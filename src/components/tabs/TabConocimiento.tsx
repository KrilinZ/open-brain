import { useState, useEffect } from 'react';
import { Search, Loader2, X, Trash2, Database, Plus, Zap } from 'lucide-react';
import type { AppContextProps } from './types';
import type { KnowledgeItem } from '@/types/antigravity';
import { ScrollArea } from "@/components/ui/scroll-area";
import { HUDCorner } from '@/components/ui/HUDCorner';

export const TabConocimiento = ({ ctx }: { ctx: AppContextProps }) => {
    const { 
        knowledgeItems, kiSearchQuery, setKiSearchQuery, 
        selectedKi, setSelectedKi, newKiTitle, setNewKiTitle, 
        newKiSummary, setNewKiSummary, newKiContent, setNewKiContent, 
        isCreatingKi, setIsCreatingKi, refreshAll 
    } = ctx;

    const filteredKis = knowledgeItems.filter((ki: KnowledgeItem) => {
      const q = kiSearchQuery?.toLowerCase() || "";
      return ki?.titulo?.toLowerCase()?.includes(q) || 
             ki?.resumen?.toLowerCase()?.includes(q);
    });

    const [isAutoMode, setIsAutoMode] = useState<boolean>(true);

    useEffect(() => {
       const fetchState = async () => {
          const ag = (window as any).antigravity;
          if (ag && ag.getKiAutoMode) {
             const auto = await ag.getKiAutoMode();
             setIsAutoMode(auto);
          }
       };
       fetchState();
    }, []);

    const toggleAutoMode = async () => {
       const newVal = !isAutoMode;
       setIsAutoMode(newVal);
       const ag = (window as any).antigravity;
       if (ag && ag.setKiAutoMode) {
          await ag.setKiAutoMode(newVal);
       }
    };

    const handleCreateKi = async () => {
       if (!newKiTitle.trim()) return;
       setIsCreatingKi(true);
       try {
         const ag = (window as any).antigravity;
         if (ag?.createKI) {
           await ag.createKI({ titulo: newKiTitle, resumen: newKiSummary, contenido: newKiContent });
           setNewKiTitle(""); setNewKiSummary(""); setNewKiContent("");
           await refreshAll();
         }
       } catch (error) {
         console.error("KI_CREATE_ERROR:", error);
       }
       setIsCreatingKi(false);
     };

    const handleDeleteKi = async (id: string) => {
       if (!confirm("CONFIRM_DELETE: ¿Seguro que desea eliminar esta entrada de conocimiento?")) return;
       try {
         const ag = (window as any).antigravity;
         if (ag?.deleteKI) {
           await ag.deleteKI(id);
           setSelectedKi(null);
           await refreshAll();
         }
       } catch (error) {
         console.error("KI_DELETE_ERROR:", error);
       }
     };

    return (
       <div className="grid xl:grid-cols-[1fr_1fr] gap-6 h-[650px]">
          
          {/* LIST SIDEBAR */}
          <div className="panel p-0 flex flex-col bg-black/40 overflow-hidden relative">
             <HUDCorner pos="tl" />
             <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-white/5">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-cyan-400" />
                        <span className="font-black italic tracking-tighter text-white uppercase sm:text-xs">KNOWLEDGE_REPOSITORY</span>
                    </div>
                    <button 
                       onClick={toggleAutoMode}
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border font-black text-[10px] tracking-widest uppercase transition-all ${
                          isAutoMode 
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.2)]' 
                          : 'border-white/10 bg-black/40 text-slate-500 hover:text-slate-300'
                       }`}
                       title={isAutoMode ? "Auto-Extract KIs (Running)" : "Auto-Extract KIs (Paused)"}
                    >
                       <Zap className={`w-3.5 h-3.5 ${isAutoMode ? 'animate-pulse text-cyan-400' : ''}`} />
                       <span>{isAutoMode ? 'AUTO ON' : 'AUTO OFF'}</span>
                    </button>
                 </div>
                 <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 opacity-50" />
                    <input 
                       className="w-full bg-black/60 border border-white/5 text-[11px] uppercase font-mono py-2.5 pl-9 pr-3 outline-none focus:border-cyan-500/30 transition-all text-white placeholder:text-slate-800"
                       placeholder="SEARCH_INDEX..." 
                       value={kiSearchQuery} 
                       onChange={e => setKiSearchQuery(e.target.value)} 
                    />
                 </div>
             </div>

             <ScrollArea className="flex-1 p-4 scroll-custom">
                <div className="space-y-2">
                   {filteredKis.map((ki: KnowledgeItem) => (
                      <button 
                         key={ki.id} 
                         onClick={() => setSelectedKi(ki)}
                         className={`w-full text-left p-4 border transition-all rounded-sm relative group ${
                            selectedKi?.id === ki.id 
                            ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(0,229,255,0.1)]" 
                            : "bg-black/20 border-white/5 hover:border-white/20"
                         }`}
                      >
                         <div className={`font-black text-[12px] italic tracking-tighter mb-1 transition-colors ${selectedKi?.id === ki.id ? 'text-white' : 'text-slate-400'}`}>
                            {ki.titulo.toUpperCase()}
                         </div>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-mono line-clamp-1 truncate">
                           {ki.resumen}
                         </p>
                      </button>
                   ))}
                   {filteredKis.length === 0 && (
                      <div className="text-center font-mono text-[10px] text-slate-800 py-20 uppercase tracking-[0.5em]">
                        NO_RECORDS_FOUND
                      </div>
                   )}
                </div>
             </ScrollArea>
             
             <div className="p-3 border-t border-white/5 text-[8px] font-black text-slate-700 uppercase tracking-[0.5em] text-center">
                TOTAL_INDEXED: {filteredKis.length} // STATUS_VERIFIED
             </div>
          </div>
          
          {/* CONTENT AREA */}
          <div className="panel p-0 flex flex-col bg-black/40 overflow-hidden relative">
             <HUDCorner pos="tr" />
             
             {selectedKi ? (
                <div className="flex flex-col h-full">
                   <div className="p-6 border-b border-white/5 flex justify-between items-start bg-white/[0.03]">
                      <div className="flex-1 pr-6">
                         <div className="font-black text-xl italic tracking-tighter text-white mb-2 uppercase break-words">
                            {selectedKi.titulo}
                         </div>
                         <div className="text-[11px] text-cyan-500/60 font-mono italic max-w-2xl border-l-2 border-cyan-500/20 pl-4 py-1">
                            {selectedKi.resumen}
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setSelectedKi(null)} 
                            className="p-2 border border-white/5 hover:bg-white/5 text-slate-500 transition-all"
                         >
                            <X className="w-5 h-5" />
                         </button>
                         <button 
                            onClick={() => handleDeleteKi(selectedKi.id)} 
                            className="p-2 border border-red-500/20 text-red-500/50 hover:bg-red-500/10 transition-all font-mono text-[10px] flex items-center gap-2"
                         >
                            <Trash2 className="w-4 h-4" />
                            <span>DELETE</span>
                         </button>
                      </div>
                   </div>
                   
                   <ScrollArea className="flex-1 p-6 scroll-custom">
                      {selectedKi.artefactos?.[0] ? (
                         <div className="p-8 bg-black/40 border border-white/5 text-[13px] leading-relaxed text-white/90 font-mono whitespace-pre-wrap relative min-h-full">
                            <div className="absolute top-0 right-0 p-3 text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">ENCRYPTED_PAYLOAD // {selectedKi.id}</div>
                            {selectedKi.artefactos[0].contenido}
                         </div>
                      ) : (
                         <div className="h-full flex items-center justify-center font-mono text-[11px] text-slate-800 uppercase tracking-[0.5em]">
                            ENTRY_IS_NULL
                         </div>
                      )}
                   </ScrollArea>
                </div>
             ) : (
                <div className="flex flex-col h-full">
                   <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/[0.03]">
                      <Plus className="w-5 h-5 text-cyan-400" />
                      <span className="font-black italic tracking-tighter text-white uppercase mt-1">NEW_REPOSITORY_ENTRY</span>
                   </div>
                   
                   <div className="flex-1 p-8 flex flex-col gap-6">
                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest ml-1">IDENTIFIER_TITLE</label>
                         <input 
                            className="w-full bg-black/60 border border-white/5 text-[12px] p-4 text-white outline-none focus:border-cyan-500/30 transition-all font-mono" 
                            placeholder="Architecture_Module_Alpha" 
                            value={newKiTitle} 
                            onChange={e => setNewKiTitle(e.target.value)} 
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest ml-1">SUMMARY_OVERVIEW</label>
                         <input 
                            className="w-full bg-black/60 border border-white/5 text-[12px] p-4 text-slate-400 outline-none focus:border-cyan-500/30 transition-all font-mono" 
                            placeholder="Technical description of the module implementation..." 
                            value={newKiSummary} 
                            onChange={e => setNewKiSummary(e.target.value)} 
                         />
                      </div>
                      <div className="space-y-2 flex-1 flex flex-col">
                         <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest ml-1">TECHNICAL_SPECIFICATIONS (MARKDOWN)</label>
                         <textarea 
                            className="w-full flex-1 bg-black/60 border border-white/5 text-[12px] p-5 text-cyan-100/70 outline-none focus:border-cyan-500/30 transition-all font-mono resize-none leading-relaxed scroll-custom" 
                            placeholder="### SPECIFICATIONS\n\n- Write detailed documentation here..." 
                            value={newKiContent} 
                            onChange={e => setNewKiContent(e.target.value)} 
                         />
                      </div>
                      <button 
                        onClick={handleCreateKi} 
                        disabled={isCreatingKi || !newKiTitle.trim()} 
                        className="btn-cyber py-4 flex justify-center items-center gap-3 transition-all disabled:opacity-30"
                      >
                         {isCreatingKi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                         <span className="font-black italic tracking-tighter">COMMIT_KNOWLEDGE_PIECE</span>
                      </button>
                   </div>
                </div>
             )}
          </div>
       </div>
    );
};
