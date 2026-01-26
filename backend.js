/**
 * backend.js - VERSIÓN PREMIUM FINAL (CORREGIDA)
 * Servidor Express optimizado para Render con SQLite, Registro, PayPal y Soporte IA.
 */

console.log('--- [STARTUP] Iniciando Backend Premium ---');

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

// --- MIDDLEWARES ---
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos (incluyendo assets)
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => console.error('!!! UNCAUGHT EXCEPTION:', err));
process.on('unhandledRejection', (reason) => console.error('!!! UNHANDLED REJECTION:', reason));

// --- DATABASE SETUP ---
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 Creada carpeta data:', dataDir);
    } catch (e) {
        console.error('Error creando carpeta data:', e);
    }
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error abriendo la BD:', err);
    } else {
        console.log('✅ SQLite listo en', DB_PATH);
        initializeSchema();
    }
});

function initializeSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            token TEXT UNIQUE,
            license_expires_at INTEGER DEFAULT 0,
            trial_used INTEGER DEFAULT 0,
            purchased INTEGER DEFAULT 0,
            created_at INTEGER
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY, usuario_id INTEGER, fecha INTEGER, ip TEXT, success INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS descargas (id INTEGER PRIMARY KEY, usuario_id INTEGER, fecha INTEGER, ip TEXT, variant TEXT)`);
        console.log('✅ Esquema de BD inicializado');
    });
}

// --- HELPERS ---
const nowMs = () => Date.now();
const daysToMs = (days) => days * 24 * 60 * 60 * 1000;
const generateToken = () => require('crypto').randomBytes(16).toString('hex');
const sendJson = (res, obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.json(obj); };

const getUserByToken = (token) => {
    return new Promise((resolve, reject) => {
        if (!token) return resolve(null);
        db.get('SELECT * FROM usuarios WHERE token = ?', [token], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
};

// --- ENDPOINTS ---

app.get('/health', (req, res) => sendJson(res, { status: 'ok', now: nowMs() }));

app.post('/api/registro', (req, res) => {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) return sendJson(res, { success: false, error: 'Faltan datos' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const token = generateToken();
    const licenseExpires = nowMs() + daysToMs(7);

    db.run('INSERT INTO usuarios (username, email, password_hash, token, license_expires_at, created_at) VALUES (?,?,?,?,?,?)',
        [username, email, passwordHash, token, licenseExpires, nowMs()],
        function (err) {
            if (err) {
                const field = err.message.includes('username') ? 'Usuario' : 'Email';
                return sendJson(res, { success: false, error: `${field} ya registrado` });
            }
            sendJson(res, { success: true, usuarioId: this.lastID, username, token, daysLeft: 7 });
        });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return sendJson(res, { success: false, error: 'Faltan datos' });

    db.get('SELECT * FROM usuarios WHERE username = ? OR email = ?', [username, username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return sendJson(res, { success: false, error: 'Credenciales inválidas' });
        }
        const daysLeft = Math.max(0, Math.ceil((user.license_expires_at - nowMs()) / (24 * 3600 * 1000)));
        sendJson(res, { success: true, usuarioId: user.id, username: user.username, token: user.token, daysLeft });
    });
});

app.get('/api/check-license', async (req, res) => {
    const token = req.query.token;
    const user = await getUserByToken(token);
    if (!user) return sendJson(res, { valid: false });
    const leftMs = user.license_expires_at - nowMs();
    sendJson(res, { valid: leftMs > 0, daysLeft: Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000))) });
});

app.get('/api/descargar/:usuarioId/:token/:variant/GrepoBot.user.js', async (req, res) => {
    const { usuarioId, token, variant } = req.params;
    const user = await getUserByToken(token);
    if (!user || String(user.id) !== String(usuarioId)) return res.status(403).send('Token inválido');

    let scriptFile = variant.includes('attack') ? 'bot_attack_only.user.js' : 'bot_full.user.js';
    const filePath = path.join(__dirname, 'scripts', scriptFile);

    if (!fs.existsSync(filePath)) return res.status(404).send('Script no encontrado');

    let code = fs.readFileSync(filePath, 'utf8');
    const injection = `/* LICENSE INJECTION */ const GREPOBOT_TOKEN = "${token}";\n`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="GrepoBot.user.js"');
    res.send(injection + code);
});

// Endpoint de captura de orden (PayPal Client-side flow)
app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body;
    const daysMap = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    const days = daysMap[planId] || 30;

    db.get('SELECT license_expires_at FROM usuarios WHERE id = ?', [usuarioId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const currentExpires = Math.max(nowMs(), user.license_expires_at);
        const newExpires = currentExpires + daysToMs(days);

        db.run('UPDATE usuarios SET purchased = 1, license_expires_at = ? WHERE id = ?', [newExpires, usuarioId], function (err) {
            if (err) return res.status(500).json({ error: 'Error DB' });
            sendJson(res, { success: true, message: 'Licencia renovada', daysAdded: days });
        });
    });
});

app.post('/api/support', (req, res) => {
    const q = (req.body.question || '').toLowerCase();
    let a = "No entiendo la pregunta. Prueba con 'instalar', 'pagar' o 'planner'.";
    if (q.includes('instalar')) a = "Para instalar: 1. Instala Tampermonkey. 2. Logueate. 3. Pulsa INSTALAR BOT.";
    if (q.includes('pagar')) a = "Puedes pagar con PayPal en tu panel de usuario.";
    sendJson(res, { answer: a });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR PREMIUM CORRIENDO EN PUERTO ${PORT}\n`);
