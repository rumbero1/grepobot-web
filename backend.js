app.get('/api/config', (req, res) => {
    const config = {
        paypalClientId: process.env.PAYPAL_CLIENT_ID,
        paypalMode: process.env.PAYPAL_MODE,
        currency: process.env.CURRENCY
    };
    sendJson(res, config);
});

