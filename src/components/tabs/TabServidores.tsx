/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Server, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Wifi, WifiOff, X, Edit3, Terminal, HardDrive, Cpu, Container } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const isElectron = typeof window !== "undefined" && !!window.antigravity;

// ── Circular gauge ───────────────────────────────────────────────────────
function CircleGauge({ pct, label, detail, size = 52 }: { pct: number; label: string; detail: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circum = 2 * Math.PI * radius;
  const offset = circum - (pct / 100) * circum;
  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#eab308' : '#22d3ee';
  const colorClass = pct > 85 ? 'text-red-400' : pct > 65 ? 'text-yellow-400' : 'text-cyan-400';

  return (
    <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-lg border border-white/5">
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="transparent" />
          <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="3" fill="transparent"
            strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <div className={`absolute font-black text-[9px] ${colorClass}`}>{pct}%</div>
      </div>
      <div className="flex flex-col min-w-0">
        <div className="text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">{label}</div>
        <div className="text-[10px] font-mono text-white mt-1 opacity-80 truncate">{detail}</div>
      </div>
    </div>
  );
}

// ── Server Form ──────────────────────────────────────────────────────────
const EMPTY_SERVER = {
  id: '', nombre: '', ip: '', proveedor: 'Contabo', os: 'Ubuntu 24.04',
  ram: '', color: 'text-cyan-400', ssh: '', proyectos: [], containers: [], notas: [],
};

function ServerForm({ server, onSave, onCancel }: { server: any; onSave: (s: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...server });
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="rounded-xl border border-pink-500/30 bg-black/60 p-5 space-y-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black tracking-widest text-pink-400">
          {server.id ? 'EDITAR SERVIDOR' : 'NUEVO SERVIDOR'}
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Nombre</label>
          <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Mi VPS"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">IP</label>
          <input value={form.ip} onChange={e => set('ip', e.target.value)} placeholder="84.247.166.121"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Proveedor</label>
          <input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Contabo / Hetzner / AWS"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">OS</label>
          <input value={form.os} onChange={e => set('os', e.target.value)} placeholder="Ubuntu 24.04"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
        </div>
      </div>

      <div>
        <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-1">Comando SSH</label>
        <input value={form.ssh} onChange={e => set('ssh', e.target.value)}
          placeholder="ssh -i ~/.ssh/id_rsa root@84.247.166.121"
          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:border-pink-500/50 focus:outline-none transition-colors" />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-colors">
          CANCELAR
        </button>
        <button
          onClick={() => {
            const id = form.id || `srv-${Date.now()}`;
            onSave({ ...form, id });
          }}
          disabled={!form.nombre.trim() || !form.ssh.trim()}
          className="px-4 py-1.5 text-[10px] font-black tracking-widest bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-md hover:bg-pink-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          GUARDAR
        </button>
      </div>
    </motion.div>
  );
}

