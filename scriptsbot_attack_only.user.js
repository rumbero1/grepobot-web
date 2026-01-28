// ==UserScript==
// @name         Bot Grepolis - V11.19 PREMIUM (Attack-only)
// @namespace    http://tampermonkey.net/
// @version      11.19.0
// @description  Variante 'solo ataca' del bot
// @author       TuNombre
// @match        https://*.grepolis.com/game/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    const API_URL = 'https://grepobot-web.onrender.com/api'; // CAMBIAR POR TU URL DE RENDER
    let LICENSE_VALID = false;
    let DAYS_LEFT = 0;

    async function checkLicense() {
        const CACHE_KEY = 'bot_license_cache';
        const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 Horas de memoria

        if (typeof GREPOBOT_TOKEN === 'undefined') {
            alert("GrepoBot: Token no encontrado. Reinstala el bot desde el portal.");
            return false;
        }

        // 1. Revisar Caché Local
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cached && cached.valid && (Date.now() - cached.timestamp < CACHE_DURATION)) {
                console.log("✅ Licencia válida (Caché)");
                LICENSE_VALID = true;
                DAYS_LEFT = cached.daysLeft;
                return true;
            }
        } catch (e) { console.error("Cache error", e); }

        // 2. Intentar Red (con reintentos)
        for (let i = 0; i < 3; i++) {
            try {
                const res = await fetch(`${API_URL}/check-license?token=${GREPOBOT_TOKEN}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();

                if (data.valid) {
                    // Guardar en caché si es válido
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        valid: true,
                        daysLeft: data.daysLeft,
                        timestamp: Date.now()
                    }));
                    LICENSE_VALID = true;
                    DAYS_LEFT = data.daysLeft;
                    return true;
                } else {
                    // Expirado explícitamente por el servidor
                    localStorage.removeItem(CACHE_KEY);
                    LICENSE_VALID = false;
                    blockUI('EXPIRED');
                    return false;
                }
            } catch (e) {
                console.warn(`Intento conexión ${i + 1}/3 fallido:`, e);
                await new Promise(r => setTimeout(r, 2000)); // Esperar 2s
            }
        }

        // 3. Fallo total de red -> Usar caché de emergencia o bloquear con mensaje de red
        // Si llegamos aquí es porque falló la conexión 3 veces.
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cached && cached.valid) {
                console.warn("⚠️ Servidor caído. Usando última licencia conocida.");
                LICENSE_VALID = true;
                return true;
            }
        } catch (e) { }

        // Si no hay nada, bloqueamos por error de red
        console.error("❌ Fallo crítico de conexión con servidor de licencias.");
        blockUI('NETWORK');
        return false;
    }

    function blockUI(reason) {
        if (document.getElementById('bot-block-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'bot-block-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:100000;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-family:Arial;text-align:center;';

        let title, msg, btnText, btnLink;

        if (reason === 'NETWORK') {
            title = '⚠️ SIN CONEXIÓN';
            msg = 'No puedo conectar con el servidor del Bot.<br>Tu licencia podría estar bien, pero el servidor no responde.<br>Intenta recargar en unos minutos.';
            btnText = 'REINTENTAR';
            btnLink = '#';
        } else {
            title = '⚔️ LICENCIA EXPIRADA';
            msg = 'Tu tiempo de gloria ha terminado.<br>Renueva tu suscripción para seguir dominando.';
            btnText = 'RENOVAR AHORA';
            btnLink = 'https://grepobot-web.onrender.com';
        }

        overlay.innerHTML = `
            <h1 style="color:${reason === 'NETWORK' ? '#ff9800' : '#ff5252'};font-size:40px;margin-bottom:20px;">${title}</h1>
            <p style="font-size:18px;margin-bottom:30px;line-height:1.5;">${msg}</p>
            <a href="${btnLink}" ${reason === 'NETWORK' ? 'onclick="location.reload()"' : 'target="_blank"'} style="padding:15px 30px;background:${reason === 'NETWORK' ? '#2196f3' : '#4caf50'};color:white;text-decoration:none;border-radius:50px;font-weight:bold;font-size:20px;cursor:pointer;">${btnText}</a>
        `;
        document.body.appendChild(overlay);
    }

    // Iniciar
    checkLicense();

    const ENCAIXE_ID = 'painel-encaixe-ataque';
    const STORAGE_KEY = 'bot_grepo_config_v1';

    let ordenesCapturadas = [];
    let botActivo = false;
    let ordenActualIndex = 0;
    let audioContext = null;

    // FACTORES DE VELOCIDAD
    const VELOCIDADES = {
        'rapido': 1,
        'normal': 1.5,
        'lento': 3
    };

    function criarPanelPrincipal() {
        if (document.getElementById(PANEL_ID)) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:9999;background:#1e1e2f;color:#fff;padding:8px;border-radius:6px;font-family:Arial,sans-serif;font-size:11px;cursor:pointer;border:2px solid #444;box-shadow:0 0 10px #000;';
        panel.innerHTML = `<strong>🤖 V11.19</strong>`;
        panel.onclick = criarPanelEncaixe;
        document.body.appendChild(panel);

        // Tecla de Pánico (ESC)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (botActivo) {
                    pararProceso();
                    playBeep(150, 300, 'sawtooth'); // Sonido de error
                }
                const p = document.getElementById(ENCAIXE_ID);
                if (p) p.style.display = 'none';
            }
        });

        setTimeout(criarPanelEncaixe, 500);
    }

    function criarPanelEncaixe() {
        if (document.getElementById(ENCAIXE_ID)) {
            document.getElementById(ENCAIXE_ID).style.display = 'block';
            return;
        }

        const panel = document.createElement('div');
        panel.id = ENCAIXE_ID;
        panel.style.cssText = `
            position:fixed;top:100px;left:50%;margin-left:-160px;
            z-index:9999;background:#1c1c2c;border:2px solid #333;
            border-radius:10px;width:320px;color:#ccc;font-family:Arial,sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div id="bot-drag-header" style="
                padding:8px;
                background:#2a2a3a;
                border-bottom:1px solid #333;
                border-radius:8px 8px 0 0;
                cursor:move;
                display:flex;
                justify-content:space-between;
                align-items:center;
                user-select:none;
            ">
                <h3 style="margin:0;color:#60a5fa;font-size:13px;">⚔️ Bot V11.19</h3>
                <button id="btn-ocultar" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;">✖</button>
            </div>

            <div style="padding:10px; max-height: 80vh; overflow-y: auto;">

                <!-- HORA SERVER -->
                <div style="background:#111;padding:4px;border-radius:4px;margin-bottom:8px;text-align:center;font-size:11px;">
                    Hora: <span id="server-time" style="color:#0f0;">--:--:--</span>
                </div>

                <!-- CONFIGURACIÓN BÁSICA -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                    <div>
                        <label style="font-size:10px;">Seg. Obj:</label>
                        <input type="number" id="segundo-obj" value="0" min="0" max="59" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                    </div>
                    <div>
                        <label style="font-size:10px;">Antelación:</label>
                        <input type="number" id="antelacion" value="5" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                    </div>
                </div>

                <!-- MODO DETECCIÓN -->
                <div style="margin-bottom:8px;">
                    <select id="modo-deteccion" style="width:100%;background:#222;color:#fff;border:1px solid #555;padding:3px;border-radius:3px;font-size:11px;">
                        <option value="auto">🤖 Auto (Detectar)</option>
                        <option value="forzar_ataque">⚔️ FORZAR ATAQUE</option>
                        <option value="forzar_defensa" selected>🛡️ FORZAR DEFENSA</option>
                    </select>
                </div>

                <!-- TOLERANCIAS -->
                <div style="background:#222;padding:6px;border-radius:4px;margin-bottom:8px;border:1px solid #444;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <!-- VERDE -->
                        <div style="text-align:center;">
                            <label style="font-size:10px;color:#4caf50;font-weight:bold;">🛡️ DEF (+)</label>
                            <input type="number" id="tol-defensa" value="3" min="0" max="20"
                                style="width:100%;background:#1a2a1a;color:#4caf50;border:1px solid #4caf50;padding:3px;border-radius:3px;text-align:center;font-size:12px;font-weight:bold;">
                        </div>
                        <!-- ROJO -->
                        <div style="text-align:center;">
                            <label style="font-size:10px;color:#ff5252;font-weight:bold;">⚔️ ATK (-)</label>
                            <input type="number" id="tol-ataque" value="0" min="0" max="20"
                                style="width:100%;background:#2a1a1a;color:#ff5252;border:1px solid #ff5252;padding:3px;border-radius:3px;text-align:center;font-size:12px;font-weight:bold;">
                        </div>
                    </div>
                </div>

                <!-- VELOCIDAD Y CHECKBOX -->
                <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
                    <select id="velocidad-bot" style="flex:1;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:10px;">
                        <option value="rapido" selected>⚡ Rápido</option>
                        <option value="normal">🚶 Normal</option>
                        <option value="lento">🐢 Lento</option>
                    </select>
                    <label style="font-size:9px;color:#fff;display:flex;align-items:center;cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" id="chk-no-cancelar" style="margin-right:4px;">
                        🚫 No Cancelar
                    </label>
                </div>

                <!-- BOTONES -->
                <button id="btn-capturar" style="width:100%;padding:6px;background:#444;color:#fff;border:none;border-radius:4px;margin-bottom:6px;font-weight:bold;cursor:pointer;font-size:11px;">
                    🔍 Capturar
                </button>

                <!-- BARRA DE PROGRESO -->
                <div id="progress-container" style="width:100%;height:4px;background:#333;margin-bottom:6px;border-radius:2px;overflow:hidden;display:none;">
                    <div id="progress-bar" style="width:0%;height:100%;background:#00cc66;transition:width 0.1s linear;"></div>
                </div>

                <div id="resultado" style="background:#0a0a14;padding:6px;border-radius:4px;color:#0f0;min-height:40px;margin-bottom:6px;font-size:10px;overflow-y:auto;max-height:100px;">
                    ...
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                    <button id="btn-iniciar" style="padding:8px;background:#00cc66;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:11px;">
                        ▶️ Iniciar
                    </button>
                    <button id="btn-parar" style="padding:8px;background:#cc0000;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:11px;">
                        ⏹️ Parar (ESC)
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Cargar configuración guardada
        loadSettings();

        // Listeners para guardar configuración al cambiar
        const inputs = ['segundo-obj', 'antelacion', 'modo-deteccion', 'tol-defensa', 'tol-ataque', 'velocidad-bot', 'chk-no-cancelar'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', saveSettings);
        });

        // Lógica de arrastre
        const header = document.getElementById('bot-drag-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = panel.offsetLeft;
            initialTop = panel.offsetTop;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
            panel.style.marginLeft = '0';
            panel.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });

        document.getElementById('btn-ocultar').onclick = () => {
            panel.style.display = 'none';
        };

        setInterval(() => {
            const st = getServerTime();
            const el = document.getElementById('server-time');
            if (st && el) {
                const d = new Date(st * 1000);
                el.textContent = d.toTimeString().substr(0, 8);
            }
        }, 1000);

        document.getElementById('btn-capturar').onclick = capturarAtaques;
        document.getElementById('btn-iniciar').onclick = iniciarProceso;
        document.getElementById('btn-parar').onclick = pararProceso;
    }

    // --- PERSISTENCIA ---
    function saveSettings() {
        const config = {
            segundoObj: document.getElementById('segundo-obj').value,
            antelacion: document.getElementById('antelacion').value,
            modo: document.getElementById('modo-deteccion').value,
            tolDef: document.getElementById('tol-defensa').value,
            tolAtk: document.getElementById('tol-ataque').value,
            velocidad: document.getElementById('velocidad-bot').value,
            noCancelar: document.getElementById('chk-no-cancelar').checked
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    function loadSettings() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const c = JSON.parse(saved);
                if (c.segundoObj !== undefined) document.getElementById('segundo-obj').value = c.segundoObj;
                if (c.antelacion !== undefined) document.getElementById('antelacion').value = c.antelacion;
                if (c.modo !== undefined) document.getElementById('modo-deteccion').value = c.modo;
                if (c.tolDef !== undefined) document.getElementById('tol-defensa').value = c.tolDef;
                if (c.tolAtk !== undefined) document.getElementById('tol-ataque').value = c.tolAtk;
                if (c.velocidad !== undefined) document.getElementById('velocidad-bot').value = c.velocidad;
                if (c.noCancelar !== undefined) document.getElementById('chk-no-cancelar').checked = c.noCancelar;
            } catch (e) {
                console.error('Error cargando config', e);
            }
        }
    }

    // --- AUDIO ---
    function playBeep(freq = 440, duration = 100, type = 'sine') {
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start();
            setTimeout(() => osc.stop(), duration);
        } catch (e) {
            console.error('Audio error', e);
        }
    }

    function getServerTime() {
        const el = document.querySelector('.server_time_area');
        if (!el) return Math.floor(Date.now() / 1000);

        const txt = el.textContent.trim();
        const m = txt.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return Math.floor(Date.now() / 1000);

        const [_, h, min, s, d, mon, y] = m.map(Number);
        return Math.floor(new Date(y, mon - 1, d, h, min, s).getTime() / 1000);
    }

    async function capturarAtaques() {
        const resultado = document.getElementById('resultado');
        resultado.innerHTML = '<span style="color:#ff0;">⏳ Escaneando...</span>';

        ordenesCapturadas = [];
        const ataquesTemp = [];
        const serverTime = getServerTime();
        const now = new Date(serverTime * 1000);

        let pagina = 1;
        let hayMasPaginas = true;

        while (hayMasPaginas) {
            const filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));
            console.log(`📄 Pág ${pagina}: ${filas.length} filas`);

            filas.forEach(fila => {
                const txt = fila.textContent;
                const m = txt.match(/(?:Partida|Departure):.*?(\d{1,2}):(\d{2}):(\d{2})/i);
                if (!m) return;

                let salida = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
                if (salida < now) salida.setDate(salida.getDate() + 1);

                const diff = Math.floor((salida.getTime() / 1000) - serverTime);
                if (diff > -60) {
                    const html = fila.innerHTML.toLowerCase();
                    const esApoyo = html.includes('support') || html.includes('def') || html.includes('reforzar');
                    const esAtaque = !esApoyo && (html.includes('attack') || html.includes('ataque'));

                    let tipo = '❓';
                    if (esApoyo) tipo = '🛡️ DEF';
                    else if (esAtaque) tipo = '⚔️ ATK';
                    else tipo = '⚔️ ATK (Defecto)';

                    const firma = `${m[1]}:${m[2]}:${m[3]}_${fila.innerHTML.length}`;

                    ataquesTemp.push({
                        hora: `${m[1]}:${m[2]}:${m[3]}`,
                        timestamp: Math.floor(salida.getTime() / 1000),
                        diff: diff,
                        firma: firma,
                        tipo: tipo,
                        esAtaque: esAtaque,
                        esApoyo: esApoyo
                    });
                }
            });

            const activePage = document.querySelector('.page_number.active');
            let clicked = false;

            if (activePage) {
                const currentNum = parseInt(activePage.textContent);
                const nextNum = currentNum + 1;
                const allPages = Array.from(document.querySelectorAll('.page_number'));
                const nextPageDiv = allPages.find(el => el.textContent.trim() === nextNum.toString());

                if (nextPageDiv) {
                    simularClick(nextPageDiv);
                    clicked = true;
                }
            }

            if (!clicked) {
                const btnNext = document.querySelector('.paginator_bg .next, .pg_next, .paged-nav-item.next, .btn_next');
                if (btnNext && !btnNext.classList.contains('disabled') && !btnNext.style.opacity === '0.5') {
                    simularClick(btnNext);
                    clicked = true;
                }
            }

            if (clicked) {
                await esperar(1500);
                pagina++;
            } else {
                hayMasPaginas = false;
            }
        }

        if (ataquesTemp.length === 0) {
            resultado.innerHTML = '<span style="color:#f00;">❌ 0 ataques</span>';
            return;
        }

        ataquesTemp.sort((a, b) => a.timestamp - b.timestamp);
        ordenesCapturadas = ataquesTemp;

        let html = `<strong style="color:#0f0;">✅ ${ataquesTemp.length} órdenes:</strong><br>`;
        ataquesTemp.forEach((a, i) => {
            html += `<div style="font-size:10px;${i === 0 ? 'font-weight:bold;color:#fff;' : 'color:#888;'}">[${i + 1}] ${a.tipo} - ${a.hora}</div>`;
        });

        resultado.innerHTML = html;
        console.log(`✅ Capturados ${ataquesTemp.length} ataques`);
    }

    function iniciarProceso() {
        if (ordenesCapturadas.length === 0) {
            alert('❌ Captura primero');
            return;
        }

        botActivo = true;
        ordenActualIndex = 0;
        document.getElementById('progress-container').style.display = 'block';
        console.log(`🚀 Iniciando...`);
        playBeep(600, 100); // Beep inicio
        procesarOrden();
    }

    function pararProceso() {
        botActivo = false;
        console.log('⛔ Detenido');
        document.getElementById('resultado').innerHTML += '<br><span style="color:#f00;">⛔ OFF</span>';
        document.getElementById('progress-container').style.display = 'none';
    }

    async function buscarFilaEnPaginas(orden) {
        let filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));
        for (const f of filas) {
            if (f.textContent.includes(orden.hora)) {
                return f;
            }
        }

        console.log('🔍 Buscando en págs...');
        let intentos = 0;
        while (intentos < 10) {
            const activePage = document.querySelector('.page_number.active');
            let clicked = false;
            if (activePage) {
                const currentNum = parseInt(activePage.textContent);
                const nextNum = currentNum + 1;
                const allPages = Array.from(document.querySelectorAll('.page_number'));
                const nextPageDiv = allPages.find(el => el.textContent.trim() === nextNum.toString());
                if (nextPageDiv) {
                    simularClick(nextPageDiv);
                    clicked = true;
                }
            }
            if (!clicked) {
                const btnNext = document.querySelector('.paginator_bg .next, .pg_next, .paged-nav-item.next, .btn_next');
                if (btnNext && !btnNext.classList.contains('disabled')) {
                    simularClick(btnNext);
                    clicked = true;
                }
            }

            if (clicked) {
                await esperar(1000);
                filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));
                for (const f of filas) {
                    if (f.textContent.includes(orden.hora)) {
                        return f;
                    }
                }
            } else {
                break;
            }
            intentos++;
        }
        return null;
    }

    function procesarOrden() {
        if (!botActivo) return;

        if (ordenActualIndex >= ordenesCapturadas.length) {
            document.getElementById('resultado').innerHTML = '<div style="text-align:center;padding:5px;background:#0c0;color:#fff;border-radius:4px;">✅ FIN</div>';
            playBeep(800, 300); // Beep final
            playBeep(1000, 300);
            botActivo = false;
            return;
        }

        const orden = ordenesCapturadas[ordenActualIndex];
        const antelacion = parseInt(document.getElementById('antelacion').value) || 5;

        const modo = document.getElementById('modo-deteccion').value;
        const valDefensa = parseInt(document.getElementById('tol-defensa').value) || 0;
        const valAtaque = parseInt(document.getElementById('tol-ataque').value) || 0;

        let tolPos = 0, tolNeg = 0;
        let tipoFinal = orden.tipo;
        let colorFinal = '#fff';

        if (modo === 'forzar_defensa') {
            tolPos = valDefensa;
            tolNeg = 0;
            tipoFinal = '🛡️ DEF (F)';
            colorFinal = '#4caf50';
        } else if (modo === 'forzar_ataque') {
            tolPos = 0;
            tolNeg = valAtaque;
            tipoFinal = '⚔️ ATK (F)';
            colorFinal = '#ff5252';
        } else {
            if (orden.esApoyo) {
                tolPos = valDefensa;
                tolNeg = 0;
                colorFinal = '#4caf50';
            } else {
                tolPos = 0;
                tolNeg = valAtaque;
                colorFinal = '#ff5252';
            }
        }

        const intervalo = setInterval(async () => {
            if (!botActivo) {
                clearInterval(intervalo);
                return;
            }

            const modoLive = document.getElementById('modo-deteccion').value;
            const valDefensaLive = parseInt(document.getElementById('tol-defensa').value) || 0;
            const valAtaqueLive = parseInt(document.getElementById('tol-ataque').value) || 0;

            if (modoLive === 'forzar_defensa') {
                tolPos = valDefensaLive;
                tolNeg = 0;
                tipoFinal = '🛡️ DEF (F)';
                colorFinal = '#4caf50';
            } else if (modoLive === 'forzar_ataque') {
                tolPos = 0;
                tolNeg = valAtaqueLive;
                tipoFinal = '⚔️ ATK (F)';
                colorFinal = '#ff5252';
            } else {
                if (orden.esApoyo) {
                    tolPos = valDefensaLive;
                    tolNeg = 0;
                    tipoFinal = orden.tipo;
                    colorFinal = '#4caf50';
                } else {
                    tolPos = 0;
                    tolNeg = valAtaqueLive;
                    tipoFinal = orden.tipo;
                    colorFinal = '#ff5252';
                }
            }

            const serverTime = getServerTime();
            const diff = orden.timestamp - serverTime;

            // Actualizar Barra
            const totalWait = 60; // Asumimos ventana de 1 min para visualización
            let pct = 100 - ((diff / totalWait) * 100);
            if (pct < 0) pct = 0;
            if (pct > 100) pct = 100;
            document.getElementById('progress-bar').style.width = `${pct}%`;

            document.getElementById('resultado').innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#0af;font-size:11px;">#${ordenActualIndex + 1}</div>
                    <div style="font-weight:bold;margin:2px 0;color:${colorFinal};font-size:12px;">
                        ${tipoFinal}
                    </div>
                    <div style="font-size:10px;color:#ccc;">
                        Tol: -${tolNeg} / +${tolPos}
                    </div>
                    <div style="color:#ff0;margin:2px 0;font-size:11px;">${orden.hora}</div>
                    <div style="font-size:18px;font-weight:bold;color:#fff;">${diff}s</div>
                </div>
            `;

            if (diff < (antelacion - 5)) {
                clearInterval(intervalo);
                ordenActualIndex++;
                setTimeout(procesarOrden, 1000);
                return;
            }

            if (diff <= antelacion) {
                clearInterval(intervalo);

                const fila = await buscarFilaEnPaginas(orden);

                if (!fila) {
                    document.getElementById('resultado').innerHTML += '<div style="color:#f00;">❌ No fila</div>';
                    ordenActualIndex++;
                    setTimeout(procesarOrden, 1000);
                    return;
                }

                ejecutarRuleta(fila, orden.timestamp, tolNeg, tolPos).then(exito => {
                    ordenActualIndex++;
                    if (botActivo) {
                        setTimeout(procesarOrden, 1000);
                    }
                });
            }
        }, 100);
    }

    function simularClick(elemento) {
        if (!elemento) return;
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 });
        elemento.dispatchEvent(mousedown);
        const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 1 });
        elemento.dispatchEvent(mouseup);
        elemento.click();
    }

    function getDelay(msBase) {
        const selector = document.getElementById('velocidad-bot');
        const tipo = selector ? selector.value : 'rapido';
        const factor = VELOCIDADES[tipo] || 1;
        const jitter = (msBase * factor) * 0.15;
        const randomOffset = (Math.random() * jitter * 2) - jitter;
        return Math.floor((msBase * factor) + randomOffset);
    }

    async function ejecutarRuleta(fila, targetTimestamp, tolNeg, tolPos) {
        const segundoObj = parseInt(document.getElementById('segundo-obj').value);
        const noCancelar = document.getElementById('chk-no-cancelar').checked;

        const validos = new Set();
        for (let i = -tolNeg; i <= tolPos; i++) {
            validos.add((segundoObj + i + 60) % 60);
        }

        console.log(`🎲 Ruleta: Obj ${segundoObj} (-${tolNeg}/+${tolPos})`);

        const MAX_INTENTOS_TOTAL = 30;
        const MAX_INTENTOS_EXTRA = 5;
        let intentosExtraUsados = 0;

        let comandosAnteriores = new Set();
        document.querySelectorAll('.js-command-row').forEach(c => comandosAnteriores.add(c.id));

        for (let i = 1; i <= MAX_INTENTOS_TOTAL; i++) {
            if (!botActivo) break;

            const ahora = getServerTime();
            if (ahora > targetTimestamp) {
                intentosExtraUsados++;
                if (intentosExtraUsados > MAX_INTENTOS_EXTRA) return false;
            }

            const icono = fila.querySelector('.attack_icon:not(.spell_icon), .support_icon:not(.spell_icon)');
            if (!icono) return false;
            simularClick(icono);
            await esperar(getDelay(300));

            const btn = await buscarBoton();
            if (!btn) {
                cerrarVentanas();
                await esperar(getDelay(200));
                continue;
            }

            simularClick(btn);
            await esperar(getDelay(400));

            if (noCancelar) {
                document.getElementById('resultado').innerHTML = `<div style="text-align:center;padding:5px;background:#0c0;color:#fff;">✅ ENVIADO</div>`;
                playBeep(600, 150);
                await esperar(1000);
                return true;
            }

            const cmd = await buscarComandoNuevo(comandosAnteriores);
            if (!cmd) {
                cerrarVentanas();
                await esperar(getDelay(200));
                continue;
            }

            const seg = extraerSegundo(cmd);
            if (seg === null) {
                await cancelar(cmd);
                await esperar(getDelay(100));
                continue;
            }

            if (validos.has(seg)) {
                // MENSAJE MEJORADO: CLAVADO + TOLERANCIA
                const diff = (seg - segundoObj);
                const sign = diff > 0 ? '+' : '';
                const tolMsg = diff === 0 ? 'Exacto' : `${sign}${diff}s`;

                document.getElementById('resultado').innerHTML = `
                    <div style="text-align:center;padding:5px;background:#0c0;color:#fff;border-radius:4px;">
                        <div style="font-size:14px;font-weight:bold;">✅ ¡CLAVADO!</div>
                        <div style="font-size:11px;">${seg}s (${tolMsg})</div>
                    </div>
                `;
                playBeep(1000, 200); // Beep éxito
                await esperar(1000);
                return true;
            }

            document.getElementById('resultado').innerHTML += `<div style="color:#f00;font-size:9px;">❌ ${seg}s</div>`;

            const cancelado = await cancelar(cmd);
            if (!cancelado) {
                await esperar(200);
                await cancelar(cmd);
            }

            comandosAnteriores.add(cmd.id);
            await esperar(getDelay(100));
        }
        return false;
    }

    async function buscarBoton() {
        for (let i = 0; i < 10; i++) {
            const btnAttack = document.getElementById('btn_attack_town');
            if (btnAttack && btnAttack.offsetParent !== null) {
                return btnAttack.querySelector('span') || btnAttack;
            }
            const botones = Array.from(document.querySelectorAll('a.button'));
            for (const btn of botones) {
                if (btn.offsetParent === null) continue;
                const mid = btn.querySelector('.middle');
                if (mid) {
                    const txt = mid.textContent.trim().toLowerCase();
                    if (txt === 'reforzar' || txt === 'support') return btn;
                }
            }
            await esperar(getDelay(200));
        }
        return null;
    }

    async function buscarComandoNuevo(anteriores) {
        for (let i = 0; i < 6; i++) {
            const cmds = document.querySelectorAll('.js-command-row');
            for (const cmd of cmds) {
                if (!anteriores.has(cmd.id)) return cmd;
            }
            await esperar(getDelay(100));
        }
        return null;
    }

    function extraerSegundo(cmd) {
        try {
            const el = cmd.querySelector('.troops_arrive_at, .arrival_time');
            if (!el) return null;
            const m = el.textContent.match(/:(\d{2})\)$/);
            return m ? parseInt(m[1], 10) : null;
        } catch (e) {
            return null;
        }
    }

    async function cancelar(cmd) {
        const selectores = ['.game_arrow_delete', 'a[onclick*="cancelCommand"]', '.btn_cancel', '.icon_cancel', '.command_cancel_btn'];
        for (const sel of selectores) {
            const btn = cmd.querySelector(sel);
            if (btn) {
                simularClick(btn);
                return true;
            }
        }
        return false;
    }

    function cerrarVentanas() {
        document.querySelectorAll('.ui-dialog, .js-window-main-container').forEach(win => {
            if (win.id.includes('planner') || win.classList.contains('planner_window')) return;
            const closeBtn = win.querySelector('.window_close, .btn_close');
            if (closeBtn) simularClick(closeBtn);
        });
    }

    function esperar(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    if (window.top === window.self) {
        (function init() {
            if (document.body) criarPanelPrincipal();
            else setTimeout(init, 500);
        })();
    }
})();
