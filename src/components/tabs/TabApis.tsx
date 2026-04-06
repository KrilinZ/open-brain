import { RefreshCw, Key } from 'lucide-react';
import type { AppContextProps } from './types';

export const TabApis = ({ ctx }: { ctx: AppContextProps }) => {
    const { apis, setApis, isSyncingApis, setIsSyncingApis } = ctx;

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
              <div className="section-title">KEY_REPOSITORY</div>
              <button 
                  onClick={async () => {
                      setIsSyncingApis(true);
                      const updatedApis = await (window as any).antigravity.syncApis();
                      if (Array.isArray(updatedApis)) setApis(updatedApis);
                      setIsSyncingApis(false);
                  }}
                  disabled={isSyncingApis}
                  className="btn-primary flex items-center gap-2">
                  <RefreshCw className={`w-3 h-3 ${isSyncingApis ? 'animate-spin' : ''}`} />
                  {isSyncingApis ? 'SYNCING...' : 'SYNC_BALANCES'}
              </button>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {apis.map((api: any) => (
              <div key={api.id} className="panel p-5 space-y-4 border-l-4 border-l-cyan-600/50 flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-3"><Key className="w-4 h-4 text-cyan-500" /><div className="font-black text-[11px] tracking-widest">{api.nombre.toUpperCase()}</div></div>
                   <div>
                      {api.status === 'ERROR' && <div className="bg-red-600 text-white font-black text-[7px] px-2 py-1 rounded-sm shadow-[0_0_10px_red]">KEY_ERROR</div>}
                      {api.status === 'OK' && <div className="bg-cyan-600 text-white font-black text-[7px] px-2 py-1 rounded-sm shadow-[0_0_10px_#00e5ff]">UPLINK_OK</div>}
                      {(!api.status || api.status === 'UNKNOWN') && <div className="bg-slate-700 text-white font-black text-[7px] px-2 py-1 rounded-sm border border-white/10">UNKNOWN_KEY</div>}
                   </div>
                </div>
                {(() => {
                   const isTraffic = api.nombre.includes('Data Impulse') || api.nombre.includes('DataImpulse');
                   const isGemini = api.nombre.includes('Gemini') || api.nombre.includes('Antigravity');
                   const isGoogle = api.nombre.includes('Google API');
                   let unit = isTraffic ? ' GB' : '$';
                   let label = isTraffic ? 'TRAFFIC' : 'QUOTA';
                   let displayValue = `${(api.saldo ?? 0).toFixed(2)}${unit}`;
                   let warnValue = `${api.limiteAlerta ?? 0}${unit}`;
                   
                   if (isGemini) {
                     label = 'TOKENS';
                     displayValue = 'FREE_TIER';
                     warnValue = 'UNLIMITED';
                   } else if (isGoogle) {
                     label = 'CLOUD_LIMIT';
                     displayValue = 'PREMIUM';
                     warnValue = 'ACTIVE';
                   }
                   
                   return (
                      <div className="grid grid-cols-2 gap-3 bg-black/50 p-4 border border-white/5">
                        <div><div className="text-[8px] text-slate-500 font-black uppercase">{label}</div><div className="text-sm font-black text-white">{displayValue}</div></div>
                        <div><div className="text-[8px] text-slate-500 font-black uppercase">Warn_At</div><div className="text-sm font-black text-cyan-500 opacity-60">{warnValue}</div></div>
                      </div>
                   );
                })()}
                
                {api.proyectos && api.proyectos.length > 0 && (
                  <div className="flex-1 space-y-2 mt-2 border-t border-white/5 pt-3">
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2">Project_Consumption</div>
                    {api.proyectos.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-black/30 p-2 text-[9px] border border-white/5">
                         <span className="font-mono text-slate-300">{p.proyecto}</span>
                         <span className="font-black text-cyan-400">{p.consumoMensual.toFixed(2)}$</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div dangerouslySetInnerHTML={{__html: '<!-- sync visualizer empty element -->'}} className="hidden" />
                <div className={`mt-auto text-[8px] p-2 bg-white/5 text-slate-600 font-mono truncate select-all hover:text-cyan-400 transition-colors ${api.status === 'ERROR' ? 'border border-red-500/50 text-red-400' : ''}`}>HASH_UPLINK::{api.apiKey?.slice(0,12) || 'EMPTY'}...</div>
              </div>
            ))}
          </div>
        </div>
    );
};
