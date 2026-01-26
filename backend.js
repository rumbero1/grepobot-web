/**
 * backend.js
 * Servidor Express con:
 * - SQLite persistente en ./data/grepobot_v2.db
 * - Registro / Login con bcryptjs
 * - /api/check-license, /api/descargar, /api/paypal, /api/support, /health
 */

console.log('--- [STARTUP] Iniciando Backend ---');
console.log('Node Version:', process.version);
console.log('Platform:', process.platform);
console.log('CWD:', process.cwd());

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

console.log('Config:', { PORT, DB_PATH });

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('!!! UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('!!! UNHANDLED REJECTION:', reason);
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Asegurar carpeta data
const dataDir = path.dirname(DB_PATH);
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 Creada carpeta data:', dataDir);
    }
} catch (e) {
    console.error('Error creando carpeta data:', e);
}

// Conectar DB
console.log('Intentando conectar a SQLite...');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error abriendo la BD:', err);
        process.exit(1);
    }
    console.log('✅ SQLite listo en', DB_PATH);
});

// Inicializar esquema
db.serialize(() => {
    console.log('Inicializando esquema de BD...');
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
  )`, (err) => { if (err) console.error('Error creando tabla usuarios:', err); });

    db.run(`CREATE TABLE IF NOT EXISTS logins (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER,
    fecha INTEGER,
    ip TEXT,
    success INTEGER
  )`, (err) => { if (err) console.error('Error creando tabla logins:', err); });

    db.run(`CREATE TABLE IF NOT EXISTS descargas (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER,
    fecha INTEGER,
    ip TEXT,
    variant TEXT
  )`, (err) => { if (err) console.error('Error creando tabla descargas:', err); });
});

// Helpers
function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }
function getIp(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
}
function generateToken() {
    return (typeof require('crypto').randomUUID === 'function')
        ? require('crypto').randomUUID()
        : require('crypto').randomBytes(16).toString('hex');
}
function sendJson(res, obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(obj);
}
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-\.]/gi, '_');
}
function getTokenFromReq(req) {
    const auth = req.get('authorization');
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
    if (req.query && req.query.token) return req.query.token;
    if (req.body && req.body.token) return req.body.token;
    return null;
}
function getUserByToken(token) {
    return new Promise((resolve, reject) => {
        if (!token) return resolve(null);
        db.get('SELECT * FROM usuarios WHERE token = ?', [token], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

// ENDPOINTS

app.get('/health', (req, res) => {
    sendJson(res, { status: 'ok', db: DB_PATH, now: nowMs() });
});

// Registro (POST)
app.post('/api/registro', (req, res) => {
    try {
        const { username, password, email } = req.body || {};
        if (!username || !password || !email) return sendJson(res, { success: false, error: 'Faltan username, password o email' });

        const createdAt = nowMs();
        const passwordHash = bcrypt.hashSync(password, 10);
        const token = generateToken();
        const licenseExpires = nowMs() + daysToMs(7); // trial 7 días

        db.run('INSERT INTO usuarios (username, email, password_hash, token, license_expires_at, trial_used, purchased, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [username, email, passwordHash, token, licenseExpires, 0, 0, createdAt],
            function (err) {
                if (err) {
                    if (err.message && err.message.includes('UNIQUE')) {
                        const field = err.message.includes('username') ? 'Usuario' : 'Email';
                        return sendJson(res, { success: false, error: `${field} ya registrado` });
                    }
                    console.error('DB error registro:', err);
                    return sendJson(res, { success: false, error: 'Error en BD: ' + err.message });
                }
                sendJson(res, {
                    success: true,
                    usuarioId: this.lastID,
                    username,
                    token,
                    daysLeft: 7
                });
            });
    } catch (e) {
        console.error(e);
        sendJson(res, { success: false, error: 'Error interno' });
    }
});

// Login (POST)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const ip = getIp(req);
    if (!username || !password) return sendJson(res, { success: false, error: 'Faltan datos' });

    db.get('SELECT * FROM usuarios WHERE username = ? OR email = ?', [username, username], (err, user) => {
        if (err) { console.error(err); return sendJson(res, { success: false, error: 'Error BD' }); }
        if (!user) {
            db.run('INSERT INTO logins (usuario_id, fecha, ip, success) VALUES (?,?,?,?)', [0, nowMs(), ip, 0]);
            return sendJson(res, { success: false, error: 'Usuario no encontrado' });
        }

        const match = bcrypt.compareSync(password, user.password_hash);
        db.run('INSERT INTO logins (usuario_id, fecha, ip, success) VALUES (?,?,?,?)', [user.id, nowMs(), ip, match ? 1 : 0]);

        if (!match) return sendJson(res, { success: false, error: 'Contraseña incorrecta' });

        sendJson(res, {
            success: true,
            usuarioId: user.id,
            username: user.username,
            token: user.token,
            daysLeft: Math.max(0, Math.ceil((user.license_expires_at - nowMs()) / (24 * 3600 * 1000))),
            purchased: !!user.purchased,
            trial_used: !!user.trial_used
        });
    });
});

// Check license
app.get('/api/check-license', async (req, res) => {
    try {
        const token = getTokenFromReq(req);
        const user = await getUserByToken(token);
        if (!user) return sendJson(res, { valid: false, daysLeft: 0, message: 'Usuario no encontrado o token inválido' });
        const leftMs = user.license_expires_at - nowMs();
        const valid = leftMs > 0;
        sendJson(res, { valid, daysLeft: Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000))), message: valid ? 'Licencia activa' : 'Licencia expirada' });
    } catch (e) {
        console.error(e);
        sendJson(res, { valid: false, daysLeft: 0, message: 'Error interno' });
    }
});

// Descargar script (Ruta amigable para Tampermonkey)
app.get('/api/descargar/:usuarioId/:token/:variant/GrepoBot.user.js', async (req, res) => {
    req.query = { ...req.query, ...req.params };
    return handleDownload(req, res);
});

// Descargar script (Ruta genérica)
app.get('/api/descargar', async (req, res) => {
    return handleDownload(req, res);
});

async function handleDownload(req, res) {
    try {
        const { usuarioId, variant, filename, token: queryToken } = req.query;
        const token = queryToken || getTokenFromReq(req);
        const ip = getIp(req);

        if (!usuarioId || !variant) return res.status(400).json({ error: 'Faltan parametros usuarioId o variant' });

        const user = await getUserByToken(token);
        if (!user || String(user.id) !== String(usuarioId)) return res.status(403).json({ error: 'Token inválido o usuario no coincide' });

        const now = nowMs();
        const leftMs = user.license_expires_at - now;

        if (leftMs <= 0) return res.status(403).json({ error: 'Licencia expirada. Por favor renueva.' });

        // Registrar descarga
        db.run('INSERT INTO descargas (usuario_id, fecha, ip, variant) VALUES (?,?,?,?)', [user.id, now, ip, variant]);

        let scriptFile = null;
        if (variant.includes('attack')) scriptFile = path.join(__dirname, 'scripts', 'bot_attack_only.user.js');
        else scriptFile = path.join(__dirname, 'scripts', 'bot_full.user.js');

        if (!fs.existsSync(scriptFile)) return res.status(404).json({ error: 'Script no encontrado en el servidor' });

        let code = fs.readFileSync(scriptFile, 'utf8');

        // Inyección de licencia
        const injection = `/* === INJECTION: license check === */
const GREPOBOT_USER_ID = ${JSON.stringify(user.id)};
const GREPOBOT_TOKEN = ${JSON.stringify(token)};
async function __grepobot_check_license() {
  try {
    const res = await fetch('${req.protocol}://${req.get('host')}/api/check-license?token=' + encodeURIComponent(GREPOBOT_TOKEN));
    const j = await res.json();
    if (!j.valid) {
      alert('La licencia ha expirado. Por favor renueva en grepobot-web.onrender.com');
      const btnStart = document.getElementById('btn-iniciar');
      if (btnStart) btnStart.disabled = true;
      return false;
    }
    return true;
  } catch(e) { return false; }
}
__grepobot_check_license();
setInterval(__grepobot_check_license, 4 * 3600 * 1000);
/* === END INJECTION === */\n\n`;

        code = injection + code;
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename || 'GrepoBot.user.js')}"`);
        return res.send(code);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error interno' });
    }
}

