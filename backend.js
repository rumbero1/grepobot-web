const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); 

// Base de Datos
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, username TEXT, password TEXT, dias_licencia INTEGER, fecha_registro DATETIME)");
});

// LOGIN / REGISTRO
app.post('/api/registro', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO usuarios (username, password, dias_licencia, fecha_registro) VALUES (?, ?, ?, ?)", 
        [username, password, 7, Date.now()], 
        function(err) {
            if (err) return res.json({ success: false });
            res.json({ success: true, usuarioId: this.lastID, dias: 7, username });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (!row) return res.json({ success: false });
        res.json({ success: true, usuarioId: row.id, dias: row.dias_licencia, username: row.username });
    });
});

// GENERADOR DE SCRIPT
function generarCargador(usuarioId) {
    // URL DE RENDER - IMPORTANTE
    const API_URL = "https://grepobot-web.onrender.com/api/obtener-codigo-real";
    
    return `// ==UserScript==
// @name         GrepoBot Pro Elite
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Bot indetectable
// @match        http://*.grepolis.com/*
// @match        https://*.grepolis.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';
    GM_xmlhttpRequest({
        method: "POST",
        url: "${API_URL}",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ u: "${usuarioId}" }),
        onload: function(response) {
            if (response.status === 200) {
                try { eval(response.responseText); } catch (e) { console.error(e); }
            } else { alert("LICENCIA CADUCADA"); }
        }
    });
})();`;
}

app.get('/api/descargar/:id/GrepoBot.user.js', (req, res) => {
    res.setHeader('Content-disposition', 'attachment; filename=GrepoBot.user.js');
    res.send(generarCargador(req.params.id));
});

app.post('/api/obtener-codigo-real', (req, res) => {
    const { u } = req.body;
    db.get("SELECT dias_licencia FROM usuarios WHERE id = ?", [u], (err, row) => {
        if (!row || row.dias_licencia <= 0) return res.status(403).send("alert('Renueva licencia');");
        
        fs.readFile(path.join(__dirname, 'bot_original.js'), 'utf8', (err, data) => {
            if (err) return res.status(500).send("");
            res.send(data);
        });
    });
});

// PAYPAL FALSO PARA QUE FUNCIONE EL BOTÓN
app.post('/api/paypal/create-order', (req, res) => { res.json({ id: "ORDER_" + Date.now() }); });
app.post('/api/paypal/capture-order', (req, res) => {
    const { usuarioId, planId } = req.body;
    let dias = planId === '12_MESES' ? 365 : (planId === '6_MESES' ? 180 : 30);
    db.run("UPDATE usuarios SET dias_licencia = dias_licencia + ? WHERE id = ?", [dias, usuarioId], (err) => {
        res.json({ status: "COMPLETED" });
    });
});

app.listen(PORT, () => console.log(`Server en ${PORT}`));