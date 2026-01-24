app.post('/api/obtener-codigo-real', (req, res) => {
    const userId = req.body.userId;
    // Replace this section with the actual logic to get 'dias' for the user
    let dias = getDiasFromLicense(userId); // Implement this function according to your logic

    if (dias > 0) {
        res.sendStatus(200);
    } else {
        res.sendStatus(403);
    }
});

// Don't forget to include the logic for getDiasFromLicense function