// Admin Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = {};
        const now = nowMs();
        const last24h = now - daysToMs(1);

        stats.totalUsuarios = await new Promise(r => db.get('SELECT COUNT(*) as count FROM usuarios', (e, row) => r(row.count)));
        stats.totalDescargas = await new Promise(r => db.get('SELECT COUNT(*) as count FROM descargas', (e, row) => r(row.count)));
        stats.licenciasActivas = await new Promise(r => db.get('SELECT COUNT(*) as count FROM usuarios WHERE license_expires_at > ?', [now], (e, row) => r(row.count)));
        stats.logins24h = await new Promise(r => db.get('SELECT COUNT(*) as count FROM logins WHERE fecha > ? AND success = 1', [last24h], (e, row) => r(row.count)));

        stats.logins = await new Promise(r => db.all(`SELECT l.*, u.username FROM logins l LEFT JOIN usuarios u ON l.usuario_id = u.id ORDER BY l.fecha DESC LIMIT 10`, (e, rows) => r(rows || [])));
        stats.descargas = await new Promise(r => db.all(`SELECT d.*, u.username FROM descargas d JOIN usuarios u ON d.usuario_id = u.id ORDER BY d.fecha DESC LIMIT 10`, (e, rows) => r(rows || [])));
        stats.usuarios = await new Promise(r => db.all(`SELECT username, email, created_at, license_expires_at FROM usuarios ORDER BY created_at DESC`, (e, rows) => r(rows || [])));

        sendJson(res, stats);
    } catch (e) {
        res.status(500).json({ error: 'Error cargando stats' });
    }
});

