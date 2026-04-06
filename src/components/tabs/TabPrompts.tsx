import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Search, 
  FileText, Hash, Database,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { HUDCorner } from '@/components/ui/HUDCorner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from 'framer-motion';
import type { AppContextProps } from './types';
import type { Prompt } from '@/types/antigravity';

/* ───── SUB-COMPONENT: PROMPT EDITOR ───── */
const PromptEditor = ({ 
    prompt, 
    onSave, 
    onInject 
}: { 
    prompt: Prompt | null, 
    onSave: (name: string, content: string, tags: string[]) => void,
    onInject: (content: string) => void
}) => {
    const [name, setName] = useState(prompt?.name || "");
    const [content, setContent] = useState(prompt?.content || "");
    const [tagsStr, setTagsStr] = useState(prompt?.tags?.join(', ') || "");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setName(prompt?.name || "");
        setContent(prompt?.content || "");
        setTagsStr(prompt?.tags?.join(', ') || "");
    }, [prompt]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col relative overflow-hidden bg-black/40 backdrop-blur-3xl"
        >
            <HUDCorner pos="tr" />
            
            {/* TOP BAR */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                <div className="flex-1 flex gap-5 items-center">
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 crt-effect">
                        <FileText className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            placeholder="PROMPT_IDENTIFIER..."
                            className="bg-transparent border-none outline-none text-xl font-black italic tracking-tighter text-white placeholder:text-slate-800 w-full glitch-hover"
                        />
                        <div className="flex items-center gap-3">
                            <Hash className="w-3.5 h-3.5 text-cyan-500/30" />
                            <input 
                                type="text"
                                value={tagsStr}
                                onChange={(e) => setTagsStr(e.target.value)}
                                placeholder="CLASSIFICATION_TAGS (CSV)..."
                                className="bg-transparent border-none outline-none text-[10px] font-black tracking-[0.3em] text-cyan-500/40 placeholder:text-slate-800 w-full uppercase"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleCopy}
                        className={`btn-cyber py-2 transition-all ${
                            copied ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : ''
                        }`}
                    >
                        {copied ? 'COPIED' : 'COPY'}
                    </button>
                    <button 
                        onClick={() => onInject(content)}
                        disabled={!content.trim()}
                        className="btn-cyber py-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500"
                    >
                        INJECT
                    </button>
                    <button 
                        onClick={() => {
                            const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
                            onSave(name, content, tags);
                        }}
                        className="btn-cyber py-2"
                    >
                        SAVE_DATA
                    </button>
                </div>
            </div>

            {/* TEXT AREA */}
            <div className="flex-1 flex flex-col relative group p-6">
                <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="ENTER_PROMPT_CONTENT_HERE >> SYSTEM_AWAITING_PAYLOAD..."
                    className="flex-1 bg-black/40 border border-white/5 p-8 text-[13px] leading-relaxed font-mono text-cyan-400 placeholder:text-slate-800 outline-none focus:border-cyan-500/30 transition-all resize-none shadow-inner scroll-custom uppercase"
                />
                <div className="absolute top-8 left-10 text-[8px] font-black text-cyan-900 pointer-events-none opacity-40 uppercase tracking-[0.4em]">BUFFER_ENCRYPTION: AES-256</div>
                <div className="absolute bottom-8 right-10 text-[8px] font-black text-cyan-900 pointer-events-none opacity-40 uppercase tracking-[0.4em]">CHAR_COUNT: {content.length}</div>
            </div>
        </motion.div>
    );
};

