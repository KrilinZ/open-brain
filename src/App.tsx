/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import logoBrain from "./assets/logo-brain.png";
import { motion } from "framer-motion";
import type { KnowledgeItem, ApiConfig, ServerConfig } from "@/types/antigravity";
import { TabConocimiento } from "./components/tabs/TabConocimiento";
import { TabApis } from "./components/tabs/TabApis";
import { TabServidores } from "./components/tabs/TabServidores";
import { TabMCP } from "./components/tabs/TabMCP";
import { TabConfig } from "./components/tabs/TabConfig";
import { TabBrainChat } from "./components/tabs/TabBrainChat";
import { TabIngesta } from "./components/tabs/TabIngesta";
import Onboarding from "./components/Onboarding";
import { Brain, Key, Server, Plug, Wifi, WifiOff, Settings, MessageSquare, FileUp } from "lucide-react";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// ── Status dot (header) ──────────────────────────────────────────────────
const STATUS_COLOR: Record<string, { dot: string; glow: string }> = {
  OK:      { dot: "#22d3ee", glow: "rgba(34,211,238,0.4)" },
  ERROR:   { dot: "#f43f5e", glow: "rgba(244,63,94,0.4)"  },
  UNKNOWN: { dot: "#475569", glow: "rgba(71,85,105,0.2)" },
  SYNCING: { dot: "#f59e0b", glow: "rgba(245,158,11,0.4)" },
};

