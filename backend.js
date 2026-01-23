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
    const API_URL = "https://grepobot-web.onrender.com/api/obtener-codigo-real";
    
    return `// ==UserScript==
// @name         GrepoBot Pro Elite
// @namespace    http://tampermonkey.net/
// @version      4.6
// @description  Bot indetectable cargado desde servidor seguro.
// @author       GrepoTeam
// @match        http://*.grepolis.com/*
// @match        https://*.grepolis.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        window.focus
// ==/UserScript==

(function() {
    'use strict';
    console.log("🔒 GrepoBot: Conectando...");

    GM_xmlhttpRequest({
        method: "POST",
        url: "${API_URL}",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ u: "${usuarioId}" }),
        onload: function(response) {
            if (response.status === 200) {
                try {
                    // Hack para dar acceso total al bot original
                    var unsafeWindow = window.unsafeWindow || window;
                    eval(response.responseText);
                    console.log("✅ GrepoBot: Código inyectado y LISTO.");
                } catch (e) {
                    console.error("❌ Error ejecutando bot:", e);
                }
            } else {
                alert("⛔ LICENCIA CADUCADA");
            }
        },
        onerror: function(err) { console.log("Error conexion", err); }
    });
})();`;
}