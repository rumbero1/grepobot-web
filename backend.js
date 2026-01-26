/**
 * backend.js
 * Servidor Express con:
 * - SQLite persistente en ./data/grepobot.db
 * - Registro / Login con bcrypt (token por usuario)
 * - /api/check-license, /api/descargar, /api/paypal, /api/support, /api/config, /health
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
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'grepobot.db');
const OPENAI_KEY = process.env.OPENAI_API_KEY || null;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // sirve frontend estático

// Asegurar carpeta data
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Creada carpeta data:', dataDir);
}

// Conectar DB
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error abriendo la BD:', err);
        process.exit(1);
    }
    console.log('✅ SQLite listo en', DB_PATH);
});

// Inicializar esquema
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    token TEXT UNIQUE,
    license_expires_at INTEGER DEFAULT 0,
    trial_used INTEGER DEFAULT 0,
    purchased INTEGER DEFAULT 0,
    created_at INTEGER
  )`);
});

// Helpers
function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }
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
app.post('/api/registro', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) return sendJson(res, { success: false, error: 'Faltan username o password' });
        const createdAt = nowMs();
        const passwordHash = await bcrypt.hash(password, 10);
        const token = generateToken();
        const licenseExpires = nowMs() + daysToMs(7); // trial 7 días
        db.run('INSERT INTO usuarios (username, password_hash, token, license_expires_at, trial_used, purchased, created_at) VALUES (?,?,?,?,?,?,?)',
            [username, passwordHash, token, licenseExpires, 0, 0, createdAt],
            function (err) {
                if (err) {
                    if (err.message && err.message.includes('UNIQUE')) return sendJson(res, { success: false, error: 'Usuario ya existe' });
                    console.error('DB error registro:', err);
                    return sendJson(res, { success: false, error: 'Error en BD' });
                }
                sendJson(res, {
                    success: true,
                    usuarioId: this.lastID,
                    username,
                    token,
                    daysLeft: Math.ceil((licenseExpires - nowMs()) / (24 * 3600 * 1000))
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
    if (!username || !password) return sendJson(res, { success: false, error: 'Faltan datos' });
    db.get('SELECT * FROM usuarios WHERE username = ?', [username], async (err, user) => {
        if (err) { console.error(err); return sendJson(res, { success: false, error: 'Error BD' }); }
        if (!user) return sendJson(res, { success: false, error: 'Usuario no encontrado' });
        const match = await bcrypt.compare(password, user.password_hash);
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
        const valid = leftMs > 0 && (user.purchased === 1 || user.trial_used === 0 || leftMs > 0);
        sendJson(res, { valid, daysLeft: Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000))), message: valid ? 'Licencia activa' : 'Licencia expirada' });
    } catch (e) {
        console.error(e);
        sendJson(res, { valid: false, daysLeft: 0, message: 'Error interno' });
    }
});

// Descargar script
app.get('/api/descargar', async (req, res) => {
    try {
        const { usuarioId, variant, filename } = req.query;
        const token = getTokenFromReq(req);
        if (!usuarioId || !variant) return res.status(400).json({ error: 'Faltan parametros usuarioId o variant' });
        const user = await getUserByToken(token);
        if (!user || String(user.id) !== String(usuarioId)) return res.status(403).json({ error: 'Token inválido o usuario no coincide' });

        const now = nowMs();
        const leftMs = user.license_expires_at - now;
        const isTrial = variant.includes('trial');
        const isTamper = variant.includes('tampermonkey');
        const isFull = variant.includes('full');

        if (isTrial) {
            if (leftMs <= 0) return res.status(403).json({ error: 'Trial expirado' });
            if (user.trial_used) return res.status(403).json({ error: 'Trial ya usado' });
        }
        if (isFull) {
            if (!user.purchased) return res.status(403).json({ error: 'Necesitas comprar para descargar la versión completa' });
            if (leftMs <= 0) return res.status(403).json({ error: 'Licencia expirada' });
        }

        let scriptFile = null;
        if (isFull) scriptFile = path.join(__dirname, 'scripts', 'bot_full.user.js');
        else if (variant.includes('attack')) scriptFile = path.join(__dirname, 'scripts', 'bot_attack_only.user.js');
        else scriptFile = path.join(__dirname, 'scripts', 'bot_full.user.js');

        if (!fs.existsSync(scriptFile)) return res.status(404).json({ error: 'Script no encontrado en el servidor' });

        let code = fs.readFileSync(scriptFile, 'utf8');

        if (isTamper) {
            const safeToken = token;
            const injection = `/* === INJECTION: license check === */
