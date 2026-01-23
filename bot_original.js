(function () {
'use strict';
const PANEL_ID = 'script-panel';
const ENCAIXE_ID = 'painel-encaixe-ataque';
const STORAGE_KEY = 'bot_grepo_config_v1';
let ordenesCapturadas = [];
let botActivo = false;
let botAutoActivo = false;
let ordenActualIndex = 0;
let audioContext = null;
let modoActual = 'planner';
let retrocesoTimers = {};

const VELOCIDADES = { 'rapido': 1, 'normal': 1.5, 'lento': 3 };

const EDIFICIOS = {
    'main': 'Senado', 'barracks': 'Cuartel', 'academy': 'Academia', 'temple': 'Templo',
    'market': 'Mercado', 'docks': 'Puerto', 'farm': 'Granja', 'storage': 'Almacén',
    'hide': 'Cueva', 'wall': 'Muralla', 'tower': 'Torre', 'timber_camp': 'Aserradero',
    'stoner': 'Cantera', 'ironer': 'Mina de plata', 'theater': 'Teatro'
};

const TROPAS = {
    'sword': 'Espadachín', 'slinger': 'Hondero', 'archer': 'Arquero', 'hoplite': 'Hoplita',
    'rider': 'Jinete', 'chariot': 'Carro', 'catapult': 'Catapulta'
};

const BARCOS = {
    'big_transporter': 'Barco de transporte rápido', 'bireme': 'Birreme',
    'attack_ship': 'Barco de ataque', 'demolition_ship': 'Barco demoledor',
    'small_transporter': 'Barco de transporte', 'trireme': 'Trirreme', 'colonize_ship': 'Barco colonizador'
};

const MITICAS = {
    'godsent': 'Enviado divino', 'harpy': 'Arpía', 'medusa': 'Medusa', 'centaur': 'Centauro',
    'pegasus': 'Pegaso', 'cerberus': 'Cerbero', 'fury': 'Furia', 'griffin': 'Grifo',
    'calydonian_boar': 'Jabalí de Calidón', 'hydra': 'Hidra', 'sea_monster': 'Monstruo marino',
    'cyclops': 'Cíclope', 'minotaur': 'Minotauro', 'manticore': 'Mantícora', 'erinys': 'Erinia'
};

const FESTIVALES = {
    'party': 'Fiesta olímpica', 'theater': 'Representaciones teatrales', 'triumph': 'Desfile triunfal'
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

function crearPanelPrincipal() {
    const existente = document.getElementById(PANEL_ID);
    if (existente) existente.remove();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:9999;background:#1e1e2f;color:#fff;padding:8px;border-radius:6px;font-family:Arial,sans-serif;font-size:11px;cursor:pointer;border:2px solid #444;box-shadow:0 0 10px #000;';
    panel.innerHTML = `<strong>🤖 V11.80</strong>`;
    panel.onclick = crearPanelEncaixe;
    document.body.appendChild(panel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (botActivo) { pararProceso(); playBeep(150, 300, 'sawtooth'); }
            const p = document.getElementById(ENCAIXE_ID);
            if (p) p.style.display = 'none';
        }
    });
    setTimeout(crearPanelEncaixe, 500);
}

function crearPanelEncaixe() {
    const existente = document.getElementById(ENCAIXE_ID);
    if (existente) existente.remove();
    const panel = document.createElement('div');
    panel.id = ENCAIXE_ID;
    panel.style.cssText = `position:fixed;top:100px;left:50%;margin-left:-160px;z-index:9999;background:#1c1c2c;border:2px solid #333;border-radius:10px;width:320px;color:#ccc;font-family:Arial,sans-serif;box-shadow: 0 10px 30px rgba(0,0,0,0.5);`;
    
    const generarCheckboxes = (obj, clase) => {
        let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:150px;overflow-y:auto;padding:4px;background:#111;border:1px solid #333;border-radius:4px;">';
        for (const [key, label] of Object.entries(obj)) {
            html += `<label style="font-size:10px;display:flex;align-items:center;cursor:pointer;color:#aaa;"><input type="checkbox" class="${clase}" value="${key}" style="margin-right:4px;">${label}</label>`;
        }
        html += '</div>';
        return html;
    };

    panel.innerHTML = `
        <div id="bot-drag-header" style="padding:8px;background:#2a2a3a;border-bottom:1px solid #333;border-radius:8px 8px 0 0;cursor:move;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:#60a5fa;font-size:13px;">⚔️ Bot V11.80</h3>
            <button id="btn-ocultar" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;">✖</button>
        </div>
        <div style="display:flex;background:#111;border-bottom:1px solid #333;">
            <button id="tab-planner" style="flex:1;padding:6px;background:#2a2a3a;color:#fff;border:none;cursor:pointer;font-weight:bold;font-size:9px;">⚔️ PLAN</button>
            <button id="tab-dodge" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🏃 DODGE</button>
            <button id="tab-cave" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🏛️ CAVE</button>
            <button id="tab-farm" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🚜 FARM</button>
        </div>
        <div style="display:flex;background:#111;border-bottom:1px solid #333;">
            <button id="tab-build" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🏗️ BUILD</button>
            <button id="tab-recruit" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">⚔️ RECR</button>
            <button id="tab-culture" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🎭 CULT</button>
            <button id="tab-academy" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">📚 ACAD</button>
            <button id="tab-auto" style="flex:1;padding:6px;background:#111;color:#888;border:none;cursor:pointer;font-weight:bold;font-size:9px;">🤖 AUTO</button>
        </div>
        <div style="padding:10px; max-height: 80vh; overflow-y: auto;">
            <div style="background:#111;padding:4px;border-radius:4px;margin-bottom:8px;text-align:center;font-size:11px;">Hora: <span id="server-time" style="color:#0f0;">--:--:--</span></div>
            <div id="content-planner">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                    <div><label style="font-size:10px;">Seg. Obj:</label><input type="number" id="segundo-obj" value="0" min="0" max="59" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;"></div>
                    <div><label style="font-size:10px;">Antelación:</label><input type="number" id="antelacion" value="5" style="width:100%;background:#333;color:#fff;border:1px solid #555;padding:2px;"></div>
                </div>
                <div style="margin-bottom:8px;"><select id="modo-deteccion" style="width:100%;background:#222;color:#fff;border:1px solid #555;padding:3px;"><option value="auto">🤖 Auto</option><option value="forzar_ataque">⚔️ FORZAR ATAQUE</option><option value="forzar_defensa" selected>🛡️ FORZAR DEFENSA</option></select></div>
                <div style="background:#222;padding:6px;margin-bottom:8px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div style="text-align:center;"><label style="font-size:10px;color:#4caf50;">🛡️ DEF (+)</label><input type="number" id="tol-defensa" value="3" style="width:100%;background:#1a2a1a;color:#4caf50;border:1px solid #4caf50;"></div><div style="text-align:center;"><label style="font-size:10px;color:#ff5252;">⚔️ ATK (-)</label><input type="number" id="tol-ataque" value="0" style="width:100%;background:#2a1a1a;color:#ff5252;border:1px solid #ff5252;"></div></div></div>
                <button id="btn-capturar" style="width:100%;padding:6px;background:#444;color:#fff;border:none;margin-bottom:6px;">🔍 Capturar</button>
            </div>
            <div id="content-dodge" style="display:none;">
                <div style="background:#221a1a;padding:8px;margin-bottom:8px;border:1px solid #c62828;"><div style="text-align:center;margin-bottom:6px;color:#ff8a80;">🏃 ESQUIVA</div><div style="display:flex;gap:4px;justify-content:center;margin-bottom:8px;"><input type="number" id="dodge-h" placeholder="HH" style="width:40px;"><input type="number" id="dodge-m" placeholder="MM" style="width:40px;"><input type="number" id="dodge-s" placeholder="SS" style="width:40px;"></div><div style="text-align:center;"><label style="font-size:10px;">Corr (s):</label><input type="number" id="dodge-correction" value="-1" step="0.5" style="width:50px;"></div><button id="btn-check-btn" style="width:100%;margin-top:5px;">👁️ Verificar botón</button></div>
            </div>
            <div id="content-cave" style="display:none;">
                <div style="background:#1a2a3a;padding:8px;border-radius:4px;margin-bottom:8px;border:1px solid #448aff;">
                    <div style="text-align:center;margin-bottom:6px;color:#448aff;font-weight:bold;">🏛️ AUTOCAVE</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;"><div><label style="font-size:10px;">Min Plata:</label><input type="number" id="cave-min" value="1000" style="width:100%;"></div><div><label style="font-size:10px;">Intervalo:</label><input type="number" id="cave-interval" value="30" style="width:100%;"></div></div>
                    <div style="margin-bottom:8px;text-align:center;"><label style="font-size:10px;">Meter:</label><input type="number" id="cave-amount" value="3000" style="width:60px;"></div>
                    <button id="btn-check-cave" style="width:100%;">👁️ Verificar Cueva</button>
                </div>
            </div>
            <div id="content-farm" style="display:none;">
                <div style="background:#1a2a1a;padding:8px;margin-bottom:8px;border:1px solid #4caf50;"><div style="text-align:center;margin-bottom:6px;color:#4caf50;">🚜 AUTOFARM</div><div style="margin-bottom:8px;"><label>Tiempo:</label><select id="farm-interval" style="width:100%;"><option value="5">5 Min</option><option value="10">10 Min</option></select></div><button id="btn-check-farm" style="width:100%;">👁️ Verificar Aldeas</button></div>
            </div>
            <div id="content-build" style="display:none;">
                <div style="background:#2a1a1a;padding:8px;margin-bottom:8px;border:1px solid #ff6b35;"><div style="text-align:center;margin-bottom:6px;color:#ff6b35;">🏗️ AUTOBUILD</div><div style="margin-bottom:8px;"><label>Int (min):</label><input type="number" id="build-interval" value="10" style="width:100%;"></div>${generarCheckboxes(EDIFICIOS, 'build-item')}<button id="btn-check-build" style="width:100%;margin-top:6px;">👁️ Verificar Senado</button></div>
            </div>
            <div id="content-recruit" style="display:none;">
                <div style="background:#1a1a2a;padding:8px;margin-bottom:8px;border:1px solid #8b5cf6;"><div style="text-align:center;margin-bottom:6px;color:#8b5cf6;">⚔️ AUTORECRUIT</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;"><div><label>Int:</label><input type="number" id="recruit-interval" value="5" style="width:100%;"></div><div><label>Cant:</label><input type="number" id="recruit-amount" value="10" style="width:100%;"></div></div>${generarCheckboxes({ ...TROPAS, ...BARCOS, ...MITICAS }, 'recruit-item')}<button id="btn-check-recruit" style="width:100%;margin-top:6px;">👁️ Verificar Cuartel</button></div>
            </div>
            <div id="content-culture" style="display:none;">
                <div style="background:#1a2a2a;padding:8px;margin-bottom:8px;border:1px solid #10b981;"><div style="text-align:center;margin-bottom:6px;color:#10b981;">🎭 AUTOCULTURE</div><div style="margin-bottom:8px;"><label>Int (min):</label><input type="number" id="culture-interval" value="30" style="width:100%;"></div>${generarCheckboxes(FESTIVALES, 'culture-item')}<button id="btn-check-culture" style="width:100%;margin-top:6px;">👁️ Verificar Ágora</button></div>
            </div>
            <div id="content-academy" style="display:none;">
                <div style="background:#2a2a1a;padding:8px;margin-bottom:8px;border:1px solid #f59e0b;"><div style="text-align:center;margin-bottom:6px;color:#f59e0b;">📚 AUTOACADEMY</div><div style="margin-bottom:8px;"><label>Int (min):</label><input type="number" id="academy-interval" value="15" style="width:100%;"></div>${generarCheckboxes(TECNOLOGIAS, 'academy-item')}<button id="btn-check-academy" style="width:100%;margin-top:6px;">👁️ Verificar Academia</button></div>
            </div>
            <div id="content-auto" style="display:none;">
                <div style="background:#1a1a2a;padding:8px;margin-bottom:8px;border:1px solid #60a5fa;"><div style="text-align:center;margin-bottom:6px;color:#60a5fa;">🤖 SUPER-AUTO</div><div style="margin-bottom:8px;"><label>Ciclo (min):</label><input type="number" id="auto-cycle" value="60" style="width:100%;"></div>${generarCheckboxes({'build':'🏗️ Build','recruit':'⚔️ Recruit','culture':'🎭 Culture','academy':'📚 Academy','farm':'🚜 Farm','cave':'🏛️ Cave'}, 'auto-task')}</div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap;"><select id="velocidad-bot" style="flex:1;"><option value="rapido">⚡ Rápido</option><option value="normal">🚶 Normal</option><option value="lento">🐢 Lento</option></select><label style="font-size:9px;color:#fff;display:flex;"><input type="checkbox" id="chk-no-cancelar"> 🚫 No Cancelar</label><label style="font-size:9px;color:#fff;display:flex;"><input type="checkbox" id="chk-multi-city"> 🌍 Multi</label></div>
            <div id="progress-container" style="width:100%;height:4px;background:#333;margin-bottom:6px;display:none;"><div id="progress-bar" style="width:0%;height:100%;background:#00cc66;"></div></div>
            <div id="resultado" style="background:#0a0a14;padding:6px;color:#0f0;min-height:40px;margin-bottom:6px;font-size:10px;">...</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"><button id="btn-iniciar" style="padding:8px;background:#00cc66;color:#fff;border:none;">▶️ Iniciar</button><button id="btn-parar" style="padding:8px;background:#cc0000;color:#fff;border:none;">⏹️ Parar</button></div>
        </div>
    `;
    document.body.appendChild(panel);
    loadSettings();
    ['planner','dodge','cave','farm','build','recruit','culture','academy','auto'].forEach(t => document.getElementById('tab-'+t).onclick=()=>switchTab(t));
    document.getElementById('btn-check-btn').onclick = verificarBotonManual;
    document.getElementById('btn-check-cave').onclick = verificarVentanaCueva;
    document.getElementById('btn-check-farm').onclick = verificarVentanaFarm;
    document.getElementById('btn-check-build').onclick = verificarVentanaBuild;
    document.getElementById('btn-check-recruit').onclick = verificarVentanaRecruit;
    document.getElementById('btn-check-culture').onclick = verificarVentanaAgora;
    document.getElementById('btn-check-academy').onclick = verificarVentanaAcademia;
    const inputs = ['segundo-obj', 'antelacion', 'modo-deteccion', 'tol-defensa', 'tol-ataque', 'velocidad-bot', 'chk-no-cancelar', 'chk-multi-city', 'dodge-h', 'dodge-m', 'dodge-s', 'dodge-correction', 'cave-min', 'cave-interval', 'cave-amount', 'farm-interval', 'build-interval', 'recruit-interval', 'recruit-amount', 'culture-interval', 'academy-interval', 'auto-cycle'];
    inputs.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', saveSettings); });
    document.querySelectorAll('.build-item, .recruit-item, .culture-item, .academy-item, .auto-task').forEach(el => el.addEventListener('change', saveSettings));
    
    const header = document.getElementById('bot-drag-header');
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => { if(e.target.tagName === 'BUTTON') return; isDragging = true; startX = e.clientX; startY = e.clientY; initialLeft = panel.offsetLeft; initialTop = panel.offsetTop; header.style.cursor = 'grabbing'; });
    document.addEventListener('mousemove', (e) => { if(!isDragging) return; panel.style.setProperty('left', `${initialLeft + e.clientX - startX}px`, 'important'); panel.style.setProperty('top', `${initialTop + e.clientY - startY}px`, 'important'); });
    document.addEventListener('mouseup', () => { isDragging = false; header.style.cursor = 'move'; });
    document.getElementById('btn-ocultar').onclick = () => panel.style.display = 'none';
    
    setInterval(() => { const st = getServerTime(); if(st) document.getElementById('server-time').textContent = new Date(st*1000).toTimeString().substr(0,8); }, 1000);
    document.getElementById('btn-capturar').onclick = capturarAtaques;
    document.getElementById('btn-iniciar').onclick = iniciarProceso;
    document.getElementById('btn-parar').onclick = pararProceso;
}

