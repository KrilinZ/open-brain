/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Key, Plus, Trash2, RefreshCw, X, Edit3, DollarSign, Zap, Globe, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// ── API Form ─────────────────────────────────────────────────────────────
const EMPTY_API = {
  id: '', nombre: '', tipo: 'llm', apiKey: '', saldo: 0,
  limiteAlerta: 0, color: 'text-cyan-400', proyectos: [], notas: [], url: '',
};

const API_TYPES = [
  { value: 'llm',   label: 'LLM (AI Model)',     icon: Zap },
  { value: 'proxy', label: 'Proxy / Scraping',    icon: Globe },
  { value: 'cloud', label: 'Cloud / SaaS',        icon: DollarSign },
];

function ApiForm({ api, onSave, onCancel }: { api: any; onSave: (a: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...api });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="rounded-xl border border-pink-500/30 bg-black/60 p-5 space-y-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black tracking-widest text-pink-400">
          {api.id ? 'EDITAR API' : 'NUEVA API'}
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Nombre</label>
          <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="OpenRouter, Anthropic..."
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Tipo</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-pink-500/50 focus:outline-none transition-colors">
            {API_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">API Key</label>
        <input value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder="sk-..."
          type="password"
          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Saldo Inicial ($)</label>
          <input value={form.saldo} onChange={e => set('saldo', parseFloat(e.target.value) || 0)} type="number" step="0.01"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-mono focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Alerta En ($)</label>
          <input value={form.limiteAlerta} onChange={e => set('limiteAlerta', parseFloat(e.target.value) || 0)} type="number" step="0.01"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-mono focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-colors">
          CANCELAR
        </button>
        <button
          onClick={() => {
            const id = form.id || `api-${Date.now()}`;
            onSave({ ...form, id, status: form.status || 'UNKNOWN' });
          }}
          disabled={!form.nombre.trim() || !form.apiKey.trim()}
          className="px-4 py-1.5 text-[10px] font-black tracking-widest bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-md hover:bg-pink-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          GUARDAR
        </button>
      </div>
    </motion.div>
  );
}

