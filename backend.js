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
// @name         Bot Grepolis - V11.80 ULTIMATE
// @namespace    http://tampermonkey.net/
// @version      11.80.1
// @description  V11.80: Academy Global Search + Recruit Multi-Window + UI Fixes.
// @author       TuNombre
// @match        https://*.grepolis.com/game/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    console.log('🤖 GrepoBot V11.80 INSTALADO');
    
    const panel = document.createElement('div');
    panel.id = 'grepobot-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;left:20px;width:350px;background:#1a1a2f;border:2px solid #4caf50;border-radius:10px;padding:20px;color:#e0e0e0;font-family:Arial,sans-serif;z-index:99999;box-shadow:0 4px 15px rgba(76,175,80,0.4);';
    
    panel.innerHTML = \`
        <div style="text-align:center;">
            <h3 style="margin:0;color:#4caf50;">⚔️ GrepoBot V11.80</h3>
            <p style="margin:5px 0;font-size:12px;color:#aaa;">✅ ACTIVO</p>
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
})();`;
        
        db.run('UPDATE usuarios SET yaDescargo = 1 WHERE id = ?', [usuarioId]);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/x-javascript; charset=utf-8');
        res.send(botCode);
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
