import { FolderOpen } from 'lucide-react';
import type { AppContextProps } from './types';
import { HUDCorner } from '@/components/ui/HUDCorner';

export const TabSalidas = ({ ctx }: { ctx: AppContextProps }) => {
    const { archivosSalida, filterSalida, setFilterSalida } = ctx;

    const salidasFiltradas = archivosSalida.filter((o: any) => 
        o.titulo.toLowerCase().includes(filterSalida.toLowerCase()) || 
        o.tamaño.toLowerCase().includes(filterSalida.toLowerCase())
    );

    return (
        <div className="panel p-5 space-y-4">
          <HUDCorner pos="tr" />
          <div className="flex justify-between items-center mb-4">
             <div className="section-title mb-0">CRYPT_VAULT</div>
             <div className="flex items-center gap-3">
               <input 
                 type="text" 
                 placeholder="FILTRAR SALIDAS..." 
                 value={filterSalida}
                 onChange={e => setFilterSalida(e.target.value)}
                 className="bg-black/50 border border-cyan-500/30 px-3 py-1 text-[10px] font-mono text-cyan-400 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-400"
               />
               <button 
                 onClick={() => { if((window as any).antigravity.openVault) (window as any).antigravity.openVault(); }}
                 className="text-[9px] font-mono font-bold text-white uppercase tracking-widest bg-cyan-900/30 hover:bg-cyan-500/20 border border-cyan-500/50 px-3 py-1 transition-all shadow-[0_0_10px_rgba(0,229,255,0.2)] flex items-center gap-2"
               >
                 <FolderOpen className="w-3 h-3" /> OPEN VAULT
               </button>
               <div className="text-[10px] font-bold text-cyan-500 uppercase">{archivosSalida.length} FILES</div>
             </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-3 h-[500px] overflow-y-auto pr-2 pb-4">
            {salidasFiltradas.length === 0 ? (
               <div className="col-span-4 text-center py-20 font-mono text-[10px] text-cyan-900 uppercase">NO HAY REGISTROS QUE COINCIDAN</div>
            ) : (
               salidasFiltradas.map((o: any, i: number) => (
                 <div key={i} className="group p-4 border border-white/5 bg-black/30 hover:bg-cyan-500/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between h-[100px]">
                   <div>
                     <div className="text-[10px] font-black truncate text-slate-100 mb-1" title={o.titulo}>[{o.titulo.toUpperCase()}]</div>
                     <div className="text-[8px] text-slate-600 font-mono">0x{i.toString(16).padStart(6, '0')} // {o.tamaño}</div>
                   </div>
                   <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                       onClick={() => { if((window as any).antigravity.openInFinder) (window as any).antigravity.openInFinder(o.ruta || ('~/.openbrain/' + o.titulo)); }} 
                       className="text-[8px] font-mono text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 px-2 py-0.5"
                       title="Localizar en Finder"
                     >
                       REVEAL {'>'}
                     </button>
                   </div>
                 </div>
               ))
            )}
          </div>
        </div>
    );
};
