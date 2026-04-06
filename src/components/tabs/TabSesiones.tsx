import { motion } from 'framer-motion';
import { Brain as BrainIcon, Loader2, Scan } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { HUDCorner } from "@/components/ui/HUDCorner";
import type { AppContextProps } from './types';

// Utility helper that was in App.tsx
function tiempoRelativo(fechaISO: string | null): string {
    if (!fechaISO) return "??:??";
    const diff = Date.now() - new Date(fechaISO).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "SEC_AGO";
    if (mins < 60) return `${mins}M_AGO`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}H_AGO`;
    const days = Math.floor(hours / 24);
    return `${days}D_AGO`;
}

const animEntrada = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as any }
};

export const TabSesiones = ({ ctx }: { ctx: AppContextProps }) => {
    const {
        sesionSeleccionada, setSesionSeleccionada,
        setIsTranscriptLoading, setIsViewingTranscript,
        setTranscriptContent, isTranscriptLoading,
        isViewingTranscript, transcriptContent,
        setIsEncodingKi, isEncodingKi, setKiEncodeMsg, kiEncodeMsg,
        refreshAll, ollamaStatus, salud, sesiones,
        setArtefactoSeleccionado, setContenidoArtefacto,
        artefactosSesion, setArtefactosSesion, artefactoSeleccionado, contenidoArtefacto
    } = ctx;

    const handleLoadTranscript = async () => {
        if (!sesionSeleccionada) return;
        setIsTranscriptLoading(true);
        setIsViewingTranscript(true);
        try {
          const transcript = await (window as any).antigravity.getSessionTranscript(sesionSeleccionada.id);
          setTranscriptContent(transcript);
        } catch (e) {
          setTranscriptContent(null);
        }
        setIsTranscriptLoading(false);
    };

    const handleEncodeSession = async () => {
        if (!sesionSeleccionada) return;
        if (!confirm("ENCODE TO NEURON: ¿Comprimir sesión actual como Knowledge Item?")) return;
        setIsEncodingKi(true);
        setKiEncodeMsg("EXTRACTING_KNOWLEDGE...");
        try {
          const res = await (window as any).antigravity.generateKIFromSession(sesionSeleccionada.id);
          if (res.exito) {
             setKiEncodeMsg("NEURON_INJECTED_SUCCESS");
             await refreshAll();
          } else {
             setKiEncodeMsg("ENCODE_FAILED: " + (res.mensaje || 'Error'));
          }
        } catch (e) {
          setKiEncodeMsg("ENCODE_FAILED: EXCEPTION");
        }
        setTimeout(() => setKiEncodeMsg(null), 4000);
        setIsEncodingKi(false);
    };

    return (
        <motion.div {...animEntrada} className="grid xl:grid-cols-[1fr_1.4fr] gap-4">
          <div className="flex flex-col gap-4 h-[600px]">
            {ollamaStatus.active && (
              <div className="panel p-3 border border-pink-500/50 bg-pink-900/10 flex items-center gap-3">
                <BrainIcon className="w-5 h-5 text-pink-500 animate-pulse" />
                <div>
                  <div className="text-[10px] text-pink-400 font-bold tracking-widest uppercase">Ollama Local Agent</div>
                  <div className="text-xs text-pink-200">Processing Session {ollamaStatus.processingSession?.substring(0,8)}...</div>
                </div>
              </div>
            )}
            {salud && (
              <div className="panel p-4 flex justify-between items-center border-l-4 border-l-cyan-500/50 bg-cyan-900/10">
                 <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">LOCAL_DATA_SIZE</div>
                    <div className="text-xl font-black text-white">{salud.tamañoTotal}</div>
                 </div>
                 <div className="text-right">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">SAVED_SESSIONS</div>
                    <div className="text-xl font-black text-cyan-400">{salud.totalConversaciones}</div>
                 </div>
              </div>
            )}
            <div className="panel p-5 space-y-4 flex-1 overflow-hidden flex flex-col">
               <HUDCorner pos="tl" />
               <div className="section-title">SESSION_LOGS</div>
               <ScrollArea className="flex-1 pr-2">
               <div className="space-y-3">
                 {sesiones.map(s => (
                   <button key={s.id}
                     onClick={() => {
                       setSesionSeleccionada(s); 
                       setArtefactoSeleccionado(null); 
                       setContenidoArtefacto(""); 
                       setIsViewingTranscript(false);
                       (window as any).antigravity.getSessionArtifacts(s.id).then(setArtefactosSesion);
                     }}
                     className={`w-full text-left p-3 border transition-all ${sesionSeleccionada?.id === s.id ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(0,229,255,0.15)]" : "bg-black/40 border-white/5 hover:border-white/20"}`}>
                     <div className="flex justify-between items-center gap-2">
                       <div className="font-bold text-xs truncate">[{s.titulo.toUpperCase()}]</div>
                       <div className={`w-1.5 h-1.5 ${s.estado === 'Saludable' ? 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]' : 'bg-red-500'} crt-effect`} />
                     </div>
                     <div className="text-[9px] text-slate-500 mt-1 font-mono uppercase opacity-60">ID://{s.id.slice(0,8)} {" >> "} {s.tamañoPBFormateado} {" >> "} {tiempoRelativo(s.fechaModificacion)}</div>
                   </button>
                 ))}
               </div>
             </ScrollArea>
            </div>
          </div>
          <div className="panel p-5 space-y-4 flex flex-col h-[600px]">
            <HUDCorner pos="tr" />
            <div className="section-title flex justify-between items-center flex-wrap gap-2">
               <span>CORE_INSPECTOR</span>
               <div className="flex items-center gap-2">
                 {kiEncodeMsg && <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase animate-pulse">{kiEncodeMsg}</span>}
                 {sesionSeleccionada && (
                   <button onClick={handleEncodeSession} disabled={isEncodingKi} className="text-[9px] font-mono text-cyan-400 border border-cyan-500/30 bg-cyan-900/20 hover:bg-cyan-500/10 px-2 py-1 uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                     {isEncodingKi ? <Loader2 className="w-3 h-3 animate-spin inline-block mr-1" /> : '⚡ '}
                     ENCODE TO NEURON
                   </button>
                 )}
                 {sesionSeleccionada && !isViewingTranscript && (
                   <button onClick={handleLoadTranscript} className="text-[9px] font-mono text-cyan-400 border border-cyan-500/30 bg-cyan-900/20 hover:bg-cyan-500/10 px-2 py-1 uppercase tracking-widest transition-all">
                     {'>'} CAT OVERVIEW.TXT [TRANSCRIPT]
                   </button>
                 )}
                 {isViewingTranscript && (
                   <button onClick={() => setIsViewingTranscript(false)} className="text-[9px] font-mono text-slate-400 border border-white/10 bg-black hover:bg-white/5 px-2 py-1 uppercase tracking-widest transition-all">
                     {'<'} RETURN_TO_ARTIFACTS
                   </button>
                 )}
               </div>
            </div>
            {!sesionSeleccionada ? (
              <div className="flex-1 flex flex-col items-center justify-center text-cyan-700/30 font-mono text-[10px] tracking-widest uppercase">
                <Scan className="w-12 h-12 mb-4 opacity-20 animate-pulse" /> [ WAITING_FOR_UPLINK ]
              </div>
            ) : isViewingTranscript ? (
              <ScrollArea className="flex-1 pr-2">
                 {isTranscriptLoading ? (
                   <div className="h-full flex flex-col items-center justify-center p-10 font-mono text-cyan-500/50 uppercase tracking-widest text-[10px]">
                      <Loader2 className="w-6 h-6 animate-spin mb-4" />
                      DECRYPTING_MEMORY_BANK...
                   </div>
                 ) : transcriptContent ? (
                   <div className="p-5 font-mono text-[10px] sm:text-[11px] leading-relaxed text-[#00ff41] bg-black border border-[#00ff41]/20 whitespace-pre-wrap selection:bg-[#00ff41] selection:text-black">
                      <div className="mb-4 text-[9px] opacity-50 uppercase tracking-widest border-b border-[#00ff41]/20 pb-2"># VISOR DE MEMORIA VIVA :: SESSION {sesionSeleccionada.id.slice(0,8)}</div>
                      {transcriptContent}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-10 font-mono text-slate-500 uppercase tracking-widest text-[10px] bg-black/50 border border-white/5">
                      [NO_TRANSCRIPT_AVAILABLE]
                      <span className="text-[8px] opacity-50 mt-2 block w-64 text-center">OVERVIEW.TXT NO GENERADO PARA ESTA SESION</span>
                   </div>
                 )}
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1 pr-2 space-y-4">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {artefactosSesion.filter((a: any) => a.esTexto).map((art: any) => (
                    <button key={art.nombre} onClick={() => { setArtefactoSeleccionado(art.nombre); (window as any).antigravity.readArtifact(sesionSeleccionada.id, art.nombre).then(setContenidoArtefacto); }}
                      className={`flex items-center justify-between p-2 border text-[10px] transition-all font-bold ${artefactoSeleccionado === art.nombre ? "bg-cyan-500/20 border-cyan-500/60 text-white" : "bg-black/40 border-white/5 text-slate-500 hover:text-cyan-400"}`}>
                      <div className="flex items-center gap-2 truncate"> {' > '} {art.nombre}</div>
                      <span className="opacity-40">[{art.tamaño}]</span>
                    </button>
                  ))}
                </div>
                {contenidoArtefacto && (
                  <div className="mt-4 p-5 bg-black/60 border border-cyan-500/15 text-[11px] leading-relaxed text-cyan-100/70 font-mono whitespace-pre-wrap relative">
                     <div className="absolute top-0 right-0 p-2 text-[8px] text-cyan-500/40 uppercase">UTF-8 // RAW_DATA</div>
                     {' > '} {contenidoArtefacto}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </motion.div>
    );    
};
