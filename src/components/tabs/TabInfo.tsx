import { Shield, Cpu, Activity, Database, Zap } from 'lucide-react';
import { HUDCorner } from '@/components/ui/HUDCorner';

export const TabInfo = () => {
    return (
        <div className="panel p-0 border-l-8 border-l-cyan-600 bg-black/40 backdrop-blur-xl relative overflow-hidden h-[600px] flex flex-col">
          <HUDCorner pos="tl" />
          <HUDCorner pos="br" />
          
          {/* HEADER SECTION */}
          <div className="p-12 pb-8 border-b border-white/5 bg-gradient-to-r from-cyan-600/10 to-transparent">
            <div className="flex items-center gap-6 mb-2">
                <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.2)]">
                    <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <div>
                    <div className="text-[10px] font-black text-cyan-500 tracking-[0.5em] mb-1 uppercase">// NEURAL_MANIFEST_LOADED</div>
                    <h1 className="text-4xl font-black italic tracking-tighter text-white">OPEN_BRAIN_OS <span className="text-cyan-500 text-lg not-italic ml-2">[v1.3.0]</span></h1>
                </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 pt-8 scroll-custom">
            <div className="grid lg:grid-cols-2 gap-16">
              
              {/* LEFT COLUMN: SYSTEM SPECS */}
              <div className="space-y-12">
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Kernel_Core_Specifications</span>
                    </div>
                    <div className="space-y-4 font-mono text-[11px] text-slate-500">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="uppercase tracking-tighter">Architecture</span>
                            <span className="text-white font-black italic">ELECTRON_v33 // REACT_19</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="uppercase tracking-tighter">Engine_Status</span>
                            <span className="text-emerald-400 font-black italic">LOCAL_NEURAL_UPLINK [ACTIVE]</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="uppercase tracking-tighter">Vault_Encryption</span>
                            <span className="text-white font-black italic">SHA-512_SECURE_VAULT</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="uppercase tracking-tighter">Visual_Driver</span>
                            <span className="text-white font-black italic">CRT_CYBER_NEON_IMMERSION</span>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-4 h-4 text-cyan-500" />
                        <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Active_Modules</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['MCP_SERVER', 'LLAMA_3.2_1B', 'GIT_RADAR', 'AUTO_KI_SYNC', 'OLLAMA_BRIDGE'].map(x => (
                            <span key={x} className="px-3 py-1 bg-cyan-900/20 border border-cyan-500/20 text-[9px] font-black text-cyan-400 uppercase tracking-widest rounded-sm">
                                {x}
                            </span>
                        ))}
                    </div>
                </section>
              </div>

              {/* RIGHT COLUMN: RECENT DEPLOYMENTS */}
              <div className="space-y-12">
                <section className="relative">
                    <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-500 via-transparent to-transparent opacity-30" />
                    <div className="flex items-center gap-3 mb-8">
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
                        <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Neural_Network_Updates</span>
                    </div>
                    <div className="space-y-8">
                        {[
                            { v: '1.3.0', title: 'NATIVE_AUTO_EXTRACTOR', dot: 'bg-emerald-500' },
                            { v: '1.2.3', title: 'PRODUCTION_RENDER_STABILITY', dot: 'bg-emerald-500' },
                            { v: '1.2.2', title: 'LIFECYCLE_DOCK_FIXES', dot: 'bg-cyan-500' },
                            { v: '1.2.0', title: 'CYBER_NEON_AESTHETICS', dot: 'bg-purple-500' }
                        ].map((u) => (
                            <div key={u.v} className="relative pl-6">
                                <div className={`absolute left-[-2px] top-1.5 w-1.5 h-1.5 rounded-full ${u.dot} shadow-[0_0_10px_currentColor]`} />
                                <div className="text-[10px] font-black text-white italic tracking-tighter mb-1 uppercase">{u.title} <span className="opacity-40 ml-2">[{u.v}]</span></div>
                                <div className="text-[9px] text-slate-600 font-bold tracking-widest uppercase italic">DEPLOYMENT_COMPLETE</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Data_Corpus_Status</span>
                    </div>
                    <div className="bg-black/60 p-6 border border-white/5 relative group hover:border-cyan-500/20 transition-all">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-mono text-slate-500 font-bold tracking-widest">LOCAL_NEURAL_WEIGHTS</span>
                            <span className="text-[10px] font-mono text-cyan-400 font-black">100%_SYNCED</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 mb-2 overflow-hidden">
                            <div className="w-full h-full bg-cyan-500 shadow-[0_0_10px_#00e5ff]" />
                        </div>
                        <div className="text-[8px] text-slate-700 font-mono tracking-widest uppercase">
                            Open_Brain is powered by local inference and is disconnected from cloud telemetry for maximum privacy.
                        </div>
                    </div>
                </section>
              </div>
            </div>
          </div>
        </div>
    );
};
