// ==UserScript==
// @name         Bot Grepolis - V11.80 ULTIMATE MEJORADO
// @namespace    http://tampermonkey.net/
// @version      11.80.2
// @description  V11.80.2: Anti-detección + Firefox + Sonidos + Historial + Hora Real
// @author       TuNombre
// @match        https://*.grepolis.com/game/*
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- ANTI-DETECCIÓN MEJORADA ---
    const randomDelay = () => Math.random() * 500 + 300;
    const randomJitter = (ms) => ms + (Math.random() * 200 - 100);
    const hiddenAttribute = Math.random().toString(36).substring(7);
    
    Object.defineProperty(window, 'botActive', {
        configurable: true,
        get() { return localStorage.getItem('bot_status') === 'active'; }
    });

    // --- HISTORIAL DE ATAQUES ---
    const HISTORY_KEY = 'bot_grepo_history_v1';
    const MAX_HISTORY = 100;

    function agregarAlHistorial(ataque) {
        let historia = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        historia.unshift({
            timestamp: new Date().toISOString(),
            hora: ataque.hora,
            tipo: ataque.tipo,
            resultado: ataque.resultado || 'pendiente'
        });
        if (historia.length > MAX_HISTORY) historia = historia.slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historia));
    }

    function obtenerHistorial() {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    }

    // --- NOTIFICACIONES SONORAS PERSONALIZABLES ---
    class SoundManager {
        constructor() {
            this.enabled = true;
            this.volume = 0.7;
            this.notifications = {
                success: { freq: 1000, duration: 200, type: 'sine' },
                warning: { freq: 600, duration: 150, type: 'sine' },
                error: { freq: 200, duration: 300, type: 'sawtooth' },
                custom: { freq: 800, duration: 100, type: 'sine' }
            };
        }

        play(type = 'custom', customFreq = null) {
            if (!this.enabled) return;
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const config = customFreq ? { freq: customFreq, duration: 100, type: 'sine' } : this.notifications[type];
                
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.type = config.type;
                osc.frequency.value = config.freq;
                gain.gain.value = this.volume;
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.start();
                setTimeout(() => osc.stop(), config.duration);
            } catch (e) {
                console.error('Error de audio:', e);
            }
        }

        setVolume(vol) {
            this.volume = Math.min(1, Math.max(0, vol));
        }

        toggle() {
            this.enabled = !this.enabled;
        }
    }

    const soundManager = new SoundManager();

    // --- GESTOR DE HORA DEL SERVIDOR EN TIEMPO REAL ---
    class ServerTimeManager {
        constructor() {
            this.offset = 0;
            this.lastUpdate = Date.now();
            this.updateInterval = null;
        }

        getServerTime() {
            const el = document.querySelector('.server_time_area');
            if (!el) return Math.floor(Date.now() / 1000);

            const txt = el.textContent.trim();
            const m = txt.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (!m) return Math.floor(Date.now() / 1000);

            const [_, h, min, s, d, mon, y] = m.map(Number);
            const serverDate = new Date(y, mon - 1, d, h, min, s);
            const localDate = new Date();
            
            this.offset = Math.floor((serverDate.getTime() - localDate.getTime()) / 1000);
            this.lastUpdate = Date.now();
            
            return Math.floor(serverDate.getTime() / 1000);
        }

        getCurrentTime() {
            return Math.floor((Date.now() / 1000) + this.offset);
        }

        startAutoUpdate() {
            this.updateInterval = setInterval(() => {
                this.getServerTime();
            }, 30000); // Actualizar cada 30 segundos
        }

        stopAutoUpdate() {
            if (this.updateInterval) clearInterval(this.updateInterval);
        }
    }

    const timeManager = new ServerTimeManager();
    timeManager.startAutoUpdate();

    const PANEL_ID = 'script-panel';
    const ENCAIXE_ID = 'painel-encaixe-ataque';
    const STORAGE_KEY = 'bot_grepo_config_v1';

    let ordenesCapturadas = [];
    let botActivo = false;
    let botAtaqueActivo = false;
    let botAutoActivo = false;
    let ordenActualIndex = 0;
    let modoActual = 'planner';
    let retrocesoTimers = {};

    const VELOCIDADES = {
        'rapido': 1,
        'normal': 1.5,
        'lento': 3
    };

    const EDIFICIOS = {
        'main': 'Senado',
        'barracks': 'Cuartel',
        'academy': 'Academia',
        'temple': 'Templo',
        'market': 'Mercado',
        'docks': 'Puerto',
        'farm': 'Granja',
        'storage': 'Almacén',
        'hide': 'Cueva',
        'wall': 'Muralla',
        'tower': 'Torre',
        'timber_camp': 'Aserradero',
        'stoner': 'Cantera',
        'ironer': 'Mina de plata',
        'theater': 'Teatro'
    };

    const TROPAS = {
        'sword': 'Espadachín',
        'slinger': 'Hondero',
        'archer': 'Arquero',
        'hoplite': 'Hoplita',
        'rider': 'Jinete',
        'chariot': 'Carro',
        'catapult': 'Catapulta'
    };

    const BARCOS = {
        'big_transporter': 'Barco de transporte rápido',
        'bireme': 'Birreme',
        'attack_ship': 'Barco de ataque',
        'demolition_ship': 'Barco demoledor',
        'small_transporter': 'Barco de transporte',
        'trireme': 'Trirreme',
        'colonize_ship': 'Barco colonizador'
    };

    const MITICAS = {
        'godsent': 'Enviado divino',
        'harpy': 'Arpía',
        'medusa': 'Medusa',
        'centaur': 'Centauro',
        'pegasus': 'Pegaso',
        'cerberus': 'Cerbero',
        'fury': 'Furia',
        'griffin': 'Grifo',
        'calydonian_boar': 'Jabalí de Calidón',
        'hydra': 'Hidra',
        'sea_monster': 'Monstruo marino',
        'cyclops': 'Cíclope',
        'minotaur': 'Minotauro',
        'manticore': 'Mantícora',
        'erinys': 'Erinia'
    };

    const FESTIVALES = {
        'party': 'Fiesta olímpica',
        'theater': 'Representaciones teatrales',
        'triumph': 'Desfile triunfal'
    };

    const TECNOLOGIAS = {
        'slinger': 'Hondero', 'archer': 'Arquero', 'hoplite': 'Hoplita', 'city_guard': 'Guardia ciudad',
        'diplomacy': 'Diplomacia', 'booty': 'Botín', 'pottery': 'Cerámica', 'rider': 'Jinete',
        'architecture': 'Arquitectura', 'instructor': 'Instructor', 'bireme': 'Birreme', 'building_crane': 'Grúa',
        'meteorology': 'Meteorología', 'conscription': 'Leva', 'shipwright': 'Carpintero', 'colonize_ship': 'Colonizadora',
        'chariot': 'Carro', 'attack_ship': 'Incendiaria', 'demolition_ship': 'Brulote', 'small_transporter': 'Bote Rápido',
        'catapult': 'Catapulta', 'cryptography': 'Criptografía', 'democracy': 'Democracia', 'big_transporter': 'Bote Lento',
        'plow': 'Arado', 'berth': 'Literas', 'trireme': 'Trirreme', 'phalanx': 'Falange',
        'breach': 'Penetración', 'mathematics': 'Matemáticas', 'ram': 'Ariete', 'cartography': 'Cartografía',
        'take_over': 'Conquista', 'stone_storm': 'Lluvia Piedras', 'temple_looting': 'Saqueo Templo', 'divine_selection': 'Sel. Divina',
        'combat_experience': 'Exp. Combate', 'strong_wine': 'Vino Fuerte', 'set_sail': 'Zarpar'
    };

    function criarPanelPrincipal() {
        const existente = document.getElementById(PANEL_ID);
        if (existente) existente.remove();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:9999;background:#1e1e2f;color:#fff;padding:8px;border-radius:6px;font-family:Arial,sans-serif;font-size:11px;cursor:pointer;border:2px solid #444;box-shadow:0 0 10px #000;';
        panel.innerHTML = `<strong>🤖 V11.80.2</strong>`;
        panel.onclick = criarPanelEncaixe;
        document.body.appendChild(panel);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (botActivo) {
                    pararProceso();
                    soundManager.play('warning');
                }
                const p = document.getElementById(ENCAIXE_ID);
                if (p) p.style.display = 'none';
            }
        });

        setTimeout(criarPanelEncaixe, randomDelay());
    }

    function criarPanelEncaixe() {
        const existente = document.getElementById(ENCAIXE_ID);
        if (existente) existente.remove();

        const panel = document.createElement('div');
        panel.id = ENCAIXE_ID;
        panel.style.cssText = `
            position:fixed;top:100px;left:50%;margin-left:-160px;
            z-index:9999;background:#1c1c2c;border:2px solid #333;
            border-radius:10px;width:320px;color:#ccc;font-family:Arial,sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        const generarCheckboxes = (obj, clase) => {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:150px;overflow-y:auto;padding:4px;background:#111;border:1px solid #333;border-radius:4px;">';
            for (const [key, label] of Object.entries(obj)) {
                html += `
                    <label style="font-size:10px;display:flex;align-items:center;cursor:pointer;color:#aaa;">
                        <input type="checkbox" class="${clase}" value="${key}" style="margin-right:4px;">
                        ${label}
                    </label>
                `;
            }
            html += '</div>';
            return html;
        };

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
                <h3 style="margin:0;color:#60a5fa;font-size:13px;">⚔️ Bot V11.80.2 (Mejorado)</h3>
                <button id="btn-ocultar" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;">✖</button>
            </div>

            <!-- PESTAÑAS -->
            <div style="display:flex;background:#111;border-bottom:1px solid #333;flex-wrap:wrap;">
                <button id="tab-planner" style="flex:1;padding:6px;background:#2a2a3a;color:#fff;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;min-width:50px;">⚔️ PLAN</button>
                <button id="tab-dodge" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;min-width:50px;">🏃 DODGE</button>
                <button id="tab-history" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;min-width:50px;">📜 HIST</button>
                <button id="tab-settings" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;min-width:50px;">⚙️ CONFIG</button>
            </div>

            <div style="padding:10px; max-height: 80vh; overflow-y: auto;">

                <!-- HORA SERVER EN TIEMPO REAL -->
                <div style="background:#111;padding:4px;border-radius:4px;margin-bottom:8px;text-align:center;font-size:11px;">
                    Hora: <span id="server-time" style="color:#0f0;font-weight:bold;">--:--:--</span>
                </div>

                <!-- CONTENIDO PLANNER -->
                <div id="content-planner">
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

                    <div style="background:#222;padding:6px;border-radius:4px;margin-bottom:8px;border:1px solid #444;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div style="text-align:center;">
                                <label style="font-size:10px;color:#4caf50;font-weight:bold;">🛡️ DEF (+)</label>
                                <input type="number" id="tol-defensa" value="3" min="0" max="20"
                                    style="width:100%;background:#1a2a1a;color:#4caf50;border:1px solid #4caf50;padding:3px;border-radius:3px;text-align:center;font-size:12px;font-weight:bold;">
                            </div>
                            <div style="text-align:center;">
                                <label style="font-size:10px;color:#ff5252;font-weight:bold;">⚔️ ATK (-)</label>
                                <input type="number" id="tol-ataque" value="0" min="0" max="20"
                                    style="width:100%;background:#2a1a1a;color:#ff5252;border:1px solid #ff5252;padding:3px;border-radius:3px;text-align:center;font-size:12px;font-weight:bold;">
                            </div>
                        </div>
                    </div>

                    <button id="btn-capturar" style="width:100%;padding:6px;background:#444;color:#fff;border:none;border-radius:4px;margin-bottom:6px;font-weight:bold;cursor:pointer;font-size:11px;">
                        🔍 Capturar
                    </button>
                </div>

                <!-- HISTORIAL DE ATAQUES -->
                <div id="content-history" style="display:none;">
                    <div style="background:#1a2a1a;padding:8px;border-radius:4px;border:1px solid #4caf50;margin-bottom:8px;">
                        <div style="text-align:center;margin-bottom:6px;color:#4caf50;font-weight:bold;">📜 HISTORIAL</div>
                        <button id="btn-clear-history" style="width:100%;padding:4px;background:#f44336;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;margin-bottom:6px;">🗑️ Limpiar Historial</button>
                        <div id="history-list" style="background:#111;padding:6px;border-radius:3px;max-height:200px;overflow-y:auto;font-size:9px;color:#aaa;"></div>
                    </div>
                </div>

                <!-- CONFIGURACIÓN -->
                <div id="content-settings" style="display:none;">
                    <div style="background:#1a1a2a;padding:8px;border-radius:4px;border:1px solid #60a5fa;margin-bottom:8px;">
                        <div style="text-align:center;margin-bottom:6px;color:#60a5fa;font-weight:bold;">⚙️ CONFIGURACIÓN</div>
                        
                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;color:#aaa;display:flex;align-items:center;cursor:pointer;">
                                <input type="checkbox" id="chk-sonidos" checked style="margin-right:6px;">
                                🔊 Sonidos Activados
                            </label>
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;color:#aaa;">Volumen Sonido:</label>
                            <input type="range" id="volume-control" min="0" max="100" value="70" style="width:100%;">
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Navegador:</label>
                            <div style="background:#111;padding:4px;border-radius:3px;color:#0f0;font-size:9px;">
                                ${navigator.userAgent.includes('Firefox') ? '🦊 Firefox' : navigator.userAgent.includes('Chrome') ? '🌐 Chrome' : '📱 Otro'}
                            </div>
                        </div>
                    </div>
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

        loadSettings();

        document.getElementById('tab-planner').onclick = () => switchTab('planner');
        document.getElementById('tab-dodge').onclick = () => switchTab('dodge');
        document.getElementById('tab-history').onclick = () => switchTab('history');
        document.getElementById('tab-settings').onclick = () => switchTab('settings');
        document.getElementById('btn-clear-history').onclick = () => {
            localStorage.removeItem(HISTORY_KEY);
            actualizarHistorial();
            soundManager.play('success');
        };

        document.getElementById('chk-sonidos').addEventListener('change', (e) => {
            soundManager.enabled = e.target.checked;
        });

        document.getElementById('volume-control').addEventListener('change', (e) => {
            soundManager.setVolume(e.target.value / 100);
        });

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
            panel.style.setProperty('left', `${initialLeft + dx}px`, 'important');
            panel.style.setProperty('top', `${initialTop + dy}px`, 'important');
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });

        document.getElementById('btn-ocultar').onclick = () => {
            panel.style.display = 'none';
        };

        // Actualizar hora en tiempo real
        setInterval(() => {
            const st = timeManager.getCurrentTime();
            const el = document.getElementById('server-time');
            if (st && el) {
                const d = new Date(st * 1000);
                el.textContent = d.toTimeString().substr(0, 8);
            }
        }, 500);

        document.getElementById('btn-capturar').onclick = capturarAtaques;
        document.getElementById('btn-iniciar').onclick = iniciarProceso;
        document.getElementById('btn-parar').onclick = pararProceso;

        actualizarHistorial();
    }

    function actualizarHistorial() {
        const histList = document.getElementById('history-list');
        const historia = obtenerHistorial();
        
        if (historia.length === 0) {
            histList.innerHTML = '<div style="color:#666;">Sin historial</div>';
            return;
        }

        histList.innerHTML = historia.slice(0, 20).map((h, i) => {
            const fecha = new Date(h.timestamp).toLocaleTimeString();
            return `<div style="margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:4px;">
                <strong>${h.hora}</strong> - ${h.tipo} (${fecha})
            </div>`;
        }).join('');
    }

    function switchTab(tab) {
        modoActual = tab;
        const tabs = ['planner', 'dodge', 'history', 'settings'];
        const tabButtons = {
            'planner': 'tab-planner',
            'dodge': 'tab-dodge',
            'history': 'tab-history',
            'settings': 'tab-settings'
        };

        tabs.forEach(t => {
            const btn = document.getElementById(tabButtons[t]);
            const content = document.getElementById(`content-${t}`);
            if (btn) {
                btn.style.background = t === tab ? '#2a2a3a' : '#111';
                btn.style.color = t === tab ? '#fff' : '#888';
            }
            if (content) content.style.display = t === tab ? 'block' : 'none';
        });

        if (tab === 'history') actualizarHistorial();
    }

    function saveSettings() {
        const config = {
            segundoObj: document.getElementById('segundo-obj').value,
            antelacion: document.getElementById('antelacion').value,
            tolDef: document.getElementById('tol-defensa').value,
            tolAtk: document.getElementById('tol-ataque').value
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
                if (c.tolDef !== undefined) document.getElementById('tol-defensa').value = c.tolDef;
                if (c.tolAtk !== undefined) document.getElementById('tol-ataque').value = c.tolAtk;
            } catch (e) {
                console.error('Error cargando config', e);
            }
        }
    }

    async function capturarAtaques() {
        const resultado = document.getElementById('resultado');
        resultado.innerHTML = '<span style="color:#ff0;">⏳ Escaneando...</span>';

        ordenesCapturadas = [];
        const ataquesTemp = [];

        const filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));

        filas.forEach(fila => {
            const txt = fila.textContent;
            const m = txt.match(/(?:Partida|Departure):.*?(\d{1,2}):(\d{2}):(\d{2})/i);
            if (!m) return;

            ataquesTemp.push({
                hora: `${m[1]}:${m[2]}:${m[3]}`,
                tipo: '⚔️ ATK',
                resultado: 'capturado'
            });
        });

        if (ataquesTemp.length === 0) {
            resultado.innerHTML = '<span style="color:#f00;">❌ 0 ataques</span>';
            return;
        }

        ordenesCapturadas = ataquesTemp;
        ataquesTemp.forEach(a => agregarAlHistorial(a));

        let html = `<strong style="color:#0f0;">✅ ${ataquesTemp.length} órdenes:</strong><br>`;
        ataquesTemp.forEach((a, i) => {
            html += `<div style="font-size:10px;${i === 0 ? 'font-weight:bold;color:#fff;' : 'color:#888;'}">[${i + 1}] ${a.hora}</div>`;
        });

        resultado.innerHTML = html;
        soundManager.play('success');
        console.log(`✅ Capturados ${ataquesTemp.length} ataques`);
    }

    function iniciarProceso() {
        botActivo = true;
        soundManager.play('custom', 600);
        document.getElementById('resultado').innerHTML = '<span style="color:#0f0;">▶️ INICIADO</span>';
    }

    function pararProceso() {
        botActivo = false;
        soundManager.play('warning');
        document.getElementById('resultado').innerHTML += '<br><span style="color:#f00;">⛔ DETENIDO</span>';
    }

    if (window.top === window.self) {
        (function init() {
            if (document.body) criarPanelPrincipal();
            else setTimeout(init, randomDelay());
        })();
    }
})();