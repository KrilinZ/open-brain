# AI Memory — OpenBrain v2.0.0

## Proyecto
App de escritorio Electron para gestión de Knowledge Items (KIs), APIs y servidores VPS.
**v2.0.0**: Simplificación radical — RemoveOllama, solo gestión local-first + APIs externas.

## Stack Actual
- Frontend: **React 19** + TypeScript + **Vite 8** + ESM
- Desktop: **Electron 33** (main.js + preload.cjs)
- UI: **Tailwind CSS v4** + **Framer Motion 12** + Custom Neural Background
- Persistencia: JSON local en `~/.openbrain/` (KIs, APIs, servidores, prompts, settings)
- Build: electron-builder → DMG (mac-arm64)

## Estructura Actual
```
OpenBrain/
├── src/
│   ├── App.tsx                          # Componente principal (258 líneas)
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── TabConocimiento.tsx      # Search & manage KIs
│   │   │   ├── TabApis.tsx              # API keys + balances vault
│   │   │   ├── TabServidores.tsx        # SSH monitoring (RAM, Disk, Docker, PM2)
│   │   │   └── ... (otras tabs)
│   │   └── NeuralBackground.tsx         # Animated neural network bg (NUEVO)
│   ├── types/antigravity.ts             # TypeScript definitions
│   └── index.css                        # Global styles + Tailwind
├── main.js                              # Electron main process + IPC
├── preload.cjs                          # IPC bridge (window.antigravity)
└── package.json                         # Deps: Electron, React, Vite, Tailwind

Local State (~/.openbrain/):
├── knowledge/                           # KIs indexados
├── servers.json                         # VPS config (3 servers)
├── apis.json                            # API keys encriptados + balances
├── prompts.json                         # Prompt repository
├── settings.json                        # Global config
└── chat-logs/                           # Neural Terminal history
```

## Módulos Principales

| Módulo | Función | Status |
|--------|---------|--------|
| **Knowledge Base** | Indexar, buscar y gestionar KIs | ✅ Funcional |
| **API Manager** | Vault de keys + saldo real-time | ✅ Funcional |
| **Server Monitor** | SSH → RAM, Disk, Docker, PM2 | ✅ Funcional |
| **Herramientas** | Backup, cache clean, integrity check | ✅ Funcional |
| **Auto Mode** | Sync c/5 min (obsoleto post v2.0) | ⚠️ Por revisar |
| **Neural Background** | Animated BG (nuevo) | ✅ Integrado |

## Servidores Conectados
1. **Contabo** (84.247.166.121) — DeliveryRecovery, Neuronalis
2. **Hetzner** (46.225.188.196) — StarsWarrior, MetricalPro CRM
3. **MetricalPro** (94.250.203.161) — MetricalPro API, Oficina MKT

## Comandos Útiles
```bash
npm run dev              # Dev mode Vite + Electron hot reload
npm run app:build       # Build app → release/mac-arm64/
npm run electron:dev    # Electron dev (main.js en modo watch)
npm run dist            # Full DMG build
git log --oneline       # Ver commits
```

## Workflow de Cambios
1. Hacer cambios en código (src/, main.js, preload.cjs)
2. `npm run app:build` → actualiza `release/mac-arm64/Antigravity Brain.app`
3. Verificar en la app del usuario (que está en release/)
4. Si OK → commit con descripción clara
5. Actualizar AI_MEMORY.md si hay cambios arquitectónicos

## Reglas de Diseño
- ❌ NUNCA emojis en UI → siempre SVG icons + Tailwind
- ✅ Cyberpunk style: neón colors (--accent, --pink, --purple, --green)
- ✅ Animaciones: Framer Motion para transiciones smooth
- ✅ Dark mode por defecto (Electron + Tailwind dark mode)

## Estado v2.0.0
- ✅ Commit dacb197: RemoveOllama + Neural UI updates (31 May 2026)
- ✅ 10 files changed, 1685 insertions(+), 873 deletions(-)
- ✅ NeuralBackground.tsx integrado
- ⚠️ AutoMode behavior post-simplification: revisar si aún es necesario
- ⚠️ Integración con Brain CLI-QUE: pasar credenciales vía IPC

## Problemas Conocidos
- **Spinning infinito Antigravity**: Ver KI específica para contexto
- **v2.0 transition**: Algunos handlers Legacy aún en main.js
- **AutoMode**: Lógica antigua (Ollama) — simplificar o eliminar

## Notas Importantes
- La app que el usuario ABRE está en `release/mac-arm64/`
- El workspace es `/Users/nacho/Desktop/PROYECTOS/OpenBrain`
- SIEMPRE guardar cambios significativos en Brain (KIs)
- NO usar "SmartModule" — se llama **"Antigravity Brain"** o **"OpenBrain"**