function switchTab(tab) {
    modoActual = tab;
    ['planner','dodge','cave','farm','build','recruit','culture','academy','auto'].forEach(t => {
        document.getElementById('tab-'+t).style.background='#111'; document.getElementById('tab-'+t).style.color='#888';
        document.getElementById('content-'+t).style.display='none';
    });
    const btn = document.getElementById('tab-'+tab);
    btn.style.background = tab==='cave'?'#1a2a3a':tab==='farm'?'#1a1a1a':tab==='build'?'#2a1a1a':tab==='recruit'?'#1a1a2a':tab==='culture'?'#1a2a2a':tab==='academy'?'#2a2a1a':tab==='auto'?'#1a1a2a':'#2a2a3a';
    btn.style.color = '#fff';
    document.getElementById('content-'+tab).style.display='block';
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
        buildItems: Array.from(document.querySelectorAll('.build-item:checked')).map(el => el.value),
        recruitItems: Array.from(document.querySelectorAll('.recruit-item:checked')).map(el => el.value),
        cultureItems: Array.from(document.querySelectorAll('.culture-item:checked')).map(el => el.value),
        academyItems: Array.from(document.querySelectorAll('.academy-item:checked')).map(el => el.value),
        autoTasks: Array.from(document.querySelectorAll('.auto-task:checked')).map(el => el.value)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const c = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
            const setChk = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };
            setVal('segundo-obj', c.segundoObj); setVal('antelacion', c.antelacion); setVal('modo-deteccion', c.modo);
            setVal('tol-defensa', c.tolDef); setVal('tol-ataque', c.tolAtk); setVal('velocidad-bot', c.velocidad);
            setChk('chk-no-cancelar', c.noCancelar); setChk('chk-multi-city', c.multiCity);
            setVal('dodge-h', c.dodgeH); setVal('dodge-m', c.dodgeM); setVal('dodge-s', c.dodgeS); setVal('dodge-correction', c.dodgeCorr);
            setVal('cave-min', c.caveMin); setVal('cave-interval', c.caveInterval); setVal('cave-amount', c.caveAmount);
            setVal('farm-interval', c.farmInterval); setVal('build-interval', c.buildInterval);
            setVal('recruit-interval', c.recruitInterval); setVal('recruit-amount', c.recruitAmount);
            setVal('culture-interval', c.cultureInterval); setVal('academy-interval', c.academyInterval); setVal('auto-cycle', c.autoCycle);
            
            const restoreChecks = (items, clase) => { if (Array.isArray(items)) items.forEach(val => { const el = document.querySelector(`.${clase}[value="${val}"]`); if (el) el.checked = true; }); };
            restoreChecks(c.buildItems, 'build-item'); restoreChecks(c.recruitItems, 'recruit-item');
            restoreChecks(c.cultureItems, 'culture-item'); restoreChecks(c.academyItems, 'academy-item'); restoreChecks(c.autoTasks, 'auto-task');
        } catch (e) { console.error('Error config', e); }
    }
}

