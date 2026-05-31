/* eslint-disable */
// @ts-nocheck
import logoBrain from '../../assets/logo-brain.png';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Loader2, X, Trash2, Plus, ChevronDown, ChevronRight, Tag, FileText, Calendar, Link2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppContextProps } from './types';
import type { KnowledgeItem } from '@/types/antigravity';
import { ScrollArea } from "@/components/ui/scroll-area";

// ── helpers ───────────────────────────────────────────────────────────────
const PINK  = "#ff2d78";
const CYAN  = "#00f0ff";
const GLOW_PINK = "drop-shadow(0 0 6px #ff2d78)";
const GLOW_CYAN = "drop-shadow(0 0 6px #00f0ff)";

// Deriva el nombre de proyecto legible desde el id del directorio o tags
function deriveProject(ki: KnowledgeItem): string {
  // Si el backend manda proyecto real (cuando haya campo project en metadata)
  if (ki.proyecto && ki.proyecto !== ki.id) return ki.proyecto;
  // Intenta leer del primer tag si es corto y sin espacios
  if (ki.tags && ki.tags.length > 0) {
    const candidate = ki.tags.find(t => t.length < 25 && !t.includes(' ') && t.length > 2);
    if (candidate) return candidate;
  }
  // Fallback: humanizar el slug del id
  return ki.id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .substring(0, 40);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Mini brain icon SVG ───────────────────────────────────────────────────
const MiniCerebro = ({ color = PINK }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M38 62 C28 62 16 55 13 44 C10 33 14 20 22 14 C27 10 33 10 38 14"
      stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M42 62 C52 62 64 55 67 44 C70 33 66 20 58 14 C53 10 47 10 42 14"
      stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M38 14 C38 18 40 20 40 20 C40 20 42 18 42 14"
      stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    <path d="M35 62 C35 66 37 68 40 68 C43 68 45 66 45 62"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M22 28 C26 26 30 28 30 32" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <path d="M16 40 C20 36 26 38 24 44" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M26 50 C30 48 34 50 32 55" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M58 28 C54 26 50 28 50 32" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <path d="M64 40 C60 36 54 38 56 44" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M54 50 C50 48 46 50 48 55" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <line x1="40" y1="20" x2="40" y2="62" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
  </svg>
);

// ── KI Detail Panel ───────────────────────────────────────────────────────
const KIDetail = ({
  ki,
  onClose,
  onDelete,
}: {
  ki: KnowledgeItem;
  onClose: () => void;
  onDelete: (id: string) => void;
}) => {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <motion.div
      key={ki.id}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="flex flex-col h-full"
      style={{ borderLeft: `1px solid ${PINK}30` }}
    >
      {/* header */}
      <div className="p-4 border-b flex items-start justify-between gap-3" style={{ borderColor: `${PINK}25` }}>
        <div className="flex items-center gap-2 min-w-0">
          <MiniCerebro />
          <span className="text-xs font-black tracking-widest truncate" style={{ color: PINK, textShadow: `0 0 8px ${PINK}` }}>
            {ki.titulo}
          </span>
        </div>
        <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* resumen */}
          <div className="rounded-lg p-3 text-xs text-slate-300 leading-relaxed" style={{ background: `${PINK}08`, border: `1px solid ${PINK}20` }}>
            {ki.resumen || <span className="text-slate-500 italic">Sin resumen</span>}
          </div>

          {/* meta row */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(ki.creadoEn)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: CYAN }} />
              <span className="text-slate-400">{formatDate(ki.actualizadoEn)}</span>
            </div>
          </div>

          {/* tags */}
          {ki.tags && ki.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ki.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded text-[9px] font-mono tracking-widest"
                  style={{ background: `${PINK}15`, border: `1px solid ${PINK}30`, color: "#ff85b3" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* referencias */}
          {ki.referencias && ki.referencias.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-mono tracking-widest text-slate-600 flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> REFS
              </div>
              {ki.referencias.map((ref, i) => (
                <div key={i} className="text-[10px] font-mono text-cyan-500 truncate opacity-70 hover:opacity-100 transition-opacity">
                  {ref}
                </div>
              ))}
            </div>
          )}

          {/* artefactos */}
          {ki.artefactos && ki.artefactos.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-mono tracking-widest text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> ARTIFACTS ({ki.artefactos.length})
              </div>
              {ki.artefactos.map((a, i) => (
                <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${CYAN}20` }}>
                  <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: `${CYAN}08` }}>
                    <span className="text-[10px] font-mono text-cyan-400">{a.nombre}</span>
                    <span className="text-[9px] text-slate-600">{a.tamaño}</span>
                  </div>
                  {a.contenido && (
                    <pre className="px-3 py-2 text-[10px] text-slate-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto leading-relaxed font-mono">
                      {a.contenido.substring(0, 4000)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* delete */}
      <div className="p-3 border-t" style={{ borderColor: `${PINK}20` }}>
        {!confirmDel ? (
          <button
            onClick={() => setConfirmDel(true)}
            className="w-full py-2 rounded text-[10px] font-mono tracking-widest text-slate-600 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Trash2 className="w-3 h-3" /> DELETE_KI
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(ki.id); setConfirmDel(false); }}
              className="flex-1 py-2 rounded text-[10px] font-mono tracking-widest text-red-400 transition-all"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              CONFIRM
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="flex-1 py-2 rounded text-[10px] font-mono tracking-widest text-slate-500 transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              CANCEL
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── KI Card ───────────────────────────────────────────────────────────────
const KICard = ({
  ki,
  isSelected,
  onClick,
}: {
  ki: KnowledgeItem;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <motion.button
    whileHover={{ x: 3 }}
    onClick={onClick}
    className="w-full text-left rounded-lg p-3 transition-all group"
    style={{
      background: isSelected ? `${PINK}12` : "rgba(255,255,255,0.02)",
      border: `1px solid ${isSelected ? PINK + "50" : "rgba(255,255,255,0.06)"}`,
      boxShadow: isSelected ? `0 0 12px ${PINK}20` : "none",
    }}
  >
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <span
        className="text-[11px] font-bold leading-snug"
        style={{ color: isSelected ? PINK : "#e2e8f0", textShadow: isSelected ? `0 0 8px ${PINK}80` : "none" }}
      >
        {ki.titulo}
      </span>
      {ki.artefactos?.length > 0 && (
        <span className="shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}25` }}>
          {ki.artefactos.length}f
        </span>
      )}
    </div>
    {ki.resumen && (
      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 text-left group-hover:text-slate-400 transition-colors">
        {ki.resumen}
      </p>
    )}
    {ki.tags && ki.tags.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2">
        {ki.tags.slice(0, 4).map(tag => (
          <span key={tag} className="text-[8px] font-mono px-1.5 py-0.5 rounded tracking-wide"
            style={{ background: `${PINK}10`, color: "#ff85b3", border: `1px solid ${PINK}20` }}>
            #{tag}
          </span>
        ))}
        {ki.tags.length > 4 && (
          <span className="text-[8px] font-mono text-slate-600">+{ki.tags.length - 4}</span>
        )}
      </div>
    )}
    <div className="mt-2 text-[8px] font-mono text-slate-700">
      {formatDate(ki.actualizadoEn || ki.creadoEn)}
    </div>
  </motion.button>
);

