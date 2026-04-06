export interface ArtefactoMeta {
  name: string;
  type: string;
  summary: string;
  updatedAt: string;
  version: string;
}

export interface Sesion {
  id: string;
  titulo: string;
  estado: 'Saludable' | 'En riesgo' | 'Archivado';
  tamañoPB: number;
  tamañoPBFormateado: string;
  fechaModificacion: string | null;
  totalArtefactos: number;
  artefactos: ArtefactoMeta[];
  archivosResolved: number;
  fuente: 'brain' | 'implicit';
}

export interface SaludSistema {
  tamañoTotal: string;
  tamañoTotalBytes: number;
  totalConversaciones: number;
  totalArtefactos: number;
  totalImagenes: number;
  totalSesionesBrain: number;
  totalResolved: number;
  seguridadSesiones: number;
  externalizacionPrompts: number;
  riesgoContexto: number;
  conversacionesGrandes: number;
  basePath: string;
}

export interface ArchivoSalida {
  titulo: string;
  sesionId: string;
  ruta: string;
  tipo: string;
  tamaño: string;
  tamañoBytes: number;
  fechaModificacion: string;
  sincronizado: boolean;
}

export interface ResultadoRespaldo {
  exito: boolean;
  ruta?: string;
  tamaño?: string;
  mensaje: string;
}

export interface ResultadoLimpieza {
  exito: boolean;
  eliminados: number;
  espacioLiberado?: string;
  errores?: string[];
  mensaje: string;
}

export interface ResultadoIntegridad {
  conversacionesSinBrain: string[];
  brainSinConversacion: string[];
  artefactosSinMetadata: string[];
  metadataSinArtefacto: string[];
  archivosCorruptos: string[];
  estadisticas: {
    totalConversaciones: number;
    totalSesionesBrain: number;
    problemas: number;
  };
  error?: string;
}

export interface ResultadoApertura {
  exito: boolean;
  mensaje: string;
}

export interface ArtefactoArchivo {
  nombre: string;
  ruta: string;
  tamaño: string;
  tamañoBytes: number;
  fechaModificacion: string;
  tipo: string;
  esTexto: boolean;
  esImagen: boolean;
  esVideo: boolean;
}

export interface KnowledgeArtifact {
  nombre: string;
  contenido: string | null;
  tamaño: string;
}

export interface KnowledgeItem {
  id: string;
  titulo: string;
  resumen: string;
  referencias: string[];
  creadoEn: string | null;
  actualizadoEn: string | null;
  artefactos: KnowledgeArtifact[];
}

