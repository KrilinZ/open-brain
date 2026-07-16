/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { FALLBACK_MODELS } from "@/types/config";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// Overlay de primer arranque (DMG vacío): pide la key de OpenRouter y el modelo.
// Se muestra solo si onboarding.completed !== true. Permite "Omitir".
export default function Onboarding({ onDone }: any) {
  const [key, setKey]       = useState("");
  const [model, setModel]   = useState("openai/gpt-4o-mini");
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const [saving, setSaving] = useState(false);

  const test = async () => {
    if (!key.trim()) return;
    setTesting(true); setTestRes(null);
    try { setTestRes(await window.antigravity.testOpenRouterKey(key.trim())); }
    catch (e) { setTestRes({ ok: false, error: String(e) }); }
    setTesting(false);
  };

  const finish = async (withKey: boolean) => {
    setSaving(true);
    try {
      const partial: any = { onboarding: { completed: true, completedAt: new Date().toISOString() } };
      if (withKey && key.trim()) partial.openrouter = { apiKey: key.trim(), model };
      else if (withKey) partial.openrouter = { model };
      await window.antigravity.saveConfig(partial);
    } catch (e) { console.error("onboarding save", e); }
    setSaving(false);
    onDone?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "rgba(6,4,12,0.86)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl p-7"
          style={{ background: "#12091f", border: "1px solid rgba(255,45,120,0.25)", boxShadow: "0 0 60px rgba(160,32,240,0.25)" }}
        >
          <div className="flex flex-col items-center text-center mb-5">
            <motion.div
              animate={{ filter: ["drop-shadow(0 0 8px rgba(255,45,120,0.5))", "drop-shadow(0 0 18px rgba(160,32,240,0.7))", "drop-shadow(0 0 8px rgba(255,45,120,0.5))"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Brain className="w-12 h-12 text-pink-400" />
            </motion.div>
            <h1 className="text-lg font-black text-slate-100 mt-3">Bienvenido a Open Brain</h1>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Tu segundo cerebro con IA. Conecta tu key de <span className="text-pink-400 font-bold">OpenRouter</span> para
              chatear con tu conocimiento. Se guarda cifrada en tu Keychain — nunca sale de tu Mac sin tu permiso.
            </p>
          </div>

          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">API Key de OpenRouter</label>
          <input
            type="password" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="sk-or-v1-…"
            className="w-full mt-1.5 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-slate-200 font-mono focus:border-pink-500/50 focus:outline-none"
          />

          <div className="flex items-center gap-3 mt-2 mb-4">
            <button onClick={test} disabled={testing || !key.trim()}
              className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-40">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Probar
            </button>
            {testRes && (
              <span className={`text-[10px] font-mono flex items-center gap-1 ${testRes.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {testRes.ok
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> OK · saldo ${Number(testRes.saldo).toFixed(2)}</>
                  : <><XCircle className="w-3.5 h-3.5" /> {testRes.error === "NO_KEY" ? "sin key" : testRes.error}</>}
              </span>
            )}
          </div>

          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Modelo por defecto</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full mt-1.5 mb-5 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:border-pink-500/50 focus:outline-none">
            {FALLBACK_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <div className="flex items-center gap-3">
            <button onClick={() => finish(false)} disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-widest text-slate-400 hover:text-slate-200 border border-white/10">
              OMITIR
            </button>
            <button onClick={() => finish(true)} disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-widest text-white flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(90deg,#ff2d78,#a020f0)" }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>EMPEZAR <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
