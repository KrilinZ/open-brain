/* eslint-disable */
// @ts-nocheck
import logoBrain from "@/assets/logo-brain.png";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, Activity,
  Database, Clock3, Zap, ToggleLeft,
  ToggleRight, RefreshCw, Key, DollarSign, Cpu, Wifi, BarChart3, Scan, Lock, Target, Skull,
  ChevronRight, Terminal, Globe, Shield, Radio, Activity as ActivityIcon, Monitor, Crosshair, 
  Settings as SettingsIcon, Database as DatabaseIcon
} from "lucide-react";
import type { Sesion, SaludSistema, ArchivoSalida, ArtefactoArchivo, KnowledgeItem, ServerConfig, ApiConfig, Prompt } from "@/types/antigravity";


import { TabSesiones } from "./components/tabs/TabSesiones";
import { TabPrompts } from "./components/tabs/TabPrompts";
import { TabSalidas } from "./components/tabs/TabSalidas";
import { TabReparar } from "./components/tabs/TabReparar";
import { TabApis } from "./components/tabs/TabApis";
import { TabServidores } from "./components/tabs/TabServidores";
import { TabConocimiento } from "./components/tabs/TabConocimiento";
import { TabUnion } from "./components/tabs/TabUnion";
import { TabIA } from "./components/tabs/TabIA";
import { TabInfo } from "./components/tabs/TabInfo";

/* ───── ANIMATIONS ───── */
const animEntrada = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
};

/* ───── HELPERS ───── */
function tiempoRelativo(fechaISO: string | null): string {
  if (!fechaISO) return "??:??";
  const diff = Date.now() - new Date(fechaISO).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "SEC_AGO";
  if (mins < 60) return `${mins}M_AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H_AGO`;
  return `${Math.floor(hours / 24)}D_AGO`;
}

/* ───── UI DECOR ───── */
export function HUDCorner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cn = pos === 'tl' ? 'top-3 left-3' : pos === 'tr' ? 'top-3 right-3' : pos === 'bl' ? 'bottom-3 left-3' : 'bottom-3 right-3';
  return <div className={`hud-corner ${cn} opacity-40 select-none uppercase tracking-[0.2em] pointer-events-none`}>[LOC_{Math.random().toString(16).slice(2, 6).toUpperCase()}]</div>;
}

