// Full backend content restored here

const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());

// PayPal client ID and config exposed at /api/config
app.get('/api/config', (req, res) => {
    res.send({
        clientId: process.env.PAYPAL_CLIENT_ID
    });
});

// Other routes and middleware configurations here...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
