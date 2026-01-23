const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Base de datos persistente
const db = new sqlite3.Database('./grepobot.db');
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
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Registro
app.post('/api/registro', (req, res) => {
  const { username, password } = req.body;
  db.run("INSERT INTO usuarios (username, password) VALUES (?, ?)", [username, password], function(err) {
    if (err) return res.json({ success: false, error: 'Usuario ya existe' });
    db.run("INSERT INTO licencias (usuario_id, dias_licencia) VALUES (?, 7)", [this.lastID]);
    res.json({ success: true, usuarioId: this.lastID, username, dias: 7 });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT u.id, l.dias_licencia FROM usuarios u JOIN licencias l ON u.id = l.usuario_id WHERE u.username = ? AND u.password = ?", [username, password], (err, row) => {
    if (!row) return res.json({ success: false });
    res.json({ success: true, usuarioId: row.id, username, dias: row.dias_licencia });
  });
});

// PayPal simulado (sandbox)
app.post('/api/paypal/create-order', (req, res) => {
  res.json({ id: "ORDER_" + Date.now() });
});
app.post('/api/paypal/capture-order', (req, res) => {
  const { usuarioId, planId } = req.body;
  let dias = planId === '12meses' ? 365 : (planId === '6meses' ? 180 : 30);
  db.run("UPDATE licencias SET dias_licencia = dias_licencia + ? WHERE usuario_id = ?", [dias, usuarioId], (err) => {
    res.json({ status: "COMPLETED" });
  });
});

// Cargador con todos los permisos y URL correcta
function generarCargador(usuarioId) {
  const API_URL = "https://grepobot-web.onrender.com/api/obtener-codigo-real";
  return `// ==UserScript==
// @name         GrepoBot Pro Elite
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Bot indetectable con licencia segura
// @author       GrepoTeam
// @match        https://*.grepolis.com/game/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        window.focus
// @connect      grepobot-web.onrender.com
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  console.log("🔒 GrepoBot: Conectando al servidor seguro...");
  GM_xmlhttpRequest({
    method: "POST",
    url: "${API_URL}",
    headers: { "Content-Type": "application/json" },
     JSON.stringify({ u: "${usuarioId}" }),
    onload: function(response) {
      if (response.status === 200) {
        try {
          // 💡 INYECCIÓN EN EL CONTEXTO REAL DEL JUEGO
          const realWindow = window.unsafeWindow || window;
          const script = realWindow.document.createElement('script');
          script.textContent = response.responseText;
          (realWindow.document.head || realWindow.document.documentElement).appendChild(script);
          script.remove();
          console.log("✅ GrepoBot: Código inyectado y ejecutado.");
        } catch (e) {
          console.error("❌ Error al ejecutar el bot:", e);
          alert("Error crítico. Revisa la consola (F12).");
        }
      } else {
        alert("⛔ LICENCIA CADUCADA. Renueva en la web.");
      }
    },
    onerror: function(err) {
      console.error("❌ Error de conexión:", err);
      alert("No se pudo conectar con el servidor de licencias.");
    }
  });
})();
`;
}

// Descargar script
app.get('/api/descargar/:id/GrepoBot.user.js', (req, res) => {
  res.setHeader('Content-disposition', 'attachment; filename=GrepoBot.user.js');
  res.send(generarCargador(req.params.id));
});

// Entregar código del bot (con escape automático si es necesario)
app.post('/api/obtener-codigo-real', (req, res) => {
  const { u } = req.body;
  db.get("SELECT dias_licencia FROM licencias l JOIN usuarios u ON l.usuario_id = u.id WHERE u.id = ?", [u], (err, row) => {
    if (!row || row.dias_licencia <= 0) return res.status(403).send("alert('Renueva licencia');");
    fs.readFile(path.join(__dirname, 'bot_original.js'), 'utf8', (err, data) => {
      if (err) return res.status(500).send("");
      res.type('application/javascript').send(data);
    });
  });
});

// Servir la web principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ SERVIDOR LISTO en puerto ' + PORT));