/* ───── APP COMPONENT ───── */
export default function App() {
  const isElectron = typeof window !== "undefined" && !!window.antigravity;
  const topRef = useRef<HTMLDivElement>(null);

  // Real Database State
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [salud, setSalud] = useState<SaludSistema | null>(null);
  const [archivosSalida, setArchivosSalida] = useState<ArchivoSalida[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [apis, setApis] = useState<ApiConfig[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [activeTab, setActiveTab] = useState("ia");
  const [promptToInject, setPromptToInject] = useState<string | null>(null);

  // UI State
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState("");
  const spotlightRef = useRef<HTMLInputElement>(null);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null);
  const [artefactosSesion, setArtefactosSesion] = useState<ArtefactoArchivo[]>([]);
  const [artefactoSeleccionado, setArtefactoSeleccionado] = useState<string | null>(null);
  const [contenidoArtefacto, setContenidoArtefacto] = useState("");
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [isSyncingApis, setIsSyncingApis] = useState(false);
  
  // KI State
  const [selectedKi, setSelectedKi] = useState<KnowledgeItem | null>(null);
  const [kiSearchQuery, setKiSearchQuery] = useState("");

  // Transcript State
  const [isViewingTranscript, setIsViewingTranscript] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  
  // KI Encoder State
  const [isEncodingKi, setIsEncodingKi] = useState(false);
  const [kiEncodeMsg, setKiEncodeMsg] = useState<string | null>(null);

  // New KI Form State
  const [newKiTitle, setNewKiTitle] = useState("");
  const [newKiSummary, setNewKiSummary] = useState("");
  const [newKiContent, setNewKiContent] = useState("");
  const [isCreatingKi, setIsCreatingKi] = useState(false);

  // Vault State
  const [filterSalida, setFilterSalida] = useState("");

  // Ollama Background State
  const [ollamaStatus, setOllamaStatus] = useState<{ active: boolean, processingSession: string | null }>({ active: false, processingSession: null });

  // AUTO MODE State
  const [autoMode, setAutoMode] = useState(true);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // refreshAll MUST be declared before runAutoSync (const hoisting)
  const refreshAll = useCallback(async () => {
    if (!isElectron) return;
    try {
      const [sess, health, outputs, ki, srvs, apiData, promptData] = await Promise.all([
        window.antigravity.getSessions(),
        window.antigravity.getSystemHealth(),
        window.antigravity.getAllOutputs(),
        window.antigravity.getKnowledge(),
        window.antigravity.getServers(),
        window.antigravity.getApis(),
        window.antigravity.getPrompts(),
      ]);
      setSesiones(sess); setSalud(health); setArchivosSalida(outputs);
      setKnowledgeItems(ki); setServers(srvs); setApis(apiData);
      setPrompts(promptData || []);
    } catch (e) { console.error("REFRESH_ALL_ERROR:", e); }
  }, [isElectron]);

  const runAutoSync = useCallback(async () => {
    if (!isElectron) return;
    setAutoStatus('SYNCING...');
    try {
      await window.antigravity.autoSyncProjects();
      await refreshAll();
      setAutoStatus('SYNCED_' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setAutoStatus('ERROR');
    }
  }, [isElectron, refreshAll]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (isElectron && window.antigravity?.getKiAutoMode) {
      window.antigravity.getKiAutoMode().then(setAutoMode);
    }
  }, [isElectron]);

  useEffect(() => {
    if (isElectron && window.antigravity?.setKiAutoMode) {
      window.antigravity.setKiAutoMode(autoMode);
    }
    if (autoMode) {
      runAutoSync();
      autoIntervalRef.current = setInterval(runAutoSync, 5 * 60 * 1000);
    } else {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      setAutoStatus(null);
    }
    return () => { if (autoIntervalRef.current) clearInterval(autoIntervalRef.current); };
  }, [autoMode, runAutoSync]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSpotlight(prev => !prev); setSpotlightQuery(""); }
      if (e.key === 'Escape') setShowSpotlight(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isElectron || !window.antigravity.onOllamaStatus) return;
    const cleanup = window.antigravity.onOllamaStatus((status) => {
       setOllamaStatus(status);
       if (!status.active) refreshAll(); // reflex sync when done
    });
    return cleanup;
  }, [isElectron, refreshAll]);

  // Scroll to top on mount — delayed to fire after all child effects
  useEffect(() => {
    const t = setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      window.scrollTo(0, 0);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    window.scrollTo(0, 0);
  }, [activeTab]);

  const ctx = {
    sesiones, setSesiones, salud, setSalud, archivosSalida, setArchivosSalida,
    knowledgeItems, setKnowledgeItems, servers, setServers, apis, setApis,
    activeTab, setActiveTab, showSpotlight, setShowSpotlight, spotlightQuery, setSpotlightQuery,
    sesionSeleccionada, setSesionSeleccionada, artefactosSesion, setArtefactosSesion,
    artefactoSeleccionado, setArtefactoSeleccionado, contenidoArtefacto, setContenidoArtefacto,
    maintenanceMsg, setMaintenanceMsg, isSyncingApis, setIsSyncingApis, selectedKi, setSelectedKi,
    kiSearchQuery, setKiSearchQuery, isViewingTranscript, setIsViewingTranscript,
    transcriptContent, setTranscriptContent, isTranscriptLoading, setIsTranscriptLoading,
    isEncodingKi, setIsEncodingKi, kiEncodeMsg, setKiEncodeMsg, filterSalida, setFilterSalida,
    newKiTitle, setNewKiTitle, newKiSummary, setNewKiSummary, newKiContent, setNewKiContent,
    isCreatingKi, setIsCreatingKi,
    ollamaStatus, setOllamaStatus, prompts, setPrompts, promptToInject, setPromptToInject, refreshAll
  };

  return (
    <div className="min-h-screen text-[#f0f0f0] font-mono selection:bg-cyan-500 selection:text-white relative">
      {/* TOP ANCHOR — scroll target */}
      <div ref={topRef} style={{position: 'absolute', top: 0, left: 0, height: 1, width: 1, pointerEvents: 'none'}} />
      
      {/* WINDOW DRAG HANDLE */}
      <div 
        className="fixed top-0 left-0 right-0 h-8 z-[9999] cursor-default" 
        style={{ WebkitAppRegion: 'drag' } as any} 
      />
      
      {/* CYBER BACKGROUND LAYERS */}
      <div className="fixed inset-0 hex-grid z-[-1] opacity-40 shadow-[inset_0_0_100px_rgba(0,0,0,1)]" />
      <div className="scanlines-fixed opacity-40" />

      {/* TACTICAL HUD OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-[200] select-none">
        {/* Top-left system readout */}
        <div className="absolute top-10 left-6 font-mono text-[10px] text-cyan-400 leading-5 font-bold tracking-widest opacity-50">
          [ NEURAL_OS v1.3.0 ]<br/>
          [ STATUS: <span className="text-cyan-300 animate-pulse">ONLINE</span> ]<br/>
          [ UPTIME: {Math.floor(Date.now()/10000) % 9999}s ]
        </div>
        {/* Top-right system readout */}
        <div className="absolute top-10 right-6 font-mono text-[10px] text-pink-400 text-right leading-5 font-bold tracking-widest opacity-50">
          [ PWR: 100% ]<br/>
          [ ACCESS: ROOT ]<br/>
          [ ENC: SHA-512 ]
        </div>

        {/* HUD corner brackets */}
        <div className="absolute top-8 left-14 w-6 h-6 border-t-2 border-l-2 border-cyan-500 opacity-50" style={{boxShadow: '0 0 8px #00f0ff'}} />
        <div className="absolute top-8 right-14 w-6 h-6 border-t-2 border-r-2 border-pink-500 opacity-50" style={{boxShadow: '0 0 8px #ff2d78'}} />
        <div className="absolute bottom-8 left-14 w-6 h-6 border-b-2 border-l-2 border-cyan-500 opacity-30" style={{boxShadow: '0 0 8px #00f0ff'}} />
        <div className="absolute bottom-8 right-14 w-6 h-6 border-b-2 border-r-2 border-pink-500 opacity-30" style={{boxShadow: '0 0 8px #ff2d78'}} />

        {/* Side accent lines */}
        <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-3">
           <div className="w-[2px] h-32 bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-60" style={{boxShadow: '0 0 8px #00f0ff'}} />
           <div className="w-2 h-2 bg-cyan-400 rounded-full" style={{boxShadow: '0 0 12px #00f0ff, 0 0 24px #00f0ff'}} />
           <div className="w-[2px] h-32 bg-gradient-to-t from-transparent via-cyan-400 to-transparent opacity-60" style={{boxShadow: '0 0 8px #00f0ff'}} />
        </div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-3">
           <div className="w-[2px] h-32 bg-gradient-to-b from-transparent via-pink-400 to-transparent opacity-60" style={{boxShadow: '0 0 8px #ff2d78'}} />
           <div className="w-2 h-2 bg-pink-400 rounded-full" style={{boxShadow: '0 0 12px #ff2d78, 0 0 24px #ff2d78'}} />
           <div className="w-[2px] h-32 bg-gradient-to-t from-transparent via-pink-400 to-transparent opacity-60" style={{boxShadow: '0 0 8px #ff2d78'}} />
        </div>

        {/* Bottom-left coordinate label */}
        <div className="absolute bottom-6 left-6 font-mono text-[9px] text-cyan-600 tracking-[0.3em] opacity-40">
          SYS://NODE_ALPHA · LAT:40.4168°N · LON:3.7038°W
        </div>

        {/* Bottom-right hash */}
        <div className="absolute bottom-6 right-6 font-mono text-[9px] text-pink-700 tracking-[0.2em] opacity-35">
          0x{Math.abs(Math.floor(Date.now() / 1000)).toString(16).toUpperCase().padStart(8, '0')}
        </div>

        {/* Slow horizontal scan line */}
        <div className="absolute left-0 right-0 h-[1px] bg-cyan-400 opacity-[0.06] animate-[scan_8s_linear_infinite]" style={{top: '35%'}} />
      </div>

      <div className="max-w-7xl mx-auto px-10 pt-16 pb-32 space-y-8 relative z-[100]">
        
        {/* MAIN HEADER */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between border-b-2 border-cyan-500/30 pb-12 relative">
          <div className="flex items-center gap-10">
            <motion.div 
                whileHover={{ scale: 1.05, filter: "hue-rotate(90deg)" }}
                className="relative group cursor-pointer"
            >
               <img src={logoBrain} alt="Logo" className="w-36 h-36 opacity-95 transition-all" style={{animation: 'logo-pulse 3.5s ease-in-out infinite'}} />
            </motion.div>
            <div>
              <div className="text-[10px] text-cyan-400 font-bold mb-2 tracking-[0.4em] uppercase opacity-80">// NEURAL_INTERFACE_READY</div>
              <h1 className="text-7xl font-black tracking-tighter text-white italic" style={{textShadow: '0 0 30px rgba(0,240,255,0.35), 0 0 60px rgba(0,240,255,0.15)'}}>OPEN BRAIN</h1>
              <div className="flex items-center gap-5 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">
                <span className="flex items-center gap-2" style={{color: '#00f0ff', textShadow: '0 0 8px #00f0ff'}}>● OS_ACTIVE</span>
                <span className="opacity-30">|</span>
                <span className="font-mono text-slate-500">{new Date().toISOString().replace('T', ' ').split('.')[0]}</span>
              </div>
            </div>
          </div>
          
          {/* AUTO MODE BUTTON + STATS */}
          <div className="mt-8 lg:mt-0 flex flex-col items-end gap-4">
            {/* AUTO MODE BUTTON */}
            <button
              onClick={() => setAutoMode(m => !m)}
              className="flex items-center gap-3 px-5 py-3 font-mono font-black text-[10px] tracking-[0.35em] uppercase transition-all duration-300 relative overflow-hidden"
              style={{
                border: `2px solid ${autoMode ? '#00ff88' : 'rgba(0,240,255,0.4)'}`,
                color: autoMode ? '#00ff88' : 'rgba(0,240,255,0.7)',
                background: autoMode ? 'rgba(0,255,136,0.06)' : 'rgba(0,240,255,0.04)',
                boxShadow: autoMode
                  ? '0 0 15px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.25), inset 0 0 15px rgba(0,255,136,0.08)'
                  : '0 0 10px rgba(0,240,255,0.15)',
                textShadow: autoMode ? '0 0 10px #00ff88, 0 0 25px #00ff88' : '0 0 8px #00f0ff',
              }}
            >
              {/* Pulsing dot */}
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: autoMode ? '#00ff88' : 'rgba(0,240,255,0.5)',
                  boxShadow: autoMode ? '0 0 8px #00ff88, 0 0 20px #00ff88' : 'none',
                  animation: autoMode ? 'neon-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
              {autoMode ? 'AUTO: ON' : 'AUTO: OFF'}
              {autoMode && autoStatus && (
                <span className="text-[8px] opacity-60 ml-1">[{autoStatus}]</span>
              )}
            </button>

            {/* CLUSTER STATS */}
            <div className="flex gap-4">
              { [ 
                { l: "SESS", v: sesiones.length, c: "cyan" }, 
                { l: "NODES", v: servers.length, c: "blue" }, 
                { l: "OUTPUTS", v: archivosSalida.length, c: "pink" } 
              ].map((item) => (
                <div key={item.l} className="panel px-6 py-4 min-w-[120px] group hover:scale-105 transition-all cursor-default"
                  style={{borderLeft: `3px solid ${item.c === 'pink' ? '#ff2d78' : '#00f0ff'}`, boxShadow: item.c === 'pink' ? '0 0 20px rgba(255,45,120,0.15)' : '0 0 20px rgba(0,240,255,0.15)'}}>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-cyan-400 transition-colors">{item.l}</div>
                  <div className="text-3xl font-black tracking-tighter" style={{color: item.c === 'pink' ? '#ff2d78' : '#fff', textShadow: item.c === 'pink' ? '0 0 15px #ff2d78' : '0 0 15px rgba(255,255,255,0.3)'}}>{item.v < 10 ? '0'+item.v : item.v}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* CYBER TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
          <TabsList className="w-full h-14 p-0 bg-black/85 border border-white/8 rounded-none flex items-center justify-between shadow-2xl backdrop-blur-2xl overflow-x-auto" style={{borderBottom: '1px solid rgba(0,240,255,0.15)'}}>
            { ["ia", "sesiones", "prompts", "salidas", "reparar", "apis", "servidores", "conocimiento", "union", "info"].map(t => (
              <TabsTrigger 
                key={t} 
                value={t} 
                className="flex-1 h-full rounded-none font-black text-[10px] tracking-[0.3em] text-white/40 data-[state=active]:bg-cyan-500/8 data-[state=active]:text-cyan-300 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 transition-all uppercase px-3 border-x border-white/5 hover:bg-white/5 hover:text-white/70"
                style={{'--tw-border-opacity': '1'} as any}
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="min-h-[650px] pb-20"
            >
                <TabsContent value="ia" className="m-0"><TabIA ctx={ctx} /></TabsContent>
                <TabsContent value="sesiones" className="m-0"><TabSesiones ctx={ctx} /></TabsContent>
                <TabsContent value="prompts" className="m-0"><TabPrompts ctx={ctx} /></TabsContent>
                <TabsContent value="salidas" className="m-0"><TabSalidas ctx={ctx} /></TabsContent>
                <TabsContent value="reparar" className="m-0"><TabReparar ctx={ctx} /></TabsContent>
                <TabsContent value="apis" className="m-0"><TabApis ctx={ctx} /></TabsContent>
                <TabsContent value="servidores" className="m-0"><TabServidores ctx={ctx} /></TabsContent>
                <TabsContent value="conocimiento" className="m-0"><TabConocimiento ctx={ctx} /></TabsContent>
                <TabsContent value="union" className="m-0"><TabUnion ctx={ctx} /></TabsContent>
                <TabsContent value="info" className="m-0"><TabInfo ctx={ctx} /></TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div className="fixed bottom-0 left-0 right-0 h-8 pointer-events-none z-[300] flex items-center justify-between px-6" style={{background: 'rgba(0,0,0,0.7)', borderTop: '1px solid rgba(0,240,255,0.12)'}}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{boxShadow: '0 0 6px #00f0ff, 0 0 12px #00f0ff'}} />
            <span className="text-[9px] font-mono font-bold text-cyan-500 tracking-[0.3em] uppercase">NEURAL_LINK</span>
          </div>
          <span className="text-[9px] font-mono text-slate-600">·</span>
          <span className="text-[9px] font-mono text-slate-600 tracking-widest">VAULT: ~/.openbrain</span>
          <span className="text-[9px] font-mono text-slate-600">·</span>
          <span className="text-[9px] font-mono text-slate-700 tracking-widest">LLM: localhost:11434</span>
        </div>
        <div className="flex items-center gap-4">
          <Radio className="w-3 h-3 text-cyan-500 animate-pulse" style={{filter: 'drop-shadow(0 0 4px #00f0ff)'}} />
          <span className="text-[9px] font-mono text-slate-600 tracking-widest">v1.3.0</span>
        </div>
      </div>
    </div>
  );
}