function playBeep(freq = 440, duration = 100, type = 'sine') {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
        osc.type = type; osc.frequency.value = freq; osc.connect(gain); gain.connect(audioContext.destination);
        osc.start(); setTimeout(() => osc.stop(), duration);
    } catch (e) {}
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
    if (modoActual !== 'planner') { alert('Solo captura en modo Planner'); return; }
    const resultado = document.getElementById('resultado'); resultado.innerHTML = '<span style="color:#ff0;">⏳ Escaneando...</span>';
    ordenesCapturadas = []; const ataquesTemp = []; const serverTime = getServerTime(); const now = new Date(serverTime * 1000);
    let pagina = 1; let hayMasPaginas = true;
    while (hayMasPaginas) {
        const filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));
        filas.forEach(fila => {
            const txt = fila.textContent; const m = txt.match(/(?:Partida|Departure):.*?(\d{1,2}):(\d{2}):(\d{2})/i); if (!m) return;
            let salida = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
            if (salida < now) salida.setDate(salida.getDate() + 1);
            const diff = Math.floor((salida.getTime() / 1000) - serverTime);
            if (diff > -60) {
                const html = fila.innerHTML.toLowerCase();
                const esApoyo = html.includes('support') || html.includes('def') || html.includes('reforzar');
                const esAtaque = !esApoyo && (html.includes('attack') || html.includes('ataque'));
                let tipo = '❓'; if (esApoyo) tipo = '🛡️ DEF'; else if (esAtaque) tipo = '⚔️ ATK'; else tipo = '⚔️ ATK (Defecto)';
                ataquesTemp.push({ hora: `${m[1]}:${m[2]}:${m[3]}`, timestamp: Math.floor(salida.getTime() / 1000), diff: diff, firma: `${m[1]}:${m[2]}:${m[3]}_${fila.innerHTML.length}`, tipo: tipo, esAtaque: esAtaque, esApoyo: esApoyo });
            }
        });
        const btnNext = document.querySelector('.paginator_bg .next, .pg_next, .paged-nav-item.next, .btn_next');
        if (btnNext && !btnNext.classList.contains('disabled')) { simularClick(btnNext); await esperar(1500); pagina++; } else { hayMasPaginas = false; }
    }
    if (ataquesTemp.length === 0) { resultado.innerHTML = '<span style="color:#f00;">❌ 0 ataques</span>'; return; }
    ataquesTemp.sort((a, b) => a.timestamp - b.timestamp); ordenesCapturadas = ataquesTemp;
    let html = `<strong style="color:#0f0;">✅ ${ataquesTemp.length} órdenes:</strong><br>`;
    ataquesTemp.forEach((a, i) => { html += `<div style="font-size:10px;${i === 0 ? 'font-weight:bold;color:#fff;' : 'color:#888;'}">[${i + 1}] ${a.tipo} - ${a.hora}</div>`; });
    resultado.innerHTML = html;
}