// ── API Card ─────────────────────────────────────────────────────────────
function ApiCard({ api, onEdit, onDelete }: { api: any; onEdit: () => void; onDelete: () => void }) {
  // Determine display values based on API type or name
  const isTraffic = api.nombre?.includes('Data Impulse') || api.nombre?.includes('DataImpulse');
  const isGemini = api.nombre?.includes('Gemini') || api.nombre?.includes('Antigravity');
  const isGoogle = api.nombre?.includes('Google API');

  let unit = isTraffic ? ' GB' : '$';
  let label = isTraffic ? 'TRAFFIC' : 'QUOTA';
  let displayValue = `${(api.saldo ?? 0).toFixed(2)}${unit}`;
  let warnValue = `${api.limiteAlerta ?? 0}${unit}`;

  if (isGemini) {
    label = 'TOKENS'; displayValue = 'FREE_TIER'; warnValue = 'UNLIMITED';
  } else if (isGoogle) {
    label = 'CLOUD_LIMIT'; displayValue = 'PREMIUM'; warnValue = 'ACTIVE';
  }

  const isLow = !isGemini && !isGoogle && api.saldo < api.limiteAlerta && api.limiteAlerta > 0;

  const statusColor = api.status === 'OK'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
    : api.status === 'ERROR'
    ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
    : 'bg-slate-500/10 text-slate-500 border-slate-500/20';

  const statusLabel = api.status === 'OK' ? 'CONNECTED' : api.status === 'ERROR' ? 'ERROR' : 'UNKNOWN';

  const TypeIcon = API_TYPES.find(t => t.value === api.tipo)?.icon || Key;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl border overflow-hidden flex flex-col transition-all duration-300 ${
        isLow ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/10 to-black/40' :
        api.status === 'OK' ? 'border-emerald-500/15 bg-gradient-to-br from-emerald-950/10 to-black/40' :
        api.status === 'ERROR' ? 'border-red-500/15 bg-gradient-to-br from-red-950/10 to-black/40' :
        'border-white/10 bg-black/40'
      }`}
    >
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${api.status === 'OK' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
              <TypeIcon className={`w-4 h-4 ${api.status === 'OK' ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
            <div className="font-black text-[11px] tracking-widest text-white">{api.nombre?.toUpperCase()}</div>
          </div>
          <div className={`text-[7px] font-black tracking-widest px-2 py-1 rounded-md border ${statusColor}`}>
            {statusLabel}
          </div>
        </div>

        {/* Quota / Balance */}
        <div className="grid grid-cols-2 gap-2 bg-black/30 p-3 rounded-lg border border-white/5">
          <div>
            <div className="text-[7px] text-slate-600 font-black uppercase tracking-widest">{label}</div>
            <div className={`text-base font-black mt-0.5 ${isLow ? 'text-amber-400' : 'text-white'}`}>{displayValue}</div>
          </div>
          <div>
            <div className="text-[7px] text-slate-600 font-black uppercase tracking-widest">WARN AT</div>
            <div className="text-base font-black text-slate-500 mt-0.5">{warnValue}</div>
          </div>
        </div>

        {/* Low balance warning */}
        {isLow && (
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-1.5 text-[9px] font-black text-amber-400 tracking-widest"
          >
            <AlertTriangle className="w-3 h-3" /> LOW BALANCE
          </motion.div>
        )}
      </div>

      {/* Project consumption */}
      {api.proyectos?.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3 space-y-1.5">
          <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1.5">Consumption</div>
          {api.proyectos.map((p: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center bg-black/30 px-2.5 py-1.5 text-[9px] border border-white/5 rounded">
              <span className="font-mono text-slate-300 truncate">{p.proyecto}</span>
              <span className="font-black text-cyan-400 shrink-0 ml-2">{p.consumoMensual?.toFixed(2) ?? '0.00'}$</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Key hash + actions */}
      <div className="mt-auto border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
        <div className={`text-[8px] font-mono truncate select-all transition-colors ${api.status === 'ERROR' ? 'text-red-400' : 'text-slate-600 hover:text-cyan-400'}`}>
          {api.apiKey?.slice(0, 16) || 'NO_KEY'}···
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit}
            className="p-1 text-slate-500 hover:text-pink-400 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={onDelete}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────
export const TabApis = ({ ctx }: { ctx: any }) => {
  const { apis = [], setApis } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [editingApi, setEditingApi] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSave(api: any) {
    if (!isElectron) return;
    await window.antigravity.saveApi(api);
    const updated = await window.antigravity.getApis();
    setApis(updated);
    setShowForm(false);
    setEditingApi(null);
  }

  async function handleDelete(id: string) {
    if (!isElectron) return;
    await window.antigravity.deleteApi(id);
    const updated = await window.antigravity.getApis();
    setApis(updated);
  }

  async function handleSync() {
    if (!isElectron) return;
    setIsSyncing(true);
    try {
      const updatedApis = await window.antigravity.syncApis();
      if (Array.isArray(updatedApis)) setApis(updatedApis);
    } catch (e) {
      console.error('Sync error:', e);
    }
    setIsSyncing(false);
  }

  const okCount = apis.filter((a: any) => a.status === 'OK').length;
  const errorCount = apis.filter((a: any) => a.status === 'ERROR').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">
            Key Repository
          </div>
          {apis.length > 0 && (
            <div className="flex items-center gap-2 text-[9px] font-mono">
              {okCount > 0 && <span className="text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{okCount}</span>}
              {errorCount > 0 && <span className="text-red-400 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{errorCount}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {apis.length > 0 && (
            <button onClick={handleSync} disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest bg-white/5 border border-white/10 rounded-md text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-30">
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'SYNCING...' : 'SYNC BALANCES'}
            </button>
          )}
          <button onClick={() => { setEditingApi(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest bg-pink-500/15 border border-pink-500/30 rounded-md text-pink-400 hover:bg-pink-500/25 transition-all">
            <Plus className="w-3 h-3" /> ADD API
          </button>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <ApiForm
            api={editingApi || { ...EMPTY_API }}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingApi(null); }}
          />
        )}
      </AnimatePresence>

      {/* Empty State */}
      {apis.length === 0 && !showForm && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="p-4 rounded-2xl bg-white/3 border border-white/5 mb-4">
            <Key className="w-10 h-10 text-slate-600" />
          </div>
          <div className="text-sm font-black text-slate-500 tracking-widest mb-1">SIN APIs</div>
          <div className="text-[10px] text-slate-600 font-mono max-w-xs">
            Registra tus API keys (OpenRouter, Anthropic, BrightData, etc.) para monitorizar saldos y estado de conexión.
          </div>
        </motion.div>
      )}

      {/* API Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {apis.map((api: any) => (
          <ApiCard
            key={api.id}
            api={api}
            onEdit={() => { setEditingApi(api); setShowForm(true); }}
            onDelete={() => handleDelete(api.id)}
          />
        ))}
      </div>
    </div>
  );
};