// PayPal
app.post('/api/paypal/create-order', (req, res) => {
    const { planId } = req.body;
    const prices = { '1_MES': '7.99', '6_MESES': '45.00', '12_MESES': '80.00' };
    const price = prices[planId] || '7.99';
    sendJson(res, { id: 'ORDER-' + Date.now(), price });
});

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

// Support AI
app.post('/api/support', (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Falta pregunta' });

    const q = question.toLowerCase();
    let answer = "No estoy seguro de cómo ayudarte con eso. Prueba preguntando sobre 'instalar', 'pagar' o 'planner'.";

    if (q.includes('instalar') || q.includes('tampermonkey')) {
        answer = "Para instalar: 1. Instala Tampermonkey. 2. Inicia sesión en nuestro portal. 3. Pulsa 'INSTALAR BOT'. 4. Acepta la instalación en la pestaña que se abre.";
    } else if (q.includes('pagar') || q.includes('paypal') || q.includes('precio')) {
        answer = "Puedes pagar con PayPal desde tu panel de usuario. Tenemos planes de 1 mes ($7.99), 6 meses ($45) y 1 año ($80).";
    } else if (q.includes('planner') || q.includes('atacar')) {
        answer = "El Planner te permite ajustar ataques al segundo. Abre la ventana de ataque, captura el comando y ajusta el tiempo de llegada.";
    } else if (q.includes('niveles') || q.includes('edificios')) {
        answer = "En la pestaña BUILD puedes poner el nivel máximo para cada edificio. El bot dejará de construir cuando llegue a ese nivel.";
    }

    sendJson(res, { success: true, answer });
});

// Servir index
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

console.log('Intentando iniciar servidor en puerto', PORT, '...');
app.listen(PORT, () => {
    console.log(`\n✅ SERVIDOR LISTO EN PUERTO ${PORT}\n`);
}).on('error', (err) => {
    console.error('❌ Error al iniciar servidor:', err);
});

console.log('--- [STARTUP] Fin del script principal ---');
