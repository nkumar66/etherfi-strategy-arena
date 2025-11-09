"use client";

import { useState } from "react";
import CompetitionView from "@/components/CompetitionView";
import StrategyBuilder from "@/components/StrategyBuilder";
import AgentCustomizer from "@/components/AgentCustomizer";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"builder" | "competition" | "customize">("builder");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 pt-8 px-4">
        <button
          onClick={() => setActiveTab("builder")}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            activeTab === "builder"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/50"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          🧮 Strategy Builder
        </button>
        <button
          onClick={() => setActiveTab("competition")}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            activeTab === "competition"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/50"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          🏆 AI Competition
        </button>
        <button
          onClick={() => setActiveTab("customize")}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            activeTab === "customize"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/50"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          ⚙️ Customize Agents
        </button>
      </div>

      {/* Content */}
      {activeTab === "builder" && <StrategyBuilder />}
      {activeTab === "competition" && <CompetitionView />}
      {activeTab === "customize" && <AgentCustomizer />}
    </div>
  );
}