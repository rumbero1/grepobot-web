/**
 * backend.js - VERSIÓN PREMIUM FINAL (CORREGIDA - MULTI DB)
 * Servidor Express optimizado para Render con soporte Híbrido (SQLite/PostgreSQL).
 */

console.log('--- [STARTUP] Iniciando Backend Premium ---');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'grepobot_v2.db');
const DATABASE_URL = process.env.DATABASE_URL; // Si existe, usa Postgres

// --- MIDDLEWARES ---
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos (incluyendo assets)
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => console.error('!!! UNCAUGHT EXCEPTION:', err));
process.on('unhandledRejection', (reason) => console.error('!!! UNHANDLED REJECTION:', reason));

// --- DATABASE ADAPTER ---
class DatabaseAdapter {
    constructor() {
        this.type = DATABASE_URL ? 'postgres' : 'sqlite';
        this.client = null;
    }

    async connect() {
        if (this.type === 'postgres') {
            console.log('🐘 Conectando a PostgreSQL...');
            this.client = new Pool({
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            // Test connection
            try {
                const res = await this.client.query('SELECT NOW()');
                console.log('✅ PostgreSQL conectado:', res.rows[0].now);
                await this.initializeSchema();
            } catch (err) {
                console.error('❌ Error conectando a Postgres:', err);
                process.exit(1);
            }
        } else {
            console.log('💾 Usando SQLite local...');
            const dataDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            this.client = new sqlite3.Database(DB_PATH, (err) => {
                if (err) console.error('❌ Error abriendo SQLite:', err);
                else {
                    console.log('✅ SQLite listo en', DB_PATH);
                    this.initializeSchema();
                }
            });
        }
    }

    async run(sql, params = []) {
        if (this.type === 'postgres') {
            // Convert ? to $1, $2, etc.
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);

            // Special handling for INSERT RETURNING ID
            if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
                const res = await this.client.query(pgSql + ' RETURNING id', params);
                return { lastID: res.rows[0]?.id };
            } else {
                await this.client.query(pgSql, params);
                return {};
            }
        } else {
            return new Promise((resolve, reject) => {
                this.client.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        }
    }

    async get(sql, params = []) {
        if (this.type === 'postgres') {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await this.client.query(pgSql, params);
            return res.rows[0];
        } else {
            return new Promise((resolve, reject) => {
                this.client.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
    }

    async all(sql, params = []) {
        if (this.type === 'postgres') {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await this.client.query(pgSql, params);
            return res.rows;
        } else {
            return new Promise((resolve, reject) => {
                this.client.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }

    async initializeSchema() {
        const idType = this.type === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY';
        const tables = [
            `CREATE TABLE IF NOT EXISTS usuarios (
                id ${idType},
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT,
                token TEXT UNIQUE,
                license_expires_at BIGINT DEFAULT 0,
                trial_used INTEGER DEFAULT 0,
                purchased INTEGER DEFAULT 0,
                created_at BIGINT
            )`,
            `CREATE TABLE IF NOT EXISTS logins (id ${idType}, usuario_id INTEGER, fecha BIGINT, ip TEXT, success INTEGER)`,
            `CREATE TABLE IF NOT EXISTS descargas (id ${idType}, usuario_id INTEGER, fecha BIGINT, ip TEXT, variant TEXT)`,
            `CREATE TABLE IF NOT EXISTS visitas (id ${idType}, fecha BIGINT, ip TEXT, user_agent TEXT, referrer TEXT)`,
            `CREATE TABLE IF NOT EXISTS actividad (id ${idType}, usuario_id INTEGER, fecha BIGINT, accion TEXT, detalles TEXT)`
        ];

        for (const sql of tables) {
            await this.run(sql);
        }
        console.log('✅ Esquema de BD verificado/inicializado');
    }
}

const db = new DatabaseAdapter();
db.connect();

// --- HELPERS ---
const nowMs = () => Date.now();
const daysToMs = (days) => days * 24 * 60 * 60 * 1000;
const generateToken = () => require('crypto').randomBytes(16).toString('hex');
const sendJson = (res, obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.json(obj); };

const getUserByToken = async (token) => {
    if (!token) return null;
    return await db.get('SELECT * FROM usuarios WHERE token = ?', [token]);
};

// --- ENDPOINTS ---

app.get('/health', (req, res) => sendJson(res, { status: 'ok', now: nowMs(), db: db.type }));

app.post('/api/registro', async (req, res) => {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) return sendJson(res, { success: false, error: 'Faltan datos' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const token = generateToken();
    const licenseExpires = nowMs() + daysToMs(7);

    try {
        // En Postgres 'returning id' se maneja dentro de db.run
        const result = await db.run(
            'INSERT INTO usuarios (username, email, password_hash, token, license_expires_at, created_at) VALUES (?,?,?,?,?,?)',
            [username, email, passwordHash, token, licenseExpires, nowMs()]
        );
        sendJson(res, { success: true, usuarioId: result.lastID, username, token, daysLeft: 7 });
    } catch (err) {
        const msg = err.message || '';
        const field = msg.includes('username') ? 'Usuario' : 'Email';
        sendJson(res, { success: false, error: `${field} ya registrado` });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return sendJson(res, { success: false, error: 'Faltan datos' });

    const user = await db.get('SELECT * FROM usuarios WHERE username = ? OR email = ?', [username, username]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return sendJson(res, { success: false, error: 'Credenciales inválidas' });
    }

    // Casting seguro para fechas (BIGINT puede venir como string en Postgres)
    const expires = Number(user.license_expires_at);
    const userId = Number(user.id);

    const daysLeft = Math.max(0, Math.ceil((expires - nowMs()) / (24 * 3600 * 1000)));

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.run('INSERT INTO logins (usuario_id, fecha, ip, success) VALUES (?,?,?,?)', [userId, nowMs(), ip, 1]);

    sendJson(res, { success: true, usuarioId: userId, username: user.username, token: user.token, daysLeft });
});

app.get('/api/check-license', async (req, res) => {
    const token = req.query.token;
    if (!token) return sendJson(res, { valid: false, error: 'Token requerido', reason: 'NO_TOKEN' });

    const user = await getUserByToken(token);
    if (!user) return sendJson(res, { valid: false, error: 'Token inválido', reason: 'INVALID_TOKEN' });

    const expires = Number(user.license_expires_at);
    const leftMs = expires - nowMs();
    const daysLeft = Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000)));

    sendJson(res, {
        valid: leftMs > 0,
        daysLeft,
        username: user.username,
        status: leftMs > 0 ? 'ACTIVA' : 'EXPIRADA',
        reason: leftMs > 0 ? 'ACTIVE' : 'EXPIRED'
    });
});

app.post('/api/validate-download', async (req, res) => {
    const { token, email } = req.body;
    if (!token || !email) return sendJson(res, { success: false, error: 'Datos incompletos' });

    const user = await getUserByToken(token);
    if (!user) return sendJson(res, { success: false, error: 'Token inválido' });

    if (user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return sendJson(res, { success: false, error: 'El correo no coincide con tu cuenta.' });
    }

    sendJson(res, { success: true });
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

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.run('INSERT INTO descargas (usuario_id, fecha, ip, variant) VALUES (?,?,?,?)', [user.id, nowMs(), ip, variant]);

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="GrepoBot.user.js"');
    res.send(injection + code);
});

// Endpoint de captura de orden (PayPal Client-side flow)
app.post('/api/paypal/capture-order', async (req, res) => {
    const { usuarioId, planId } = req.body;
    const daysMap = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    const days = daysMap[planId] || 30;

    const user = await db.get('SELECT license_expires_at FROM usuarios WHERE id = ?', [usuarioId]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const currentExpires = Math.max(nowMs(), Number(user.license_expires_at));
    const newExpires = currentExpires + daysToMs(days);

    await db.run('UPDATE usuarios SET purchased = 1, license_expires_at = ? WHERE id = ?', [newExpires, usuarioId]);
    sendJson(res, { success: true, message: 'Licencia renovada', daysAdded: days });
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

// --- NUEVOS ENDPOINTS DE MONITOREO ---

app.post('/api/log-visit', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.body.referrer || '';
    await db.run('INSERT INTO visitas (fecha, ip, user_agent, referrer) VALUES (?,?,?,?)', [nowMs(), ip, userAgent, referrer]);
    res.sendStatus(204);
});

app.post('/api/log-action', async (req, res) => {
    const { token, accion, detalles } = req.body;
    const user = await getUserByToken(token);
    const userId = user ? user.id : null;
    await db.run('INSERT INTO actividad (usuario_id, fecha, accion, detalles) VALUES (?,?,?,?)', [userId, nowMs(), accion, detalles]);
    res.sendStatus(204);
});

app.get('/api/admin/stats', async (req, res) => {
    // Si no es admin real, podría protegerse mejor.
    const stats = {};

    // Queries seguras para PG y SQLite
    // En PG 'license_expires_at > ?' funciona bien.

    try {
        const qUsers = await db.all('SELECT COUNT(*) as count FROM usuarios');
        stats.totalUsuarios = qUsers[0].count;

        const qDownloads = await db.all('SELECT COUNT(*) as count FROM descargas');
        stats.totalDescargas = qDownloads[0].count;

        const qActive = await db.all('SELECT COUNT(*) as count FROM usuarios WHERE license_expires_at > ?', [nowMs()]);
        stats.licenciasActivas = qActive[0].count;

        const qLogins24 = await db.all('SELECT COUNT(*) as count FROM logins WHERE fecha > ?', [nowMs() - daysToMs(1)]);
        stats.logins24h = qLogins24[0].count;

        // Para joins, SQLite y PG difieren ligeramente a veces, pero los JOINs simples son standard.
        // Cuidado con la ambigüedad de 'id'.

        const qLogins = await db.all('SELECT l.*, u.username FROM logins l JOIN usuarios u ON l.usuario_id = u.id ORDER BY l.fecha DESC LIMIT 20');
        stats.logins = qLogins;

        const qDescargas = await db.all('SELECT d.*, u.username, u.license_expires_at FROM descargas d JOIN usuarios u ON d.usuario_id = u.id ORDER BY d.fecha DESC LIMIT 20');
        stats.descargas = qDescargas.map(r => ({
            ...r,
            diasRestantes: Math.max(0, Math.ceil((Number(r.license_expires_at) - nowMs()) / (24 * 3600 * 1000)))
        }));

        const qUsuarios = await db.all('SELECT id, username, created_at, license_expires_at FROM usuarios ORDER BY created_at DESC');
        stats.usuarios = qUsuarios.map(r => ({
            ...r,
            diasRestantes: Math.max(0, Math.ceil((Number(r.license_expires_at) - nowMs()) / (24 * 3600 * 1000)))
        }));

        stats.actividad = await db.all('SELECT a.*, u.username FROM actividad a LEFT JOIN usuarios u ON a.usuario_id = u.id ORDER BY a.fecha DESC LIMIT 50');
        stats.visitas = await db.all('SELECT * FROM visitas ORDER BY fecha DESC LIMIT 50');

        sendJson(res, stats);
    } catch (e) {
        console.error("Error stats:", e);
        sendJson(res, { error: 'Error obteniendo stats' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR PREMIUM CORRIENDO EN PUERTO ${PORT}\n`);
    console.log(`   MODO DB: ${db.type.toUpperCase()}`);
});

// FIN
