const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const paypal = require('paypal-rest-sdk');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// MongoDB setup
mongoose.connect('mongodb://localhost/yourdbname', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// PayPal configuration
paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'YOUR_PAYPAL_CLIENT_ID',
    'client_secret': 'YOUR_PAYPAL_CLIENT_SECRET'
});

// Define a simple User model (modify as needed)
const User = mongoose.model('User', new mongoose.Schema({
    email: String,
    name: String,
    // Add additional fields as necessary
}));

// Route to create a payment
app.post('/pay', (req, res) => {
    const paymentJson = {
        // Define payment details as per PayPal APIs
        intent: 'sale',
        payer: {
            payment_method: 'paypal'
        },
        transactions: [{
            amount: {
                total: '10.00',
                currency: 'USD'
            },
            description: 'Payment description'
        }],
        redirect_urls: {
            return_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel'
        }
    };

    paypal.payment.create(paymentJson, function (error, payment) {
        if (error) {
            console.error(JSON.stringify(error));
            res.status(500).send(error);
        } else {
            res.json(payment);
        }
    });
});

// Admin panel route
app.get('/admin', (req, res) => {
    // Render your admin panel (you might use a template engine)
    res.send('Admin Panel'); // Replace with actual admin panel rendering logic
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
