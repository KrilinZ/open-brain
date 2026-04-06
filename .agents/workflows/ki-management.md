---
description: Gestión de Knowledge Items — Extraer, consolidar y limpiar KIs sin basura
---

# Gestión de Knowledge Items (KIs) en Brain

## Reglas Fundamentales

### 1. Principio de No-Basura
- **Nunca** crear una KI vacía o con solo metadata.json sin contenido en `artifacts/context.md`.
- **Nunca** crear KIs duplicadas. Antes de crear, SIEMPRE buscar si ya existe una KI que cubra el mismo tema.
- **Nunca** guardar credenciales/keys obsoletas. Si una clave deja de ser válida, borrar la KI inmediatamente.

### 2. Cuándo Crear una KI Nueva
Solo crear una KI nueva cuando:
- Se descubre un **patrón técnico reutilizable** (ej: cómo forzar WhatsApp large thumbnails)
- Se documenta un **bug con su fix** que puede volver a ocurrir (ej: Framer Motion crash)
- Se establece un **protocolo obligatorio** (ej: release flow)
- Se completa una **feature arquitectónica significativa** que cambia cómo funciona el sistema

### 3. Cuándo Consolidar (Merge)
Consolidar KIs existentes cuando:
- Hay **3+ KIs del mismo proyecto** que cubren aspectos parciales → Fusionar en una KI maestra
- Una KI de versión anterior queda **subsumida** por una nueva versión → Absorber en la maestra
- Hay KIs que se solapan más del 50% en contenido

### 4. Cuándo Eliminar
Eliminar una KI cuando:
- Está **vacía** (sin artifacts/context.md o context.md vacío)
- Las credenciales que contiene son **obsoletas/revocadas**
- Ha sido **consolidada** en otra KI maestra
- El proyecto/feature al que se refiere **ya no existe**

---

## Estructura Canónica de una KI

```
knowledge/<nombre-descriptivo>/
├── metadata.json
└── artifacts/
    └── context.md
```

### metadata.json
```json
{
  "title": "Título claro y descriptivo",
  "summary": "1-2 frases que permitan decidir si esta KI es relevante sin abrirla",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "references": ["ruta/archivo1.ts", "ruta/archivo2.tsx"]
}
```

### context.md
- Usar headers Markdown para seccionar
- Incluir **código real** (no pseudocódigo) cuando sea un patrón reutilizable
- Incluir la **causa raíz** cuando sea un bug documentado
- Ser **conciso**: si un contexto ocupa >150 líneas, probablemente debería partirse en secciones con headers claros

---

## Taxonomía de KIs por Proyecto

Cada proyecto debería tener **como máximo** estas KIs:

### Open Brain (proyecto actual)
- `open-brain-master` — Arquitectura, features, bugs conocidos, protocolo de release (TODO EN UNO)

### Adsteroides / StarsWarrior
- `arquitectura-adsteroides` — Stack, estructura, deploy, auth
- Engines, modelos, frontend, LLM, etc. solo si son KIs de referencia activa

### Transversales (sin proyecto específico)
- `whatsapp-large-thumbnail-og` — Técnica SEO reutilizable
- `api-keys-centralizadas` — Registro vivo de credenciales activas

---

## Workflow de Fin de Sesión

// turbo-all

Al finalizar una sesión de trabajo significativa:

1. **Auditar**: ¿Se descubrió algo reutilizable? ¿Se arregló un bug no trivial? ¿Cambió la arquitectura?
2. **Buscar primero**: `ls ~/.gemini/antigravity/knowledge/` — ¿Ya existe una KI que cubra este tema?
3. **Decidir**:
   - Si existe → **Actualizar** el `context.md` de esa KI y el `updatedAt` del metadata.json
   - Si no existe y es reutilizable → **Crear** una KI nueva siguiendo la estructura canónica
   - Si no es reutilizable → **No crear nada**. No toda sesión merece una KI.
4. **Limpiar**: Si durante la sesión se detectaron KIs obsoletas o vacías, eliminarlas.

---

## Anti-Patrones (PROHIBIDOS)

❌ Crear una KI por cada sesión de chat  
❌ Crear KIs con nombres genéricos como "session-notes" o "debug-log"  
❌ Guardar keys de cuentas que ya no se controlan  
❌ Tener 5+ KIs separadas para el mismo proyecto con info fragmentada  
❌ KIs con solo `metadata.json` y carpeta `artifacts/` vacía  
❌ KIs con `context.md` de 1 línea que no aporta contexto suficiente  