// ── Project Group ─────────────────────────────────────────────────────────
const ProjectGroup = ({
  name,
  items,
  selectedKi,
  onSelect,
}: {
  name: string;
  items: KnowledgeItem[];
  selectedKi: KnowledgeItem | null;
  onSelect: (ki: KnowledgeItem) => void;
}) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-3">
      {/* group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1.5 transition-all hover:bg-white/5"
        style={{ border: "1px solid rgba(255,255,255,0.04)" }}
      >
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="w-3 h-3 text-slate-600" />
        </motion.div>
        <MiniCerebro color={open ? PINK : "#555"} />
        <span
          className="flex-1 text-left text-[10px] font-black tracking-widest uppercase truncate"
          style={{ color: open ? "#ff85b3" : "#64748b", textShadow: open ? `0 0 6px ${PINK}60` : "none" }}
        >
          {name}
        </span>
        <span className="text-[9px] font-mono text-slate-600 shrink-0">
          {items.length} KI{items.length !== 1 ? "s" : ""}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 overflow-hidden pl-1"
          >
            {items.map(ki => (
              <KICard
                key={ki.id}
                ki={ki}
                isSelected={selectedKi?.id === ki.id}
                onClick={() => onSelect(ki)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Create KI Form ────────────────────────────────────────────────────────
const CreateKIForm = ({ ctx }: { ctx: AppContextProps }) => {
  const { newKiTitle, setNewKiTitle, newKiSummary, setNewKiSummary, newKiContent, setNewKiContent, isCreatingKi, setIsCreatingKi, refreshAll } = ctx;
  const [show, setShow] = useState(false);

  const handleCreate = async () => {
    if (!newKiTitle.trim()) return;
    setIsCreatingKi(true);
    try {
      await window.antigravity.createKI({ titulo: newKiTitle, resumen: newKiSummary, contenido: newKiContent });
      setNewKiTitle(''); setNewKiSummary(''); setNewKiContent('');
      setShow(false);
      await refreshAll();
    } catch (e) { console.error(e); }
    finally { setIsCreatingKi(false); }
  };

  return (
    <div>
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="w-full py-2.5 rounded-lg text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all"
          style={{
            background: `${PINK}10`,
            border: `1px dashed ${PINK}40`,
            color: PINK,
            textShadow: `0 0 8px ${PINK}`,
          }}
        >
          <Plus className="w-3.5 h-3.5" /> NEW_KI
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg p-3 space-y-2"
          style={{ background: `${PINK}08`, border: `1px solid ${PINK}30` }}
        >
          <input
            value={newKiTitle}
            onChange={e => setNewKiTitle(e.target.value)}
            placeholder="TITULO"
            className="w-full bg-transparent text-[11px] font-bold tracking-wider text-pink-200 placeholder-pink-900 border-b pb-1 outline-none"
            style={{ borderColor: `${PINK}30` }}
          />
          <input
            value={newKiSummary}
            onChange={e => setNewKiSummary(e.target.value)}
            placeholder="Resumen..."
            className="w-full bg-transparent text-[10px] text-slate-400 placeholder-slate-700 border-b pb-1 outline-none"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          />
          <textarea
            value={newKiContent}
            onChange={e => setNewKiContent(e.target.value)}
            placeholder="Contenido markdown..."
            rows={5}
            className="w-full bg-black/30 rounded p-2 text-[10px] text-slate-300 placeholder-slate-700 outline-none resize-none font-mono"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isCreatingKi || !newKiTitle.trim()}
              className="flex-1 py-2 rounded text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-30"
              style={{ background: `${PINK}20`, border: `1px solid ${PINK}50`, color: PINK }}
            >
              {isCreatingKi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              COMMIT
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-4 py-2 rounded text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              CANCEL
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ── MAIN TAB ──────────────────────────────────────────────────────────────
export const TabConocimiento = ({ ctx }: { ctx: AppContextProps }) => {
  const { knowledgeItems, kiSearchQuery, setKiSearchQuery, selectedKi, setSelectedKi, refreshAll } = ctx;

  // Agrupar por proyecto
  const grouped = useMemo(() => {
    const q = (kiSearchQuery || '').toLowerCase();
    const filtered = q
      ? knowledgeItems.filter((ki: KnowledgeItem) =>
          ki.titulo?.toLowerCase().includes(q) ||
          ki.resumen?.toLowerCase().includes(q) ||
          ki.tags?.some((t: string) => t.toLowerCase().includes(q))
        )
      : knowledgeItems;

    const map = new Map<string, KnowledgeItem[]>();
    filtered.forEach((ki: KnowledgeItem) => {
      const proj = deriveProject(ki);
      if (!map.has(proj)) map.set(proj, []);
      map.get(proj)!.push(ki);
    });

    // Ordenar: más KIs primero
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [knowledgeItems, kiSearchQuery]);

  const handleDelete = async (id: string) => {
    try {
      await window.antigravity.deleteKI(id);
      setSelectedKi(null);
      await refreshAll();
    } catch (e) { console.error(e); }
  };

  const totalKIs = knowledgeItems.length;
  const totalProjects = grouped.length;

  // ── resizable divider ──────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem("kb_leftWidth");
    return saved ? Number(saved) : 288;
  });
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const lastW = useRef(288);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      const newW = Math.min(520, Math.max(180, startW.current + delta));
      lastW.current = newW;
      setLeftWidth(newW);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      localStorage.setItem("kb_leftWidth", String(lastW.current));
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);


  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* ── LEFT PANEL: lista por proyectos ── */}
      <div className="flex flex-col shrink-0" style={{ width: leftWidth, borderRight: `1px solid ${PINK}15` }}>
        {/* stats bar */}
        <div className="px-4 py-2 flex items-center gap-3 border-b" style={{ borderColor: `${PINK}10` }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[18px] font-black" style={{ color: PINK, textShadow: `0 0 12px ${PINK}` }}>{totalKIs}</span>
            <span className="text-[9px] font-mono text-slate-600 tracking-widest">KIs</span>
          </div>
          <div className="w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-[18px] font-black text-slate-400">{totalProjects}</span>
            <span className="text-[9px] font-mono text-slate-600 tracking-widest">PROYECTOS</span>
          </div>
          <button
            onClick={refreshAll}
            className="ml-auto opacity-40 hover:opacity-100 transition-opacity"
            title="Refresh"
          >
            <Zap className="w-3.5 h-3.5" style={{ color: CYAN }} />
          </button>
        </div>

        {/* search */}
        <div className="px-3 py-2 border-b" style={{ borderColor: `${PINK}10` }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Search className="w-3 h-3 text-slate-600 shrink-0" />
            <input
              value={kiSearchQuery}
              onChange={e => setKiSearchQuery(e.target.value)}
              placeholder="buscar KIs..."
              className="flex-1 bg-transparent text-[11px] text-slate-300 placeholder-slate-700 outline-none font-mono"
            />
            {kiSearchQuery && (
              <button onClick={() => setKiSearchQuery('')}>
                <X className="w-3 h-3 text-slate-600 hover:text-slate-400 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* create button */}
        <div className="px-3 py-2 border-b" style={{ borderColor: `${PINK}10` }}>
          <CreateKIForm ctx={ctx} />
        </div>

        {/* groups list */}
        <ScrollArea className="flex-1 px-3 py-3">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
              <MiniCerebro color="#555" />
              <span className="text-[10px] font-mono text-slate-600 tracking-widest">
                {kiSearchQuery ? "SIN RESULTADOS" : "KNOWLEDGE VACÍO"}
              </span>
            </div>
          ) : (
            grouped.map(([project, items]) => (
              <ProjectGroup
                key={project}
                name={project}
                items={items}
                selectedKi={selectedKi}
                onSelect={setSelectedKi}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── DRAG HANDLE ── */}
      <div
        onMouseDown={onDragStart}
        className="w-1 shrink-0 cursor-col-resize group relative flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div
          className="absolute inset-y-0 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: `${PINK}60`, boxShadow: `0 0 6px ${PINK}` }}
        />
      </div>

      {/* ── RIGHT PANEL: detalle ── */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {selectedKi ? (
            <KIDetail
              key={selectedKi.id}
              ki={selectedKi}
              onClose={() => setSelectedKi(null)}
              onDelete={handleDelete}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-6"
            >
              {/* Brain SVG grande pulsando */}
              <motion.div
                animate={{
                  filter: [
                    "drop-shadow(0 0 10px #ff2d78) drop-shadow(0 0 30px #ff2d7840)",
                    "drop-shadow(0 0 25px #ff2d78) drop-shadow(0 0 60px #ff2d7860)",
                    "drop-shadow(0 0 10px #ff2d78) drop-shadow(0 0 30px #ff2d7840)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src={logoBrain} alt="Brain" width={90} height={90} style={{ objectFit: "contain" }} />
              </motion.div>
              <div className="text-center space-y-1">
                <div className="text-[11px] font-black tracking-widest" style={{ color: "#ff85b3" }}>
                  SELECCIONA UN KI
                </div>
                <div className="text-[9px] font-mono text-slate-700 tracking-widest">
                  {totalKIs} knowledge items · {totalProjects} proyectos
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