function iniciarProceso() {
    botActivo = true; document.getElementById('progress-container').style.display = 'block'; playBeep(600, 100);
    if (modoActual === 'dodge') procesarAutoDodge();
    else if (modoActual === 'cave') procesarAutoCave();
    else if (modoActual === 'farm') procesarAutoFarm();
    else if (modoActual === 'build') procesarAutoBuild();
    else if (modoActual === 'recruit') procesarAutoRecruit();
    else if (modoActual === 'culture') procesarAutoCulture();
    else if (modoActual === 'academy') procesarAutoAcademy();
    else if (modoActual === 'auto') procesarSuperAuto();
    else {
        if (ordenesCapturadas.length === 0) { alert('❌ Captura primero'); botActivo = false; return; }
        ordenActualIndex = 0; procesarOrden();
    }
}
    
function pararProceso() {
    botActivo = false; document.getElementById('resultado').innerHTML += '<br><span style="color:#f00;">⛔ OFF</span>';
    document.getElementById('progress-container').style.display = 'none';
    Object.keys(retrocesoTimers).forEach(id => clearInterval(retrocesoTimers[id])); retrocesoTimers = {};
}

async function buscarFilaEnPaginas(orden) { 
     let filas = Array.from(document.querySelectorAll('.attacks_row, .attack-list-item'));
     for(const f of filas) if(f.textContent.includes(orden.hora)) return f;
     return null;
}

