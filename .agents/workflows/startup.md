---
description: Startup workflow — lee contexto del proyecto al iniciar un chat nuevo
---

# Startup

Al iniciar una nueva conversación sobre este proyecto:

// turbo-all

1. Leer el archivo `AI_MEMORY.md` en la raíz del proyecto para entender el contexto.
2. **CONSULTA OBLIGATORIA A BRAIN**: Revisar los KIs en `~/.gemini/antigravity/knowledge/` para contexto transversal (credenciales, reglas, memoria). No programar sin haber leído los KIs relevantes.
3. **LEER WORKFLOW `/ki-management`**: Ejecutar `view_file` sobre `.agents/workflows/ki-management.md` para cargar las reglas de gestión de KIs. Esto es obligatorio y no negociable.
4. No recargar conversaciones antiguas — todo el contexto está en AI_MEMORY.md y la memoria viva (KIs) de Brain.

---

# Cierre de Sesión (OBLIGATORIO)

Antes de que el usuario cierre el chat o deje de interactuar, el agente DEBE ejecutar este checklist:

1. **¿Hubo progreso técnico significativo?** (feature nueva, bug resuelto, patrón descubierto, cambio arquitectónico)
   - SÍ → Ir al paso 2
   - NO → No hacer nada. Fin.

2. **¿Ya existe una KI que cubra este tema?**
   ```bash
   ls ~/.gemini/antigravity/knowledge/
   ```
   - SÍ → **Actualizar** el `context.md` de esa KI y el `updatedAt` del metadata.json
   - NO → **Crear** una KI nueva siguiendo la estructura de `/ki-management`

3. **¿Se detectaron KIs obsoletas o vacías durante la sesión?**
   - SÍ → Eliminarlas
   - NO → Fin.

> IMPORTANTE: Este paso de cierre no es opcional. El agente debe proponerlo activamente al usuario antes de cerrar.
