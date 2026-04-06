import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain as BrainIcon, Loader2, Copy, Zap } from 'lucide-react';
import { HUDCorner } from '@/components/ui/HUDCorner';
import type { AppContextProps } from './types';

const animEntrada = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as any }
};

export const TabUnion = (_props: { ctx: AppContextProps }) => {
    // We can use local state here because it's only used in this tab!
    const [stackInfo, setStackInfo] = useState("");
    const [customRule, setCustomRule] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState("");
    const [projects, setProjects] = useState<string[]>([]);
    const [newProject, setNewProject] = useState("");

    useEffect(() => {
       const wa = window as any;
       if (wa.antigravity && wa.antigravity.getProjects) {
           wa.antigravity.getProjects().then(setProjects);
       }
    }, []);

    const addProject = async () => {
       if(!newProject.trim()) return;
       const p = await (window as any).antigravity.addProject(newProject);
       setProjects(p);
       setNewProject("");
    };
    const deleteProject = async (p: string) => {
       const ps = await (window as any).antigravity.deleteProject(p);
       setProjects(ps);
    };

    const forceScan = async () => {
        setIsScanning(true);
        setScanResult("");
        try {
            const res = await (window as any).antigravity.forceScanRadars();
            if (res.ok) {
                const count = res.capturados?.length || 0;
                setScanResult(`[SCAN_OK] ${count} repos tenían diffs y han sido absorbidos.`);
            } else {
                setScanResult(`[ERROR] ${res.error}`);
            }
        } catch(e: any) {
            setScanResult(`[ERROR] ${e.message}`);
        }
        setIsScanning(false);
    };

    const genericRule = "Eres el Agente IA de este IDE, estrictamente vinculado a Open Brain (tu Torre de Control).\nTu repositorio maestro de KIs está en: ~/.openbrain/knowledge\nTus logs de sesión van a: ~/.openbrain/brain\n\nDIRECTIVA OMNI-TRACKER: LEERAS Knowledge Items al inicio. CUALQUIER archivo editado, creado o decisión tomada debe ser volcada como texto detallado en la ruta ~/.openbrain/brain/ INMEDIATAMENTE. Open Brain te supervisa y asimilará esos archivos en KIs.";

    const generateCustomRule = async () => {
      if (!stackInfo.trim() || !(window as any).antigravity.askLlama) return;
      setIsGenerating(true);
      const promptToLlama = `Soy tu administrador. Tu código genérico de enlace es: "${genericRule}". Necesito que redactes un bloque de SYSTEM PROMPT (reglas) específico para usarlo en el archivo .cursorrules, .windsurfrules, o CLAUDE.md de un proyecto con el siguiente stack: "${stackInfo}". 
Incluye obligatoriamente el bloque de enlace a Open Brain (las rutas ~/.openbrain), e inventa/añade reglas estrictas de código buenas para ese stack. Responde SOLO con el prompt final a copiar.`;
      const res = await (window as any).antigravity.askLlama(promptToLlama);
      setCustomRule(res);
      setIsGenerating(false);
    };

    return (
      <motion.div {...animEntrada} className="panel p-8 space-y-6 flex flex-col items-center relative min-h-[500px]">
        <HUDCorner pos="tl" /> <HUDCorner pos="tr" />
        <div className="section-title text-center w-full mb-2">UPLINK_PROTOCOL_X (MAIN DIRECTIVE)</div>
        <div className="text-[10px] text-slate-400 font-mono tracking-widest text-center max-w-3xl leading-relaxed mb-4">
          Open Brain puede redactarte un System Prompt maestro a medida para unificar tu editor con la Torre de Control. (Pégalo en <b>.cursorrules</b>, <b>.windsurfrules</b>, <b>CLAUDE.md</b> o <b>.aider.conf.yml</b>)
        </div>
        
        <div className="w-full max-w-4xl flex gap-3">
           <input 
             className="flex-1 bg-black/50 text-white font-mono text-xs border border-[#00ff41]/30 p-4 focus:outline-none focus:border-[#00ff41] transition-all placeholder:text-[#00ff41]/30 text-center" 
             placeholder="Ej: Editor Cursor (o Claude Code) con Next.js 14, Tailwind y Supabase"
             value={stackInfo}
             onChange={e => setStackInfo(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && generateCustomRule()}
             disabled={isGenerating}
           />
           <button 
             onClick={generateCustomRule}
             disabled={isGenerating || !stackInfo.trim()}
             className="px-6 border border-[#00ff41]/50 bg-[#00ff41]/10 hover:bg-[#00ff41]/20 text-[#00ff41] disabled:opacity-50 transition-all font-black"
           >
             {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainIcon className="w-5 h-5" />}
           </button>
        </div>

        <div className="w-full max-w-4xl bg-black/80 border border-[#00ff41]/30 p-8 relative group shadow-[0_0_30px_rgba(0,255,65,0.05)] mt-4 min-h-[150px]">
          <div className="absolute top-0 right-0 p-2 text-[8px] text-[#00ff41]/50 uppercase font-black">
             {isGenerating ? "GENERANDO UPLINK PROTOCOL..." : "SYS_PROMPT_CRUDE"}
          </div>
          <div className="font-mono text-[#00ff41] text-[12px] leading-8 whitespace-pre-wrap selection:bg-[#00ff41] selection:text-black">
             {isGenerating ? (
               <div className="flex animate-pulse text-[#00ff41]/50">{'>>> LLAMA_ASIMILANDO_STACK...'}</div>
             ) : (
               customRule || genericRule
             )}
          </div>
        </div>
        
        <button 
          onClick={() => {
            navigator.clipboard.writeText(customRule || genericRule);
            alert("✅ DIRECTIVA COPIADA AL PORTAPAPELES");
          }}
          className="mt-4 mb-10 px-8 py-4 border-2 border-cyan-500 bg-cyan-900/30 hover:bg-cyan-500/20 text-cyan-400 hover:text-white font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:shadow-[0_0_40px_rgba(0,229,255,0.4)]">
          <Copy className="w-4 h-4" />
          COPY TO CLIPBOARD
        </button>

        {/* RADAR TRACKER SECTION */}
        <div className="w-full max-w-4xl border border-purple-500/20 bg-black/60 p-6 relative">
           <HUDCorner pos="tl" /> <HUDCorner pos="tr" /> <HUDCorner pos="bl" /> <HUDCorner pos="br" />
           <div className="section-title text-center text-purple-400 w-full mb-2">GIT RADAR NETWORK (ACTIVE OS-SCANNER)</div>
           <div className="text-[10px] text-slate-400 font-mono tracking-widest text-center max-w-3xl leading-relaxed mb-6">
              El agente local de Open Brain monitoriza silenciosamente estas carpetas en busca de Diff Git sin confirmar.
              Cuando detecta actividad técnica, utiliza Llama localmente para destilarla a un nuevo KI sin que tú toques nada.
           </div>
           
           <div className="flex items-center justify-between mb-4">
              <button 
                 onClick={forceScan}
                 disabled={isScanning || projects.length === 0}
                 className="px-4 py-2 border border-purple-500/50 bg-purple-900/20 hover:bg-purple-500/30 text-purple-400 disabled:opacity-40 transition-all font-black text-[10px] tracking-widest uppercase flex items-center gap-2 cursor-pointer"
              >
                 {isScanning ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                 ⚡️ FORZAR ESCANEO AHORA
              </button>
              {scanResult && <span className="text-[9px] font-mono text-purple-300">{scanResult}</span>}
           </div>
           
           <div className="flex gap-3 mb-6">
              <input 
                 className="flex-1 bg-black/50 text-white font-mono text-xs border border-purple-500/30 p-3 focus:outline-none focus:border-purple-500 transition-all placeholder:text-purple-500/30" 
                 placeholder="/Users/admin/Workspace/mi-proyecto-secreto"
                 value={newProject}
                 onChange={e => setNewProject(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addProject()}
              />
              <button 
                 onClick={addProject}
                 disabled={!newProject.trim()}
                 className="px-6 border border-purple-500/50 bg-purple-900/10 hover:bg-purple-500/20 text-purple-400 disabled:opacity-50 transition-all font-black text-[10px] tracking-widest uppercase"
              >
                 + ADD RADAR
              </button>
           </div>

           <div className="space-y-2">
              {projects.length === 0 && <div className="text-center text-[10px] text-slate-600 font-mono uppercase tracking-widest">Ningún radar activo en OS-Level</div>}
              {projects.map((p, i) => (
                 <div key={i} className="flex items-center justify-between p-3 border border-purple-500/20 bg-black/40 hover:border-purple-500/40 transition-all">
                    <div className="font-mono text-[10px] text-purple-300 truncate"><span className="text-purple-600">DIR: </span>{p}</div>
                    <button onClick={() => deleteProject(p)} className="text-[10px] font-black text-red-500/60 hover:text-red-400 uppercase">Eliminar</button>
                 </div>
              ))}
           </div>
        </div>
      </motion.div>
    );
};
