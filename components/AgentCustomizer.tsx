// components/AgentCustomizer.tsx
"use client";

import { useState } from "react";

type Risk = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

type AgentConstraintsForm = {
  displayName: string;
  maxLeverage: number;
  minGasPrice: number;
  maxGasPrice: number;
  riskTolerance: Risk;
  allowedChains: { ethereum: boolean; base: boolean; arbitrum: boolean };
  preferredProtocols: { etherfi: boolean; aave: boolean; morpho: boolean; merkl: boolean };
};

const defaultAgent = (idx: number): AgentConstraintsForm => ({
  displayName: `Agent ${idx + 1}`,
  maxLeverage: 3,
  minGasPrice: 0,
  maxGasPrice: 200,
  riskTolerance: "MEDIUM",
  allowedChains: { ethereum: true, base: true, arbitrum: false },
  preferredProtocols: { etherfi: true, aave: true, morpho: true, merkl: true },
});

export default function AgentCustomizer() {
  const [days, setDays] = useState<number>(5);
  const [agents, setAgents] = useState<AgentConstraintsForm[]>(
    Array.from({ length: 4 }, (_, i) => defaultAgent(i))
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
  { success: boolean; rankings?: { name: string; currentStrategy: string; currentAPY: number; performance: { totalReturn: number } }[] } | null
>(null);

  const updateAgent = <K extends keyof AgentConstraintsForm>(
    i: number,
    key: K,
    value: AgentConstraintsForm[K]
  ) => {
    setAgents((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value } as AgentConstraintsForm;
      return next;
    });
  };

  const toggleNested = (
    i: number,
    group: "allowedChains" | "preferredProtocols",
    key: string
  ) => {
    setAgents((prev) => {
      const next = [...prev];
      const cur = next[i][group] as Record<string, boolean>;
      next[i] = { ...next[i], [group]: { ...cur, [key]: !cur[key] } } as AgentConstraintsForm;
      return next;
    });
  };

  async function runSimulation() {
    setLoading(true);
    setResult(null);
    try {
      // Map our UI to the API payload keyed by original personality keys
      const toApi = (a: AgentConstraintsForm) => ({
        displayName: a.displayName,
        maxLeverage: a.maxLeverage,
        minGasPrice: a.minGasPrice,
        maxGasPrice: a.maxGasPrice,
        riskTolerance: a.riskTolerance,
        allowedChains: [
          a.allowedChains.ethereum && "ethereum",
          a.allowedChains.base && "base",
          a.allowedChains.arbitrum && "arbitrum",
        ].filter(Boolean) as string[],
        preferredProtocols: [
          a.preferredProtocols.etherfi && "etherfi",
          a.preferredProtocols.aave && "aave",
          a.preferredProtocols.morpho && "morpho",
          a.preferredProtocols.merkl && "merkl",
        ].filter(Boolean) as string[],
      });

      // Keep the old keys so the server can merge, but send our constraints
      const payload = {
        days,
        constraints: {
          "The Maximalist": toApi(agents[0]),
          "Risk Manager": toApi(agents[1]),
          "Gas Optimizer": toApi(agents[2]),
          "Yield Hunter": toApi(agents[3]),
        },
      };

      const res = await fetch("/api/agents/compete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setResult(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight mb-6">EtherFi Strategy Arena</h1>

      {/* Controls */}
      <div className="rounded-2xl border p-5 shadow-sm mb-6">
        <label className="block text-sm font-medium mb-2">Days</label>
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
          className="border rounded-lg px-3 py-2 w-32"
          min={1}
        />
        <button
          onClick={runSimulation}
          disabled={loading}
          className="ml-4 px-4 py-2 rounded-xl bg-black text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Running…" : "Run Simulation"}
        </button>
      </div>

      {/* Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((a, i) => (
          <div key={i} className="rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-xl font-semibold">Agent {i + 1}</div>
            </div>

            <label className="block text-sm font-medium">Display name</label>
            <input
              className="border rounded-lg px-3 py-2 w-full mb-3"
              value={a.displayName}
              onChange={(e) => updateAgent(i, "displayName", e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Max leverage</label>
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 w-full"
                  value={a.maxLeverage}
                  onChange={(e) => updateAgent(i, "maxLeverage", parseFloat(e.target.value || "0"))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Risk tolerance</label>
                <select
                  className="border rounded-lg px-3 py-2 w-full"
                  value={a.riskTolerance}
                  onChange={(e) => updateAgent(i, "riskTolerance", e.target.value as Risk)}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="EXTREME">EXTREME</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Min gas (gwei)</label>
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 w-full"
                  value={a.minGasPrice}
                  onChange={(e) => updateAgent(i, "minGasPrice", parseFloat(e.target.value || "0"))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Max gas (gwei)</label>
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 w-full"
                  value={a.maxGasPrice}
                  onChange={(e) => updateAgent(i, "maxGasPrice", parseFloat(e.target.value || "0"))}
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Allowed chains</div>
              <div className="flex flex-wrap gap-4">
                {(["ethereum", "base", "arbitrum"] as const).map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={a.allowedChains[c as keyof typeof a.allowedChains]}
                      onChange={() => toggleNested(i, "allowedChains", c)}
                    />
                    <span className="text-sm capitalize">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Preferred protocols</div>
              <div className="flex flex-wrap gap-4">
                {(["etherfi", "aave", "merkl", "morpho"] as const).map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={a.preferredProtocols[p as keyof typeof a.preferredProtocols]}
                      onChange={() => toggleNested(i, "preferredProtocols", p)}
                    />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Results summary (very light) */}
      {result?.success && (
        <div className="rounded-2xl border p-5 shadow-sm mt-8">
          <h2 className="text-xl font-semibold mb-3">Final rankings</h2>
          <ul className="space-y-2">
            {result.rankings?.map((r: {
              name: string;
              currentStrategy: string;
              currentAPY: number;
              performance: { totalReturn: number };
}) => (
              <li key={r.name} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-gray-600">
                    {r.currentStrategy} • APY ~ {r.currentAPY.toFixed(2)}%
                  </div>
                </div>
                <div className="font-semibold">
                  Return: {r.performance.totalReturn.toFixed(2)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
