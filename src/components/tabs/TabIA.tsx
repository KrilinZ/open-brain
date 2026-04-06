import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain as BrainIcon, AlertTriangle, Loader2, Trash2, Zap, Archive, Clock3, Terminal, Monitor, Cpu, Send, Database } from 'lucide-react';
import { HUDCorner } from '@/components/ui/HUDCorner';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppContextProps } from './types';
import type { AntigravityAPI } from '@/types/antigravity';

declare global {
  interface Window {
    antigravity: AntigravityAPI;
  }
}

const animEntrada = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } as const
};

export const TabIA = ({ ctx }: { ctx: AppContextProps }) => {
    const { refreshAll } = ctx;

    const [prompt, setPrompt] = useState("");
    const [chatLogs, setChatLogs] = useState<{ role: 'user' | 'ia', text: string }[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isLlamaReady, setIsLlamaReady] = useState<boolean | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);
    const [chatSessions, setChatSessions] = useState<{ file: string, savedAt: string | null, count: number }[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSavingChat, setIsSavingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [agentLog, setAgentLog] = useState<string[]>([]);
    const [agentResult, setAgentResult] = useState<{ editores: string[], capturados: {id:string,title:string}[], resumen: string } | null>(null);
    const [showAgentPanel, setShowAgentPanel] = useState(false);

    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [activeModel, setActiveModel] = useState("llama3.2:1b");

    useEffect(() => {
      const ag = window.antigravity;
      if (!ag) return;

      const initIA = async () => {
        if (ag.checkLlama) {
          const ready = await ag.checkLlama();
          setIsLlamaReady(ready);
        } else {
          setIsLlamaReady(false);
        }
        
        if (ag.loadLastChatLog) {
          const data = await ag.loadLastChatLog();
          if (data?.logs?.length > 0) setChatLogs(data.logs);
        }

        if (ag.getOllamaModels) {
          const m = await ag.getOllamaModels();
          if (m.length > 0) setOllamaModels(m);
          else setOllamaModels(["llama3.2:1b"]);
        }

        if (ag.getSettings) {
          const s = await ag.getSettings();
          if (s?.localAiModel) setActiveModel(s.localAiModel);
        }
      };

      initIA();
    }, []);

    useEffect(() => {
        const toInject = ctx.promptToInject;
        if (toInject) {
            setPrompt(prev => {
                const combined = prev.trim() ? `${prev}\n\n${toInject}` : toInject;
                return combined;
            });
            setTimeout(() => {
                ctx.setPromptToInject(null);
            }, 0);
        }
    }, [ctx.promptToInject, ctx.setPromptToInject, ctx]);

    useEffect(() => {
      // Scroll only the chat container, not the whole page
      const el = chatEndRef.current;
      if (el) {
        const container = el.closest('[data-radix-scroll-area-viewport]') || el.parentElement;
        if (container) container.scrollTop = container.scrollHeight;
      }
    }, [chatLogs, isThinking]);

    const loadChatHistory = async () => {
      const ag = window.antigravity;
      if (ag?.getChatSessions) {
        const sessions = await ag.getChatSessions();
        setChatSessions(sessions);
        setShowHistory(true);
      }
    };

    const saveChatLog = async () => {
      const ag = window.antigravity;
      if (!chatLogs.length || !ag?.saveChatLog) return;
      setIsSavingChat(true);
      await ag.saveChatLog(chatLogs);
      setIsSavingChat(false);
    };

    const runAgent = async (mode: 'quick' | 'full' = 'quick') => {
      const ag = window.antigravity;
      if (!ag?.runAgent) return;
      setIsAgentRunning(true);
      setAgentLog([]);
      setAgentResult(null);
      setShowAgentPanel(true);
      
      const result = await ag.runAgent(mode);
      setAgentLog(result.log || []);
      setAgentResult({ editores: result.editores, capturados: result.capturados, resumen: result.resumen });
      setIsAgentRunning(false);
      
      const agentMsg = `**[ AGENT REPORT ]**\n\n${result.resumen}\n\n**IDEs:** ${result.editores.join(', ')}\n**KIs capturados:** ${result.capturados.length}\n${result.capturados.map((c: any) => `- \`${c.id}\` — ${c.title}`).join('\n')}`;
      const newLogs = [...chatLogs, { role: 'ia' as const, text: agentMsg }];
      setChatLogs(newLogs);
      
      if (ag.saveChatLog) ag.saveChatLog(newLogs);
      await refreshAll();
    };

    const installAndPull = async () => {
      const ag = window.antigravity;
      if (!ag) return;
      setIsInstalling(true);
      if (ag.installLlama) {
        const success = await ag.installLlama();
        if (success) setTimeout(() => setIsLlamaReady(true), 1000);
        else alert("Error instalando el motor Llama. Consulta los logs.");
      }
      setIsInstalling(false);
    };

    const sendPrompt = async () => {
      const ag = window.antigravity;
      if (!prompt.trim() || !ag?.askLlama) return;
      const q = prompt;
      setPrompt("");
      const newLogs = [...chatLogs, { role: 'user' as const, text: q }];
      setChatLogs(newLogs);
      setIsThinking(true);
      
      let res = await ag.askLlama(q);
      setIsThinking(false);
      
      if (typeof res === 'string') {
        const cmdMatch = res.match(/<CMD>(.*?)<\/CMD>/);
        if (cmdMatch) {
          const cmd = cmdMatch[1].trim();
          res = res.replace(/<CMD>.*?<\/CMD>/g, '').trim();
          
          if (cmd.startsWith("GOTO:")) {
             const tab = cmd.split(":")[1].toLowerCase();
             if (ctx.setActiveTab) ctx.setActiveTab(tab);
          } else if (cmd === "RUN_AGENT") {
             setTimeout(() => runAgent('quick'), 500);
          } else if (cmd === "GET_ZOMBIES") {
             const zRes = await window.antigravity.getZombieProcesses();
             if (zRes.ok && zRes.zombies.length > 0) {
                const list = zRes.zombies.map((z: any) => `- ${z.parentName} (PID: ${z.ppid})`).join('\n');
                res = `${res}\n\n[ SCAN_REPORT: AMENAZAS_DETECTADAS ]\n${list}\n\nID_PAYLOAD: [${zRes.zombies.map((z: any) => z.ppid).join(',')}]`;
             } else {
                res = `${res}\n\n[ SCAN_REPORT: SECTOR_LIMPIO ]. No se detectaron zombies.`;
             }
          } else if (cmd.startsWith("KILL_PROCESSES:")) {
             const pids = cmd.split(":")[1].replace(/[[\]]/g, '').split(',').map(p => p.trim());
             const kRes = await window.antigravity.killProcesses(pids);
             if (kRes.ok) {
                res = `${res}\n\n[ EXECUTION_REPORT: PURGA_COMPLETA ]. ${kRes.mensaje}`;
             } else {
                res = `${res}\n\n[ EXECUTION_REPORT: ERROR_EN_EL_CLUSTER ]. ${kRes.error}`;
             }
          }
        }
      }

      const finalLogs = [...newLogs, { role: 'ia' as const, text: res }];
      setChatLogs(finalLogs);
      if (ag.saveChatLog) ag.saveChatLog(finalLogs);
    };

    if (isLlamaReady === false) {
      return (
        <motion.div {...animEntrada} className="panel p-16 h-[650px] flex flex-col items-center justify-center relative text-center bg-black/40 backdrop-blur-3xl overflow-hidden">
           <HUDCorner pos="tl" /> <HUDCorner pos="br" />
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
           
           <div className="relative mb-10">
                <AlertTriangle className="w-24 h-24 text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] crt-effect" />
                <div className="absolute inset-0 w-24 h-24 bg-red-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
           </div>

           <h2 className="text-4xl font-black text-white italic tracking-tighter mb-4 glitch-hover uppercase">MOTOR_NEURONAL_OFFLINE</h2>
           <p className="text-slate-500 font-mono text-[11px] max-w-lg mb-10 leading-relaxed uppercase tracking-widest px-10">
             El clúster "Llama 3.2 1B (Ollama)" no responde en el puerto 11434. 
             Pulse el botón de abajo para inicializar el protocolo de instalación automática.
           </p>

           <button
             onClick={installAndPull}
             disabled={isInstalling}
             className="btn-cyber-red px-12 py-5 text-sm flex items-center gap-4 group"
           >
             {isInstalling ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <BrainIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />}
             <span className="font-black italic tracking-tighter">
                {isInstalling ? "PROTOCOLO_INSTALACIÓN_ACTIVO..." : "INITIALIZE_LOCAL_ENGINE"}
             </span>
           </button>
        </motion.div>
      );
    }

    if (showHistory) {
      return (
        <motion.div {...animEntrada} className="panel p-0 h-[650px] flex flex-col relative overflow-hidden backdrop-blur-2xl">
          <HUDCorner pos="tl" />
          <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Archive className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-black italic tracking-tight text-white uppercase">NEURAL_LOGS_REPOSITORY ({chatSessions.length})</span>
            </div>
            <button onClick={() => setShowHistory(false)} className="btn-cyber text-[9px] py-2">
                CLOSE_HISTORY
            </button>
          </div>
          <ScrollArea className="flex-1 p-6">
            <div className="grid gap-3">
              {chatSessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <Database className="w-12 h-12 mb-4" />
                    <div className="text-[10px] font-mono tracking-[0.4em] uppercase">NULL_ARCHIVE_DATA</div>
                </div>
              )}
              {chatSessions.map((s) => (
                <div key={s.file} className="flex items-center justify-between p-4 border border-white/5 bg-black/40 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_#00e5ff] opacity-40 group-hover:opacity-100 transition-opacity" />
                    <div>
                        <div className="text-[11px] font-black text-white font-mono tracking-tight">{s.file.replace('chat_', '').replace('.json', '').replace('T', ' ').substring(0, 19)}</div>
                        <div className="text-[9px] text-slate-600 font-mono font-bold tracking-widest uppercase mt-0.5">{s.count} DATA_PACKETS</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={async () => {
                      const ag = window.antigravity;
                      if (!ag?.loadChatSession) return;
                      const data = await ag.loadChatSession(s.file);
                      if (data?.logs) { setChatLogs(data.logs); setShowHistory(false); }
                    }} className="btn-cyber py-1.5 px-3 text-[8px]">RECALL</button>
                    <button onClick={async () => {
                      const ag = window.antigravity;
                      if (!ag?.deleteChatSession) return;
                      if (confirm('CONFIRM_DELETE: Destruir este log neural?')) {
                        await ag.deleteChatSession(s.file);
                        setChatSessions(prev => prev.filter(x => x.file !== s.file));
                      }
                    }} className="p-1.5 border border-red-500/20 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-all rounded-sm">
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      );
    }

    return (
      <motion.div {...animEntrada} className="panel p-0 h-[650px] flex flex-col relative overflow-hidden backdrop-blur-2xl">
         <HUDCorner pos="tl" />
         
         {/* HEADER BAR */}
         <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-center">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm font-black italic tracking-tighter text-white uppercase glitch-hover">NEURAL_LINK_TERMINAL</span>
                </div>
                <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                    <select
                        value={activeModel}
                        onChange={async (e) => {
                            const newModel = e.target.value;
                            setActiveModel(newModel);
                            if (window.antigravity?.setSettings) {
                                await window.antigravity.setSettings({ localAiModel: newModel });
                            }
                        }}
                        className="bg-transparent border-none text-cyan-500/70 font-mono text-[10px] outline-none cursor-pointer uppercase font-black tracking-widest hover:text-cyan-400 transition-colors"
                    >
                        {ollamaModels.map(m => <option key={m} value={m} className="bg-black text-[12px]">{m}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => runAgent('quick')}
                    disabled={isAgentRunning || isThinking}
                    className="btn-cyber flex items-center gap-2 py-1.5 px-4"
                >
                    {isAgentRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-current" />}
                    <span>AGENT</span>
                </button>
                <div className="h-4 w-[1px] bg-white/5 mx-1" />
                <button onClick={loadChatHistory} className="p-2 border border-white/10 text-slate-500 hover:text-white hover:border-white/30 transition-all">
                    <Clock3 className="w-4 h-4" />
                </button>
                {chatLogs.length > 0 && (
                    <button onClick={saveChatLog} disabled={isSavingChat} className="p-2 border border-white/10 text-cyan-500/60 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                        {isSavingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                    </button>
                )}
            </div>
         </div>

         {/* AGENT LOG PANEL - INTEGRATED */}
         <AnimatePresence>
            {(isAgentRunning || (showAgentPanel && agentResult)) && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-white/5 bg-emerald-500/5 font-mono text-[9px] overflow-hidden"
                >
                    <div className="p-4 space-y-1 max-h-[200px] overflow-y-auto scroll-custom">
                        <div className="flex items-center gap-2 text-emerald-400 font-black mb-2 uppercase tracking-widest">
                            <Monitor className="w-3 h-3" /> NEURAL_AGENT_PROCESS_OUTPUT
                        </div>
                        {agentLog.map((line, i) => (
                            <div key={i} className="text-emerald-500/70 border-l border-emerald-500/20 pl-3 leading-loose">
                                {`> ${line}`}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
         </AnimatePresence>

         {/* MESSAGES AREA */}
         <ScrollArea className="flex-1 bg-black/20">
            <div className="p-8 space-y-8">
                {chatLogs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-20">
                        <Monitor className="w-20 h-20 text-slate-400 crt-effect" />
                        <div className="text-xs font-black tracking-[0.5em] uppercase">TERMINAL_IDLE_AWAITING_SIGNAL</div>
                    </div>
                )}
                {chatLogs.map((log, i) => (
                    <motion.div 
                        initial={{ opacity: 0, x: log.role === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] p-5 relative ${
                            log.role === 'user' 
                            ? 'bg-cyan-500/10 border-r-2 border-cyan-500' 
                            : 'bg-white/5 border-l-2 border-white/20'
                        }`}>
                            <div className={`text-[8px] font-black uppercase tracking-widest mb-2 ${log.role === 'user' ? 'text-cyan-400' : 'text-slate-500'}`}>
                                {log.role === 'user' ? 'ROOT_ADMIN' : `${activeModel.toUpperCase()} // NEURAL_IA`}
                            </div>
                            <div className="text-[13px] leading-relaxed text-white/90 whitespace-pre-wrap font-mono uppercase tracking-tight">
                                {log.text}
                            </div>
                        </div>
                    </motion.div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 border-l-2 border-cyan-500 p-5 flex items-center gap-4">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span className="text-[9px] font-black text-cyan-500/60 uppercase tracking-[0.4em] animate-pulse">PROCESSING_NEURAL_UPLINK...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
         </ScrollArea>

         {/* INPUT AREA */}
         <div className="p-6 border-t border-white/5 bg-black/40">
            <div className="relative group">
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
                    placeholder="ENTER_PAYLOAD // SEND_INSTRUCTION..."
                    className="w-full h-24 bg-black/60 border border-white/10 p-4 pt-6 text-[12px] font-mono text-cyan-400 placeholder:text-slate-700 outline-none focus:border-cyan-500/60 transition-all resize-none shadow-inner"
                />
                <div className="absolute top-0 right-0 p-3 h-full flex flex-col justify-between items-end">
                    <div className="flex items-center gap-1 opacity-40 group-focus-within:opacity-100 transition-opacity">
                        <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-black text-cyan-400 tracking-tighter uppercase">READY_TO_TRANSMIT</span>
                    </div>
                    <button 
                        onClick={sendPrompt}
                        disabled={!prompt.trim() || isThinking}
                        className="btn-cyber py-3 px-6 shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="absolute top-2 left-4 text-[7px] font-bold text-cyan-900 uppercase tracking-widest">NEURAL_COMMAND_INPUT</div>
            </div>
         </div>
      </motion.div>
    );
};
