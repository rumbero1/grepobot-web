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
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS licencias (id INTEGER PRIMARY KEY, usuario_id INTEGER, dias_licencia INTEGER DEFAULT 7, fecha_expiracion DATETIME, fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS descargas (id INTEGER PRIMARY KEY, usuario_id INTEGER, fecha_descarga DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(usuario_id))`);
});

app.post('/api/registro', (req, res) => {
  const { username, password } = req.body;
  db.run("INSERT INTO usuarios (username, password) VALUES (?, ?)", [username, password], function(err) {
    if (err) return res.json({ success: false, error: 'Usuario ya existe' });
    
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    db.run("INSERT INTO licencias (usuario_id, dias_licencia, fecha_expiracion) VALUES (?, 7, ?)", [this.lastID, expiracion.toISOString()]);
    res.json({ success: true, usuarioId: this.lastID, username, dias: 7 });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT u.id, l.dias_licencia, l.fecha_expiracion FROM usuarios u JOIN licencias l ON u.id = l.usuario_id WHERE u.username = ? AND u.password = ?", [username, password], (err, row) => {
    if (!row) return res.json({ success: false });
    
    const ahora = new Date();
    const expiracion = new Date(row.fecha_expiracion);
    const diasRestantes = Math.ceil((expiracion - ahora) / (1000 * 60 * 60 * 24));
    
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

app.post('/api/paypal/create-order', (req, res) => {
  res.json({ id: "ORDER_" + Date.now() });
});

app.post('/api/paypal/capture-order', (req, res) => {
  const { usuarioId, planId } = req.body;
  let dias = planId === '12_MESES' ? 365 : (planId === '6_MESES' ? 180 : 30);
  
  const ahora = new Date();
  const nuevaExpiracion = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
  
  db.run("UPDATE licencias SET dias_licencia = ?, fecha_expiracion = ? WHERE usuario_id = ?", [dias, nuevaExpiracion.toISOString(), usuarioId], (err) => {
    db.run("DELETE FROM descargas WHERE usuario_id = ?", [usuarioId], (err) => {
      res.json({ status: "COMPLETED" });
    });
  });
});

function generarCargador(usuarioId) {
  const API_URL = "https://grepobot-web.onrender.com/api/obtener-codigo-real";
  return `// ==UserScript==
// @name         GrepoBot Pro Elite
// @namespace    http://tampermonkey.net/
// @version      5.4
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
  console.log("🔒 GrepoBot: Verificando licencia...");
  
  const pantallaCarga = document.createElement('div');
  pantallaCarga.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.98);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:Arial,sans-serif;';
  
  const textoCarguE = document.createElement('div');
  textoCarguE.style.cssText = 'font-size:24px;margin-bottom:20px;font-weight:bold;';
  textoCarguE.innerHTML = '🔒 VERIFICANDO LICENCIA...';
  pantallaCarga.appendChild(textoCarguE);
  
  const spinner = document.createElement('div');
  spinner.style.cssText = 'width:50px;height:50px;border:4px solid #4caf50;border-top:4px solid transparent;border-radius:50%;animation:spin 1s linear infinite;';
  const style = document.createElement('style');
  style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
  document.head.appendChild(style);
  pantallaCarga.appendChild(spinner);
  
  document.body.appendChild(pantallaCarga);
  
  GM_xmlhttpRequest({
    method: "POST",
    url: "${API_URL}",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ u: "${usuarioId}" }),
    onload: function(response) {
      if (response.status === 200) {
        try {
          console.log("✅ Licencia verificada correctamente");
          
          textoCarguE.innerHTML = '✅ LICENCIA VÁLIDA<br><span style="font-size:14px;color:#4caf50;">Iniciando bot...</span>';
          
          setTimeout(() => {
            pantallaCarga.remove();
            
            const realWindow = window.unsafeWindow || window;
            const script = realWindow.document.createElement('script');
            script.textContent = response.responseText;
            (realWindow.document.head || realWindow.document.documentElement).appendChild(script);
            script.remove();
            
            console.log("✅ GrepoBot: Bot inyectado y funcionando");
          }, 1500);
          
        } catch (e) {
          console.error("❌ Error:", e);
          pantallaCarga.innerHTML = '<div style="font-size:20px;color:red;"><b>❌ ERROR CRÍTICO</b><br>' + e.message + '</div>';
        }
      } else {
        console.error("❌ Licencia caducada o inválida");
        
        pantallaCarga.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2a1a1a 100%)';
        textoCarguE.innerHTML = '⛔ LICENCIA CADUCADA';
        
        const textoExpiracion = document.createElement('div');
        textoExpiracion.style.cssText = 'font-size:16px;color:#ff5252;margin-top:20px;text-align:center;line-height:1.8;';
        textoExpiracion.innerHTML = '<b>Tu período de prueba de 7 días ha terminado.</b><br><br>El bot no funcionará hasta que<br>renueves tu licencia.<br><br><button onclick="window.open(\\'https://grepobot-web.onrender.com\\', \\'_blank\\')" style="margin-top:20px;padding:15px 30px;background:#4caf50;color:white;border:none;border-radius:5px;font-size:16px;font-weight:bold;cursor:pointer;transition:0.3s;">💳 RENOVAR LICENCIA AHORA</button>';
        
        pantallaCarga.innerHTML = '';
        pantallaCarga.appendChild(textoCarguE);
        pantallaCarga.appendChild(textoExpiracion);
      }
    },
    onerror: function(err) {
      console.error("❌ Error de conexión:", err);
      pantallaCarga.style.background = 'linear-gradient(135deg, #2a1a1a 0%, #1a1a2a 100%)';
      textoCarguE.innerHTML = '⚠️ ERROR DE CONEXIÓN';
      
      const textoError = document.createElement('div');
      textoError.style.cssText = 'font-size:14px;color:#ff9800;margin-top:20px;';
      textoError.innerHTML = 'No se pudo verificar la licencia.<br>Recarga la página e intenta de nuevo.';
      pantallaCarga.appendChild(textoError);
    }
  });
})();
`;
}

app.get('/api/descargar/:id/GrepoBot.user.js', (req, res) => {
  const usuarioId = req.params.id;
  
  db.get("SELECT fecha_descarga FROM descargas WHERE usuario_id = ?", [usuarioId], (err, descarga) => {
    if (descarga) {
      return res.status(403).json({ error: "Ya descargaste el bot. No puedes descargar de nuevo hasta renovar." });
    }
    
    db.get("SELECT fecha_expiracion FROM licencias WHERE usuario_id = ?", [usuarioId], (err, licencia) => {
      if (!licencia) {
        return res.status(403).json({ error: "No tienes licencia válida" });
      }
      
      const ahora = new Date();
      const expiracion = new Date(licencia.fecha_expiracion);
      
      if (ahora > expiracion) {
        return res.status(403).json({ error: "Tu licencia ha caducado. Renuévala para descargar." });
      }
      
      db.run("INSERT INTO descargas (usuario_id) VALUES (?)", [usuarioId], (err) => {
        if (err) console.error("Error registrando descarga:", err);
      });
      
      res.setHeader('Content-disposition', 'attachment; filename=GrepoBot.user.js');
      res.send(generarCargador(usuarioId));
    });
  });
});

app.post('/api/obtener-codigo-real', (req, res) => {
  const { u } = req.body;
  db.get("SELECT dias_licencia, fecha_expiracion FROM licencias WHERE usuario_id = ?", [u], (err, row) => {
    if (!row) {
      return res.status(403).json({ error: "Usuario no encontrado" });
    }
    
    const ahora = new Date();
    const expiracion = new Date(row.fecha_expiracion);
    
    if (ahora > expiracion) {
      return res.status(403).json({ error: "Licencia expirada" });
    }
    
    fs.readFile(path.join(__dirname, 'bot_original.js'), 'utf8', (err, data) => {
      if (err) return res.status(500).send("");
      
      const diasRestantes = Math.ceil((expiracion - ahora) / (1000 * 60 * 60 * 24));
      
      const botConBanner = data + `

// MOSTRAR BANNER
setTimeout(() => {
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:10000;background:#1a2a1a;border:2px solid #4caf50;border-radius:8px;padding:12px 16px;color:#4caf50;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;box-shadow:0 0 20px rgba(76,175,80,0.4);opacity:0.85;';
  banner.innerHTML = '📊 PRUEBA<br>   ️ ${diasRestantes}d<br><a href="https://grepobot-web.onrender.com" target="_blank" style="color:#4caf50;text-decoration:underline;cursor:pointer;font-size:11px;">Comprar</a>';
  document.body.appendChild(banner);
}, 2000);
      `;
      
      res.send(botConBanner);
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ SERVIDOR LISTO en puerto ' + PORT));