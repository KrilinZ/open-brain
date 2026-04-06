const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('antigravity', {
  // Sesiones / Conversaciones
  getSessions: () => ipcRenderer.invoke('ag:get-sessions'),
  getSessionArtifacts: (sessionId) => ipcRenderer.invoke('ag:get-session-artifacts', sessionId),
  readArtifact: (sessionId, filename) => ipcRenderer.invoke('ag:read-artifact', sessionId, filename),

  // Salud del sistema
  getSystemHealth: () => ipcRenderer.invoke('ag:get-system-health'),

  // Bóveda de salidas
  getAllOutputs: () => ipcRenderer.invoke('ag:get-all-outputs'),

  // Respaldos
  createBackup: () => ipcRenderer.invoke('ag:create-backup'),

  // Base de conocimiento
  getKnowledge: () => ipcRenderer.invoke('ag:get-knowledge'),

  // Abrir en Finder
  openInFinder: (path) => ipcRenderer.invoke('ag:open-in-finder', path),
  openVault: () => ipcRenderer.invoke('ag:open-vault'),

  // ═══════════ NUEVOS ═══════════

  // Abrir conversación en Antigravity / VS Code
  openConversation: (sessionId) => ipcRenderer.invoke('ag:open-conversation', sessionId),

  // Limpiar archivos .resolved duplicados
  cleanResolved: () => ipcRenderer.invoke('ag:clean-resolved'),

  // Verificar integridad de datos
  verifyIntegrity: () => ipcRenderer.invoke('ag:verify-integrity'),

  // ═══════════ KNOWLEDGE ITEMS ═══════════
  createKI: (data) => ipcRenderer.invoke('ag:create-ki', data),
  generateKIFromSession: (sessionId) => ipcRenderer.invoke('ag:generate-ki-from-session', sessionId),
  deleteKI: (kiId) => ipcRenderer.invoke('ag:delete-ki', kiId),

  // ═══════════ AUTO-SYNC DE PROYECTOS ═══════════
  // Agrupa sesiones por proyecto, crea/actualiza KIs automáticamente
  autoSyncProjects: () => ipcRenderer.invoke('ag:auto-sync-projects'),
  getKiAutoMode: () => ipcRenderer.invoke('ag:get-ki-auto-mode'),
  setKiAutoMode: (auto) => ipcRenderer.invoke('ag:set-ki-auto-mode', auto),

  // ═══════════ SERVIDORES ═══════════
  getServers: () => ipcRenderer.invoke('ag:get-servers'),
  saveServer: (server) => ipcRenderer.invoke('ag:save-server', server),
  deleteServer: (serverId) => ipcRenderer.invoke('ag:delete-server', serverId),
  checkServer: (server) => ipcRenderer.invoke('ag:check-server', server),

  // ═══════════ APIs ═══════════
  getApis: () => ipcRenderer.invoke('ag:get-apis'),
  saveApi: (api) => ipcRenderer.invoke('ag:save-api', api),
  deleteApi: (apiId) => ipcRenderer.invoke('ag:delete-api', apiId),
  syncApis: () => ipcRenderer.invoke('ag:sync-apis'),

  // ═══════════ MANTENIMIENTO PROFUNDO ═══════════
  getMaintenanceInfo: () => ipcRenderer.invoke('ag:get-maintenance-info'),
  cleanExtensions: () => ipcRenderer.invoke('ag:clean-extensions'),
  cleanBrowserCache: () => ipcRenderer.invoke('ag:clean-browser-cache'),
  cleanAntigravityCache: () => ipcRenderer.invoke('ag:clean-antigravity-cache'),
  killZombieProcesses: () => ipcRenderer.invoke('ag:kill-zombie-processes'),
  listExtensions: () => ipcRenderer.invoke('ag:list-extensions'),

  // ═══════════ AUTONOMIA OLLAMA ═══════════
  checkLlama: () => ipcRenderer.invoke('ag:check-llama'),
  installLlama: () => ipcRenderer.invoke('ag:install-llama'),
  askLlama: (question) => ipcRenderer.invoke('ag:ask-llama', question),
  onOllamaStatus: (callback) => {
    ipcRenderer.on('ag:ollama-status', (_event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('ag:ollama-status');
  },

  // ═══════════ AUTO-CHECK SERVIDORES ═══════════
  getServerStatuses: () => ipcRenderer.invoke('ag:get-server-statuses'),
  forceCheckServers: () => ipcRenderer.invoke('ag:force-check-servers'),
  onServerStatuses: (callback) => {
    ipcRenderer.on('ag:server-statuses', (_event, statuses) => callback(statuses));
    return () => ipcRenderer.removeAllListeners('ag:server-statuses');
  },
  // ═══════════ CHAT LOG PERSISTENCE ═══════════
  saveChatLog: (logs) => ipcRenderer.invoke('ag:save-chat-log', logs),
  loadLastChatLog: () => ipcRenderer.invoke('ag:load-last-chat-log'),
  getChatSessions: () => ipcRenderer.invoke('ag:get-chat-sessions'),
  loadChatSession: (fileName) => ipcRenderer.invoke('ag:load-chat-session', fileName),
  deleteChatSession: (fileName) => ipcRenderer.invoke('ag:delete-chat-session', fileName),

  // ═══════════ SESSION TRANSCRIPT ═══════════
  getSessionTranscript: (sessionId) => ipcRenderer.invoke('ag:get-session-transcript', sessionId),

  // ═══════════ AGENTE AUTÓNOMO ═══════════
  runAgent: (command) => ipcRenderer.invoke('ag:run-agent', command),

  // ═══════════ PROYECTOS RADAR ═══════════
  getProjects: () => ipcRenderer.invoke('ag:get-projects'),
  addProject: (pathStr) => ipcRenderer.invoke('ag:add-project', pathStr),
  deleteProject: (pathStr) => ipcRenderer.invoke('ag:delete-project', pathStr),
  forceScanRadars: () => ipcRenderer.invoke('ag:force-scan-radars'),
  getZombieProcesses: () => ipcRenderer.invoke('ag:get-zombie-processes'),
  killProcesses: (pids) => ipcRenderer.invoke('ag:kill-processes', pids),

  // ═══════════ SETTINGS GLOBALES ═══════════
  getSettings: () => ipcRenderer.invoke('ag:get-settings'),
  setSettings: (s) => ipcRenderer.invoke('ag:set-settings', s),
  getOllamaModels: () => ipcRenderer.invoke('ag:get-ollama-models'),

  // ═══════════ PROMPT REPOSITORY ═══════════
  getPrompts: () => ipcRenderer.invoke('ag:get-prompts'),
  savePrompt: (p) => ipcRenderer.invoke('ag:save-prompt', p),
  deletePrompt: (id) => ipcRenderer.invoke('ag:delete-prompt', id),
});

