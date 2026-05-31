/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug, Search, RefreshCw, BookOpen, User, Zap, ChevronRight,
  Copy, CheckCheck, X, Plus, Loader2, Globe, Terminal, Brain
} from "lucide-react";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// ── Types ────────────────────────────────────────────────────────────────────
interface MCPServer {
  id: string;
  name: string;
  type: "stdio" | "http";
  status: "connected" | "error" | "unknown";
  command?: string;
  url?: string;
  kiCount?: number;
  description?: string;
}

interface KIItem {
  id: string;
  title: string;
  summary: string;
  createdAt?: string;
}

interface AIProfile {
  codingStyle?: { language?: string; framework?: string; conventions?: string };
  learnedPatterns?: string[];
  customInstructions?: string;
  autoLearn?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function truncate(s: string, n = 90) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Sub-components ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string; label: string }> = {
    connected: { color: "#22d3ee", label: "ONLINE" },
    error:     { color: "#f43f5e", label: "ERROR" },
    unknown:   { color: "#475569", label: "UNKNOWN" },
  };
  const s = map[status] ?? map.unknown;
  return (
    <span
      className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border"
      style={{ color: s.color, borderColor: s.color + "40", background: s.color + "12" }}
    >
      {s.label}
    </span>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 transition-colors"
    >
      {copied
        ? <CheckCheck className="w-3 h-3 text-emerald-400" />
        : <Copy className="w-3 h-3 text-slate-500" />}
    </button>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export function TabMCP({ ctx }: { ctx: any }) {
  const [servers, setServers]         = useState<MCPServer[]>([]);
  const [kis, setKis]                 = useState<KIItem[]>([]);
  const [profile, setProfile]         = useState<AIProfile | null>(null);
  const [search, setSearch]           = useState("");
  const [selectedKi, setSelectedKi]   = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<"servers" | "brain" | "profile">("servers");
  const [loading, setLoading]         = useState(false);
  const [kiLoading, setKiLoading]     = useState(false);
  const [newKiOpen, setNewKiOpen]     = useState(false);
  const [newKiTitle, setNewKiTitle]   = useState("");
  const [newKiSummary, setNewKiSummary] = useState("");
  const [newKiContent, setNewKiContent] = useState("");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ── Load servers ────────────────────────────────────────────────────────
  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data: MCPServer[] = isElectron
        ? await window.antigravity.mcpListServers()
        : MOCK_SERVERS;
      setServers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load KIs ────────────────────────────────────────────────────────────
  const loadKIs = useCallback(async (q = "") => {
    setKiLoading(true);
    try {
      const data: KIItem[] = isElectron
        ? await window.antigravity.mcpSearchKI(q)
        : MOCK_KIS;
      setKis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setKiLoading(false);
    }
  }, []);

  // ── Load profile ─────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const data: AIProfile = isElectron
        ? await window.antigravity.mcpGetProfile()
        : MOCK_PROFILE;
      setProfile(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ── Open KI detail ────────────────────────────────────────────────────────
  const openKI = useCallback(async (ki: KIItem) => {
    try {
      const detail = isElectron
        ? await window.antigravity.mcpReadKI(ki.id)
        : { ...ki, content: "Mock content for " + ki.title };
      setSelectedKi(detail);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ── Create KI ─────────────────────────────────────────────────────────────
  const createKI = useCallback(async () => {
    if (!newKiTitle.trim() || !newKiContent.trim()) return;
    setSaving(true);
    try {
      await (isElectron
        ? window.antigravity.mcpCreateKI({ title: newKiTitle, summary: newKiSummary, content: newKiContent })
        : Promise.resolve());
      setNewKiTitle(""); setNewKiSummary(""); setNewKiContent("");
      setNewKiOpen(false);
      showToast("✓ KI creado en Antigravity Brain");
      loadKIs(search);
    } catch (e) {
      showToast("✗ Error creando KI");
    } finally {
      setSaving(false);
    }
  }, [newKiTitle, newKiSummary, newKiContent, search, loadKIs]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadServers(); loadKIs(""); loadProfile(); }, []);

  useEffect(() => {
    const t = setTimeout(() => loadKIs(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Section nav ────────────────────────────────────────────────────────────
  const SECTIONS = [
    { id: "servers" as const, label: "SERVIDORES MCP", Icon: Plug },
    { id: "brain"   as const, label: "BRAIN (KIs)",    Icon: Brain },
    { id: "profile" as const, label: "AI PROFILE",     Icon: User },
  ];

  return (
    <div className="flex flex-col h-full gap-4">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: "#1e0a2e", border: "1px solid rgba(255,45,120,0.4)", color: "#f472b6" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section nav */}
      <div className="flex gap-1 shrink-0">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${
              activeSection === id
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => { loadServers(); loadKIs(search); loadProfile(); }}
          className="p-1.5 rounded-lg border border-white/5 text-slate-500 hover:text-pink-400 hover:border-pink-500/30 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* ── SECTION: SERVERS ─────────────────────────────────────────────── */}
      {activeSection === "servers" && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
            </div>
          ) : servers.map((srv) => (
            <motion.div
              key={srv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 border transition-all"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,45,120,0.15)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.2)" }}>
                    {srv.type === "http" ? <Globe className="w-4 h-4 text-pink-400" /> : <Terminal className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white tracking-wide">{srv.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{srv.description}</div>
                  </div>
                </div>
                <StatusBadge status={srv.status} />
              </div>

              {/* Details */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {srv.command && (
                  <div className="col-span-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">CMD</span>
                    <span className="text-[9px] text-cyan-300 font-mono truncate flex-1">{srv.command}</span>
                    <CopyButton text={srv.command} />
                  </div>
                )}
                {srv.url && (
                  <div className="col-span-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">URL</span>
                    <span className="text-[9px] text-cyan-300 font-mono truncate flex-1">{srv.url}</span>
                    <CopyButton text={srv.url} />
                  </div>
                )}
                {srv.kiCount !== undefined && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <BookOpen className="w-3 h-3 text-pink-400" />
                    <span className="text-[9px] text-slate-300 font-mono">{srv.kiCount} KIs</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── SECTION: BRAIN KIs ───────────────────────────────────────────── */}
      {activeSection === "brain" && (
        <div className="flex flex-col gap-3 min-h-0">
          {/* Search + New KI */}
          <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar KIs en Antigravity Brain…"
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
              />
            </div>
            <button
              onClick={() => setNewKiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.3)", color: "#f472b6" }}
            >
              <Plus className="w-3.5 h-3.5" /> NUEVO
            </button>
          </div>

          {/* KI List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1" style={{ maxHeight: "420px" }}>
            {kiLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
              </div>
            ) : kis.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs">No se encontraron KIs</div>
            ) : kis.map((ki) => (
              <motion.button
                key={ki.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => openKI(ki)}
                className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all group"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                whileHover={{ borderColor: "rgba(255,45,120,0.3)", background: "rgba(255,45,120,0.05)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{ki.title}</div>
                  {ki.summary && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{ki.summary}</div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-pink-400 transition-colors shrink-0" />
              </motion.button>
            ))}
          </div>

          {/* KI count */}
          <div className="text-[9px] text-slate-600 text-center shrink-0">
            {kis.length} KIs {search ? `para "${search}"` : "totales"} · ~/.gemini/antigravity/knowledge/
          </div>
        </div>
      )}

      {/* ── SECTION: AI PROFILE ──────────────────────────────────────────── */}
      {activeSection === "profile" && profile && (
        <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "500px" }}>
          {/* Coding Style */}
          {profile.codingStyle && (
            <div className="rounded-xl p-4 border"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,45,120,0.15)" }}>
              <div className="text-[9px] font-black text-pink-400 tracking-widest mb-3">CODING STYLE</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(profile.codingStyle).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="px-3 py-2 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="text-[8px] text-slate-500 uppercase tracking-widest">{k}</div>
                    <div className="text-[10px] text-cyan-300 mt-0.5 font-mono">{v as string}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto Learn */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,45,120,0.15)" }}>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-white">Auto Learn</span>
            </div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
              profile.autoLearn ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
            }`}>
              {profile.autoLearn ? "ACTIVO" : "INACTIVO"}
            </span>
          </div>

          {/* Learned Patterns */}
          {profile.learnedPatterns && profile.learnedPatterns.length > 0 && (
            <div className="rounded-xl p-4 border"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,45,120,0.15)" }}>
              <div className="text-[9px] font-black text-pink-400 tracking-widest mb-3">
                LEARNED PATTERNS ({profile.learnedPatterns.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {profile.learnedPatterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[9px] text-pink-500 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[10px] text-slate-300">{truncate(p, 120)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Instructions */}
          {profile.customInstructions && (
            <div className="rounded-xl p-4 border"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,45,120,0.15)" }}>
              <div className="text-[9px] font-black text-pink-400 tracking-widest mb-2">CUSTOM INSTRUCTIONS</div>
              <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                {profile.customInstructions.slice(0, 400)}{profile.customInstructions.length > 400 ? "…" : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: KI Detail ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedKi && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setSelectedKi(null)}
          >
            <motion.div
              className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl"
              style={{ background: "#120820", border: "1px solid rgba(255,45,120,0.3)" }}
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div>
                  <div className="text-sm font-black text-white">{selectedKi.title}</div>
                  {selectedKi.summary && (
                    <div className="text-[10px] text-slate-500 mt-0.5">{selectedKi.summary}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={selectedKi.content || ""} />
                  <button onClick={() => setSelectedKi(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <pre className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {selectedKi.content || "(sin contenido)"}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: New KI ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {newKiOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setNewKiOpen(false)}
          >
            <motion.div
              className="w-full max-w-md flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "#120820", border: "1px solid rgba(255,45,120,0.3)" }}
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="text-sm font-black text-white">NUEVO KI</span>
                <button onClick={() => setNewKiOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
              <div className="flex flex-col gap-3 p-5">
                <input
                  value={newKiTitle} onChange={(e) => setNewKiTitle(e.target.value)}
                  placeholder="Título *"
                  className="w-full px-4 py-2.5 text-xs rounded-xl outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <input
                  value={newKiSummary} onChange={(e) => setNewKiSummary(e.target.value)}
                  placeholder="Resumen (opcional)"
                  className="w-full px-4 py-2.5 text-xs rounded-xl outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <textarea
                  value={newKiContent} onChange={(e) => setNewKiContent(e.target.value)}
                  placeholder="Contenido (markdown) *"
                  rows={6}
                  className="w-full px-4 py-2.5 text-xs rounded-xl outline-none resize-none font-mono"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <button
                  onClick={createKI}
                  disabled={saving || !newKiTitle.trim() || !newKiContent.trim()}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
                  style={{ background: "rgba(255,45,120,0.2)", border: "1px solid rgba(255,45,120,0.4)", color: "#f472b6" }}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {saving ? "GUARDANDO…" : "CREAR KI"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Mock data (dev fallback) ──────────────────────────────────────────────────
const MOCK_SERVERS: MCPServer[] = [
  {
    id: "brain",
    name: "CLI-QUE Brain",
    type: "stdio",
    status: "connected",
    command: "/Users/nacho/Desktop/PROYECTOS/CLI-QUE/backend/.venv/bin/python mcp_brain_server.py",
    description: "Knowledge base de CLI-QUE · Antigravity",
    kiCount: 271,
  },
  {
    id: "4geekswebsite",
    name: "4Geeks Website",
    type: "http",
    status: "connected",
    url: "https://4geeksacademy.com/mcp",
    description: "CMS MCP · YAML pages, programs, landings",
  },
];

const MOCK_KIS: KIItem[] = [
  { id: "mock-1", title: "OpenBrain Architecture", summary: "Electron + React 19 + Tailwind v4" },
  { id: "mock-2", title: "CLI-QUE Brain MCP", summary: "MCP server for knowledge base" },
];

const MOCK_PROFILE: AIProfile = {
  codingStyle: { language: "TypeScript", framework: "Next.js + Express", conventions: "Clean Code, SOLID" },
  autoLearn: true,
  learnedPatterns: ["RAG architecture", "Agentic loops", "Prompt engineering"],
  customInstructions: "SISTEMA AUTO-READ BRAIN CON HAIKU…",
};