const StatusDot = ({ status, label }: { status: string; label: string }) => {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.UNKNOWN;
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${status}`}>
      <motion.span
        className="w-1.5 h-1.5 rounded-full block"
        style={{ background: c.dot, boxShadow: `0 0 5px ${c.glow}` }}
        animate={status === "OK" ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-[8px] font-black tracking-widest uppercase" style={{ color: c.dot, fontFamily: "monospace" }}>
        {label}
      </span>
    </div>
  );
};

// ── Helpers de ping (lightweight, en renderer) ───────────────────────────
async function pingOllama(): Promise<"OK" | "ERROR"> {
  try {
    const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    return r.ok ? "OK" : "ERROR";
  } catch { return "ERROR"; }
}

// ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [activeTab, setActiveTab]           = useState<"brain"|"chat"|"ingesta"|"apis"|"servers"|"mcp"|"config">("brain");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [kiSearchQuery, setKiSearchQuery]   = useState("");
  const [selectedKi, setSelectedKi]         = useState<KnowledgeItem | null>(null);
  const [newKiTitle, setNewKiTitle]         = useState("");
  const [newKiSummary, setNewKiSummary]     = useState("");
  const [newKiContent, setNewKiContent]     = useState("");
  const [isCreatingKi, setIsCreatingKi]     = useState(false);

  // ── Servidores y APIs ──
  const [apis, setApis]                     = useState<ApiConfig[]>([]);
  const [servers, setServers]               = useState<ServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, any>>({});

  // ── Status de header ──
  const [ollamaStatus, setOllamaStatus]     = useState<"OK"|"ERROR"|"UNKNOWN">("UNKNOWN");

  // ── Cargar KIs ──
  const refreshAll = useCallback(async () => {
    try {
      if (isElectron) {
        const items = await window.antigravity.getKnowledge();
        if (Array.isArray(items)) setKnowledgeItems(items);
      }
    } catch (e) {
      console.error("Error loading KIs:", e);
    }
  }, []);

  // ── Cargar servidores y APIs ──
  const refreshServersApis = useCallback(async () => {
    if (!isElectron) return;
    try {
      const [srvs, aps] = await Promise.all([
        window.antigravity.getServers?.() ?? [],
        window.antigravity.getApis?.()    ?? [],
      ]);
      if (Array.isArray(srvs)) setServers(srvs);
      if (Array.isArray(aps))  setApis(aps);
    } catch (e) {
      console.error("Error loading servers/apis:", e);
    }
  }, []);

  // ── Load server statuses from backend cache ──
  const refreshServerStatuses = useCallback(async () => {
    if (!isElectron) return;
    try {
      const statuses = await window.antigravity.getServerStatuses?.();
      if (statuses) setServerStatuses(statuses);
    } catch (e) {
      console.error("Error loading server statuses:", e);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { refreshServersApis(); }, [refreshServersApis]);
  useEffect(() => { refreshServerStatuses(); }, [refreshServerStatuses]);

  // ── Listen to heartbeat pushes from Electron main ──
  useEffect(() => {
    if (!isElectron || !window.antigravity.onServerStatuses) return;
    const unsub = window.antigravity.onServerStatuses((statuses) => {
      setServerStatuses(statuses);
    });
    return unsub;
  }, []);

  // ── Ping Ollama (lightweight, 30s interval) ──
  useEffect(() => {
    pingOllama().then(setOllamaStatus);
    const iv = setInterval(() => pingOllama().then(setOllamaStatus), 30_000);
    return () => clearInterval(iv);
  }, []);

  // ── Primer arranque: mostrar onboarding si no está completado (DMG vacío) ──
  useEffect(() => {
    if (!isElectron || !window.antigravity.getConfig) return;
    window.antigravity.getConfig()
      .then((c) => { if (c && c.onboarding && c.onboarding.completed !== true) setShowOnboarding(true); })
      .catch(() => {});
  }, []);

  const ctx = {
    knowledgeItems,
    kiSearchQuery, setKiSearchQuery,
    selectedKi, setSelectedKi,
    newKiTitle, setNewKiTitle,
    newKiSummary, setNewKiSummary,
    newKiContent, setNewKiContent,
    isCreatingKi, setIsCreatingKi,
    refreshAll,
    servers, setServers,
    apis, setApis,
    serverStatuses,
  };

  // ── Derived status counts ──
  const onlineServers = Object.values(serverStatuses).filter((s: any) => s.ok).length;
  const totalServers = servers.length;
  const okApis = apis.filter(a => a.status === 'OK').length;

  const TABS = [
    { id: "brain"   as const, label: "BRAIN",      Icon: Brain,  badge: knowledgeItems.length },
    { id: "chat"    as const, label: "CHAT",        Icon: MessageSquare, badge: 0 },
    { id: "ingesta" as const, label: "INGESTA",     Icon: FileUp, badge: 0 },
    { id: "apis"    as const, label: "APIs",        Icon: Key,    badge: apis.length },
    { id: "servers" as const, label: "SERVIDORES",  Icon: Server, badge: totalServers },
    { id: "mcp"     as const, label: "MCP",         Icon: Plug,   badge: 0 },
    { id: "config"  as const, label: "AJUSTES",     Icon: Settings, badge: 0 },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: "#0f0a1a" }}>

      {/* Fondo gradiente */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 70% 50% at 10% 0%, rgba(255,45,120,0.10) 0%, transparent 60%),
          radial-gradient(ellipse 50% 70% at 90% 100%, rgba(160,32,240,0.08) 0%, transparent 60%)
        `
      }} />

      {/* ── HEADER ── */}
      <div
        className="drag-region flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,45,120,0.15)", paddingTop: "env(titlebar-area-top, 12px)" }}
      >
        {/* Izquierda: logo + título */}
        <div className="flex items-center gap-3 no-drag">
          <motion.div
            animate={{ filter: ["drop-shadow(0 0 6px rgba(255,45,120,0.4))", "drop-shadow(0 0 12px rgba(255,45,120,0.7))", "drop-shadow(0 0 6px rgba(255,45,120,0.4))"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <img src={logoBrain} alt="Brain" width={40} height={40} style={{ objectFit: "contain" }} />
          </motion.div>
          <div>
            <div className="font-black text-lg leading-none tracking-tight" style={{
              fontFamily: "Inter, sans-serif",
              background: "linear-gradient(90deg, #ff2d78 0%, #a020f0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Open Brain
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest mt-0.5">
              {knowledgeItems.length} KIs · {totalServers} srv · {apis.length} apis
            </div>
          </div>
        </div>

        {/* Derecha: indicadores de status */}
        <div className="no-drag flex items-center gap-3">
          {/* Ollama local */}
          <StatusDot status={ollamaStatus} label="Ollama" />

          {/* Servers (aggregated) */}
          {totalServers > 0 && (
            <div className="flex items-center gap-1 text-[8px] font-mono">
              {onlineServers > 0 ? (
                <StatusDot status="OK" label={`${onlineServers}/${totalServers} SRV`} />
              ) : (
                <StatusDot status="ERROR" label={`0/${totalServers} SRV`} />
              )}
            </div>
          )}

          {/* APIs (aggregated) */}
          {apis.length > 0 && (
            <StatusDot status={okApis > 0 ? "OK" : "UNKNOWN"} label={`${okApis}/${apis.length} API`} />
          )}

          {/* Separador */}
          <div className="w-px h-4 bg-white/10" />

          {/* LIVE dot */}
          <motion.div
            className="flex items-center gap-1.5 text-[9px] font-black tracking-widest"
            style={{ color: "#ff85b3", fontFamily: "Inter, sans-serif" }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            LIVE
          </motion.div>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div className="flex gap-0.5 px-4 pt-1.5 border-b border-white/5 shrink-0 no-drag">
        {TABS.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`group flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all border-b-2 ${
              activeTab === id
                ? "border-pink-500 text-pink-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${activeTab === id ? 'text-pink-400' : 'text-slate-600 group-hover:text-slate-400'} transition-colors`} />
            {label}
            {badge > 0 && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === id ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-slate-600'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-hidden overflow-y-auto p-5">
        {activeTab === "brain"   && <TabConocimiento ctx={ctx} />}
        {activeTab === "chat"    && <TabBrainChat     ctx={ctx} />}
        {activeTab === "ingesta" && <TabIngesta       ctx={ctx} />}
        {activeTab === "apis"    && <TabApis         ctx={ctx} />}
        {activeTab === "servers" && <TabServidores   ctx={ctx} />}
        {activeTab === "mcp"     && <TabMCP           ctx={ctx} />}
        {activeTab === "config"  && <TabConfig        ctx={ctx} />}
      </div>

      {/* ── Onboarding (primer arranque) ── */}
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}
