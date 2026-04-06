# AI Memory — Torre de Control (Antigravity Brain)

## Proyecto
App de escritorio Electron (Vite + React 18 + TypeScript + shadcn/ui + framer-motion + Tailwind v4).
Panel local-first con 8 tabs: Sesiones, Prompts, Salidas, Reparar, APIs, Servidores, Conocimiento, Info.

## Stack
- Frontend: React 18 + TypeScript + Vite
- Desktop: Electron (main.js + preload.cjs)
- UI: shadcn/ui + framer-motion + Tailwind CSS v4
- Persistencia: JSON local (servers.json, apis.json)
- Build: electron-builder → DMG

## Estructura
- `src/App.tsx` — Componente principal con todas las tabs
- `electron/main.js` — Proceso principal Electron con IPC handlers
- `electron/preload.cjs` — Bridge IPC (window.antigravity)
- `src/assets/` — Logo e iconos

## Reglas de Diseño
- NUNCA usar emojis en UI — siempre SVG icons con animaciones CSS
- Landings: grids completos sin huecos (columnas fijas, no auto-fit)
- Estilo cyberpunk con colores neón (--accent, --pink, --purple, --green)
- Stroke-based icons con glow/pulse/rotate animations

## Servidores Conectados
1. Contabo (84.247.166.121) — DeliveryRecovery, Neuronalis
2. Hetzner (46.225.188.196) — StarsWarrior, MetricalPro CRM
3. MetricalPro (94.250.203.161) — MetricalPro API, Oficina MKT

## Comandos Útiles
- Dev: `npm run dev`
- Build: `npm run app:build`
- Electron dev: `npm run electron:dev`

## Problemas Conocidos
- El spinning infinito de Antigravity NO es un bug de esta app
- Ver KI "Antigravity — Spinning eterno" para soluciones

## Flujo de Trabajo OBLIGATORIO
1. Hacer cambios en código fuente (main.js, App.tsx, etc.)
2. Build: `npm run app:build` → actualiza `release/mac-arm64/Antigravity Brain.app`
3. El usuario verifica en su app de mac-arm64 (la que tiene abierta)
4. Si OK → subir a git. Si NO → iterar y rebuild

### Reglas
- La app que el usuario USA está en `release/mac-arm64/` — verificar ahí
- NO abrir navegadores — esto es Electron, no web
- El push a git es el ÚLTIMO paso
- NUNCA usar el nombre "SmartModule" — se llama "Antigravity Brain"
- **SIEMPRE guardar avances y cambios en KI** — actualizar context.md de los KIs relevantes después de cada cambio significativo, sin esperar a que el usuario lo pida

