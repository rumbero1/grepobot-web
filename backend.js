const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- TUS CLAVES DE PAYPAL (Sandbox) ---
const PAYPAL_CLIENT_ID = "ARI8xtvx-zlykSa7RFIka_g5C3_iF8-CaK_ipoT_L9C_mDJiuUyTgTv_HLLHeXNPHrlwRQbmcPmYWIGs";
const PAYPAL_SECRET = "EMrKIP9ii85VCqyTGBzOY_IEyGB2zY5OP11Vdv8RHT8pOE8TPxyXfEIlrzE5xrMbA9LzZCgB8zOB1HMA";
const PAYPAL_API = "https://api-m.sandbox.paypal.com";

// --- BASE DE DATOS ---
const db = new sqlite3.Database('grepobot.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS licencias (id INTEGER PRIMARY KEY, usuario_id INTEGER, clave_unica TEXT UNIQUE, tipo TEXT, fecha_vencimiento DATETIME)`);
});

function generarClave() { return crypto.randomBytes(8).toString('hex'); }

// --- CONFIGURACIÓN DE PRECIOS Y DÍAS ---
const PLANES = {
    '1_MES': { precio: '7.99', dias: 30, nombre: '1 Mes' },
    '6_MESES': { precio: '45.00', dias: 180, nombre: '6 Meses' },
    '12_MESES': { precio: '80.00', dias: 365, nombre: '1 Año' }
};

async function getPayPalAccessToken() {
    const auth = Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_SECRET).toString("base64");
    try {
        const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`,
            querystring.stringify({ grant_type: 'client_credentials' }),
            { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Error PayPal:", error.message);
        return null;
    }
}

app.post('/api/registro', (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO usuarios (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) return res.status(400).json({ error: 'Usuario existe' });
        const userId = this.lastID;
        const clave = generarClave();
        const vencimiento = new Date();
        vencimiento.setDate(vencimiento.getDate() + 7); 
        db.run('INSERT INTO licencias (usuario_id, clave_unica, tipo, fecha_vencimiento) VALUES (?, ?, ?, ?)', 
            [userId, clave, 'trial', vencimiento.toISOString()], 
            () => res.json({ success: true, usuarioId: userId, username: username })
        );
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (!user) return res.json({ success: false, error: 'Datos incorrectos' });
        db.get('SELECT * FROM licencias WHERE usuario_id = ?', [user.id], (err, lic) => {
            const dias = lic ? Math.ceil((new Date(lic.fecha_vencimiento) - new Date()) / 86400000) : 0;
            res.json({ success: true, usuarioId: user.id, username: user.username, dias: dias, tipo: lic.tipo });
        });
    });
});

// --- CREAR ORDEN DE PAGO (Multil-Plan) ---
app.post('/api/paypal/create-order', async (req, res) => {
    const { planId } = req.body; 
    const plan = PLANES[planId];
    
    if (!plan) return res.status(400).json({ error: "Plan inválido" });

    const token = await getPayPalAccessToken();
    if (!token) return res.status(500).json({ error: "Error PayPal" });

    try {
        const order = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, {
            intent: "CAPTURE",
            purchase_units: [{
                amount: { currency_code: "USD", value: plan.precio }, 
                description: `Licencia GrepoBot Pro (${plan.nombre})`
            }]
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        res.json({ id: order.data.id });
    } catch (err) {
        res.status(500).json({ error: "Error creando orden" });
    }
});

app.post('/api/paypal/capture-order', async (req, res) => {
    const { orderID, usuarioId, planId } = req.body;
    const plan = PLANES[planId];
    
    if (!plan) return res.status(400).json({ error: "Plan desconocido" });

    const token = await getPayPalAccessToken();

    try {
        const capture = await axios.post(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {}, 
            { headers: { Authorization: `Bearer ${token}` } });

        if (capture.data.status === "COMPLETED") {
            db.get('SELECT fecha_vencimiento FROM licencias WHERE usuario_id = ?', [usuarioId], (err, row) => {
                let actual = new Date(row.fecha_vencimiento);
                let hoy = new Date();
                if (actual < hoy) actual = hoy;
                
                // SUMAMOS LOS DÍAS DEL PLAN ELEGIDO
                actual.setDate(actual.getDate() + plan.dias);

                db.run('UPDATE licencias SET tipo = ?, fecha_vencimiento = ? WHERE usuario_id = ?', 
                    ['premium', actual.toISOString(), usuarioId], 
                    (err) => {
                        console.log(`PAGO OK: Plan ${plan.nombre} - Usuario ${usuarioId}`);
                        res.json({ success: true, mensaje: "Pago aceptado." });
                    }
                );
            });
        }
    } catch (err) {
        res.status(500).json({ error: "Error verificando pago" });
    }
});

app.post('/api/obtener-codigo-real', (req, res) => {
    const { clave } = req.body;
    db.get('SELECT * FROM licencias WHERE clave_unica = ?', [clave], (err, row) => {
        if (!row) return res.status(403).send("CLAVE_INVALIDA");
        const now = new Date();
        const fin = new Date(row.fecha_vencimiento);
        
        if (fin < now) return res.status(403).send("LICENCIA_CADUCADA");

        fs.readFile(path.join(__dirname, 'bot_original.js'), 'utf8', (err, botContent) => {
            if (err) return res.status(500).send("Error interno");
            res.send(botContent);
        });
    });
});

function generarCargador(clave) {
    return `
// ==UserScript==
// @name         GrepoBot Pro (Loader)
// @version      11.80
// @match        https://*.grepolis.com/game/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==
(function() {
    const API = "http://localhost:3000/api/obtener-codigo-real";
    const KEY = "${clave}";
    const cartel = document.createElement('div');
    cartel.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,0.9);color:white;padding:15px;border:2px solid orange;border-radius:10px;text-align:center;";
    cartel.innerHTML = "🔒 Verificando licencia...";
    document.body.appendChild(cartel);
    GM_xmlhttpRequest({
        method: "POST", url: API,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ clave: KEY }),
        onload: function(res) {
            if (res.status === 200) {
                cartel.style.borderColor = "#0f0"; cartel.innerHTML = "✅ Licencia Válida. Cargando...";
                setTimeout(() => { cartel.remove(); try { const f = new Function(res.responseText); f(); } catch(e){} }, 1000);
            } else {
                cartel.style.borderColor = "red"; cartel.innerHTML = "⛔ LICENCIA CADUCADA<br>Renueva en la web.";
            }
        },
        onerror: function() { cartel.innerHTML = "❌ Error Conexión Servidor"; }
    });
})();`;
}

app.get('/api/copiar/:usuarioId', (req, res) => {
    const usuarioId = req.params.usuarioId;
    db.get('SELECT clave_unica FROM licencias WHERE usuario_id = ?', [usuarioId], (err, row) => {
        if (!row) return res.json({ success: false });
        res.json({ success: true, codigo: generarCargador(row.clave_unica).trim() });
    });
});

app.get('/api/descargar/:usuarioId/GrepoBot.user.js', (req, res) => {
    const usuarioId = req.params.usuarioId;
    db.get('SELECT clave_unica FROM licencias WHERE usuario_id = ?', [usuarioId], (err, row) => {
        if (!row) return res.status(404).send("Error");
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Content-Disposition', 'attachment; filename="GrepoBot_Instalar.user.js"');
        res.send(generarCargador(row.clave_unica).trim());
    });
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(3000, () => console.log('SERVIDOR LISTO en puerto 3000'));