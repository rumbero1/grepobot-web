const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        diasLicencia INTEGER DEFAULT 0,
        yaDescargo BOOLEAN DEFAULT 0
    )`);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, user) => {
        if(err) return res.json({ success: false, error: 'Error en BD' });
        if(!user) return res.json({ success: false, error: 'Usuario no encontrado' });
        if(user.password !== password) return res.json({ success: false, error: 'Contraseña incorrecta' });
        res.json({
            success: true,
            usuarioId: user.id,
            username: user.username,
            dias: user.diasLicencia,
            yaDescargo: user.yaDescargo === 1
        });
    });
});

app.post('/api/registro', (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.json({ success: false, error: 'Faltan datos' });
    db.run('INSERT INTO usuarios (username, password, diasLicencia) VALUES (?, ?, ?)', 
        [username, password, 7], 
        function(err) {
            if(err) return res.json({ success: false, error: 'Usuario ya existe' });
            res.json({
                success: true,
                usuarioId: this.lastID,
                username: username,
                dias: 7,
                yaDescargo: false
            });
        }
    );
});
app.get('/api/descargar/:usuarioId/:filename', (req, res) => {
    const { usuarioId, filename } = req.params;
    const fs = require('fs');
    
    db.get('SELECT * FROM usuarios WHERE id = ?', [usuarioId], (err, user) => {
        if(err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if(user.yaDescargo) return res.status(403).json({ error: 'Ya descargaste el bot' });
        
        try {
            const botCode = fs.readFileSync(path.join(__dirname, 'bot_original.js'), 'utf-8');
            db.run('UPDATE usuarios SET yaDescargo = 1 WHERE id = ?', [usuarioId]);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/x-javascript; charset=utf-8');
            res.send(botCode);
        } catch(e) {
            res.status(500).json({ error: 'Error leyendo bot' });
        }
    });
});


app.post('/api/paypal/create-order', (req, res) => {
    res.json({ id: 'TEST_' + Date.now() });
});

app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body;
    const diasPlan = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    db.run('UPDATE usuarios SET diasLicencia = ?, yaDescargo = 0 WHERE id = ?', [diasPlan[planId] || 30, usuarioId], function(err) {
        if(err) return res.json({ success: false, error: 'Error' });
        res.json({ success: true, message: 'Pago completado' });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('\n✅ SERVIDOR LISTO en puerto 10000');
    console.log('🌐 URL: http://localhost:10000\n');

});

