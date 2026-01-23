# GrepoBot Web 🤖

Integración completa de **GrepoBot** con React + Vite + Express para un panel moderno y escalable.

## ✨ Características Principales

- 🎨 **React 18** + **Vite** - Frontend ultramoderno y rápido
- 🚀 **Express Server** - APIs REST robustas
- 📱 **Responsive Design** - Funciona en mobile, tablet y desktop
- 🔐 **Admin Dashboard** - Panel con estadísticas en tiempo real
- 🎯 **TypeScript** - Type safety en todo el código
- 🎨 **Tailwind CSS** - Estilos modernos y personalizables
- 📦 **PostCSS + Autoprefixer** - CSS optimizado
- ✅ **ESLint** - Code quality checks
- 🌍 **Ready for Production** - Optimizado para deploy

## 📁 Estructura del Proyecto

```
grepobot-web/
├── src/
│   ├── main.tsx              # Punto de entrada React
│   ├── App.tsx               # Componente principal
│   ├── index.css             # Estilos globales
│   └── vite-env.d.ts         # Tipos TypeScript Vite
├── public/
│   ├── index.html            # Landing page
│   └── admin.html            # Admin dashboard
├── backend.js                # Servidor Express
├── vite.config.ts            # Configuración Vite
├── tailwind.config.ts        # Tailwind theme
├── tsconfig.json             # TypeScript config
├── tsconfig.node.json        # TypeScript Node config
├── postcss.config.js         # PostCSS plugins
├── eslint.config.js          # ESLint rules
├── package.json              # Dependencias
├── Procfile                  # Heroku/Render deploy
├── .gitignore               # Git ignore rules
└── README.md                # Este archivo
```

## 🚀 Instalación Rápida

```bash
# Clonar repositorio
git clone https://github.com/rumbero1/grepobot-web.git
cd grepobot-web

# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev
```

## 🌐 URLs Disponibles

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000/` | 🏠 Landing Page |
| `http://localhost:3000/app` | 🎨 React App |
| `http://localhost:3000/admin` | 🔐 Admin Dashboard |
| `http://localhost:3000/api/health` | 🔌 API Health Check |
| `http://localhost:3000/api/admin/stats` | 📊 Admin Statistics |

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia Vite dev server

# Build & Preview
npm run build        # Build para producción
npm run preview      # Preview del build

# Production
npm start            # Inicia servidor Express

# Code Quality
npm run lint         # Ejecuta ESLint
npm test             # Corre tests
```

## 🔧 Configuración de Desarrollo

### Variables de Entorno
Crea un archivo `.env` en la raíz:

```env
PORT=3000
NODE_ENV=development
```

## 📦 Dependencias Principales

### Frontend
- `react` - UI library
- `react-dom` - React DOM rendering
- `react-router-dom` - Client-side routing

### Backend
- `express` - Web framework
- `cors` - CORS middleware
- `body-parser` - JSON parser

### Development
- `vite` - Build tool
- `typescript` - Type safety
- `tailwindcss` - Utility-first CSS
- `eslint` - Code linting

## 🌍 Deployment

### En Render.com

1. Conecta tu repositorio GitHub
2. Configurar environment:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
3. Deploy automático en push a main

El archivo `Procfile` está preconfigurado:
```
web: node backend.js
```

## 🔒 Admin Dashboard Features

El dashboard admin incluye:

- 📊 **Estadísticas Globales**
  - Total de usuarios registrados
  - Descargas totales
  - Licencias activas
  - Logins en últimas 24h

- 📋 **Datos en Tiempo Real**
  - Últimos logins con IP
  - Descargas recientes
  - Lista completa de usuarios
  - Estado de licencias

- 🔄 **Auto-refresh**
  - Se actualiza cada 30 segundos
  - Botón manual de actualización

## 🎨 Personalización

### Agregar Nuevas APIs
Edita `backend.js`:

```javascript
app.get('/api/ruta-nueva', (req, res) => {
  res.json({ data: 'valor' });
});
```

## 🐛 Troubleshooting

### Puerto ya en uso
```bash
# Cambiar puerto en vite.config.ts
server: {
  port: 5173
}
```

### Errores de TypeScript
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Build falla
```bash
# Limpiar caché Vite
rm -rf .vite dist
npm run build
```

## 📚 Recursos Útiles

- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Express Docs](https://expressjs.com)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Docs](https://www.typescriptlang.org)

## 📄 Licencia

MIT © 2026 GrepoBot

## 👨‍💻 Autor

**rumbero1** - [GitHub](https://github.com/rumbero1)

---

**Hecho con ❤️ para GrepoBot Pro**