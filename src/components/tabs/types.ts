import type { 
    Sesion, SaludSistema, ArchivoSalida, KnowledgeItem, 
    ServerConfig, ApiConfig 
  } from "@/types/antigravity";
  
  export interface AppContextProps {
    // Database State
    sesiones: Sesion[];
    salud: SaludSistema | null;
    archivosSalida: ArchivoSalida[];
    knowledgeItems: KnowledgeItem[];
    servers: ServerConfig[];
    apis: ApiConfig[];
    
    // Core Functions
    refreshAll: () => Promise<void>;
    
    // UI Helpers (we will just let the components destructure everything from generic any for now to speed up the massive refactor)
    [key: string]: any;
  }
