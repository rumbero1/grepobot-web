/**
 * backend.js - VERSIÓN PREMIUM FINAL (CORREGIDA)
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'grepobot_v2.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); }

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (!err) { initializeSchema(); }
});

function initializeSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT, token TEXT UNIQUE, license_expires_at INTEGER DEFAULT 0, created_at INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY, usuario_id INTEGER, fecha INTEGER, ip TEXT, success INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS descargas (id INTEGER PRIMARY KEY, usuario_id INTEGER, fecha INTEGER, ip TEXT, variant TEXT)`);
    });
}

const nowMs = () => Date.now();
const daysToMs = (days) => days * 24 * 60 * 60 * 1000;
const generateToken = () => require('crypto').randomBytes(16).toString('hex');
const sendJson = (res, obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.json(obj); };

app.get('/health', (req, res) => sendJson(res, { status: 'ok' }));

app.post('/api/registro', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return sendJson(res, { success: false, error: 'Faltan datos' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const token = generateToken();
    const licenseExpires = nowMs() + daysToMs(7);
    db.run('INSERT INTO usuarios (username, email, password_hash, token, license_expires_at, created_at) VALUES (?,?,?,?,?,?)',
        [username, email, passwordHash, token, licenseExpires, nowMs()],
        function (err) {
            if (err) return sendJson(res, { success: false, error: 'Usuario o Email ya registrado' });
            sendJson(res, { success: true, usuarioId: this.lastID, username, token, daysLeft: 7 });
        });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE username = ? OR email = ?', [username, username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password_hash)) return sendJson(res, { success: false, error: 'Credenciales inválidas' });
        const daysLeft = Math.max(0, Math.ceil((user.license_expires_at - nowMs()) / (24 * 3600 * 1000)));
        sendJson(res, { success: true, usuarioId: user.id, username: user.username, token: user.token, daysLeft });
    });
});

app.get('/api/descargar/:usuarioId/:token/:variant/GrepoBot.user.js', (req, res) => {
    const { token } = req.params;
    const filePath = path.join(__dirname, 'scripts', 'bot_full.user.js');
    if (!fs.existsSync(filePath)) return res.status(404).send('Script no encontrado');
    let code = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`/* LICENSE */ const GREPOBOT_TOKEN = "${token}";\n` + code);
});

app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body;
    const days = planId === '12_MESES' ? 365 : (planId === '6_MESES' ? 180 : 30);
    db.get('SELECT license_expires_at FROM usuarios WHERE id = ?', [usuarioId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'Error' });
        const newExpires = Math.max(nowMs(), user.license_expires_at) + daysToMs(days);
        db.run('UPDATE usuarios SET license_expires_at = ? WHERE id = ?', [newExpires, usuarioId], () => {
            sendJson(res, { success: true });
        });
    });
});

app.post('/api/support', (req, res) => {
    sendJson(res, { answer: "Para instalar: 1. Instala Tampermonkey. 2. Logueate. 3. Pulsa INSTALAR BOT." });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => { console.log('🚀 Servidor listo'); });

// --- FIN DEL ARCHIVO ---