export interface ApiProjectUsage {
  proyecto: string;
  consumoMensual: number;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

export interface ApiConfig {
  id: string;
  nombre: string;
  tipo: string;
  apiKey: string;
  saldo: number;
  limiteAlerta: number;
  color: string;
  proyectos: ApiProjectUsage[];
  notas: string[];
  url: string;
  status?: 'OK' | 'ERROR' | 'SYNCING' | 'UNKNOWN';
}

export interface ServerProject {
  nombre: string;
  desc: string;
  color: string;
  activo: boolean;
}

export interface ServerContainer {
  nombre: string;
  puerto: string;
  activo: boolean;
}

export interface ServerConfig {
  id: string;
  nombre: string;
  ip: string;
  proveedor: string;
  os: string;
  ram: string;
  color: string;
  ssh: string;
  proyectos: ServerProject[];
  containers: ServerContainer[];
  notas: string[];
}

export interface MaintenanceExtInfo {
  nombre: string;
  tamaño: string;
}

export interface MaintenanceInfo {
  extensiones: {
    total: number;
    innecesarias: number;
    listaInnecesarias: MaintenanceExtInfo[];
    tamañoTotal: string;
    tamañoInnecesarias: string;
  };
  browserProfile: {
    tamaño: string;
    tamañoBytes: number;
    cacheLimpiable: string;
    cacheLimpiableBytes: number;
  };
  appSupport: {
    tamaño: string;
    tamañoBytes: number;
  };
}

export interface AntigravityAPI {
  getSessions: () => Promise<Sesion[]>;
  getSessionArtifacts: (sessionId: string) => Promise<ArtefactoArchivo[]>;
  getSessionTranscript: (sessionId: string) => Promise<string | null>;
  getProjects: () => Promise<string[]>;
  addProject: (p: string) => Promise<string[]>;
  deleteProject: (p: string) => Promise<string[]>;
  forceScanRadars: () => Promise<{ ok: boolean, logs?: string[], capturados?: {id:string, title:string}[], error?: string }>;
  getZombieProcesses: () => Promise<{ ok: boolean, zombies: { pid: string, ppid: string, stat: string, comm: string, parentName: string }[] }>;
  killProcesses: (pids: string[]) => Promise<{ ok: boolean, mensaje?: string, error?: string }>;
  getSettings: () => Promise<{ localAiModel?: string }>;
  setSettings: (s: { localAiModel?: string }) => Promise<{ localAiModel?: string }>;
  getOllamaModels: () => Promise<string[]>;
  getPrompts: () => Promise<Prompt[]>;
  savePrompt: (p: Prompt) => Promise<Prompt[]>;
  deletePrompt: (id: string) => Promise<Prompt[]>;
  askLlama: (prompt: string) => Promise<string>;
  installLlama: () => Promise<boolean>;
  readArtifact: (sessionId: string, filename: string) => Promise<string | null>;
  getSystemHealth: () => Promise<SaludSistema>;
  getAllOutputs: () => Promise<ArchivoSalida[]>;
  createBackup: () => Promise<ResultadoRespaldo>;
  getKnowledge: () => Promise<KnowledgeItem[]>;
  openInFinder: (path: string) => Promise<void>;
  openConversation: (sessionId: string) => Promise<ResultadoApertura>;
  cleanResolved: () => Promise<ResultadoLimpieza>;
  verifyIntegrity: () => Promise<ResultadoIntegridad>;
  createKI: (data: { titulo: string; resumen: string; contenido: string }) => Promise<ResultadoApertura>;
  generateKIFromSession: (sessionId: string) => Promise<ResultadoApertura>;
  deleteKI: (kiId: string) => Promise<ResultadoApertura>;
  autoSyncProjects: () => Promise<{ exito: boolean; creados: number; actualizados: number; saltados: number; log: string[]; mensaje: string }>;
  getServers: () => Promise<ServerConfig[]>;
  saveServer: (server: ServerConfig) => Promise<{ exito: boolean; mensaje: string }>;
  deleteServer: (serverId: string) => Promise<{ exito: boolean; mensaje: string }>;
  checkServer: (server: ServerConfig) => Promise<{ exito: boolean; servidor: ServerConfig; mensaje: string }>;
  getApis: () => Promise<ApiConfig[]>;
  saveApi: (api: ApiConfig) => Promise<{ exito: boolean; mensaje: string }>;
  deleteApi: (apiId: string) => Promise<{ exito: boolean; mensaje: string }>;
  syncApis: () => Promise<ApiConfig[]>;
  // Mantenimiento profundo
  getMaintenanceInfo: () => Promise<MaintenanceInfo>;
  cleanExtensions: () => Promise<ResultadoLimpieza>;
  cleanBrowserCache: () => Promise<{ exito: boolean; espacioLiberado: string; errores?: string[]; mensaje: string }>;
  cleanAntigravityCache: () => Promise<{ exito: boolean; espacioLiberado: string; errores?: string[]; mensaje: string }>;
  killZombieProcesses: () => Promise<{ exito: boolean; procesos: number; pids?: string[]; lineas?: string[]; mensaje: string }>;
  listExtensions: () => Promise<{ total: number; esenciales: number; innecesarias: number; extensiones: { id: string; version: string; esencial: boolean; tamaño: string; tamañoBytes: number }[] }>;
  // Auto-check servidores
  getServerStatuses: () => Promise<Record<string, { ok: boolean; lastCheck: string; ram: string; nombre: string }>>;
  forceCheckServers: () => Promise<Record<string, { ok: boolean; lastCheck: string; ram: string; nombre: string }>>;
  onServerStatuses: (callback: (statuses: Record<string, { ok: boolean; lastCheck: string; ram: string; nombre: string }>) => void) => () => void;
  // Terminal Neuronal & Chat
  checkLlama: () => Promise<boolean>;
  loadLastChatLog: () => Promise<{ logs: { role: 'user' | 'ia', text: string }[] }>;
  saveChatLog: (logs: { role: 'user' | 'ia', text: string }[]) => Promise<void>;
  getChatSessions: () => Promise<{ file: string, savedAt: string | null, count: number }[]>;
  loadChatSession: (file: string) => Promise<{ logs: { role: 'user' | 'ia', text: string }[] }>;
  deleteChatSession: (file: string) => Promise<void>;
  runAgent: (mode: 'quick' | 'full') => Promise<{ log: string[], editores: string[], capturados: {id:string, title:string}[], resumen: string }>;
}

declare global {
  interface Window {
    antigravity: AntigravityAPI;
  }
}
