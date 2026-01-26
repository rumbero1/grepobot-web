// ==UserScript==
// @name         Bot Grepolis - V11.80 ULTIMATE
// @namespace    http://tampermonkey.net/
// @version      11.80.1
// @description  V11.80: Academy Global Search + Recruit Multi-Window + UI Fixes.
// @author       TuNombre
// @match        https://*.grepolis.com/game/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'script-panel';
    const ENCAIXE_ID = 'painel-encaixe-ataque';
    const STORAGE_KEY = 'bot_grepo_config_v1';

    let ordenesCapturadas = [];
    let botActivo = false; // Legacy / General
    let botAtaqueActivo = false;
    let botAutoActivo = false;
    let ordenActualIndex = 0;
    let audioContext = null;
    let modoActual = 'planner';
    let retrocesoTimers = {};

    // FACTORES DE VELOCIDAD
    const VELOCIDADES = {
        'rapido': 1,
        'normal': 1.5,
        'lento': 3
    };

    // EDIFICIOS
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

    // TROPAS TERRESTRES
    const TROPAS = {
        'sword': 'Espadachín',
        'slinger': 'Hondero',
        'archer': 'Arquero',
        'hoplite': 'Hoplita',
        'rider': 'Jinete',
        'chariot': 'Carro',
        'catapult': 'Catapulta'
    };

    // TROPAS NAVALES
    const BARCOS = {
        'big_transporter': 'Barco de transporte rápido',
        'bireme': 'Birreme',
        'attack_ship': 'Barco de ataque',
        'demolition_ship': 'Barco demoledor',
        'small_transporter': 'Barco de transporte',
        'trireme': 'Trirreme',
        'colonize_ship': 'Barco colonizador'
    };

    // TROPAS MÍTICASssss
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

    // FESTIVALES CULTURALES
    const FESTIVALES = {
        'party': 'Festival de la ciudad',
        'games': 'Juegos Olímpicos',
        'theater': 'Representaciones teatrales',
        'triumph': 'Desfile triunfal'
    };

    // INVESTIGACIONES ACADEMIA
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
        panel.innerHTML = `<strong>🤖 V11.39</strong>`;
        panel.onclick = criarPanelEncaixe;
        document.body.appendChild(panel);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (botActivo) {
                    pararProceso();
                    playBeep(150, 300, 'sawtooth');
                }
                const p = document.getElementById(ENCAIXE_ID);
                if (p) p.style.display = 'none';
            }
        });

        setTimeout(criarPanelEncaixe, 500);
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

        // Generar HTML de checkboxes
        const generarCheckboxes = (obj, clase) => {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:150px;overflow-y:auto;padding:4px;background:#111;border:1px solid #333;border-radius:4px;">';
            for (const [key, label] of Object.entries(obj)) {
                const isBuild = clase === 'build-item';
                const isRecruit = clase === 'recruit-item';
                const limitClass = isBuild ? 'build-limit' : (isRecruit ? 'recruit-limit' : '');
                const defaultValue = isBuild ? '99' : '9999';

                html += `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:2px;border-bottom:1px solid #222;">
                        <label style="font-size:10px;display:flex;align-items:center;cursor:pointer;color:#aaa;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            <input type="checkbox" class="${clase}" value="${key}" style="margin-right:4px;">
                            ${label}
                        </label>
                        ${limitClass ? `<input type="number" class="${limitClass}" data-id="${key}" value="${defaultValue}" min="0" style="width:35px;background:#333;color:#fff;border:1px solid #555;font-size:9px;text-align:center;margin-left:4px;">` : ''}
                    </div>
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
                <h3 style="margin:0;color:#60a5fa;font-size:13px;">⚔️ Bot V11.80 (Fix)</h3>
                <button id="btn-ocultar" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;">✖</button>
            </div>

            <!-- PESTAÑAS (Fila 1) -->
            <div style="display:flex;background:#111;border-bottom:1px solid #333;">
                <button id="tab-planner" style="flex:1;padding:6px;background:#2a2a3a;color:#fff;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">⚔️ PLAN</button>
                <button id="tab-dodge" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">🏃 DODGE</button>
                <button id="tab-cave" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">🏛️ CAVE</button>
                <button id="tab-farm" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🚜 FARM</button>
            </div>
            <!-- PESTAÑAS (Fila 2) -->
            <div style="display:flex;background:#111;border-bottom:1px solid #333;">
                <button id="tab-build" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">🏗️ BUILD</button>
                <button id="tab-recruit" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">⚔️ RECR</button>
                <button id="tab-culture" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">🎭 CULT</button>
                <button id="tab-academy" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;border-right:1px solid #333;font-size:9px;">📚 ACAD</button>
                <button id="tab-auto" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🤖 AUTO</button>
            </div>

            <div style="padding:10px; max-height: 80vh; overflow-y: auto;">

                <!-- HORA SERVER -->
                <div style="background:#111;padding:4px;border-radius:4px;margin-bottom:8px;text-align:center;font-size:11px;">
                    Hora: <span id="server-time" style="color:#0f0;">--:--:--</span>
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

                    <div style="margin-bottom:8px;">
                        <select id="modo-deteccion" style="width:100%;background:#222;color:#fff;border:1px solid #555;padding:3px;border-radius:3px;font-size:11px;">
                            <option value="auto">🤖 Auto (Detectar)</option>
                            <option value="forzar_ataque">⚔️ FORZAR ATAQUE</option>
                            <option value="forzar_defensa" selected>🛡️ FORZAR DEFENSA</option>
                        </select>
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

                <!-- CONTENIDO AUTODODGE -->
                <div id="content-dodge" style="display:none;">
                    <div style="background:#221a1a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #c62828;">
                        <div style="text-align:center;margin-bottom:6px;color:#ff8a80;font-weight:bold;">🏃 ESQUIVA PROGRAMADA</div>

                        <div style="font-size:10px;color:#ccc;margin-bottom:8px;text-align:left;line-height:1.4;">
                            1. Abre la ventana de ataque.<br>
                            2. Pon la hora exacta de vuelta.<br>
                            3. Dale a Iniciar y <strong>NO cierres la ventana</strong>.
                        </div>

                        <div style="display:flex;gap:4px;justify-content:center;align-items:center;margin-bottom:8px;">
                            <input type="number" id="dodge-h" placeholder="HH" min="0" max="23" style="width:40px;background:#333;color:#fff;border:1px solid #555;padding:4px;text-align:center;">
                            :
                            <input type="number" id="dodge-m" placeholder="MM" min="0" max="59" style="width:40px;background:#333;color:#fff;border:1px solid #555;padding:4px;text-align:center;">
                            :
                            <input type="number" id="dodge-s" placeholder="SS" min="0" max="59" style="width:40px;background:#333;color:#fff;border:2px solid #ff5252;padding:4px;text-align:center;font-weight:bold;">
                        </div>

                        <div style="margin-bottom:8px;text-align:center;">
                            <label style="font-size:10px;color:#aaa;">Corrección (s):</label>
                            <input type="number" id="dodge-correction" value="-1" step="0.5" style="width:50px;background:#333;color:#fff;border:1px solid #555;padding:2px;text-align:center;font-size:11px;">
                        </div>

                        <button id="btn-check-btn" style="width:100%;padding:4px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar si veo el botón
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO CUEVA -->
                <div id="content-cave" style="display:none;">
                    <div style="background:#1a2a3a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #448aff;">
                        <div style="text-align:center;margin-bottom:6px;color:#448aff;font-weight:bold;">🏛️ AUTOCAVE</div>

                        <div style="font-size:10px;color:#ccc;margin-bottom:8px;text-align:left;">
                            Guarda plata automáticamente cuando sobra.
                            <br><strong>Requiere ventana de Cueva abierta.</strong>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                            <div>
                                <label style="font-size:10px;">Min Plata:</label>
                                <input type="number" id="cave-min" value="1000" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                            </div>
                            <div>
                                <label style="font-size:10px;">Intervalo (min):</label>
                                <input type="number" id="cave-interval" value="30" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                            </div>
                        </div>

                         <div style="margin-bottom:8px;text-align:center;">
                            <label style="font-size:10px;color:#aaa;">Meter de golpe:</label>
                            <input type="number" id="cave-amount" value="3000" style="width:60px;background:#333;color:#fff;border:1px solid #555;padding:2px;text-align:center;font-size:11px;">
                        </div>

                        <button id="btn-check-cave" style="width:100%;padding:4px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar ventana Cueva
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO FARM -->
                <div id="content-farm" style="display:none;">
                    <div style="background:#1a2a1a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #4caf50;">
                        <div style="text-align:center;margin-bottom:6px;color:#4caf50;font-weight:bold;">🚜 AUTOFARM (CAPITÁN)</div>

                        <div style="font-size:10px;color:#ccc;margin-bottom:8px;text-align:left;">
                            Recolecta recursos de todas las aldeas.
                            <br><strong>Abre la "Vista General de Aldeas".</strong>
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Tiempo de recolección:</label>
                            <select id="farm-interval" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:3px;border-radius:3px;font-size:11px;">
                                <option value="5" selected>5 Minutos</option>
                                <option value="10">10 Minutos</option>
                                <option value="20">20 Minutos</option>
                                <option value="40">40 Minutos</option>
                            </select>
                        </div>

                        <button id="btn-check-farm" style="width:100%;padding:4px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar Vista Aldeas
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO BUILD -->
                <div id="content-build" style="display:none;">
                    <div style="background:#2a1a1a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #ff6b35;">
                        <div style="text-align:center;margin-bottom:6px;color:#ff6b35;font-weight:bold;">🏗️ AUTOBUILD</div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Intervalo (min):</label>
                            <input type="number" id="build-interval" value="10" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                        </div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:4px;">Edificios permitidos:</div>
                        ${generarCheckboxes(EDIFICIOS, 'build-item')}
                        <button id="btn-check-build" style="width:100%;padding:4px;margin-top:6px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar Senado
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO RECRUIT -->
                <div id="content-recruit" style="display:none;">
                    <div style="background:#1a1a2a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #8b5cf6;">
                        <div style="text-align:center;margin-bottom:6px;color:#8b5cf6;font-weight:bold;">⚔️ AUTORECRUIT</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                            <div>
                                <label style="font-size:10px;">Intervalo:</label>
                                <input type="number" id="recruit-interval" value="5" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                            </div>
                            <div>
                                <label style="font-size:10px;">Cantidad:</label>
                                <input type="number" id="recruit-amount" value="10" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                            </div>
                        </div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:4px;">Unidades permitidas:</div>
                        ${generarCheckboxes({ ...TROPAS, ...BARCOS, ...MITICAS }, 'recruit-item')}
                        <button id="btn-check-recruit" style="width:100%;padding:4px;margin-top:6px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar Cuartel/Puerto
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO CULTURE -->
                <div id="content-culture" style="display:none;">
                    <div style="background:#1a2a2a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #10b981;">
                        <div style="text-align:center;margin-bottom:6px;color:#10b981;font-weight:bold;">🎭 AUTOCULTURE</div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Intervalo (min):</label>
                            <input type="number" id="culture-interval" value="30" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                        </div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:4px;">Festivales permitidos:</div>
                        ${generarCheckboxes(FESTIVALES, 'culture-item')}
                        <button id="btn-check-culture" style="width:100%;padding:4px;margin-top:6px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar Ágora
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO ACADEMY -->
                <div id="content-academy" style="display:none;">
                    <div style="background:#2a2a1a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #f59e0b;">
                        <div style="text-align:center;margin-bottom:6px;color:#f59e0b;font-weight:bold;">📚 AUTOACADEMY</div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Intervalo (min):</label>
                            <input type="number" id="academy-interval" value="15" min="1" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                        </div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:4px;">Investigaciones permitidas:</div>
                        ${generarCheckboxes(TECNOLOGIAS, 'academy-item')}
                        <button id="btn-check-academy" style="width:100%;padding:4px;margin-top:6px;background:#333;color:#aaa;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;">
                            👁️ Verificar Academia
                        </button>
                    </div>
                </div>

                <!-- CONTENIDO AUTO (SUPER-AUTO) -->
                <div id="content-auto" style="display:none;">
                    <div style="background:#1a1a2a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #60a5fa;">
                        <div style="text-align:center;margin-bottom:6px;color:#60a5fa;font-weight:bold;">🤖 SUPER-AUTO</div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:8px;text-align:left;">
                            Ejecuta todos los modos seleccionados en ciclo.
                        </div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:10px;">Ciclo completo (min):</label>
                            <input type="number" id="auto-cycle" value="60" min="10" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:11px;">
                        </div>
                        <div style="font-size:10px;color:#ccc;margin-bottom:4px;">Tareas del ciclo:</div>
                        ${generarCheckboxes({
            'build': '🏗️ Build',
            'recruit': '⚔️ Recruit',
            'culture': '🎭 Culture',
            'academy': '📚 Academy',
            'farm': '🚜 Farm',
            'cave': '🏛️ Cave'
        }, 'auto-task')}
                    </div>
                </div>

                <!-- COMUNES -->
                <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
                    <select id="velocidad-bot" style="flex:1;background:#333;color:#fff;border:1px solid #555;padding:2px;border-radius:3px;font-size:10px;min-width:80px;">
                        <option value="rapido" selected>⚡ Rápido</option>
                        <option value="normal">🚶 Normal</option>
                        <option value="lento">🐢 Lento</option>
                    </select>
                    <label style="font-size:9px;color:#fff;display:flex;align-items:center;cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" id="chk-no-cancelar" style="margin-right:4px;">
                        🚫 No Cancelar
                    </label>
                    <label style="font-size:9px;color:#fff;display:flex;align-items:center;cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" id="chk-multi-city" style="margin-right:4px;">
                        🌍 Multi-Ciudad
                    </label>
                </div>

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

        loadSettings();

        document.getElementById('tab-planner').onclick = () => switchTab('planner');
        document.getElementById('tab-dodge').onclick = () => switchTab('dodge');
        document.getElementById('tab-cave').onclick = () => switchTab('cave');
        document.getElementById('tab-farm').onclick = () => switchTab('farm');
        document.getElementById('tab-build').onclick = () => switchTab('build');
        document.getElementById('tab-recruit').onclick = () => switchTab('recruit');
        document.getElementById('tab-culture').onclick = () => switchTab('culture');
        document.getElementById('tab-academy').onclick = () => switchTab('academy');
        document.getElementById('tab-auto').onclick = () => switchTab('auto');

        document.getElementById('btn-check-btn').onclick = verificarBotonManual;
        document.getElementById('btn-check-cave').onclick = verificarVentanaCueva;
        document.getElementById('btn-check-farm').onclick = verificarVentanaFarm;
        document.getElementById('btn-check-build').onclick = verificarVentanaBuild;
        document.getElementById('btn-check-recruit').onclick = verificarVentanaRecruit;
        document.getElementById('btn-check-culture').onclick = verificarVentanaAgora;
        document.getElementById('btn-check-academy').onclick = verificarVentanaAcademia;

        const inputs = ['segundo-obj', 'antelacion', 'modo-deteccion', 'tol-defensa', 'tol-ataque', 'velocidad-bot', 'chk-no-cancelar', 'chk-multi-city', 'dodge-h', 'dodge-m', 'dodge-s', 'dodge-correction', 'cave-min', 'cave-interval', 'cave-amount', 'farm-interval', 'build-interval', 'recruit-interval', 'recruit-amount', 'culture-interval', 'academy-interval', 'auto-cycle'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', saveSettings);
        });

        // Listeners para checkboxes dinámicos
        document.querySelectorAll('.build-item, .recruit-item, .culture-item, .academy-item, .auto-task').forEach(el => {
            el.addEventListener('change', saveSettings);
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
            panel.style.setProperty('margin', '0', 'important');
            panel.style.setProperty('transform', 'none', 'important');
            panel.style.setProperty('bottom', 'auto', 'important');
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

    function switchTab(tab) {
        modoActual = tab;
        const btnPlanner = document.getElementById('tab-planner');
        const btnDodge = document.getElementById('tab-dodge');
        const btnCave = document.getElementById('tab-cave');
        const btnFarm = document.getElementById('tab-farm');
        const btnBuild = document.getElementById('tab-build');
        const btnRecruit = document.getElementById('tab-recruit');
        const btnCulture = document.getElementById('tab-culture');
        const btnAcademy = document.getElementById('tab-academy');
        const btnAuto = document.getElementById('tab-auto');

        const contentPlanner = document.getElementById('content-planner');
        const contentDodge = document.getElementById('content-dodge');
        const contentCave = document.getElementById('content-cave');
        const contentFarm = document.getElementById('content-farm');
        const contentBuild = document.getElementById('content-build');
        const contentRecruit = document.getElementById('content-recruit');
        const contentCulture = document.getElementById('content-culture');
        const contentAcademy = document.getElementById('content-academy');
        const contentAuto = document.getElementById('content-auto');

        // Reset styles
        [btnPlanner, btnDodge, btnCave, btnFarm, btnBuild, btnRecruit, btnCulture, btnAcademy, btnAuto].forEach(b => {
            b.style.background = '#111';
            b.style.color = '#888';
        });
        [contentPlanner, contentDodge, contentCave, contentFarm, contentBuild, contentRecruit, contentCulture, contentAcademy, contentAuto].forEach(c => c.style.display = 'none');

        // Activate selected
        if (tab === 'planner') {
            btnPlanner.style.background = '#2a2a3a';
            btnPlanner.style.color = '#fff';
            contentPlanner.style.display = 'block';
        } else if (tab === 'dodge') {
            btnDodge.style.background = '#2a2a3a';
            btnDodge.style.color = '#fff';
            contentDodge.style.display = 'block';
        } else if (tab === 'cave') {
            btnCave.style.background = '#1a2a3a';
            btnCave.style.color = '#448aff';
            contentCave.style.display = 'block';
        } else if (tab === 'farm') {
            btnFarm.style.background = '#1a1a1a';
            btnFarm.style.color = '#4caf50';
            contentFarm.style.display = 'block';
        } else if (tab === 'build') {
            btnBuild.style.background = '#2a1a1a';
            btnBuild.style.color = '#ff6b35';
            contentBuild.style.display = 'block';
        } else if (tab === 'recruit') {
            btnRecruit.style.background = '#1a1a2a';
            btnRecruit.style.color = '#8b5cf6';
            contentRecruit.style.display = 'block';
        } else if (tab === 'culture') {
            btnCulture.style.background = '#1a2a2a';
            btnCulture.style.color = '#10b981';
            contentCulture.style.display = 'block';
        } else if (tab === 'academy') {
            btnAcademy.style.background = '#2a2a1a';
            btnAcademy.style.color = '#f59e0b';
            contentAcademy.style.display = 'block';
        } else if (tab === 'auto') {
            btnAuto.style.background = '#1a1a2a';
            btnAuto.style.color = '#60a5fa';
            contentAuto.style.display = 'block';
        }
    }

    function saveSettings() {
        const config = {
            segundoObj: document.getElementById('segundo-obj').value,
            antelacion: document.getElementById('antelacion').value,
            modo: document.getElementById('modo-deteccion').value,
            tolDef: document.getElementById('tol-defensa').value,
            tolAtk: document.getElementById('tol-ataque').value,
            velocidad: document.getElementById('velocidad-bot').value,
            noCancelar: document.getElementById('chk-no-cancelar').checked,
            multiCity: document.getElementById('chk-multi-city')?.checked || false,
            dodgeH: document.getElementById('dodge-h').value,
            dodgeM: document.getElementById('dodge-m').value,
            dodgeS: document.getElementById('dodge-s').value,
            dodgeCorr: document.getElementById('dodge-correction').value,
            caveMin: document.getElementById('cave-min').value,
            caveInterval: document.getElementById('cave-interval').value,
            caveAmount: document.getElementById('cave-amount').value,
            farmInterval: document.getElementById('farm-interval').value,
            buildInterval: document.getElementById('build-interval').value,
            recruitInterval: document.getElementById('recruit-interval').value,
            recruitAmount: document.getElementById('recruit-amount').value,
            cultureInterval: document.getElementById('culture-interval').value,
            academyInterval: document.getElementById('academy-interval').value,
            autoCycle: document.getElementById('auto-cycle').value,
            // Guardar checkboxes dinámicos
            buildItems: Array.from(document.querySelectorAll('.build-item:checked')).map(el => el.value),
            recruitItems: Array.from(document.querySelectorAll('.recruit-item:checked')).map(el => el.value),
            cultureItems: Array.from(document.querySelectorAll('.culture-item:checked')).map(el => el.value),
            academyItems: Array.from(document.querySelectorAll('.academy-item:checked')).map(el => el.value),
            autoTasks: Array.from(document.querySelectorAll('.auto-task:checked')).map(el => el.value),
            // Guardar límites
            buildLimits: Array.from(document.querySelectorAll('.build-limit')).map(el => ({ id: el.getAttribute('data-id'), val: el.value })),
            recruitLimits: Array.from(document.querySelectorAll('.recruit-limit')).map(el => ({ id: el.getAttribute('data-id'), val: el.value }))
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
                if (c.multiCity !== undefined) {
                    const el = document.getElementById('chk-multi-city');
                    if (el) el.checked = c.multiCity;
                }
                if (c.dodgeH !== undefined) document.getElementById('dodge-h').value = c.dodgeH;
                if (c.dodgeM !== undefined) document.getElementById('dodge-m').value = c.dodgeM;
                if (c.dodgeS !== undefined) document.getElementById('dodge-s').value = c.dodgeS;
                if (c.dodgeCorr !== undefined) document.getElementById('dodge-correction').value = c.dodgeCorr;
                if (c.caveMin !== undefined) document.getElementById('cave-min').value = c.caveMin;
                if (c.caveInterval !== undefined) document.getElementById('cave-interval').value = c.caveInterval;
                if (c.caveAmount !== undefined) document.getElementById('cave-amount').value = c.caveAmount;
                if (c.farmInterval !== undefined) document.getElementById('farm-interval').value = c.farmInterval;
                if (c.buildInterval !== undefined) document.getElementById('build-interval').value = c.buildInterval;
                if (c.recruitInterval !== undefined) document.getElementById('recruit-interval').value = c.recruitInterval;
                if (c.recruitAmount !== undefined) document.getElementById('recruit-amount').value = c.recruitAmount;
                if (c.cultureInterval !== undefined) document.getElementById('culture-interval').value = c.cultureInterval;
                if (c.academyInterval !== undefined) document.getElementById('academy-interval').value = c.academyInterval;
                if (c.autoCycle !== undefined) document.getElementById('auto-cycle').value = c.autoCycle;

                // Cargar checkboxes dinámicos
                const restoreChecks = (items, clase) => {
                    if (Array.isArray(items)) {
                        items.forEach(val => {
                            const el = document.querySelector(`.${clase}[value="${val}"]`);
                            if (el) el.checked = true;
                        });
                    }
                };

                restoreChecks(c.buildItems, 'build-item');
                restoreChecks(c.recruitItems, 'recruit-item');
                restoreChecks(c.cultureItems, 'culture-item');
                restoreChecks(c.academyItems, 'academy-item');
                restoreChecks(c.autoTasks, 'auto-task');

                // Restaurar límites
                if (Array.isArray(c.buildLimits)) {
                    c.buildLimits.forEach(item => {
                        const el = document.querySelector(`.build-limit[data-id="${item.id}"]`);
                        if (el) el.value = item.val;
                    });
                }
                if (Array.isArray(c.recruitLimits)) {
                    c.recruitLimits.forEach(item => {
                        const el = document.querySelector(`.recruit-limit[data-id="${item.id}"]`);
                        if (el) el.value = item.val;
                    });
                }

            } catch (e) {
                console.error('Error cargando config', e);
            }
        }
    }

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
        if (modoActual !== 'planner') {
            alert('Solo captura en modo Planner');
            return;
        }

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
        botActivo = true;
        document.getElementById('progress-container').style.display = 'block';
        playBeep(600, 100);

        if (modoActual === 'dodge') {
            procesarAutoDodge();
        } else if (modoActual === 'cave') {
            procesarAutoCave();
        } else if (modoActual === 'farm') {
            procesarAutoFarm();
        } else if (modoActual === 'build') {
            procesarAutoBuild();
        } else if (modoActual === 'recruit') {
            procesarAutoRecruit();
        } else if (modoActual === 'culture') {
            procesarAutoCulture();
        } else if (modoActual === 'academy') {
            procesarAutoAcademy();
        } else if (modoActual === 'auto') {
            procesarSuperAuto();
        } else {
            if (ordenesCapturadas.length === 0) {
                alert('❌ Captura primero');
                botActivo = false;
                return;
            }
            ordenActualIndex = 0;
            console.log(`🚀 Iniciando Planner...`);
            procesarOrden();
        }
    }

    function pararProceso() {
        botActivo = false;
        console.log('⛔ Detenido');
        document.getElementById('resultado').innerHTML += '<br><span style="color:#f00;">⛔ OFF</span>';
        document.getElementById('progress-container').style.display = 'none';

        Object.keys(retrocesoTimers).forEach(id => clearInterval(retrocesoTimers[id]));
        retrocesoTimers = {};
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
            playBeep(800, 300);
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
            const totalWait = 60;
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
                const diff = (seg - segundoObj);
                const sign = diff > 0 ? '+' : '';
                const tolMsg = diff === 0 ? 'Exacto' : `${sign}${diff}s`;

                document.getElementById('resultado').innerHTML = `
                    <div style="text-align:center;padding:5px;background:#0c0;color:#fff;border-radius:4px;">
                        <div style="font-size:14px;font-weight:bold;">✅ ¡CLAVADO!</div>
                        <div style="font-size:11px;">${seg}s (${tolMsg})</div>
                    </div>
                `;
                playBeep(1000, 200);
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

            const btnSupport = document.getElementById('btn_support_town');
            if (btnSupport && btnSupport.offsetParent !== null) {
                return btnSupport.querySelector('span') || btnSupport;
            }

            const botones = Array.from(document.querySelectorAll('a.button'));
            for (const btn of botones) {
                if (btn.offsetParent === null) continue;
                const mid = btn.querySelector('.middle');
                if (mid) {
                    const txt = mid.textContent.trim().toLowerCase();
                    if (txt === 'reforzar' || txt === 'support' || txt === 'atacar' || txt === 'attack' || txt === 'apoyar' || txt === 'apoyo' || txt === 'ataque') return btn;
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

    // --- FUNCIONES AUTODODGE ---
    async function procesarAutoDodge() {
        const h = parseInt(document.getElementById('dodge-h').value);
        const m = parseInt(document.getElementById('dodge-m').value);
        const s = parseInt(document.getElementById('dodge-s').value);
        const correction = parseFloat(document.getElementById('dodge-correction').value) || 0;
        const resultado = document.getElementById('resultado');

        if (isNaN(h) || isNaN(m) || isNaN(s)) {
            alert('❌ Configura la hora válida (HH:MM:SS)');
            botActivo = false;
            return;
        }

        const now = new Date(getServerTime() * 1000);
        let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);

        if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
        const launchWindowStart = targetTimestamp - 70;

        resultado.innerHTML = `<div style="color:#ff8a80;">⏳ Esperando ventana de lanzamiento...</div>`;

        while (botActivo) {
            const st = getServerTime();
            const diff = targetTimestamp - st;

            if (st >= launchWindowStart) break;

            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#ff8a80;font-weight:bold;">🏃 AUTODODGE</div>
                    <div style="color:#fff;">Meta: ${h}:${m}:${s}</div>
                    <div style="font-size:18px;color:#0af;">Faltan: ${diff}s</div>
                    <div style="font-size:10px;color:#888;">Lanzamiento en: ${diff - 60}s</div>
                </div>
            `;
            await esperar(1000);
        }

        if (!botActivo) return;

        resultado.innerHTML = `<div style="color:#ff0;">🎲 Buscando paridad...</div>`;

        while (botActivo) {
            const st = getServerTime();
            if ((targetTimestamp - st) % 2 === 0) {
                break;
            }
            await esperar(100);
        }

        if (!botActivo) return;

        const btn = await buscarBoton();
        if (!btn) {
            resultado.innerHTML = `<div style="color:#f00;">❌ No botón (Abre ventana)</div>`;
            botActivo = false;
            return;
        }

        const comandosAnteriores = new Set(Array.from(document.querySelectorAll('.js-command-row')).map(c => c.id));
        console.log(`DODGE: ${comandosAnteriores.size} comandos previos detectados.`);

        simularClick(btn);
        const launchTime = getServerTime();
        playBeep(800, 100);

        resultado.innerHTML = `<div style="color:#0f0;">🚀 Lanzado a :${launchTime % 60}</div>`;

        const travelTime = (targetTimestamp - launchTime) / 2;
        const cancelTime = launchTime + travelTime + correction;

        console.log(`DODGE: Launch ${launchTime}, Target ${targetTimestamp}, Cancel ${cancelTime} (Corr: ${correction})`);

        const cmd = await buscarComandoNuevo(comandosAnteriores);

        if (cmd) {
            armarRetroceso(cmd.id, cancelTime);
            resultado.innerHTML = `
                <div style="text-align:center;padding:5px;background:#0c0;color:#fff;border-radius:4px;">
                    <div style="font-size:14px;font-weight:bold;">✅ PROGRAMADO</div>
                    <div style="font-size:11px;">Cancelación automática</div>
                    <div style="font-size:10px;color:#eee;">Corrección: ${correction}s</div>
                </div>
            `;
            playBeep(1000, 300);
        } else {
            resultado.innerHTML += `<div style="color:#f00;">❌ No se detectó comando nuevo</div>`;
        }

        botActivo = false;
        document.getElementById('progress-container').style.display = 'none';
    }

    function armarRetroceso(comandoId, targetCancelTimestamp) {
        if (retrocesoTimers[comandoId]) clearInterval(retrocesoTimers[comandoId]);

        const cmd = document.getElementById(comandoId);
        if (!cmd) return;

        let timer = cmd.querySelector('.gp_bot_retroceso_timer');
        if (!timer) {
            timer = document.createElement('span');
            timer.className = 'gp_bot_retroceso_timer';
            timer.style.cssText = 'color:#ffae00;font-weight:bold;margin-left:10px;font-size:12px;background:#000;padding:2px;border-radius:3px;';

            const countdownContainer = cmd.querySelector('.countdown');
            if (countdownContainer && countdownContainer.parentElement) {
                countdownContainer.parentElement.appendChild(timer);
            } else {
                cmd.appendChild(timer);
            }
        }

        retrocesoTimers[comandoId] = setInterval(() => {
            const now = getServerTime();
            const restante = targetCancelTimestamp - now;

            if (!document.getElementById(comandoId)) {
                clearInterval(retrocesoTimers[comandoId]);
                delete retrocesoTimers[comandoId];
                return;
            }

            timer.textContent = `⏳ Cancel: ${restante.toFixed(1)}s`;

            if (restante <= 0) {
                const btn = document.getElementById(comandoId).querySelector('.game_arrow_delete, .btn_cancel, .icon_cancel');
                if (btn) {
                    console.log(`🔙 Ejecutando Retroceso: ${comandoId}`);
                    simularClick(btn);
                    playBeep(1200, 500);
                }
                clearInterval(retrocesoTimers[comandoId]);
                delete retrocesoTimers[comandoId];
                timer.textContent = "✅ CANCELADO";
                timer.style.color = "#0f0";
            }
        }, 200);
    }

    // --- FUNCIONES AUTOCAVE (NUEVO) ---
    async function procesarAutoCave() {
        const resultado = document.getElementById('resultado');
        const minPlata = parseInt(document.getElementById('cave-min').value) || 1000;
        const intervaloMin = parseInt(document.getElementById('cave-interval').value) || 30;
        const cantidadMeter = parseInt(document.getElementById('cave-amount').value) || 3000;

        resultado.innerHTML = `<div style="color:#448aff;">🏛️ AutoCave ACTIVO</div>`;

        while (botActivo) {
            // 1. Leer Plata
            let plataActual = 0;
            const resEl = document.querySelector('.ui_resources_bar .silver .amount, #res_silver_area, .res_silver, .resource_iron_icon .count');
            if (resEl) {
                const raw = resEl.textContent.replace(/\./g, '').trim();
                plataActual = parseInt(raw) || 0;
            }

            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#448aff;font-weight:bold;">🏛️ AUTOCAVE</div>
                    <div style="font-size:12px;color:#ccc;">Plata: ${plataActual.toLocaleString()} / Min: ${minPlata.toLocaleString()}</div>
                </div>
            `;

            // Solo meter si después de meter seguimos teniendo el mínimo
            if (plataActual >= (minPlata + cantidadMeter)) {
                resultado.innerHTML += `<div style="color:#ff0;font-size:10px;">⏳ Metiendo ${cantidadMeter}...</div>`;
                const exito = await intentarMeterPlata(cantidadMeter);
                if (exito) {
                    resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Guardado ${cantidadMeter}</div>`;
                    playBeep(800, 100);
                } else {
                    resultado.innerHTML += `<div style="color:#f00;font-size:10px;">❌ Abre la ventana de Cueva</div>`;
                }
            } else {
                resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Esperando a tener ${minPlata + cantidadMeter}...</div>`;
            }

            // Esperar el intervalo en minutos
            await esperar(intervaloMin * 60 * 1000);
        }
    }

    async function intentarMeterPlata(cantidad) {
        // 1. Intentar Ventana Individual
        const winIndividual = document.querySelector('.ui-dialog .hide_window, .ui-dialog .window_hide, .ui-dialog .window_building_hide');
        if (winIndividual) {
            const input = winIndividual.querySelector('input[name="store_silver"], input.silver_amount');
            const btn = winIndividual.querySelector('.btn_store, .button_new.store_silver');
            if (input && btn) {
                input.value = cantidad;
                input.dispatchEvent(new Event('change'));
                input.dispatchEvent(new Event('input'));
                await esperar(500);
                simularClick(btn);
                return true;
            }
        }

        // 2. Intentar Vista General (Hides Overview)
        const winOverview = document.getElementById('hides_overview_bottom');
        if (winOverview) {
            const input = winOverview.querySelector('#hides_overview_all_towns_iron_store input');
            const btn = document.getElementById('store_iron_in_all_towns');
            if (input && btn) {
                input.value = cantidad;
                input.dispatchEvent(new Event('change'));
                input.dispatchEvent(new Event('input'));
                await esperar(500);
                simularClick(btn);
                return true;
            }
        }

        return false;
    }

    async function verificarVentanaCueva() {
        const res = document.getElementById('resultado');

        const winInd = document.querySelector('.ui-dialog .hide_window, .ui-dialog .window_hide, .ui-dialog .window_building_hide');
        const winOve = document.getElementById('hides_overview_bottom');

        if (winInd) {
            res.innerHTML = `<div style="color:#0f0;">✅ Ventana Individual DETECTADA</div>`;
        } else if (winOve) {
            res.innerHTML = `<div style="color:#0f0;">✅ Vista General DETECTADA</div>`;
            const input = winOve.querySelector('#hides_overview_all_towns_iron_store input');
            const btn = document.getElementById('store_iron_in_all_towns');
            if (input && btn) {
                res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Input Global y Botón OK</div>`;
            } else {
                res.innerHTML += `<div style="color:#f00;font-size:10px;">❌ Falta Input/Botón Global</div>`;
            }
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo ninguna ventana de Cueva. Ábrela.</div>`;
        }
    }

    async function verificarBotonManual() {
        const btn = await buscarBoton();
        const res = document.getElementById('resultado');
        if (btn) {
            res.innerHTML = `<div style="color:#0f0;">✅ Botón DETECTADO: "${btn.innerText || 'Icono'}"</div>`;
            playBeep(800, 100);
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo el botón. Abre la ventana.</div>`;
            playBeep(200, 300);
        }
    }

    // --- FUNCIONES AUTOFARM (NUEVO) ---
    async function procesarAutoFarm() {
        const resultado = document.getElementById('resultado');
        const intervaloMin = parseInt(document.getElementById('farm-interval').value) || 5;

        resultado.innerHTML = `<div style="color:#4caf50;">🚜 AutoFarm ACTIVO</div>`;

        while (botActivo) {
            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#4caf50;font-weight:bold;">🚜 AUTOFARM</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervaloMin} min</div>
                </div>
            `;

            const exito = await recolectarAldeas();
            if (exito) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Recolectado OK</div>`;
                playBeep(800, 100);
            } else {
                resultado.innerHTML += `<div style="color:#f00;font-size:10px;">❌ Abre la Vista de Aldeas</div>`;
            }

            await esperar(intervaloMin * 60 * 1000);
        }
    }

    async function recolectarAldeas() {
        // 1. Buscar ventana (fto_town_wrapper es el ID del HTML que me pasaste)
        const win = document.querySelector('#fto_town_wrapper, #farm_town_overview, .farm_town_overview');
        if (!win) return false;

        // 2. Seleccionar todas las ciudades si no están seleccionadas
        const btnSelectAll = win.querySelector('.checkbox.select_all');
        if (btnSelectAll && !btnSelectAll.classList.contains('checked')) {
            simularClick(btnSelectAll);
            await esperar(500);
        }

        // 3. Seleccionar el tiempo (opcional, intenta marcar el que coincida con el bot)
        const farmMin = document.getElementById('farm-interval').value;
        const farmSec = farmMin * 60;
        const timeOpt = win.querySelector(`.fto_time_checkbox[data-option="${farmSec}"] .checkbox, .fto_time_checkbox.fto_${farmSec} .checkbox`);
        if (timeOpt && !timeOpt.classList.contains('checked')) {
            simularClick(timeOpt);
            await esperar(500);
        }

        // 4. Buscar botón "Collect" (fto_claim_button en tu HTML)
        const btnCollect = document.getElementById('fto_claim_button') || win.querySelector('.button.collect_resources, .btn_collect_resources, .collect_all_resources');

        if (btnCollect) {
            if (btnCollect.classList.contains('disabled')) {
                console.log('🚜 Botón deshabilitado (esperando tiempo)');
                return true; // Consideramos éxito porque la ventana está abierta
            }

            simularClick(btnCollect);
            await esperar(1000);

            // Confirmar si sale popup
            const btnConfirm = document.querySelector('.confirmation .btn_confirm, .ui-dialog .btn_confirm');
            if (btnConfirm) simularClick(btnConfirm);

            return true;
        }

        return false;
    }

    async function verificarVentanaFarm() {
        const res = document.getElementById('resultado');
        const win = document.querySelector('#fto_town_wrapper, #farm_town_overview, .farm_town_overview');

        if (win) {
            res.innerHTML = `<div style="color:#0f0;">✅ Vista Aldeas DETECTADA</div>`;
            const btn = document.getElementById('fto_claim_button') || win.querySelector('.button.collect_resources, .btn_collect_resources, .collect_all_resources, .farm_town_action_button');
            if (btn) {
                const status = btn.classList.contains('disabled') ? '<span style="color:#ff0;">(En espera)</span>' : '<span style="color:#0f0;">(Listo)</span>';
                res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Botón de recolección OK ${status}</div>`;
            } else {
                res.innerHTML += `<div style="color:#f00;font-size:10px;">❌ No veo el botón de recolectar</div>`;
            }
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo la Vista de Aldeas. Ábrela.</div>`;
        }
    }

    // --- FUNCIONES AUTOBUILD ---
    async function procesarAutoBuild() {
        const resultado = document.getElementById('resultado');
        const intervaloMin = parseInt(document.getElementById('build-interval').value) || 10;
        const el = document.getElementById('chk-multi-city');
        const multiCity = el ? el.checked : false;

        resultado.innerHTML = `<div style="color:#ff9800;">🏗️ AutoBuild ACTIVO</div>`;

        while (botActivo) {
            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#ff9800;font-weight:bold;">🏗️ AUTOBUILD</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervaloMin} min ${multiCity ? '(Multi-Ciudad)' : ''}</div>
                </div>
            `;

            const exito = await construirAlgo();
            if (exito) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Construcción iniciada</div>`;
                playBeep(800, 100);
            } else {
                resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Nada para construir o cola llena</div>`;
            }

            if (multiCity) {
                const hayMas = await proximaCiudad();
                if (!hayMas) {
                    await esperar(intervaloMin * 60 * 1000);
                } else {
                    await esperar(3000);
                }
            } else {
                await esperar(intervaloMin * 60 * 1000);
            }
        }
    }

    async function construirAlgo() {
        const win = document.querySelector('#gpwnd_1002, .building_main, #techtree');
        if (!win) return false;

        const h4 = win.querySelector('#main_tasks h4');
        const queueText = h4 ? h4.innerText : "";
        if (queueText.includes("7/7")) {
            console.log("🏗️ Cola llena");
            return false;
        }

        const buildBtns = Array.from(win.querySelectorAll('.button_build.build_up.build:not(.build_grey)'));
        const allowed = Array.from(document.querySelectorAll('.build-item:checked')).map(el => el.value);

        for (const btn of buildBtns) {
            const container = btn.closest('[id^="building_main_"]');
            if (!container) continue;

            const buildingId = container.id.replace('building_main_', '');
            const levelEl = container.querySelector('.level');
            const currentLevel = levelEl ? parseInt(levelEl.innerText.trim()) : 0;

            const limitEl = document.querySelector(`.build-limit[data-id="${buildingId}"]`);
            const targetLevel = limitEl ? parseInt(limitEl.value) : 99;

            if (allowed.includes(buildingId) && currentLevel < targetLevel) {
                console.log(`🏗️ Construyendo ${buildingId} (Nivel ${currentLevel} -> ${currentLevel + 1}, Objetivo: ${targetLevel})`);
                simularClick(btn);
                return true;
            }
        }

        return false;
    }

    async function verificarVentanaBuild() {
        const res = document.getElementById('resultado');
        const win = document.querySelector('#gpwnd_1002, .building_main, #techtree');

        if (win) {
            res.innerHTML = `<div style="color:#0f0;">✅ Senado DETECTADO</div>`;
            const btns = win.querySelectorAll('.button_build.build_up.build:not(.build_grey)');
            res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Edificios ampliables: ${btns.length}</div>`;
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo el Senado. Ábrelo.</div>`;
        }
    }

    // --- FUNCIONES AUTORECRUIT ---
    async function procesarAutoRecruit() {
        const resultado = document.getElementById('resultado');
        const intervaloMin = parseInt(document.getElementById('recruit-interval').value) || 15;
        const cantidadEl = document.getElementById('recruit-amount');
        const cantidad = cantidadEl ? cantidadEl.value : 10;
        const el = document.getElementById('chk-multi-city');
        const multiCity = el ? el.checked : false;

        resultado.innerHTML = `<div style="color:#e91e63;">⚔️ AutoRecruit ACTIVO</div>`;

        while (botActivo) {
            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#e91e63;font-weight:bold;">⚔️ AUTORECRUIT</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervaloMin} min ${multiCity ? '(Multi-Ciudad)' : ''}</div>
                </div>
            `;

            // 1. Intentar Modo Masivo (Vista General de Reclutamiento)
            const massContainer = document.getElementById('recruit_general_fields');
            if (massContainer) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">ℹ️ Vista General Reclutamiento Detectada</div>`;
                const exito = await reclutarMasivo(cantidad);
                if (exito) {
                    resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Reclutamiento Masivo OK</div>`;
                    playBeep(800, 100);
                } else {
                    resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Nada para reclutar (Masivo)</div>`;
                }
                // En modo masivo no iteramos ciudades
                await esperar(intervaloMin * 60 * 1000);
                continue;
            }

            // 2. Modo Individual (Cuartel/Puerto)
            const exito = await reclutarAlgo(cantidad);
            if (exito) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Reclutamiento enviado</div>`;
                playBeep(800, 100);
            } else {
                resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Sin recursos o cola llena</div>`;
            }

            if (multiCity) {
                const hayMas = await proximaCiudad();
                if (!hayMas) {
                    await esperar(intervaloMin * 60 * 1000);
                } else {
                    await esperar(3000);
                }
            } else {
                await esperar(intervaloMin * 60 * 1000);
            }
        }
    }

    async function reclutarMasivo(cantidad) {
        const container = document.getElementById('recruit_general_fields');
        if (!container) return false;

        const allowed = Array.from(document.querySelectorAll('.recruit-item:checked')).map(el => el.value);
        let algoPuesto = false;

        // 1. Rellenar inputs
        for (const unitId of allowed) {
            // El ID del input suele ser 'txt_main_sword', 'txt_main_archer', etc.
            const inputId = `txt_main_${unitId}`;
            const input = document.getElementById(inputId);

            if (input && !input.disabled) {
                // Verificar si ya tiene valor para no sobrescribir si no es necesario, 
                // pero el usuario quiere "ponerlo", así que asignamos el valor.
                if (input.value != cantidad) {
                    input.value = cantidad;
                    // Disparar eventos para que el juego detecte el cambio
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('keyup', { bubbles: true }));
                    algoPuesto = true;
                    await esperar(200);
                }
            }
        }

        if (!algoPuesto) return false;

        // 2. Click en "Añadir tropas" (btn_insert_troops)
        const btnInsert = document.getElementById('btn_insert_troops');
        if (btnInsert && !btnInsert.classList.contains('disabled')) {
            console.log("⚔️ Ejecutando Reclutamiento Masivo...");
            simularClick(btnInsert);
            await esperar(2000);
            return true;
        }

        return false;
    }

    async function reclutarAlgo(cantidad) {
        // FIX: Usamos querySelectorAll para encontrar TODAS las ventanas de reclutamiento abiertas (Cuartel y Puerto)
        // Usamos la clase .js-barracks-docks que apunta al contenedor de contenido real, no al fondo vacío.
        let wins = document.querySelectorAll('.js-barracks-docks');

        // Fallback si no encuentra la clase específica, buscamos por ID (aunque el ID sea único, a veces se duplica en Grepolis)
        if (wins.length === 0) {
            const winById = document.getElementById('unit_order');
            if (winById) wins = [winById];
        }

        if (wins.length === 0) return false;

        console.log(`⚔️ Ventanas de reclutamiento detectadas: ${wins.length}`);

        for (const win of wins) {
            // --- LÓGICA DE DETECCIÓN DE COLA ---
            const queueItems = win.querySelectorAll('.js-queue-item');
            let queueCount = 0;
            queueItems.forEach(item => {
                // Contamos si tiene icono, tiempo, nombre O si NO tiene la clase empty_slot
                if (item.querySelector('.unit_icon, .time, .name') || !item.classList.contains('empty_slot')) {
                    queueCount++;
                }
            });

            console.log(`⚔️ Cola en ventana: ${queueCount}/7`);

            if (queueCount >= 7) {
                console.log("⚔️ Cola llena en esta ventana, pasando a la siguiente...");
                continue; // Pasamos a la siguiente ventana (ej. de Cuartel a Puerto)
            }

            // --- LÓGICA DE RECLUTAMIENTO ---
            const unitTabs = win.querySelectorAll('.unit_tab:not(.unavailable), .unit_container:not(.unavailable)');
            const allowed = Array.from(document.querySelectorAll('.recruit-item:checked')).map(el => el.value);

            for (const tab of unitTabs) {
                const unitId = tab.getAttribute('data-unit_id') || tab.id;
                if (!unitId || !allowed.includes(unitId)) continue;

                const amountEl = tab.querySelector('.unit_order_total, .amount, .count');
                const currentAmount = amountEl ? parseInt(amountEl.innerText.trim()) : 0;

                const limitEl = document.querySelector(`.recruit-limit[data-id="${unitId}"]`);
                const targetAmount = limitEl ? parseInt(limitEl.value) : 9999;

                if (currentAmount >= targetAmount) {
                    continue;
                }

                // FIX: Mejor detección de MAX.
                let maxVal = 0;
                const maxEl = tab.querySelector('.max');
                if (maxEl) {
                    // Extraemos solo los dígitos para evitar problemas con '+' o espacios
                    const match = maxEl.innerText.match(/(\d+)/);
                    if (match) maxVal = parseInt(match[1]);
                } else {
                    // Fallback: Si el input está habilitado, asumimos que se puede
                    const input = document.getElementById('unit_order_input') || win.querySelector('input.textbox, #unit_order_input');
                    if (input && !input.disabled) maxVal = 9999;
                }

                if (maxVal > 0) {
                    console.log(`⚔️ Intentando reclutar ${unitId} (Max: ${maxVal})`);

                    const clickTarget = tab.querySelector('.unit_order_tab, .unit_icon40x40, .unit') || tab;
                    simularClick(clickTarget);
                    await esperar(800);

                    // Buscamos el input DENTRO de la ventana actual para evitar conflictos
                    const input = win.querySelector('#unit_order_input, input[name="amount"]');
                    if (input) {
                        const aReclutar = Math.min(cantidad, maxVal, targetAmount - currentAmount);
                        input.value = aReclutar;
                        input.dispatchEvent(new Event('change'));
                        input.dispatchEvent(new Event('input'));
                        await esperar(300);
                    }

                    const btnConfirm = win.querySelector('#unit_order_confirm, .button_new.recruit_btn, .btn_recruit, .confirm');
                    if (btnConfirm) {
                        simularClick(btnConfirm);
                        return true; // Éxito, salimos de la función
                    }
                }
            }
        }

        return false; // Si terminamos el loop sin éxito
    }

    async function verificarVentanaRecruit() {
        const res = document.getElementById('resultado');
        let wins = document.querySelectorAll('.js-barracks-docks');
        const massWin = document.getElementById('recruit_general_fields');

        if (massWin) {
            res.innerHTML = `<div style="color:#0f0;">✅ Vista General Reclutamiento DETECTADA</div>`;
            const btn = document.getElementById('btn_insert_troops');
            if (btn) {
                res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Botón 'Añadir tropas' OK</div>`;
            } else {
                res.innerHTML += `<div style="color:#f00;font-size:10px;">❌ No veo el botón de añadir</div>`;
            }
            return;
        }

        if (wins.length === 0) {
            const winById = document.getElementById('unit_order');
            if (winById) wins = [winById];
        }

        if (wins.length > 0) {
            res.innerHTML = `<div style="color:#0f0;">✅ ${wins.length} Ventana(s) de Reclutamiento DETECTADA(S)</div>`;

            wins.forEach((win, index) => {
                const esPuerto = win.classList.contains('docks_building') || win.classList.contains('docks');
                const units = win.querySelectorAll('.unit_tab:not(.unavailable), .unit_container:not(.unavailable)').length;
                res.innerHTML += `<div style="color:#0f0;font-size:10px;">   - ${esPuerto ? 'Puerto' : 'Cuartel'} (${index + 1}): ${units} unidades</div>`;
            });
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo Cuartel, Puerto ni Vista General.</div>`;
        }
    }

    // --- FUNCIONES AUTOCULTURE ---
    async function procesarAutoCulture() {
        const resultado = document.getElementById('resultado');
        const intervaloMin = parseInt(document.getElementById('culture-interval').value) || 60;
        const el = document.getElementById('chk-multi-city');
        const multiCity = el ? el.checked : false;

        resultado.innerHTML = `<div style="color:#00bcd4;">🎭 AutoCulture ACTIVO</div>`;

        while (botActivo) {
            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#00bcd4;font-weight:bold;">🎭 AUTOCULTURE</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervaloMin} min ${multiCity ? '(Multi)' : ''}</div>
                </div>
            `;

            // 1. Intentar Modo Masivo (Vista General)
            const massContainer = document.getElementById('culture_points_overview_bottom');
            if (massContainer) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">ℹ️ Vista General Detectada</div>`;
                const exito = await organizarCulturaMasiva();
                if (exito) {
                    resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Cultura Masiva OK</div>`;
                    playBeep(800, 100);
                } else {
                    resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Nada para organizar (Masivo)</div>`;
                }
                // En modo masivo no iteramos ciudades
                await esperar(intervaloMin * 60 * 1000);
                continue;
            }

            // 2. Modo Individual (Ágora)
            const exito = await organizarCultura();
            if (exito) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Festival organizado</div>`;
                playBeep(800, 100);
            } else {
                resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Nada para organizar o Ágora cerrada</div>`;
            }

            if (multiCity) {
                const hayMas = await proximaCiudad();
                if (!hayMas) {
                    await esperar(intervaloMin * 60 * 1000);
                } else {
                    await esperar(3000);
                }
            } else {
                await esperar(intervaloMin * 60 * 1000);
            }
        }
    }

    async function organizarCulturaMasiva() {
        const container = document.getElementById('culture_points_overview_bottom');
        if (!container) return false;

        const allowed = Array.from(document.querySelectorAll('.culture-item:checked')).map(el => el.value);
        let algoHecho = false;

        for (const id of allowed) {
            const nombre = FESTIVALES[id];
            if (!nombre) continue;

            // Seleccionar en dropdown
            const selected = await seleccionarFestivalEnDropdown(nombre);
            if (!selected) continue;

            // Click Empezar en todas partes
            const btnStart = document.getElementById('start_all_celebrations');
            if (btnStart && !btnStart.classList.contains('disabled')) {
                console.log(`🎭 Iniciando masivo: ${nombre}`);
                simularClick(btnStart);
                algoHecho = true;
                await esperar(2000); // Esperar a que procese
            }
        }
        return algoHecho;
    }

    async function seleccionarFestivalEnDropdown(nombre) {
        const dropdown = document.getElementById('place_celebration_select');
        if (!dropdown) return false;

        // Verificar si ya está seleccionado
        const caption = dropdown.querySelector('.caption');
        if (caption && caption.innerText.trim() === nombre) return true;

        // Abrir dropdown
        simularClick(dropdown);
        await esperar(500);

        // Buscar opción por texto (Grepolis suele poner la lista en el body o cerca)
        // Buscamos elementos visibles con la clase 'item' o 'option' que contengan el texto
        const allOptions = Array.from(document.querySelectorAll('.dropdown-list .item, .popup_menu .item, .list .option'));
        const option = allOptions.find(el => el.innerText.trim() === nombre && el.offsetParent !== null);

        if (option) {
            simularClick(option);
            await esperar(500);
            return true;
        }

        // Intento fallback: buscar cualquier elemento visible con el texto exacto
        const fallbackOption = Array.from(document.querySelectorAll('div, span, li')).find(el =>
            el.innerText.trim() === nombre &&
            el.offsetParent !== null &&
            (el.classList.contains('item') || el.classList.contains('option'))
        );

        if (fallbackOption) {
            simularClick(fallbackOption);
            await esperar(500);
            return true;
        }

        return false;
    }

    async function organizarCultura() {
        const win = document.querySelector('#gpwnd_1003, .agora, #place_container');
        if (!win) return false;

        const allowed = Array.from(document.querySelectorAll('.culture-item:checked')).map(el => el.value);
        let organizado = false;

        const map = {
            'party': '.btn_city_festival',
            'games': '.btn_organize_olympic_games',
            'triumph': '.btn_victory_procession',
            'theater': '.btn_theater_plays'
        };

        for (const id of allowed) {
            const selector = map[id];
            if (!selector) continue;

            const btn = win.querySelector(selector);
            if (btn && !btn.classList.contains('disabled') && btn.getAttribute('data-enabled') !== "") {
                console.log(`🎭 Organizando: ${id}`);
                simularClick(btn);
                organizado = true;
                await esperar(1000);
            }
        }

        return organizado;
    }

    async function verificarVentanaAgora() {
        const res = document.getElementById('resultado');
        const win = document.querySelector('#gpwnd_1003, .agora, #place_container');
        const massWin = document.getElementById('culture_points_overview_bottom');

        if (massWin) {
            res.innerHTML = `<div style="color:#0f0;">✅ Vista General Cultura DETECTADA</div>`;
            const btn = document.getElementById('start_all_celebrations');
            if (btn) {
                res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Botón 'Empezar en todas partes' OK</div>`;
            } else {
                res.innerHTML += `<div style="color:#f00;font-size:10px;">❌ No veo el botón de empezar</div>`;
            }
        } else if (win) {
            res.innerHTML = `<div style="color:#0f0;">✅ Ágora DETECTADA</div>`;
            const buttons = win.querySelectorAll('.button_new:not(.disabled)');
            res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Festivales disponibles: ${buttons.length}</div>`;
        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo Ágora ni Vista General.</div>`;
        }
    }

    // --- FUNCIONES AUTOACADEMY ---
    async function procesarAutoAcademy() {
        const resultado = document.getElementById('resultado');
        const intervaloMin = parseInt(document.getElementById('academy-interval').value) || 30;
        const el = document.getElementById('chk-multi-city');
        const multiCity = el ? el.checked : false;

        resultado.innerHTML = `<div style="color:#60a5fa;">🎓 AutoAcademy ACTIVO</div>`;

        while (botActivo) {
            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#60a5fa;font-weight:bold;">🎓 AUTOACADEMY</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervaloMin} min ${multiCity ? '(Multi)' : ''}</div>
                </div>
            `;

            const exito = await investigarAlgo();
            if (exito) {
                resultado.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Investigación iniciada</div>`;
                playBeep(800, 100);
            } else {
                resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Sin puntos, cola llena o Academia cerrada</div>`;
            }

            if (multiCity) {
                const hayMas = await proximaCiudad();
                if (!hayMas) {
                    await esperar(intervaloMin * 60 * 1000);
                } else {
                    await esperar(3000);
                }
            } else {
                await esperar(intervaloMin * 60 * 1000);
            }
        }
    }

    async function investigarAlgo() {
        // FIX: "Hazlo más grande" -> Búsqueda GLOBAL de botones de investigación.
        // Ignoramos si están dentro de una ventana específica o no. Buscamos cualquier botón con data-research_id.

        const allUpgradeButtons = document.querySelectorAll('.btn_upgrade[data-research_id], .button_upgrade[data-research_id], [data-research_id]');

        if (allUpgradeButtons.length === 0) {
            // console.log("🎓 No veo botones de investigación en todo el documento.");
            return false;
        }

        console.log(`🎓 Botones de investigación detectados (Global): ${allUpgradeButtons.length}`);

        // --- DETECCIÓN DE PUNTOS (Intento global) ---
        const pointsEl = document.querySelector('.js-research-points, .research_points_amount');
        const pointsAvailable = pointsEl ? parseInt(pointsEl.innerText.trim()) : 0;
        console.log(`🎓 Puntos detectados: ${pointsAvailable}`);

        const allowed = Array.from(document.querySelectorAll('.academy-item:checked')).map(el => el.value);

        for (const btn of allUpgradeButtons) {
            // Verificamos que sea visible (no oculto por CSS)
            if (btn.offsetParent === null) continue;

            const techId = btn.getAttribute('data-research_id');
            if (!techId) continue;

            // Si tiene clase 'disabled' o 'inactive' (a veces el contenedor padre es el inactivo)
            if (btn.classList.contains('disabled')) continue;

            if (!allowed.includes(techId)) continue;

            console.log(`🎓 Intentando investigar (Global): ${techId}`);
            simularClick(btn);

            await esperar(1000);

            // Confirmación
            const btnConfirm = document.querySelector('.confirmation .btn_confirm, .ui-dialog .btn_confirm');
            if (btnConfirm) simularClick(btnConfirm);

            return true;
        }

        return false;
    }

    async function verificarVentanaAcademia() {
        console.log("🎓 Verificando Academia (Global)...");
        const res = document.getElementById('resultado');

        // Búsqueda global
        const allUpgradeButtons = document.querySelectorAll('.btn_upgrade[data-research_id], .button_upgrade[data-research_id]');
        const pointsEl = document.querySelector('.js-research-points, .research_points_amount');

        if (allUpgradeButtons.length > 0 || pointsEl) {
            res.innerHTML = `<div style="color:#0f0;">✅ Academia DETECTADA (Global)</div>`;

            const points = pointsEl ? pointsEl.innerText.trim() : "??";
            res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Puntos: ${points}</div>`;
            res.innerHTML += `<div style="color:#0f0;font-size:10px;">✅ Botones de mejora visibles: ${allUpgradeButtons.length}</div>`;

            // Listar algunos IDs encontrados para depurar
            let ids = [];
            allUpgradeButtons.forEach(b => {
                if (b.offsetParent !== null) ids.push(b.getAttribute('data-research_id'));
            });
            if (ids.length > 0) {
                res.innerHTML += `<div style="color:#ccc;font-size:9px;">IDs: ${ids.slice(0, 5).join(', ')}...</div>`;
            } else {
                res.innerHTML += `<div style="color:#ff0;font-size:10px;">⚠️ Botones detectados pero OCULTOS</div>`;
            }

        } else {
            res.innerHTML = `<div style="color:#f00;">❌ NO veo elementos de Academia en todo el DOM.</div>`;
        }
    }

    // --- FUNCIONES SUPER-AUTO ---
    async function procesarSuperAuto() {
        const resultado = document.getElementById('resultado');
        const intervalEl = document.getElementById('auto-interval');
        const intervalMin = intervalEl ? parseInt(intervalEl.value) : 15;
        const el = document.getElementById('chk-multi-city');
        const multiCity = el ? el.checked : false;

        resultado.innerHTML = `<div style="color:#4caf50;">🤖 Super-Auto ACTIVO</div>`;

        while (botAutoActivo) {
            const tasks = Array.from(document.querySelectorAll('.auto-task:checked')).map(el => el.value);

            resultado.innerHTML = `
                <div style="text-align:center;">
                    <div style="color:#4caf50;font-weight:bold;">🤖 SUPER-AUTO</div>
                    <div style="font-size:10px;color:#ccc;">Intervalo: ${intervalMin} min</div>
                    <div style="font-size:9px;color:#888;">Tareas: ${tasks.join(', ')}</div>
                </div>
            `;

            await ejecutarCicloMantenimiento(tasks, multiCity);

            if (!botAutoActivo) break;

            resultado.innerHTML += `<div style="color:#888;font-size:10px;">💤 Esperando ${intervalMin} min...</div>`;
            await esperar(intervalMin * 60 * 1000);
        }
    }

    async function ejecutarCicloMantenimiento(tasks, multiCity) {
        let hayMasCiudades = true;
        let ciudadesProcesadas = 0;

        while (hayMasCiudades && botAutoActivo) {
            console.log(`🤖 Procesando ciudad ${ciudadesProcesadas + 1}...`);

            if (tasks.includes('cave')) {
                const minPlata = parseInt(document.getElementById('cave-min').value) || 1000;
                const cantidadMeter = parseInt(document.getElementById('cave-amount').value) || 3000;
                await ejecutarUnaVezCave(minPlata, cantidadMeter);
            }

            if (tasks.includes('farm')) {
                await recolectarAldeas();
            }

            if (tasks.includes('build')) {
                await construirAlgo();
            }

            if (tasks.includes('recruit')) {
                const cantidadEl = document.getElementById('recruit-amount');
                const cantidad = cantidadEl ? cantidadEl.value : 10;
                await reclutarAlgo(cantidad);
            }

            if (tasks.includes('culture')) {
                await organizarCultura();
            }

            if (tasks.includes('academy')) {
                await investigarAlgo();
            }

            if (multiCity) {
                hayMasCiudades = await proximaCiudad();
                if (hayMasCiudades) {
                    ciudadesProcesadas++;
                    await esperar(3000);
                }
            } else {
                hayMasCiudades = false;
            }
        }
    }

    async function ejecutarUnaVezCave(minPlata, cantidadMeter) {
        let plataActual = 0;
        const resEl = document.querySelector('.ui_resources_bar .silver .amount, #res_silver_area, .res_silver, .resource_iron_icon .count');
        if (resEl) {
            const raw = resEl.textContent.replace(/\./g, '').trim();
            plataActual = parseInt(raw) || 0;
        }

        if (plataActual >= (minPlata + cantidadMeter)) {
            console.log("🏛️ Metiendo plata en cueva...");
            return await intentarMeterPlata(cantidadMeter);
        }
        return false;
    }

    async function proximaCiudad() {
        const btnNext = document.querySelector('.city_navigation .btn_next_city, .btn_next_town, .next_city');
        if (btnNext) {
            console.log('🌍 Cambiando de ciudad...');
            simularClick(btnNext);
            await esperar(3000);
            return true;
        }
        return false;
    }

    if (window.top === window.self) {
        (function init() {
            if (document.body) criarPanelPrincipal();
            else setTimeout(init, 500);
        })();
    }
})();
