/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Upload, FileText, Loader2, Sparkles, Check, X, Link2,
  Save, AlertTriangle, FileUp,
} from "lucide-react";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

export function TabIngesta({ ctx }: any) {
  // ── URL ──
  const [url, setUrl]           = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched]   = useState<any>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [structured, setStructured]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // ── Documentos ──
  const [dragOver, setDragOver] = useState(false);
  const [docBusy, setDocBusy]   = useState(false);
  const [docProg, setDocProg]   = useState<any>(null);

  // ── Resultados recientes ──
  const [results, setResults]   = useState<any[]>([]);

  useEffect(() => {
    if (!isElectron || !window.antigravity.onIngestProgress) return;
    return window.antigravity.onIngestProgress((d: any) => setDocProg(d));
  }, []);

  const addResult = (r: any) => setResults((prev) => [r, ...prev].slice(0, 20));

  // ── URL: traer ──
  const doFetch = async () => {
    if (!url.trim() || fetching) return;
    setFetching(true); setError(""); setFetched(null); setStructured("");
    try {
      const r = await window.antigravity.ingestFetch(url.trim());
      if (r?.ok) setFetched(r);
      else setError(r?.error || "no se pudo traer la URL");
    } catch (e: any) { setError(String(e?.message || e)); }
    setFetching(false);
  };

  const doSummarize = async () => {
    if (!fetched || summarizing) return;
    setSummarizing(true);
    try {
      const r = await window.antigravity.ingestSummarize({ markdown: fetched.markdown, title: fetched.title, sourceUrl: fetched.finalUrl });
      if (r?.ok) setStructured(r.structuredMarkdown || "");
      else setError(r?.error === "NO_KEY" ? "Configura tu key de OpenRouter para resumir." : (r?.error || "error al resumir"));
    } catch (e: any) { setError(String(e?.message || e)); }
    setSummarizing(false);
  };

  const doSaveUrl = async () => {
    if (!fetched || saving) return;
    setSaving(true);
    const content = structured || fetched.markdown;
    // título: del resumen (# ...) o del fetched
    const h = content.match(/^#\s+(.+)$/m);
    const title = (h ? h[1] : fetched.title).trim().slice(0, 80);
    try {
      const r = await window.antigravity.ingestSave({ title, summary: fetched.excerpt || "", content, sourceUrl: fetched.finalUrl });
      if (r?.ok) { addResult({ ok: true, kind: "url", title, id: r.id, source: fetched.finalUrl }); setFetched(null); setStructured(""); setUrl(""); ctx?.refreshAll?.(); }
      else setError(r?.error || "no se pudo guardar");
    } catch (e: any) { setError(String(e?.message || e)); }
    setSaving(false);
  };

  // ── Documentos ──
  const ingestPaths = async (paths: string[]) => {
    const clean = (paths || []).filter(Boolean);
    if (!clean.length) return;
    setDocBusy(true); setDocProg({ done: 0, total: clean.length });
    try {
      const r = await window.antigravity.ingestDocuments(clean);
      for (const res of (r?.results || [])) addResult({ ...res, kind: "doc", title: res.title || res.file });
      ctx?.refreshAll?.();
    } catch (e: any) { setError(String(e?.message || e)); }
    setDocBusy(false); setDocProg(null);
  };

  const pickFiles = async () => {
    try {
      const r = await window.antigravity.pickDocuments();
      if (!r?.canceled && r?.filePaths?.length) ingestPaths(r.filePaths);
    } catch (e: any) { setError(String(e?.message || e)); }
  };

  const onDrop = (e: any) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    const paths = files.map((f: any) => window.antigravity.resolveFilePath?.(f)).filter(Boolean);
    ingestPaths(paths);
  };

  if (!isElectron) return <div className="text-slate-500 text-sm p-8 text-center">La ingesta solo está disponible en la app de escritorio.</div>;

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5">
        <FileUp className="w-5 h-5 text-pink-400" />
        <h2 className="text-sm font-black tracking-widest text-slate-200 uppercase">Ingesta</h2>
        <span className="text-[10px] text-slate-600">— alimenta tu Brain desde internet y documentos</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-3 py-2 text-[11px] text-rose-300 flex items-center gap-2" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)" }}>
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Desde una URL ── */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,45,120,0.12)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="text-[11px] font-black tracking-widest text-slate-300 uppercase">Desde internet</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doFetch()}
              placeholder="https://articulo-que-quieres-guardar.com/…"
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500/40" />
          </div>
          <button onClick={doFetch} disabled={!url.trim() || fetching}
            className="px-4 py-2 rounded-lg text-[10px] font-black tracking-widest text-white disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#22d3ee,#a020f0)" }}>
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "TRAER"}
          </button>
        </div>

        {fetched && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
            <div className="text-xs font-bold text-white">{fetched.title}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{fetched.finalUrl} · {fetched.wordCount} palabras</div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg p-3 text-[11px] text-slate-400 whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {(structured || fetched.markdown).slice(0, 1200)}{(structured || fetched.markdown).length > 1200 ? "…" : ""}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={doSummarize} disabled={summarizing}
                className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {structured ? "Re-resumir con IA" : "Resumir con IA"}
              </button>
              <button onClick={doSaveUrl} disabled={saving}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black tracking-widest text-white disabled:opacity-40"
                style={{ background: "linear-gradient(90deg,#ff2d78,#a020f0)" }}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} GUARDAR EN BRAIN
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Documentos ── */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,45,120,0.12)" }}>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-pink-400" />
          <h3 className="text-[11px] font-black tracking-widest text-slate-300 uppercase">Subir documentos</h3>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={pickFiles}
          className="rounded-xl px-5 py-8 flex flex-col items-center justify-center cursor-pointer transition-all"
          style={{ border: `1.5px dashed ${dragOver ? "rgba(255,45,120,0.6)" : "rgba(255,255,255,0.12)"}`, background: dragOver ? "rgba(255,45,120,0.06)" : "transparent" }}>
          {docBusy ? (
            <>
              <Loader2 className="w-7 h-7 text-pink-400 animate-spin" />
              <div className="text-[10px] text-slate-400 mt-2 font-mono">{docProg ? `${docProg.done}/${docProg.total}` : "procesando…"}</div>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-slate-500" />
              <div className="text-[11px] text-slate-400 mt-2 font-bold">Arrastra aquí o haz clic para elegir</div>
              <div className="text-[9px] text-slate-600 mt-0.5">PDF · DOCX · TXT · MD</div>
            </>
          )}
        </div>
      </div>

      {/* ── Recientes ── */}
      {results.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-3">Ingerido en esta sesión</h3>
          <div className="flex flex-col gap-1.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                {r.ok ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                <span className={r.kind === "url" ? "text-cyan-400" : "text-pink-400"}>{r.kind === "url" ? "URL" : "DOC"}</span>
                <span className="text-slate-300 truncate flex-1">{r.title || r.file}</span>
                {r.ok ? <span className="text-[9px] text-slate-600 font-mono truncate max-w-[160px]">{r.id}</span> : <span className="text-[9px] text-rose-400">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TabIngesta;
