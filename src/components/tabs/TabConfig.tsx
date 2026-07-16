/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, Key, Eye, EyeOff, Zap, Loader2, CheckCircle2, XCircle,
  FolderOpen, ShieldCheck, ShieldAlert, Cpu, DollarSign, Lock,
  Sparkles, RefreshCw,
} from "lucide-react";
import { FALLBACK_MODELS } from "@/types/config";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// ── Sub-componentes ──────────────────────────────────────────────────────────
const Toggle = ({ on, onChange, label, hint }: any) => (
  <button
    onClick={() => onChange(!on)}
    className="flex items-center justify-between w-full py-2.5 group"
  >
    <div className="text-left">
      <div className="text-[11px] font-bold text-slate-200">{label}</div>
      {hint && <div className="text-[9px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
    <span
      className="relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3"
      style={{ background: on ? "linear-gradient(90deg,#ff2d78,#a020f0)" : "rgba(255,255,255,0.08)" }}
    >
      <motion.span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
        animate={{ left: on ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </span>
  </button>
);

const Section = ({ icon: Icon, title, children }: any) => (
  <div
    className="rounded-2xl p-5 mb-4"
    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,45,120,0.12)" }}
  >
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-pink-400" />
      <h3 className="text-[11px] font-black tracking-widest text-slate-300 uppercase">{title}</h3>
    </div>
    {children}
  </div>
);

// ── Componente principal ─────────────────────────────────────────────────────
export function TabConfig({ ctx }: any) {
  const [cfg, setCfg]           = useState(null);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [models, setModels]     = useState(FALLBACK_MODELS);
  const [testing, setTesting]   = useState(false);
  const [testRes, setTestRes]   = useState<{ ok: boolean; saldo?: number; error?: string } | null>(null);
  const [saving, setSaving]     = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [idx, setIdx]           = useState<any>(null);
  const [reindexing, setReindexing] = useState(false);
  const [idxProg, setIdxProg]   = useState<any>(null);

  const load = useCallback(async () => {
    if (!isElectron) return;
    try {
      const c = await window.antigravity.getConfig();
      setCfg(c);
      // intenta modelos en vivo si hay key
      if (c?.openrouter?.hasKey && window.antigravity.getOpenRouterModels) {
        const r = await window.antigravity.getOpenRouterModels();
        if (r?.ok && Array.isArray(r.models) && r.models.length) {
          setModels(r.models.map((m: any) => ({ id: m.id, name: m.name || m.id })));
        }
      }
    } catch (e) { console.error("getConfig error", e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadIdx = useCallback(async () => {
    if (!isElectron || !window.antigravity.ragIndexStatus) return;
    try { setIdx(await window.antigravity.ragIndexStatus()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { loadIdx(); }, [loadIdx]);
  useEffect(() => {
    if (!isElectron || !window.antigravity.onRagIndexProgress) return;
    return window.antigravity.onRagIndexProgress((d: any) => setIdxProg(d));
  }, []);

  const reindex = async () => {
    setReindexing(true); setIdxProg(null);
    try { await window.antigravity.ragReindex({ force: false }); }
    catch (e) { console.error(e); }
    setReindexing(false); setIdxProg(null); loadIdx();
  };

  const patch = (partial: any) => setCfg((prev: any) => ({ ...prev, ...partial }));

  const save = async (partial: any) => {
    if (!isElectron) return;
    setSaving(true);
    try {
      const updated = await window.antigravity.saveConfig(partial);
      setCfg(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) { console.error("saveConfig error", e); }
    setSaving(false);
  };

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    await save({ openrouter: { apiKey: keyInput.trim() } });
    setKeyInput("");
    setRevealed(false);
    setTestRes(null);
    load();
  };

  const reveal = async () => {
    if (revealed) { setRevealed(false); setKeyInput(""); return; }
    try {
      const r = await window.antigravity.revealConfigKey();
      setKeyInput(r?.apiKey || "");
      setRevealed(true);
      setShowKey(true);
    } catch (e) { console.error(e); }
  };

  const testKey = async () => {
    setTesting(true); setTestRes(null);
    try {
      const r = await window.antigravity.testOpenRouterKey(keyInput.trim() || undefined);
      setTestRes(r);
    } catch (e) { setTestRes({ ok: false, error: String(e) }); }
    setTesting(false);
  };

  if (!isElectron) {
    return <div className="text-slate-500 text-sm p-8 text-center">Los ajustes solo están disponibles en la app de escritorio.</div>;
  }
  if (!cfg) {
    return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando ajustes…</div>;
  }

  const or = cfg.openrouter || {};
  const enc = cfg.flags?.keyEncryption;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-pink-400" />
          <h2 className="text-sm font-black tracking-widest text-slate-200 uppercase">Ajustes</h2>
        </div>
        {savedFlash && (
          <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
          </motion.span>
        )}
      </div>

      {/* ── OpenRouter ── */}
      <Section icon={Key} title="OpenRouter · Motor de chat">
        {/* Estado de la key */}
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
          {or.hasKey ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Key configurada
              <span className="text-slate-500">{or.apiKeyMasked}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" /> Sin key — el chat no funcionará hasta configurarla
            </span>
          )}
        </div>

        {/* Input de key */}
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={or.hasKey ? "Introduce una nueva key para reemplazar…" : "sk-or-v1-…"}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-pink-500/50 focus:outline-none pr-9"
            />
            <button onClick={() => setShowKey(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={saveKey} disabled={!keyInput.trim() || saving}
            className="px-4 py-2 rounded-lg text-[10px] font-black tracking-widest text-white disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#ff2d78,#a020f0)" }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "GUARDAR"}
          </button>
        </div>

        {/* Acciones: probar + revelar */}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={testKey} disabled={testing}
            className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Probar conexión
          </button>
          {or.hasKey && (
            <button onClick={reveal} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300">
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {revealed ? "Ocultar key" : "Editar key actual"}
            </button>
          )}
          {testRes && (
            <span className={`text-[10px] font-mono flex items-center gap-1 ${testRes.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testRes.ok
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> OK · saldo ${Number(testRes.saldo).toFixed(2)}</>
                : <><XCircle className="w-3.5 h-3.5" /> {testRes.error === "NO_KEY" ? "sin key" : testRes.error}</>}
            </span>
          )}
        </div>

        {/* Modelo por defecto */}
        <div className="mt-4">
          <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3.5 h-3.5" /> Modelo por defecto
          </label>
          <select
            value={or.model}
            onChange={(e) => save({ openrouter: { model: e.target.value } })}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 focus:outline-none"
          >
            {models.some((m: any) => m.id === or.model) ? null : <option value={or.model}>{or.model}</option>}
            {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </Section>

      {/* ── Coste ── */}
      <Section icon={DollarSign} title="Coste">
        <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Tope de gasto por sesión (USD)</label>
        <input type="number" min={0} step={0.5}
          value={cfg.brain?.maxSpendPerSessionUsd ?? 1}
          onChange={(e) => patch({ brain: { ...cfg.brain, maxSpendPerSessionUsd: parseFloat(e.target.value) || 0 } })}
          onBlur={(e) => save({ brain: { maxSpendPerSessionUsd: parseFloat(e.target.value) || 0 } })}
          className="w-32 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-pink-500/50 focus:outline-none"
        />
      </Section>

      {/* ── Privacidad ── */}
      <Section icon={Lock} title="Privacidad — qué sale a la nube">
        <Toggle label="Solo local" hint="Bloquea el envío de cualquier dato a OpenRouter (RAG local únicamente)"
          on={cfg.brain?.privacy?.localOnly}
          onChange={(v) => save({ brain: { privacy: { ...cfg.brain.privacy, localOnly: v } } })} />
        <Toggle label="Enviar contexto de KIs" hint="Incluye fragmentos de tus KIs en el prompt al LLM"
          on={cfg.brain?.privacy?.sendKiContext}
          onChange={(v) => save({ brain: { privacy: { ...cfg.brain.privacy, sendKiContext: v } } })} />
        <Toggle label="Redactar secretos salientes" hint="Enmascara keys/tokens/emails antes de enviarlos (recomendado)"
          on={cfg.brain?.privacy?.redactOutbound}
          onChange={(v) => save({ brain: { privacy: { ...cfg.brain.privacy, redactOutbound: v } } })} />
      </Section>

      {/* ── Sistema ── */}
      <Section icon={Cpu} title="Sistema">
        <Toggle label="Embeddings solo locales" hint="El RAG usa un modelo de embeddings offline (privado)"
          on={cfg.flags?.onlyLocalEmbeddings}
          onChange={(v) => save({ flags: { onlyLocalEmbeddings: v } })} />
        <Toggle label="Abrir al iniciar sesión"
          on={cfg.flags?.launchAtLogin}
          onChange={(v) => save({ flags: { launchAtLogin: v } })} />
      </Section>

      {/* ── Búsqueda semántica ── */}
      <Section icon={Sparkles} title="Búsqueda semántica (local)">
        {idx && !idx.embedderAvailable && (
          <div className="text-[10px] text-amber-400 mb-3 leading-relaxed">
            Motor de embeddings no instalado. Ejecuta <code className="text-pink-300">npm i @xenova/transformers</code> y reinicia la app para activar la búsqueda por significado.
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-mono text-slate-500">
            {idx
              ? (idx.ready
                  ? `${idx.count} vectores · ${idx.kis} KIs · ${(idx.model || "").split("/").pop() || ""}`
                  : "índice vacío — usando búsqueda léxica")
              : "…"}
          </div>
          <button onClick={reindex} disabled={reindexing || (idx && !idx.embedderAvailable)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest text-white disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#ff2d78,#a020f0)" }}>
            {reindexing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {reindexing ? "INDEXANDO…" : "REINDEXAR"}
          </button>
        </div>
        {reindexing && idxProg && idxProg.total > 0 && (
          <div className="mt-3">
            <div className="text-[9px] text-slate-500 font-mono mb-1">{idxProg.done}/{idxProg.total} KIs · {idxProg.embedded} embebidos</div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.round((idxProg.done / idxProg.total) * 100)}%`, background: "linear-gradient(90deg,#ff2d78,#a020f0)" }} />
            </div>
          </div>
        )}
      </Section>

      {/* ── Rutas + seguridad ── */}
      <Section icon={FolderOpen} title="Almacén">
        <div className="text-[10px] font-mono text-slate-500 space-y-1 mb-3">
          <div>base: <span className="text-slate-300">{cfg.paths?.base}</span></div>
          <div>knowledge: <span className="text-slate-300">{cfg.paths?.knowledge}</span></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.antigravity.openVault?.()}
            className="flex items-center gap-1.5 text-[10px] font-bold text-pink-400 hover:text-pink-300">
            <FolderOpen className="w-3.5 h-3.5" /> Abrir en Finder
          </button>
          <span className={`flex items-center gap-1.5 text-[10px] font-mono ${enc ? "text-emerald-400" : "text-amber-400"}`}>
            {enc ? <><ShieldCheck className="w-3.5 h-3.5" /> Keys cifradas en Keychain</> : <><ShieldAlert className="w-3.5 h-3.5" /> Cifrado no disponible — keys en claro</>}
          </span>
        </div>
      </Section>
    </div>
  );
}

export default TabConfig;
