const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('./grepobot.db');

// Crear tablas con columna de logging
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY, 
    username TEXT UNIQUE, 
    password TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS licencias (
    id INTEGER PRIMARY KEY, 
    usuario_id INTEGER, 
    dias_licencia INTEGER DEFAULT 7, 
    fecha_expiracion DATETIME, 
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS descargas (
    id INTEGER PRIMARY KEY, 
    usuario_id INTEGER, 
    fecha_descarga DATETIME DEFAULT CURRENT_TIMESTAMP, 
    ip TEXT,
    user_agent TEXT,
    UNIQUE(usuario_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logins_log (
    id INTEGER PRIMARY KEY, 
    usuario_id INTEGER, 
    username TEXT,
    fecha LOGIN DATETIME DEFAULT CURRENT_TIMESTAMP, 
    ip TEXT,
    success BOOLEAN DEFAULT 1
  )`);
});

// === REGISTRO ===
app.post('/api/registro', (req, res) => {
  const { username, password } = req.body;
  db.run("INSERT INTO usuarios (username, password) VALUES (?, ?)", [username, password], function(err) {
    if (err) return res.json({ success: false, error: 'Usuario ya existe' });
    
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    db.run("INSERT INTO licencias (usuario_id, dias_licencia, fecha_expiracion) VALUES (?, 7, ?)", [this.lastID, expiracion.toISOString()]);
    
    console.log(`✅ REGISTRO: ${username} (ID: ${this.lastID})`);
    res.json({ success: true, usuarioId: this.lastID, username, dias: 7 });
  });
});

// === LOGIN (CON LOGGING) ===
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  db.get("SELECT u.id, l.dias_licencia, l.fecha_expiracion FROM usuarios u JOIN licencias l ON u.id = l.usuario_id WHERE u.username = ? AND u.password = ?", [username, password], (err, row) => {
    if (!row) {
      // Log de LOGIN FALLIDO
      console.log(`❌ LOGIN FALLIDO: ${username} desde IP ${ip}`);
      db.run("INSERT INTO logins_log (username, fecha, ip, success) VALUES (?, datetime('now'), ?, 0)", [username, ip]);
      return res.json({ success: false });
    }
    
    const ahora = new Date();
    const expiracion = new Date(row.fecha_expiracion);
    const diasRestantes = Math.ceil((expiracion - ahora) / (1000 * 60 * 60 * 24));
    
    // Log de LOGIN EXITOSO
    console.log(`✅ LOGIN: ${username} (ID: ${row.id}) desde IP ${ip}`);
    db.run("INSERT INTO logins_log (usuario_id, username, fecha, ip, success) VALUES (?, ?, datetime('now'), ?, 1)", [row.id, username, ip]);
    
    db.get("SELECT fecha_descarga FROM descargas WHERE usuario_id = ?", [row.id], (err, descarga) => {
      res.json({ 
        success: true, 
        usuarioId: row.id, 
        username, 
        dias: Math.max(0, diasRestantes),
        yaDescargo: !!descarga
      });
    });
  });
});

// === DESCARGA DEL BOT (CON LOGGING) ===
app.get('/api/descargar/:usuarioId/:nombreArchivo', (req, res) => {
  const { usuarioId, nombreArchivo } = req.params;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Verificar licencia
  db.get("SELECT u.username, l.fecha_expiracion FROM usuarios u JOIN licencias l ON u.id = l.usuario_id WHERE u.id = ?", [usuarioId], (err, row) => {
    if (!row) {
      console.log(`❌ DESCARGA RECHAZADA: Usuario ID ${usuarioId} no encontrado`);
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const ahora = new Date();
    const expiracion = new Date(row.fecha_expiracion);
    
    if (expiracion < ahora) {
      console.log(`❌ DESCARGA RECHAZADA: ${row.username} (Licencia caducada)`);
      return res.status(401).json({ error: 'Licencia caducada' });
    }

    // Registrar descarga
    db.run("INSERT INTO descargas (usuario_id, ip, user_agent) VALUES (?, ?, ?) ON CONFLICT(usuario_id) DO UPDATE SET fecha_descarga = datetime('now')", 
      [usuarioId, ip, userAgent], 
      (err) => {
        console.log(`⬇️ DESCARGA: ${row.username} (ID: ${usuarioId}) desde IP ${ip}`);
        
        // Crear el script en memoria y enviar
        const scriptContent = `// ==UserScript==
// @name Bot Grepolis V11.80 - Usuario: ${row.username}
// @namespace http://tampermonkey.net/
// @version 11.80.1
// @description Bot Grepolis personalizado
// @author TuNombre
// @match https://*.grepolis.com/game/*
// @grant none
// @run-at document-idle
// ==/UserScript==
// CONTENIDO DEL BOT AQUÍ...
// Este es un archivo de demostración
console.log('Bot cargado para ${row.username}');
`;
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.send(scriptContent);
      }
    );
  });
});

// === PAYPAL: Crear orden ===
app.post('/api/paypal/create-order', (req, res) => {
  const { planId } = req.body;
  const precios = { '1_MES': 7.99, '6_MESES': 45.00, '12_MESES': 80.00 };
  res.json({ id: "ORDER_" + Date.now(), monto: precios[planId] || 7.99 });
});

// === PAYPAL: Capturar orden (completar pago) ===
app.post('/api/paypal/capture-order', (req, res) => {
  const { usuarioId, planId, orderID } = req.body;
  let dias = planId === '12_MESES' ? 365 : (planId === '6_MESES' ? 180 : 30);
  
  const ahora = new Date();
  const nuevaExpiracion = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
  
  db.run("UPDATE licencias SET fecha_expiracion = ?, dias_licencia = ? WHERE usuario_id = ?", 
    [nuevaExpiracion.toISOString(), dias, usuarioId], 
    (err) => {
      if (err) {
        console.log(`❌ PAGO FALLIDO: ${usuarioId}`);
        return res.json({ success: false, error: 'Error procesando pago' });
      }
      console.log(`💰 PAGO EXITOSO: Usuario ${usuarioId} - Plan ${planId} - Order ${orderID}`);
      res.json({ success: true, nuevosDias: dias });
    }
  );
});

// === ADMIN: ESTADÍSTICAS ===
app.get('/api/admin/stats', (req, res) => {
  const stats = {
    totalUsuarios: 0,
    totalDescargas: 0,
    licenciasActivas: 0,
    logins24h: 0,
    ingresos: 0,
    logins: [],
    descargas: [],
    usuarios: []
  };

  // Total usuarios
  db.get("SELECT COUNT(*) as count FROM usuarios", (err, row) => {
    stats.totalUsuarios = row?.count || 0;
  });

  // Total descargas
  db.get("SELECT COUNT(*) as count FROM descargas", (err, row) => {
    stats.totalDescargas = row?.count || 0;
  });

  // Licencias activas
  db.get("SELECT COUNT(*) as count FROM licencias WHERE fecha_expiracion > datetime('now')", (err, row) => {
    stats.licenciasActivas = row?.count || 0;
  });

  // Logins en últimas 24h
  db.get("SELECT COUNT(*) as count FROM logins_log WHERE fecha > datetime('now', '-1 day') AND success = 1", (err, row) => {
    stats.logins24h = row?.count || 0;
  });

  // Últimos logins
  db.all(`SELECT username, fecha, ip, success FROM logins_log ORDER BY fecha DESC LIMIT 15`, (err, rows) => {
    stats.logins = rows || [];
  });

  // Descargas recientes
  db.all(`SELECT u.username, d.fecha_descarga, d.ip,
                 CAST((julianday(l.fecha_expiracion) - julianday('now')) AS INTEGER) as diasRestantes
          FROM descargas d
          JOIN usuarios u ON d.usuario_id = u.id
          JOIN licencias l ON u.id = l.usuario_id
          ORDER BY d.fecha_descarga DESC LIMIT 15`, (err, rows) => {
    stats.descargas = rows || [];
  });

  // Todos los usuarios
  db.all(`SELECT u.username, l.fecha_registro, l.fecha_expiracion,
                 CAST((julianday(l.fecha_expiracion) - julianday('now')) AS INTEGER) as diasRestantes,
                 CASE WHEN d.usuario_id IS NOT NULL THEN 1 ELSE 0 END as yaDescargo
          FROM usuarios u
          JOIN licencias l ON u.id = l.usuario_id
          LEFT JOIN descargas d ON u.id = d.usuario_id
          ORDER BY l.fecha_registro DESC`, (err, rows) => {
    stats.usuarios = rows || [];
    
    // Responder cuando TODO esté listo
    setTimeout(() => res.json(stats), 300);
  });
});

// === LOGS EN TIEMPO REAL ===
app.get('/api/admin/logs', (req, res) => {
  db.all(`SELECT * FROM logins_log ORDER BY fecha DESC LIMIT 100`, (err, rows) => {
    res.json({ logs: rows || [] });
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ SERVIDOR LISTO en puerto ${PORT}`);
  console.log(`🌐 URL: https://grepobot-web.onrender.com`);
});