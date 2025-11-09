"use client";

import { useState } from "react";
import { Save, RotateCcw } from "lucide-react";

interface AgentConstraints {
  maxLeverage: number;
  allowedChains: string[];
  riskTolerance: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  minGasPrice: number;
  maxGasPrice: number;
  preferredProtocols: string[];
}

const DEFAULT_CONSTRAINTS: Record<string, AgentConstraints> = {
  maximalist: {
    maxLeverage: 10,
    allowedChains: ["ethereum", "base", "arbitrum"],
    riskTolerance: "EXTREME",
    minGasPrice: 0,
    maxGasPrice: 100,
    preferredProtocols: ["Aave", "Merkl", "Compound"],
  },
  riskManager: {
    maxLeverage: 2,
    allowedChains: ["ethereum"],
    riskTolerance: "LOW",
    minGasPrice: 0,
    maxGasPrice: 40,
    preferredProtocols: ["Aave"],
  },
  gasOptimizer: {
    maxLeverage: 5,
    allowedChains: ["base", "arbitrum"],
    riskTolerance: "MEDIUM",
    minGasPrice: 0,
    maxGasPrice: 30,
    preferredProtocols: ["Aave"],
  },
  yieldHunter: {
    maxLeverage: 8,
    allowedChains: ["ethereum", "base", "arbitrum"],
    riskTolerance: "HIGH",
    minGasPrice: 0,
    maxGasPrice: 100,
    preferredProtocols: ["Aave", "Merkl", "Morpho"],
  },
};

export default function AgentCustomizer() {
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [activeAgent, setActiveAgent] = useState("maximalist");

  const updateConstraint = (agent: string, field: keyof AgentConstraints, value: number | string | string[]) => {
    setConstraints({
      ...constraints,
      [agent]: {
        ...constraints[agent],
        [field]: value,
      },
    });
  };

  const toggleChain = (agent: string, chain: string) => {
    const current = constraints[agent].allowedChains;
    const updated = current.includes(chain)
      ? current.filter((c) => c !== chain)
      : [...current, chain];
    updateConstraint(agent, "allowedChains", updated);
  };

  const resetAgent = (agent: string) => {
    setConstraints({
      ...constraints,
      [agent]: DEFAULT_CONSTRAINTS[agent],
    });
  };

  const saveConstraints = () => {
    localStorage.setItem("agentConstraints", JSON.stringify(constraints));
    alert("Agent constraints saved! They'll be used in the next competition.");
  };

  const agents = [
    { id: "maximalist", name: "The Maximalist", emoji: "🔥", color: "red" },
    { id: "riskManager", name: "Risk Manager", emoji: "🛡️", color: "blue" },
    { id: "gasOptimizer", name: "Gas Optimizer", emoji: "⚡", color: "yellow" },
    { id: "yieldHunter", name: "Yield Hunter", emoji: "🎯", color: "purple" },
  ];

  const currentAgent = agents.find((a) => a.id === activeAgent)!;
  const currentConstraints = constraints[activeAgent];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold text-white mb-4">⚙️ Customize AI Agents</h2>
          <p className="text-xl text-slate-300">
            Set constraints and preferences for each agent&apos;s decision-making
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`p-4 rounded-xl font-bold transition-all ${
                activeAgent === agent.id
                  ? "bg-purple-600 text-white shadow-lg scale-105"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <div className="text-3xl mb-2">{agent.emoji}</div>
              <div>{agent.name}</div>
            </button>
          ))}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">{currentAgent.emoji}</span>
              {currentAgent.name}
            </h3>
            <button
              onClick={() => resetAgent(activeAgent)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          <div className="space-y-6">
            {/* Max Leverage */}
            <div>
              <label className="text-slate-300 font-semibold mb-2 block">
                Maximum Leverage: <span className="text-purple-400">{currentConstraints.maxLeverage}x</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={currentConstraints.maxLeverage}
                onChange={(e) => updateConstraint(activeAgent, "maxLeverage", Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>

            {/* Allowed Chains */}
            <div>
              <label className="text-slate-300 font-semibold mb-3 block">Allowed Blockchain Networks</label>
              <div className="grid grid-cols-3 gap-3">
                {["ethereum", "base", "arbitrum"].map((chain) => (
                  <button
                    key={chain}
                    onClick={() => toggleChain(activeAgent, chain)}
                    className={`p-3 rounded-lg font-semibold transition-all ${
                      currentConstraints.allowedChains.includes(chain)
                        ? "bg-purple-600 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {chain.charAt(0).toUpperCase() + chain.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="text-slate-300 font-semibold mb-3 block">Risk Tolerance</label>
              <div className="grid grid-cols-4 gap-3">
                {(["LOW", "MEDIUM", "HIGH", "EXTREME"] as const).map((risk) => (
                  <button
                    key={risk}
                    onClick={() => updateConstraint(activeAgent, "riskTolerance", risk)}
                    className={`p-3 rounded-lg font-semibold transition-all ${
                      currentConstraints.riskTolerance === risk
                        ? "bg-purple-600 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {risk}
                  </button>
                ))}
              </div>
            </div>

            {/* Gas Price Range */}
            <div>
              <label className="text-slate-300 font-semibold mb-2 block">
                Gas Price Range: <span className="text-orange-400">{currentConstraints.minGasPrice}-{currentConstraints.maxGasPrice} gwei</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Min Gas</label>
                  <input
                    type="number"
                    value={currentConstraints.minGasPrice}
                    onChange={(e) => updateConstraint(activeAgent, "minGasPrice", Number(e.target.value))}
                    className="w-full bg-slate-700 text-white rounded p-2 mt-1"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Max Gas</label>
                  <input
                    type="number"
                    value={currentConstraints.maxGasPrice}
                    onChange={(e) => updateConstraint(activeAgent, "maxGasPrice", Number(e.target.value))}
                    className="w-full bg-slate-700 text-white rounded p-2 mt-1"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>

            {/* Preferred Protocols */}
            <div>
              <label className="text-slate-300 font-semibold mb-3 block">Preferred Protocols</label>
              <div className="flex flex-wrap gap-2">
                {["Aave", "Merkl", "Compound", "Morpho", "Yearn"].map((protocol) => (
                  <button
                    key={protocol}
                    onClick={() => {
                      const current = currentConstraints.preferredProtocols;
                      const updated = current.includes(protocol)
                        ? current.filter((p) => p !== protocol)
                        : [...current, protocol];
                      updateConstraint(activeAgent, "preferredProtocols", updated);
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      currentConstraints.preferredProtocols.includes(protocol)
                        ? "bg-purple-600 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {protocol}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={saveConstraints}
          className="w-full mt-8 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Save All Agent Constraints
        </button>
      </div>
    </div>
  );
}