/* ───── MAIN COMPONENT: TAB PROMPTS ───── */
export const TabPrompts = ({ ctx }: { ctx: AppContextProps }) => {
    const { prompts, setPrompts, setPromptToInject, setActiveTab } = ctx;
    const safePrompts = Array.isArray(prompts) ? prompts : [];
    const [selectedId, setSelectedId] = useState<string | null>(safePrompts[0]?.id || null);
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const filtered = safePrompts.filter((p: Prompt) => 
        (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
        (p.tags || []).some((t: string) => (t || "").toLowerCase().includes(search.toLowerCase()))
    );

    const currentPrompt = safePrompts.find((p: Prompt) => p.id === selectedId) || null;

    const handleSave = async (name: string, content: string, tags: string[]) => {
        if (!name || !content) return;
        setIsSaving(true);
        const ag = window.antigravity;
        
        const newPrompt: Prompt = {
            id: selectedId || `p_${Date.now()}`,
            name,
            content,
            tags,
            updatedAt: new Date().toISOString()
        };

        const updated = await ag.savePrompt(newPrompt);
        if (Array.isArray(updated)) {
            setPrompts(updated);
            setSelectedId(newPrompt.id);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("CONFIRM_DESTRUCTION: ¿Eliminar este registro de forma permanente?")) return;
        const ag = window.antigravity;
        const updated = await ag.deletePrompt(id);
        if (Array.isArray(updated)) {
            setPrompts(updated);
            if (selectedId === id) setSelectedId(updated[0]?.id || null);
        }
    };

    const handleInject = (content: string) => {
        setPromptToInject(content);
        setActiveTab("ia");
    };

    const handleNew = () => {
        setSelectedId(null);
    };

    return (
        <div className="flex gap-6 h-[650px] relative">
            
            {/* SIDEBAR LIST */}
            <div className="w-[380px] panel flex flex-col overflow-hidden bg-black/60 shadow-2xl">
                <HUDCorner pos="tl" />
                
                <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-cyan-400 crt-effect" />
                            <span className="font-black italic tracking-tighter text-white uppercase sm:text-xs">PROMPT_VAULT</span>
                        </div>
                        <button 
                            onClick={handleNew}
                            className="p-2 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="SEARCH_REPOSITORY..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/5 text-[11px] font-mono text-cyan-500 placeholder:text-slate-800 outline-none focus:border-cyan-500/30 transition-all uppercase tracking-widest"
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4 scroll-custom">
                    <div className="space-y-2">
                        {filtered.map((p: Prompt) => (
                            <div 
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`p-4 border group cursor-pointer transition-all relative ${
                                    selectedId === p.id 
                                    ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(0,229,255,0.1)]' 
                                    : 'bg-black/20 border-white/5 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className={`text-[12px] font-black italic tracking-tighter transition-colors ${selectedId === p.id ? 'text-white' : 'text-slate-400'}`}>
                                        {p.name}
                                    </h3>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {p.tags?.map((t: string) => (
                                        <span key={t} className="text-[8px] font-black tracking-widest text-cyan-500/50 uppercase border border-cyan-500/10 px-2 py-0.5 bg-cyan-500/[0.02]">
                                            #{t}
                                        </span>
                                    ))}
                                </div>
                                {selectedId === p.id && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                    >
                                        <ArrowRight className="w-4 h-4 text-cyan-400 animate-pulse" />
                                    </motion.div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                
                <div className="p-4 bg-white/[0.02] border-t border-white/5 text-[8px] font-black text-slate-700 uppercase tracking-[0.5em] text-center">
                    TOTAL_RECORDS: {filtered.length} // STATUS_VERIFIED
                </div>
            </div>

            {/* EDITOR AREA */}
            <div className="flex-1 panel p-0 overflow-hidden flex flex-col bg-black/40">
                {selectedId ? (
                    <PromptEditor 
                        key={selectedId}
                        prompt={currentPrompt} 
                        onSave={handleSave}
                        onInject={handleInject}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-10">
                        <Database className="w-16 h-16 text-slate-400" />
                        <div className="text-[10px] font-black tracking-[0.5em] uppercase">SYSTEM_AWAITING_SELECTION</div>
                    </div>
                )}
                {isSaving && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden"
                    >
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                                <RefreshCw className="w-16 h-16 text-cyan-500 animate-spin" />
                                <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                            </div>
                            <div className="text-[10px] font-black text-cyan-400 tracking-[0.5em] uppercase animate-pulse">COMMITTING_TO_SECURE_STORAGE...</div>
                        </div>
                    </motion.div>
                )}
            </div>

        </div>
    );
};
