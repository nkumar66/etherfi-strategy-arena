'use client';

import React, { useMemo, useState } from 'react';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
type AgentKey = 'The Maximalist' | 'Risk Manager' | 'Gas Optimizer' | 'Yield Hunter';

export interface AgentConstraints {
  maxLeverage: number;
  allowedChains: string[]; // lowercase: ["ethereum","base","arbitrum"]
  riskTolerance: RiskLevel;
  minGasPrice: number; // gwei
  maxGasPrice: number; // gwei
  preferredProtocols: string[]; // e.g. ["EtherFi","Aave","Merkl","Morpho"]
  displayName?: string;
  emoji?: string;
  color?: string;
}

type ConstraintsMap = Record<AgentKey, AgentConstraints>;

interface SimulationPerformance {
  initialValue: number;
  currentValue: number;
  totalReturn: number;
  totalGasCosts: number;
  transactionCount: number;
}

interface SimulationRanking {
  name: string;
  emoji: string;
  color: string;
  currentStrategy: string;
  currentAPY: number;
  performance: SimulationPerformance;
}

interface SimulationResponse {
  success: boolean;
  rankings: SimulationRanking[];
}

const CHAIN_OPTIONS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
];

const PROTOCOL_OPTIONS = ['EtherFi', 'Aave', 'Merkl', 'Morpho'];

const defaultConstraints: ConstraintsMap = {
  'The Maximalist': {
    displayName: 'Agent 1',
    emoji: '🧠',
    color: 'slate',
    maxLeverage: 8,
    allowedChains: ['ethereum', 'base'],
    riskTolerance: 'HIGH',
    minGasPrice: 0,
    maxGasPrice: 200,
    preferredProtocols: ['EtherFi', 'Aave', 'Merkl'],
  },
  'Risk Manager': {
    displayName: 'Agent 2',
    emoji: '🛡️',
    color: 'blue',
    maxLeverage: 2,
    allowedChains: ['ethereum'],
    riskTolerance: 'LOW',
    minGasPrice: 0,
    maxGasPrice: 60,
    preferredProtocols: ['EtherFi', 'Aave'],
  },
  'Gas Optimizer': {
    displayName: 'Agent 3',
    emoji: '⚙️',
    color: 'yellow',
    maxLeverage: 4,
    allowedChains: ['base', 'arbitrum'],
    riskTolerance: 'MEDIUM',
    minGasPrice: 0,
    maxGasPrice: 40,
    preferredProtocols: ['Aave', 'Merkl'],
  },
  'Yield Hunter': {
    displayName: 'Agent 4',
    emoji: '🎯',
    color: 'purple',
    maxLeverage: 5,
    allowedChains: ['base', 'arbitrum'],
    riskTolerance: 'HIGH',
    minGasPrice: 0,
    maxGasPrice: 120,
    preferredProtocols: ['Merkl', 'Aave', 'EtherFi'],
  },
};

export default function AgentCustomizer() {
  const [days, setDays] = useState<number>(5);
  const [constraints, setConstraints] = useState<ConstraintsMap>(defaultConstraints);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentOrder: AgentKey[] = useMemo(
    () => ['The Maximalist', 'Risk Manager', 'Gas Optimizer', 'Yield Hunter'],
    []
  );

  const updateConstraint = <K extends keyof AgentConstraints>(
    key: AgentKey,
    field: K,
    value: AgentConstraints[K]
  ) => {
    setConstraints((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const toggleArrayValue = (arr: string[], value: string): string[] => {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/agents/compete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, constraints }), // hybrid engine only
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Request failed');
      }
      const data: SimulationResponse = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-6">
      <h1 className="text-2xl font-bold">EtherFi Strategy Arena</h1>

      {/* Global controls */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="w-28 font-medium">Days</label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 rounded border px-2 py-1"
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Run Simulation'}
        </button>
      </div>

      {/* Agent cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {agentOrder.map((key) => {
          const c = constraints[key];
          return (
            <div key={key} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <span>{c.emoji ?? ''}</span>
                <span>{c.displayName ?? 'Agent'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Display name</label>
                  <input
                    value={c.displayName ?? ''}
                    onChange={(e) => updateConstraint(key, 'displayName', e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Emoji</label>
                  <input
                    value={c.emoji ?? ''}
                    onChange={(e) => updateConstraint(key, 'emoji', e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Color</label>
                  <input
                    value={c.color ?? ''}
                    onChange={(e) => updateConstraint(key, 'color', e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Max leverage</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={c.maxLeverage}
                    onChange={(e) => updateConstraint(key, 'maxLeverage', Number(e.target.value))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Risk tolerance</label>
                  <select
                    value={c.riskTolerance}
                    onChange={(e) => updateConstraint(key, 'riskTolerance', e.target.value as RiskLevel)}
                    className="w-full rounded border px-2 py-1"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="EXTREME">EXTREME</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Min gas (gwei)</label>
                  <input
                    type="number"
                    min={0}
                    value={c.minGasPrice}
                    onChange={(e) => updateConstraint(key, 'minGasPrice', Number(e.target.value))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Max gas (gwei)</label>
                  <input
                    type="number"
                    min={0}
                    value={c.maxGasPrice}
                    onChange={(e) => updateConstraint(key, 'maxGasPrice', Number(e.target.value))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Allowed chains</label>
                <div className="flex flex-wrap gap-3">
                  {CHAIN_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={c.allowedChains.includes(opt.id)}
                        onChange={() =>
                          updateConstraint(key, 'allowedChains', toggleArrayValue(c.allowedChains, opt.id))
                        }
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Preferred protocols</label>
                <div className="flex flex-wrap gap-3">
                  {PROTOCOL_OPTIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={c.preferredProtocols.includes(p)}
                        onChange={() =>
                          updateConstraint(key, 'preferredProtocols', toggleArrayValue(c.preferredProtocols, p))
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results */}
      {error && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
      {result && (
        <div className="rounded-xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Final rankings</h2>
          <div className="space-y-2">
            {result.rankings.map((r, idx) => (
              <div key={r.name + idx} className="flex items-center justify-between rounded border p-2">
                <div className="flex items-center gap-2">
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm text-gray-500">({r.currentStrategy})</span>
                </div>
                <div className="text-sm">
                  Return: <span className="font-semibold">{r.performance.totalReturn.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
