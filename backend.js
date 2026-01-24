const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        diasLicencia INTEGER DEFAULT 0,
        yaDescargo BOOLEAN DEFAULT 0
    )`);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, user) => {
        if(err) return res.json({ success: false, error: 'Error en BD' });
        if(!user) return res.json({ success: false, error: 'Usuario no encontrado' });
        if(user.password !== password) return res.json({ success: false, error: 'Contraseña incorrecta' });
        res.json({
            success: true,
            usuarioId: user.id,
            username: user.username,
            dias: user.diasLicencia,
            yaDescargo: user.yaDescargo === 1
        });
    });
});

app.post('/api/registro', (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.json({ success: false, error: 'Faltan datos' });
    db.run('INSERT INTO usuarios (username, password, diasLicencia) VALUES (?, ?, ?)', 
        [username, password, 7], 
        function(err) {
            if(err) return res.json({ success: false, error: 'Usuario ya existe' });
            res.json({
                success: true,
                usuarioId: this.lastID,
                username: username,
                dias: 7,
                yaDescargo: false
            });
        }
    );
});

app.get('/api/descargar/:usuarioId/:filename', (req, res) => {
    const { usuarioId, filename } = req.params;
    
    db.get('SELECT * FROM usuarios WHERE id = ?', [usuarioId], (err, user) => {
        if(err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if(user.yaDescargo) return res.status(403).json({ error: 'Ya descargaste el bot' });
        
        const botCode = `// ==UserScript==
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
    url: "https://grepobot-web.onrender.com/api/obtener-codigo-real",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ u: "1" }),
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
})();`;
        
        db.run('UPDATE usuarios SET yaDescargo = 1 WHERE id = ?', [usuarioId]);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/x-javascript; charset=utf-8');
        res.send(botCode);
    });
});

app.post('/api/obtener-codigo-real', (req, res) => {
    const { u } = req.body;
    db.get('SELECT * FROM usuarios WHERE id = ?', [u], (err, user) => {
        if(err || !user) return res.status(404).send('Usuario no encontrado');
        if(user.diasLicencia <= 0) return res.status(403).send('Licencia expirada');
        
        const codigoReal = `
        (function() {
            'use strict';
            console.log('✅ GrepoBot V11.80 ACTIVO');
            
            const panel = document.createElement('div');
            panel.id = 'grepobot-panel';
            panel.style.cssText = 'position:fixed;bottom:20px;left:20px;width:350px;background:#1a1a2f;border:2px solid #4caf50;border-radius:10px;padding:20px;color:#e0e0e0;font-family:Arial,sans-serif;z-index:99999;';
            
            panel.innerHTML = \`
                <div style="text-align:center;">
                    <h3 style="margin:0;color:#4caf50;">⚔️ GrepoBot V11.80</h3>
                    <p style="margin:5px 0;font-size:12px;color:#aaa;">��� ACTIVO</p>
                </div>
                <div style="margin-top:15px;border-top:1px solid #444;padding-top:10px;">
                    <button id="btn-planner" style="width:100%;padding:8px;margin:5px 0;background:#4caf50;color:#000;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">📋 Planner</button>
                    <button id="btn-autododge" style="width:100%;padding:8px;margin:5px 0;background:#2196F3;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">🛡️ AutoDodge</button>
                    <button id="btn-autofarm" style="width:100%;padding:8px;margin:5px 0;background:#FF9800;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">🌾 AutoFarm</button>
                    <button id="btn-config" style="width:100%;padding:8px;margin:5px 0;background:#9C27B0;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">⚙️ Config</button>
                </div>
            \`;
            
            document.body.appendChild(panel);
            
            document.getElementById('btn-planner').addEventListener('click', () => alert('📋 Planner - Próximamente'));
            document.getElementById('btn-autododge').addEventListener('click', () => alert('🛡️ AutoDodge - Próximamente'));
            document.getElementById('btn-autofarm').addEventListener('click', () => alert('🌾 AutoFarm - Próximamente'));
            document.getElementById('btn-config').addEventListener('click', () => alert('⚙️ Config - Próximamente'));
        })();
        `;
        
        res.send(codigoReal);
    });
});

app.post('/api/paypal/create-order', (req, res) => {
    res.json({ id: 'TEST_' + Date.now() });
});

app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body;
    const diasPlan = { '1_MES': 30, '6_MESES': 180, '12_MESES': 365 };
    db.run('UPDATE usuarios SET diasLicencia = ?, yaDescargo = 0 WHERE id = ?', [diasPlan[planId] || 30, usuarioId], function(err) {
        if(err) return res.json({ success: false, error: 'Error' });
        res.json({ success: true, message: 'Pago completado' });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('\n✅ SERVIDOR LISTO en puerto ' + PORT);
    console.log('🌐 URL: http://localhost:' + PORT + '\n');
});
