const express = require('express');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('WhatsApp Flow Server Running');
});

app.post('/', (req, res) => {
  console.log(req.body);

  res.json({
    version: "3.0",
    screen: "SUCCESS",
    data: {}
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
