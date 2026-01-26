# GrepoBot Web — Cambios propuestos

Resumen:
- Persistencia SQLite en `./data/grepobot.db`
- Registro/Login con token y contraseña hasheada (bcrypt)
- Trial 7 días al registrarse; descarga de prueba 1 vez; la versión completa requiere compra
- Descargas Tampermonkey inyectan un snippet que comprueba licencia en `/api/check-license`
- Endpoints: `/api/registro`, `/api/login`, `/api/check-license`, `/api/descargar`, `/api/paypal/*`, `/api/support`, `/health`

Variables de entorno:
- PORT (opcional)
- DB_PATH (opcional) — por defecto `./data/grepobot.db`
- OPENAI_API_KEY (opcional) — para activar soporte IA
- PAYPAL keys (cuando quieras activar pagos reales)

Instalación local (para pruebas):
1. Clona repo
2. Copia `bot_original.js` a `scripts/bot_full.user.js` y añade `scripts/bot_attack_only.user.js` (ya incluido)
3. Instala dependencias:
   npm install
   npm install bcryptjs node-fetch@2
4. Arranca:
   npm start
5. Pruebas manuales:
   - POST /api/registro { username, password } -> devuelve token
   - POST /api/login { username, password } -> devuelve token
   - GET /api/check-license?token=...
   - GET /api/descargar?usuarioId=...&variant=tampermonkey-trial&token=... -> descarga tampermonkey con inyección
   - POST /api/paypal/capture-order { usuarioId, planId } -> simula compra

Despliegue en Render:
- Añade variables de entorno en Render: DB_PATH (opcional), OPENAI_API_KEY (si quieres IA)
- Deploy automático desde GitHub

Notas:
- No se sube la base de datos al repo — la carpeta `/data` está en `.gitignore`.
- El sistema de pago en este PR es simulado. Para pagos reales hay que añadir credenciales del proveedor.