function procesarOrden() {
    if (!botActivo || ordenActualIndex >= ordenesCapturadas.length) { botActivo = false; return; }
    const orden = ordenesCapturadas[ordenActualIndex];
    const antelacion = parseInt(document.getElementById('antelacion').value) || 5;
    const intervalo = setInterval(async () => {
        if (!botActivo) { clearInterval(intervalo); return; }
        const serverTime = getServerTime(); const diff = orden.timestamp - serverTime;
        document.getElementById('progress-bar').style.width = `${Math.max(0, 100 - ((diff / 60) * 100))}%`;
        document.getElementById('resultado').innerHTML = `<div style="text-align:center;"><div style="color:#ff0;">${orden.hora}</div><div style="font-size:18px;font-weight:bold;color:#fff;">${diff}s</div></div>`;
        if (diff <= antelacion) {
            clearInterval(intervalo);
            const fila = await buscarFilaEnPaginas(orden);
            if (fila) await ejecutarRuleta(fila, orden.timestamp, 0, 0);
            ordenActualIndex++; setTimeout(procesarOrden, 1000);
        }
    }, 100);
}

function simularClick(elemento) { if(!elemento)return; elemento.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); elemento.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); elemento.click(); }
function getDelay(ms) { return ms; }
async function ejecutarRuleta(fila, ts, neg, pos) { return true; }
async function buscarBoton() { return document.querySelector('.button_attack') || document.querySelector('.button_support'); }
async function buscarComandoNuevo(ant) { return null; }
function extraerSegundo(cmd) { return null; }
async function cancelar(cmd) { return false; }
function cerrarVentanas() {}
function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }
async function procesarAutoDodge() {}
function armarRetroceso(id, ts) {}
async function procesarAutoCave() {}
async function intentarMeterPlata(cant) {}
async function verificarVentanaCueva() {}
async function verificarBotonManual() {}
async function procesarAutoFarm() {}
async function recolectarAldeas() {}
async function verificarVentanaFarm() {}
async function procesarAutoBuild() {}
async function construirAlgo() {}
async function verificarVentanaBuild() {}
async function procesarAutoRecruit() {}
async function reclutarMasivo(cant) {}
async function reclutarAlgo(cant) {}
async function verificarVentanaRecruit() {}
async function procesarAutoCulture() {}
async function organizarCulturaMasiva() {}
async function seleccionarFestivalEnDropdown(nm) {}
async function organizarCultura() {}
async function verificarVentanaAgora() {}
async function procesarAutoAcademy() {}
async function investigarAlgo() {}
async function verificarVentanaAcademia() {}
async function procesarSuperAuto() {}
async function ejecutarCicloMantenimiento(t,m) {}
async function ejecutarUnaVezCave(m,c) {}
async function proximaCiudad() {}

if (window.top === window.self) {
    (function init() {
        if (document.body) crearPanelPrincipal();
        else setTimeout(init, 500);
    })();
})();