import { Server } from 'lucide-react';
import type { AppContextProps } from './types';

export const TabServidores = ({ ctx }: { ctx: AppContextProps }) => {
    const { servers } = ctx;

    return (
        <div className="grid lg:grid-cols-2 gap-5">
          {servers.map((srv: any) => (
            <div key={srv.id} className="panel p-5 flex flex-col gap-4 border-l-4 border-l-cyan-500/40">
              <div className="flex gap-4">
                <div className="p-4 bg-black/50 border border-white/5 h-fit shadow-[0_0_15px_rgba(0,229,255,0.05)]"><Server className="w-10 h-10 text-cyan-500 crt-effect" /></div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-start"><div className="font-black text-sm tracking-tighter">NODE_INSTANCE::{srv.nombre.toUpperCase()}</div><div className="text-[9px] font-black text-cyan-400 status-blink">STATUS: LIVE</div></div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{srv.ip} // {srv.os}</div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                     {[ ["SSH", srv.ssh ? "OK" : "NO"], ["PROJECTS", srv.proyectos?.length || 0] ].map(([l,v]) => (
                       <div key={l as string} className="p-2 border border-white/5 bg-black/30 text-center"><div className="text-[7px] text-slate-600 font-black uppercase tracking-widest">{l}</div><div className="text-xs font-black text-white mt-1">{v}</div></div>
                     ))}
                  </div>
                </div>
              </div>
              
              {/* PROJECTS & CONTAINERS DATASTREAM */}
              <div className="mt-2 border-t border-white/5 pt-3 grid grid-cols-2 gap-4">
                 <div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center justify-between">Hosted_Projects <span>[{srv.proyectos?.length || 0}]</span></div>
                    <div className="space-y-1">
                      {srv.proyectos?.slice(0, 6).map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-black/40 px-2 py-1.5 text-[8px] font-mono border border-white/5">
                          <span className={`text-slate-300 truncate ${!p.activo && 'opacity-40'}`}>{p.nombre}</span>
                          <div className={`w-1.5 h-1.5 ${p.activo ? 'bg-cyan-500 shadow-[0_0_5px_#00e5ff]' : 'bg-red-500'} crt-effect`} />
                        </div>
                      ))}
                      {srv.proyectos && srv.proyectos.length > 6 && <div className="text-[8px] text-cyan-500 opacity-50 font-mono text-center pt-1">+ {srv.proyectos.length - 6} MORE...</div>}
                    </div>
                 </div>
                 <div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center justify-between">Active_Containers <span>[{srv.containers?.length || 0}]</span></div>
                    <div className="space-y-1">
                      {srv.containers?.slice(0, 6).map((c: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-black/40 px-2 py-1.5 text-[8px] font-mono border border-white/5">
                          <span className="text-slate-300 truncate">{c.nombre}</span>
                          <span className="text-cyan-500 opacity-60">:{c.puerto}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
  
              {/* METRICS ROW */}
              {(() => {
                 const ramMatch = srv.ram ? String(srv.ram).match(/\((\d+)%\)/) : null;
                 const ramPct = ramMatch ? parseInt(ramMatch[1]) : 0;
                 const diskNota = (srv.notas || []).find((n: string) => n.includes('Disco:'));
                 const diskMatch = diskNota ? diskNota.match(/\((\d+)%\)/) : null;
                 const diskPct = diskMatch ? parseInt(diskMatch[1]) : 0;
  
                 // Extract raw strings for details
                 const ramStrMatch = srv.ram ? String(srv.ram).match(/(^.*?MB)/) : null;
                 const ramStr = ramStrMatch ? ramStrMatch[1] : '';
                 const diskStrMatch = diskNota ? diskNota.match(/Disco:\s*(.*?G)/) : null;
                 const diskStr = diskStrMatch ? diskStrMatch[1] : '';
  
                 return (
                   <div className="mt-auto border-t border-white/5 pt-3 grid grid-cols-2 gap-4">
                     {[
                        { label: "RAM USAGE", pct: ramPct, detail: ramStr },
                        { label: "DISK USAGE", pct: diskPct, detail: diskStr }
                     ].map((m, idx) => {
                        const color = m.pct > 85 ? '#ef4444' : m.pct > 65 ? '#eab308' : '#00e5ff';
                        const colorClass = m.pct > 85 ? 'text-red-500' : m.pct > 65 ? 'text-yellow-500' : 'text-cyan-400';
                        const radius = 16;
                        const circum = 2 * Math.PI * radius;
                        const offset = circum - (m.pct / 100) * circum;
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-black/40 p-2 border border-white/5">
                             <div className="relative flex items-center justify-center">
                               <svg className="w-12 h-12 transform -rotate-90">
                                 <circle cx="24" cy="24" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="transparent" />
                                 <circle cx="24" cy="24" r={radius} stroke={color} strokeWidth="3" fill="transparent" strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                               </svg>
                               <div className={`absolute font-black text-[9px] ${colorClass}`}>{m.pct}%</div>
                             </div>
                             <div className="flex flex-col">
                               <div className="text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">{m.label}</div>
                               <div className="text-[10px] font-mono text-white mt-1 opacity-80">{m.detail}</div>
                             </div>
                          </div>
                        );
                     })}
                   </div>
                 );
              })()}
            </div>
          ))}
        </div>
    );
};
