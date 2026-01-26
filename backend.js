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
    if (!token) return sendJson(res, { valid: false, error: 'Token requerido' });

    const user = await getUserByToken(token);
    if (!user) return sendJson(res, { valid: false, error: 'Token inválido' });

    const leftMs = user.license_expires_at - nowMs();
    const daysLeft = Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000)));

    // Seguridad: El bot debe recibir 'valid: true' para funcionar
    sendJson(res, {
        valid: leftMs > 0,
        daysLeft,
        username: user.username,
        status: leftMs > 0 ? 'ACTIVA' : 'EXPIRADA'
    });
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
    let a = "No estoy seguro de entenderte, Comandante. Prueba preguntando por 'planner', 'autobuild', 'esquiva', 'instalación' o 'pagos'.";

    if (q.includes('hola') || q.includes('saludos')) a = "¡Saludos, Comandante! Estoy listo para ayudarte a dominar el mundo. ¿Qué necesitas saber sobre el bot?";
    if (q.includes('instalar') || q.includes('instalacion')) a = "Para instalar: 1. Instala la extensión Tampermonkey. 2. Regístrate en este portal. 3. En tu Dashboard, pulsa 'Instalar en Tampermonkey'. ¡Es automático!";
    if (q.includes('pagar') || q.includes('pago') || q.includes('comprar') || q.includes('precio')) a = "Puedes adquirir licencias de 1, 6 o 12 meses en tu Dashboard usando PayPal. Los precios son $7.99, $45 y $80 respectivamente.";
    if (q.includes('planner') || q.includes('planificador') || q.includes('ataque')) a = "El Planner captura ataques de la ventana de 'Ataques entrantes'. Debes tener esa ventana abierta para que el bot pueda ver los tiempos y enviar los refuerzos en el segundo exacto.";
    if (q.includes('ojo') || q.includes('verificar')) a = "El botón del 'Ojo' sirve para que el bot compruebe si puede ver la ventana necesaria (Senado, Cuartel, etc.). Si sale verde, ¡todo está listo!";
    if (q.includes('autobuild') || q.includes('construir')) a = "El AutoBuild gestiona tu cola de construcción. Selecciona los edificios que quieres subir y el bot los pondrá en cola cuando tengas recursos.";
    if (q.includes('esquiva') || q.includes('dodge')) a = "El modo Dodge saca tus tropas de la ciudad justo antes de un ataque y las trae de vuelta un segundo después. ¡Ideal para salvar tu ejército!";
    if (q.includes('trial') || q.includes('gratis') || q.includes('7 dias')) a = "Todos los nuevos comandantes reciben 7 días de Trial gratuito al registrarse para probar todas las funciones.";
    if (q.includes('seguro') || q.includes('ban') || q.includes('detectar')) a = "Nuestro bot usa tiempos de respuesta humanos y es indetectable por el sistema anti-bot de Grepolis. ¡Úsalo con confianza!";

    sendJson(res, { answer: a });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR PREMIUM CORRIENDO EN PUERTO ${PORT}\n`);
});

// FIN DEL ARCHIVO - VERIFICACIÓN DE CIERRE COMPLETA
