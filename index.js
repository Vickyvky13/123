const express = require('express');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());

const PRIVATE_KEY = fs.readFileSync('/app/private.pem', 'utf8');

function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encrypted_aes_key, 'base64')
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const initialVectorBuffer = Buffer.from(initial_vector, 'base64');

  const TAG_LENGTH = 16;
  const encryptedData = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    'aes-128-gcm',
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(authTag);

  const decrypted =
    decipher.update(encryptedData, undefined, 'utf8') + decipher.final('utf8');

  return {
    decryptedBody: JSON.parse(decrypted),
    aesKey: decryptedAesKey,
    initialVector: initialVectorBuffer,
  };
}

function encryptResponse(response, aesKey, initialVector) {
  const flippedIV = Buffer.alloc(initialVector.length);
  for (let i = 0; i < initialVector.length; i++) {
    flippedIV[i] = ~initialVector[i];
  }

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIV);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted.toString('base64');
}

app.get('/', (req, res) => {
  res.send('WhatsApp Flow Server Running');
});

app.post('/', (req, res) => {
  try {
    const { decryptedBody, aesKey, initialVector } = decryptRequest(req.body);

    console.log('Decrypted:', JSON.stringify(decryptedBody, null, 2));

    // Health check ping from Meta
    if (decryptedBody.action === 'ping') {
      const response = encryptResponse(
        { version: '3.0', data: { status: 'active' } },
        aesKey,
        initialVector
      );
      return res.send(response);
    }

    // Normal flow response
    const response = encryptResponse(
      { version: '3.0', screen: 'SUCCESS', data: {} },
      aesKey,
      initialVector
    );

    res.send(response);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).send('Error processing request');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
