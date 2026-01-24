const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const users = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).json({ message: 'User already exists' });
    }
    users[username] = { password };
    res.status(201).json({ message: 'User registered successfully', userId: username });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.status(200).json({ message: 'Login successful', userId: username });
});

app.get('/download-bot', (req, res) => {
    const filePath = path.join(__dirname, 'bot_original.js');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Bot file not found' });
    }
    res.download(filePath, 'bot_original.js');
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
