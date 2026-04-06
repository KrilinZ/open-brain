import { Lock, Trash2, ShieldCheck, RefreshCw, Globe, HardDrive, Code2, Skull, Zap, Activity } from 'lucide-react';
import type { AppContextProps } from './types';
import { HUDCorner } from '@/components/ui/HUDCorner';

export const TabReparar = ({ ctx }: { ctx: AppContextProps }) => {
    const { setMaintenanceMsg, refreshAll, maintenanceMsg } = ctx;

    const acc = [
        { id: 'BK', t: 'SYS_REDUNDANCY', i: Lock, c: 'text-cyan-400', fn: () => window.antigravity.createBackup() },
        { id: 'RM', t: 'TRACE_NULLIFIER', i: Trash2, c: 'text-cyan-400', fn: () => window.antigravity.cleanResolved() },
        { id: 'VF', t: 'NODE_INTEGRITY', i: ShieldCheck, c: 'text-cyan-400', fn: () => window.antigravity.verifyIntegrity() },
        { id: 'SY', t: 'SYNC_CONTEXT', i: RefreshCw, c: 'text-cyan-400', fn: () => window.antigravity.autoSyncProjects() },
        { id: 'CB', t: 'CLEAN_BROWSER', i: Globe, c: 'text-cyan-400', fn: () => window.antigravity.cleanBrowserCache() },
        { id: 'CA', t: 'NUCLEAR_CACHE', i: HardDrive, c: 'text-pink-500', fn: () => window.antigravity.cleanAntigravityCache() },
        { id: 'CE', t: 'CLEAN_MODULES', i: Code2, c: 'text-cyan-400', fn: () => window.antigravity.cleanExtensions() },
        { id: 'KZ', t: 'KILL_ZOMBIES', i: Skull, c: 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]', 
            fn: async () => {
                const res = await window.antigravity.getZombieProcesses();
                if (res.ok && res.zombies.length > 0) {
                    const list = res.zombies.map((z: any) => `${z.parentName} (PID: ${z.ppid})`).join(', ');
                    if (confirm(`[ ALERTA_SISTEMA ]: DETECTADAS AMENAZAS ZOMBIE\n\nSe cerrarán los procesos padre:\n${list}\n\n¿Proceder con la purga terminal?`)) {
                        const kRes = await window.antigravity.killProcesses(res.zombies.map((z: any) => z.ppid));
                        return kRes;
                    }
                    return { mensaje: 'OPERACIÓN_ABORTADA: Purga cancelada por protocolo de usuario.' };
                }
                return { mensaje: 'STATUS_CLEAR: No se han detectado procesos zombie en el sector.' };
            } 
        },
    ];

    return (
        <div className="space-y-8 relative">
          <div className="section-title">SYSTEM_MAINTENANCE_PROCEDURES</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {acc.map(a => (
               <button 
                  key={a.id} 
                  onClick={async() => { 
                    const r: any = await a.fn(); 
                    if (r) setMaintenanceMsg(r.mensaje || r.error || "OK"); 
                    refreshAll(); 
                  }} 
                  className="panel p-10 flex flex-col items-center group transition-all hover:bg-cyan-500/5 relative overflow-hidden"
               >
                  <HUDCorner pos="tl" />
                  <div className={`p-6 border border-white/10 mb-6 group-hover:border-cyan-500/50 transition-all ${a.id === 'KZ' ? 'group-hover:bg-red-500/10 border-red-500/20' : 'group-hover:bg-cyan-500/10'}`}>
                    <a.i className={`w-10 h-10 ${a.c} crt-effect group-hover:scale-110 transition-transform`} />
                  </div>
                  <div className="font-black text-[11px] tracking-[0.3em] text-white/70 group-hover:text-white transition-colors">{a.t}</div>
                  <div className="absolute bottom-2 right-4 text-[7px] font-mono text-white/10 group-hover:text-cyan-500/30">ID:{a.id}</div>
               </button>
             ))}
          </div>

          {maintenanceMsg && (
            <div className="panel p-6 bg-black/80 border-l-4 border-l-pink-600 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4">
                <Zap className="w-5 h-5 text-pink-500 animate-pulse" />
                <div className="font-mono text-xs text-white/90">
                  <span className="text-pink-500 font-black mr-2 tracking-widest">[ RESPONSE ]</span>
                  {maintenanceMsg}
                </div>
              </div>
            </div>
          )}

          <div className="panel p-6 border-dashed border-white/5 opacity-50">
             <div className="flex items-center gap-6">
                <Activity className="w-8 h-8 text-slate-700" />
                <div className="space-y-1">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AUTO_CLEAN_STATUS</div>
                   <div className="text-[9px] font-mono text-slate-700">SCAN_INTERVAL: 300S // NEXT_RUN: T-42S // PROTOCOL: PASSIVE</div>
                </div>
             </div>
          </div>
        </div>
    );
};
