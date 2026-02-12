/**
 * backend.js - VERSIÓN PREMIUM FINAL (MULTI DB)
 */
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
const DATABASE_URL = process.env.DATABASE_URL;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

class DatabaseAdapter {
    constructor() {
        this.type = DATABASE_URL ? 'postgres' : 'sqlite';
        this.client = null;
    }
    async connect() {
        if (this.type === 'postgres') {
            this.client = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
            await this.initializeSchema();
        } else {
            const dataDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            this.client = new sqlite3.Database(DB_PATH, () => this.initializeSchema());
        }
    }
    async run(sql, params = []) {
        if (this.type === 'postgres') {
            let i = 1; const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
                const res = await this.client.query(pgSql + ' RETURNING id', params);
                return { lastID: res.rows[0]?.id };
            }
            await this.client.query(pgSql, params); return {};
        } else {
            return new Promise((res, rej) => {
                this.client.run(sql, params, function(err) { if (err) rej(err); else res({ lastID: this.lastID }); });
            });
        }
    }
    async get(sql, params = []) {
        if (this.type === 'postgres') {
            let i = 1; const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await this.client.query(pgSql, params); return res.rows[0];
        } else {
            return new Promise((res, rej) => { this.client.get(sql, params, (err, row) => err ? rej(err) : res(row)); });
        }
    }
    async all(sql, params = []) {
        if (this.type === 'postgres') {
            let i = 1; const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await this.client.query(pgSql, params); return res.rows;
        } else {
            return new Promise((res, rej) => { this.client.all(sql, params, (err, rows) => err ? rej(err) : res(rows)); });
        }
    }
    async initializeSchema() {
        const idType = this.type === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY';
        const tables = [
            `CREATE TABLE IF NOT EXISTS usuarios (id ${idType}, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT, token TEXT UNIQUE, license_expires_at BIGINT DEFAULT 0, created_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS logins (id ${idType}, usuario_id INTEGER, fecha BIGINT, ip TEXT, success INTEGER)`,
            `CREATE TABLE IF NOT EXISTS descargas (id ${idType}, usuario_id INTEGER, fecha BIGINT, ip TEXT, variant TEXT)`,
            `CREATE TABLE IF NOT EXISTS visitas (id ${idType}, fecha BIGINT, ip TEXT, user_agent TEXT, referrer TEXT)`,
            `CREATE TABLE IF NOT EXISTS actividad (id ${idType}, usuario_id INTEGER, fecha BIGINT, accion TEXT, detalles TEXT)`
        ];
        for (const sql of tables) await this.run(sql);
    }
}

const db = new DatabaseAdapter();
db.connect();

// Endpoints principales
app.post('/api/registro', async (req, res) => {
    const { username, password, email } = req.body;
    const token = require('crypto').randomBytes(16).toString('hex');
    const licenseExpires = Date.now() + (7 * 24 * 60 * 60 * 1000);
    try {
        const result = await db.run('INSERT INTO usuarios (username, email, password_hash, token, license_expires_at, created_at) VALUES (?,?,?,?,?,?)', 
        [username, email, bcrypt.hashSync(password, 10), token, licenseExpires, Date.now()]);
        res.json({ success: true, token, daysLeft: 7 });
    } catch (e) { res.json({ success: false, error: 'Usuario ya existe' }); }
});

app.get('/api/check-license', async (req, res) => {
    const user = await db.get('SELECT * FROM usuarios WHERE token = ?', [req.query.token]);
    if (!user) return res.json({ valid: false });
    const left = Number(user.license_expires_at) - Date.now();
    res.json({ valid: left > 0, daysLeft: Math.max(0, Math.ceil(left / 86400000)) });
});

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT} (${db.type})`));
