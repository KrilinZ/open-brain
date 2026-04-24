/* eslint-disable */
// @ts-nocheck
import logoBrain from "@/assets/logo-brain.png";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Radio } from "lucide-react";
import type { KnowledgeItem } from "@/types/antigravity";
import { TabConocimiento } from "./components/tabs/TabConocimiento";

const isElectron = typeof window !== "undefined" && !!window.antigravity;

export default function App() {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [kiSearchQuery, setKiSearchQuery] = useState("");
  const [selectedKi, setSelectedKi] = useState<KnowledgeItem | null>(null);
  const [newKiTitle, setNewKiTitle] = useState("");
  const [newKiSummary, setNewKiSummary] = useState("");
  const [newKiContent, setNewKiContent] = useState("");
  const [isCreatingKi, setIsCreatingKi] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!isElectron) return;
    try {
      const ki = await window.antigravity.getKnowledge();
      setKnowledgeItems(ki || []);
    } catch (e) {
      console.error("refreshAll error:", e);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const ctx = {
    knowledgeItems,
    kiSearchQuery, setKiSearchQuery,
    selectedKi, setSelectedKi,
    newKiTitle, setNewKiTitle,
    newKiSummary, setNewKiSummary,
    newKiContent, setNewKiContent,
    isCreatingKi, setIsCreatingKi,
    refreshAll,
  };

  return (
    <div className="min-h-screen text-[#f0f0f0] font-mono selection:bg-cyan-500 selection:text-white relative">
      {/* DRAG HANDLE */}
      <div
        className="fixed top-0 left-0 right-0 h-8 z-[9999] cursor-default"
        style={{ WebkitAppRegion: "drag" } as any}
      />

      {/* BG */}
      <div className="fixed inset-0 hex-grid z-[-1] opacity-40 shadow-[inset_0_0_100px_rgba(0,0,0,1)]" />
      <div className="scanlines-fixed opacity-40" />

      {/* HEADER */}
      <div className="pt-8 pb-2 px-6 flex items-center gap-3 border-b border-cyan-900/40">
        <motion.img
          src={logoBrain}
          alt="Open Brain"
          className="w-8 h-8"
          animate={{ filter: ["drop-shadow(0 0 6px #00f0ff)", "drop-shadow(0 0 14px #00f0ff)", "drop-shadow(0 0 6px #00f0ff)"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div>
          <h1 className="text-sm font-black tracking-widest text-cyan-300" style={{ textShadow: "0 0 12px #00f0ff" }}>
            OPEN BRAIN
          </h1>
          <p className="text-[10px] text-slate-500 tracking-widest">Knowledge Base · For any AI</p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-4">
        <TabConocimiento ctx={ctx} />
      </div>

      {/* STATUS BAR */}
      <div className="fixed bottom-0 left-0 right-0 h-7 border-t border-cyan-900/30 bg-black/60 backdrop-blur-sm flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 6px #00f0ff" }} />
          <span className="text-[9px] font-mono text-slate-500 tracking-widest">
            {knowledgeItems.length} KIs cargados
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Radio className="w-3 h-3 text-cyan-500 animate-pulse" style={{ filter: "drop-shadow(0 0 4px #00f0ff)" }} />
          <span className="text-[9px] font-mono text-slate-600 tracking-widest">v2.0.0</span>
        </div>
      </div>
    </div>
  );
}