const GREPOBOT_USER_ID = ${JSON.stringify(user.id)};
const GREPOBOT_TOKEN = ${JSON.stringify(safeToken)};
async function __grepobot_check_license() {
  try {
    const res = await fetch('${req.protocol}://${req.get('host')}/api/check-license?token=' + encodeURIComponent(GREPOBOT_TOKEN));
    const j = await res.json();
    if (!j.valid) {
      try {
        if (typeof window !== 'undefined') {
          alert('La licencia ha expirado. Por favor renueva para seguir usando el bot.');
          const btnStart = document.getElementById('btn-iniciar');
          if (btnStart) btnStart.disabled = true;
        }
      } catch(e) { console.error('Disable error', e); }
      return false;
    }
    return true;
  } catch(e) {
    console.error('License check error', e);
    return false;
  }
}
__grepobot_check_license();
setInterval(__grepobot_check_license, 12 * 3600 * 1000);
/* === END INJECTION === */\n\n`;
            code = injection + code;
            const outFilename = sanitizeFilename(filename || path.basename(scriptFile));
            res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            if (isTrial) db.run('UPDATE usuarios SET trial_used = 1 WHERE id = ?', [user.id]);
            return res.send(code);
        } else {
            const outFilename = sanitizeFilename(filename || path.basename(scriptFile));
            res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            if (isTrial) db.run('UPDATE usuarios SET trial_used = 1 WHERE id = ?', [user.id]);
            return res.send(code);
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error interno' });
    }
});

// PayPal simulated (POST)
app.post('/api/paypal/create-order', (req, res) => sendJson(res, { id: 'TEST_' + Date.now() }));
app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body || {};
    if (!usuarioId || !planId) return sendJson(res, { success: false, error: 'Faltan parametros' });
    const diasPlan = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    const days = diasPlan[planId] || 30;
    const newExpires = nowMs() + daysToMs(days);
    db.run('UPDATE usuarios SET purchased = 1, license_expires_at = ?, trial_used = 0 WHERE id = ?', [newExpires, usuarioId], function (err) {
        if (err) { console.error(err); return sendJson(res, { success: false, error: 'Error DB' }); }
        sendJson(res, { success: true, message: 'Pago simulado completado', daysAdded: days });
    });
});

// Compat GET for PayPal (optional)
app.get('/api/paypal/create-order', (req, res) => res.json({ id: 'TEST_' + Date.now() }));
app.get('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.query || {};
    if (!usuarioId || !planId) return res.status(400).json({ success: false, error: 'Faltan usuarioId o planId (query)' });
    const diasPlan = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    const days = diasPlan[planId] || 30;
    const newExpires = Date.now() + days * 24 * 3600 * 1000;
    db.run('UPDATE usuarios SET purchased = 1, license_expires_at = ?, trial_used = 0 WHERE id = ?', [newExpires, usuarioId], function (err) {
        if (err) { console.error(err); return res.json({ success: false, error: 'Error DB' }); }
        return res.json({ success: true, message: 'Pago simulado completado', daysAdded: days });
    });
});

// Support endpoints
app.post('/api/support', async (req, res) => {
    const { question } = req.body || {};
    if (!question) return sendJson(res, { success: false, error: 'Falta pregunta' });
    if (!OPENAI_KEY) {
        const faq = [
            { q: '¿Cómo instalo Tampermonkey?', a: 'Instala Tampermonkey desde la tienda de tu navegador; luego usa la URL de descarga del panel.' },
            { q: 'El bot dejó de funcionar', a: 'Comprueba /api/check-license; si no, revisa la consola del navegador.' }
        ];
        const ans = faq.find(f => question.toLowerCase().includes(f.q.split(' ')[0].toLowerCase()));
        return sendJson(res, { success: true, answer: ans ? ans.a : 'No encontré una respuesta automática.' });
    }
    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: question }], max_tokens: 500 })
        });
        const j = await resp.json();
        const text = j?.choices?.[0]?.message?.content || 'No hay respuesta';
        return sendJson(res, { success: true, answer: text, raw: j });
    } catch (e) {
        console.error('OpenAI error', e);
        return sendJson(res, { success: false, error: 'Error al consultar IA' });
    }
});
app.get('/api/support', async (req, res) => {
    const question = req.query.question || req.query.q;
    if (!question) return res.status(400).json({ success: false, error: 'Falta pregunta (query ?question=...)' });
    try {
        const resp = await fetch(`${req.protocol}://${req.get('host')}/api/support`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const j = await resp.json();
        return res.status(resp.status).json(j);
    } catch (e) {
        console.error('Support GET->POST forward error', e);
        return res.status(500).json({ success: false, error: 'Error interno en soporte' });
    }
});

// Endpoint para exponer configuración (PayPal client id)
app.get('/api/config', (req, res) => {
    sendJson(res, {
        paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
        paypalMode: process.env.PAYPAL_MODE || 'sandbox',
        currency: process.env.CURRENCY || 'USD'
    });
});

// Servir index
app.get('/', (req, res) => {
    const idx = path.join(__dirname, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.send('GrepoBot web server');
});

app.listen(PORT, () => {
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log('\n✅ SERVIDOR LISTO');
    console.log('🌐 URL: ' + host);
    console.log('📂 DB PATH: ' + DB_PATH + '\n');
});