// ── Server Card ──────────────────────────────────────────────────────────
function ServerCard({ srv, liveStatus, onEdit, onDelete, onCheck, isChecking }: {
  srv: any; liveStatus: any; onEdit: () => void; onDelete: () => void;
  onCheck: () => void; isChecking: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // Parse metrics from server data
  const ramMatch = srv.ram ? String(srv.ram).match(/\((\d+)%\)/) : null;
  const ramPct = ramMatch ? parseInt(ramMatch[1]) : 0;
  const ramStrMatch = srv.ram ? String(srv.ram).match(/(^.*?MB)/) : null;
  const ramStr = ramStrMatch ? ramStrMatch[1] : (srv.ram || 'N/A');

  const diskNota = (srv.notas || []).find((n: string) => n.includes('Disco:'));
  const diskMatch = diskNota ? diskNota.match(/\((\d+)%\)/) : null;
  const diskPct = diskMatch ? parseInt(diskMatch[1]) : 0;
  const diskStrMatch = diskNota ? diskNota.match(/Disco:\s*(.*?G)/) : null;
  const diskStr = diskStrMatch ? diskStrMatch[1] : '';

  const uptimeNota = (srv.notas || []).find((n: string) => n.startsWith('⏱'));
  const uptime = uptimeNota ? uptimeNota.replace('⏱ ', '') : '';

  const isOnline = liveStatus?.ok === true;
  const isOffline = liveStatus?.ok === false;
  const isUnknown = !liveStatus;
  const lastCheck = liveStatus?.lastCheck ? new Date(liveStatus.lastCheck).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${
        isOnline ? 'border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-black/40' :
        isOffline ? 'border-red-500/20 bg-gradient-to-br from-red-950/20 to-black/40' :
        'border-white/10 bg-black/40'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={`p-3 rounded-lg border shrink-0 ${
          isOnline ? 'bg-cyan-500/10 border-cyan-500/20' :
          isOffline ? 'bg-red-500/10 border-red-500/20' :
          'bg-white/5 border-white/10'
        }`}>
          <Server className={`w-6 h-6 ${isOnline ? 'text-cyan-400' : isOffline ? 'text-red-400' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-black text-sm tracking-tight text-white truncate">{srv.nombre}</div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isOnline && (
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1 text-[8px] font-black tracking-widest text-cyan-400">
                  <Wifi className="w-3 h-3" /> ONLINE
                </motion.div>
              )}
              {isOffline && (
                <div className="flex items-center gap-1 text-[8px] font-black tracking-widest text-red-400">
                  <WifiOff className="w-3 h-3" /> OFFLINE
                </div>
              )}
              {isUnknown && (
                <div className="text-[8px] font-black tracking-widest text-slate-500">NO CHECKED</div>
              )}
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2">
            <span>{srv.ip}</span>
            <span className="text-slate-700">·</span>
            <span>{srv.os}</span>
            {srv.proveedor && <><span className="text-slate-700">·</span><span>{srv.proveedor}</span></>}
          </div>
          {uptime && <div className="text-[9px] font-mono text-slate-600 mt-1">⏱ {uptime}</div>}
          {lastCheck && <div className="text-[8px] font-mono text-slate-700 mt-0.5">Último check: {lastCheck}</div>}
        </div>
      </div>

      {/* Actions bar */}
      <div className="px-4 pb-3 flex gap-1.5">
        <button onClick={onCheck} disabled={isChecking}
          className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black tracking-widest bg-white/5 border border-white/10 rounded-md text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-30">
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'CHECKING...' : 'CHECK'}
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black tracking-widest bg-white/5 border border-white/10 rounded-md text-slate-400 hover:text-pink-400 hover:border-pink-500/30 transition-all">
          <Edit3 className="w-3 h-3" /> EDIT
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black tracking-widest bg-white/5 border border-white/10 rounded-md text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all ml-auto">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Metrics */}
      {(ramPct > 0 || diskPct > 0) && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          <CircleGauge pct={ramPct} label="RAM USAGE" detail={ramStr} />
          <CircleGauge pct={diskPct} label="DISK USAGE" detail={diskStr} />
        </div>
      )}

      {/* Projects + Containers */}
      {((srv.proyectos?.length > 0) || (srv.containers?.length > 0)) && (
        <div className="border-t border-white/5 px-4 py-3 grid grid-cols-2 gap-4">
          {/* Projects */}
          <div>
            <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <HardDrive className="w-3 h-3" /> Projects <span className="text-slate-600">[{srv.proyectos?.length || 0}]</span>
            </div>
            <div className="space-y-1">
              {srv.proyectos?.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-black/30 px-2 py-1.5 text-[8px] font-mono border border-white/5 rounded">
                  <span className={`text-slate-300 truncate ${!p.activo && 'opacity-40'}`}>{p.nombre}</span>
                  <motion.div
                    animate={p.activo ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.activo ? 'bg-cyan-500 shadow-[0_0_5px_#22d3ee]' : 'bg-red-500'}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Containers */}
          <div>
            <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Container className="w-3 h-3" /> Containers <span className="text-slate-600">[{srv.containers?.length || 0}]</span>
            </div>
            <div className="space-y-1">
              {srv.containers?.map((c: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-black/30 px-2 py-1.5 text-[8px] font-mono border border-white/5 rounded">
                  <span className="text-slate-300 truncate">{c.nombre}</span>
                  <span className="text-cyan-500 opacity-60">:{c.puerto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────
export const TabServidores = ({ ctx }: { ctx: any }) => {
  const { servers = [], setServers, serverStatuses = {} } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [isForceChecking, setIsForceChecking] = useState(false);

  async function handleSave(server: any) {
    if (!isElectron) return;
    await window.antigravity.saveServer(server);
    const updated = await window.antigravity.getServers();
    setServers(updated);
    setShowForm(false);
    setEditingServer(null);
  }

  async function handleDelete(id: string) {
    if (!isElectron) return;
    await window.antigravity.deleteServer(id);
    const updated = await window.antigravity.getServers();
    setServers(updated);
  }

  async function handleCheck(server: any) {
    if (!isElectron) return;
    setCheckingId(server.id);
    try {
      const result = await window.antigravity.checkServer(server);
      if (result.exito && result.servidor) {
        const updated = await window.antigravity.getServers();
        setServers(updated);
      }
    } catch (e) {
      console.error('Check server error:', e);
    }
    setCheckingId(null);
  }

  async function handleForceCheckAll() {
    if (!isElectron) return;
    setIsForceChecking(true);
    try {
      await window.antigravity.forceCheckServers();
      const updated = await window.antigravity.getServers();
      setServers(updated);
    } catch (e) {
      console.error('Force check error:', e);
    }
    setIsForceChecking(false);
  }

  const onlineCount = Object.values(serverStatuses).filter((s: any) => s.ok).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">
            Node Grid
          </div>
          {servers.length > 0 && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-600">
              <span className="text-cyan-400">{onlineCount}</span>/<span>{servers.length}</span> online
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {servers.length > 0 && (
            <button onClick={handleForceCheckAll} disabled={isForceChecking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest bg-white/5 border border-white/10 rounded-md text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-30">
              <RefreshCw className={`w-3 h-3 ${isForceChecking ? 'animate-spin' : ''}`} />
              {isForceChecking ? 'CHECKING ALL...' : 'CHECK ALL'}
            </button>
          )}
          <button onClick={() => { setEditingServer(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest bg-pink-500/15 border border-pink-500/30 rounded-md text-pink-400 hover:bg-pink-500/25 transition-all">
            <Plus className="w-3 h-3" /> ADD SERVER
          </button>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <ServerForm
            server={editingServer || { ...EMPTY_SERVER }}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingServer(null); }}
          />
        )}
      </AnimatePresence>

      {/* Empty State */}
      {servers.length === 0 && !showForm && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="p-4 rounded-2xl bg-white/3 border border-white/5 mb-4">
            <Server className="w-10 h-10 text-slate-600" />
          </div>
          <div className="text-sm font-black text-slate-500 tracking-widest mb-1">SIN SERVIDORES</div>
          <div className="text-[10px] text-slate-600 font-mono max-w-xs">
            Añade tus VPS/servidores para monitorizar RAM, disco, Docker y servicios activos via SSH.
          </div>
        </motion.div>
      )}

      {/* Server Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {servers.map((srv: any) => (
          <ServerCard
            key={srv.id}
            srv={srv}
            liveStatus={serverStatuses[srv.id]}
            isChecking={checkingId === srv.id}
            onEdit={() => { setEditingServer(srv); setShowForm(true); }}
            onDelete={() => handleDelete(srv.id)}
            onCheck={() => handleCheck(srv)}
          />
        ))}
      </div>
    </div>
  );
};
