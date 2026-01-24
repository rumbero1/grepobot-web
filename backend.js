const fs = require('fs');

// Load the complete bot code from bot_original.js file
const botCode = fs.readFileSync('bot_original.js', 'utf8');

// Serve the botCode when downloading
app.get('/download-bot', (req, res) => {
    res.setHeader('Content-disposition', 'attachment; filename=bot.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(botCode);
});