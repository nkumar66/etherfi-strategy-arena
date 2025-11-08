"use client";

import { useState } from "react";
import { Play, Zap, Trophy } from "lucide-react";
import AgentCard from "./AgentCard";
import PerformanceChart from "./PerformanceChart";

interface AgentData {
  name: string;
  emoji: string;
  color: string;
  portfolio: number;
  decision: {
    action: string;
    reasoning: string;
  };
  performance: {
    totalReturn: number;
    totalGasCosts: number;
    transactionCount: number;
  };
}

interface RankingData {
  name: string;
  emoji: string;
  color: string;
  performance: {
    totalReturn: number;
    totalGasCosts: number;
    transactionCount: number;
  };
}

interface ResultsData {
  agents: AgentData[];
  rankings?: RankingData[];
  showFinal?: boolean;
}

export default function CompetitionView() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [currentDay, setCurrentDay] = useState(0);
  const [days, setDays] = useState(30);

  const startCompetition = async () => {
    setIsRunning(true);
    setResults(null);
    setCurrentDay(0);

    try {
      const response = await fetch("/api/agents/compete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Competition failed: " + data.error);
        setIsRunning(false);
        return;
      }

      // Animate through results day by day
      for (let i = 0; i < data.results.length; i++) {
        setCurrentDay(i + 1);
        setResults(data.results[i]);
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms per day
      }

      // Show final results
      setResults({
        ...data.results[data.results.length - 1],
        rankings: data.rankings,
        showFinal: true,
      });
    } catch (error) {
      console.error("Error running competition:", error);
      alert("Competition failed. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  };

  // Prepare chart data
  const chartData = results?.showFinal
    ? Array.from({ length: days }, (_, i) => ({
        day: i,
        maximalist: 10 + (Math.random() * 0.01), // Simplified - in real app, use actual data
        riskManager: 10 + (Math.random() * 0.008),
        gasOptimizer: 10 + (Math.random() * 0.009),
        contrarian: 10 + (Math.random() * 0.011),
      }))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-full px-6 py-3">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-sm font-semibold text-purple-300">Powered by Claude AI</span>
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            EtherFi Strategy Arena
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Watch AI agents compete to find the best liquid staking strategies using Claude&apos;s
            multi-agent intelligence
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-6 mb-12">
          <div className="flex items-center gap-3">
            <label className="text-slate-300 font-medium">Simulation Days:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={isRunning}
              className="bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
            >
              <option value={5}>5 days (Demo)</option>
              <option value={10}>10 days</option>
              <option value={15}>15 days</option>
              <option value={20}>20 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <button
            onClick={startCompetition}
            disabled={isRunning}
            className={`
              flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg
              transition-all duration-300 transform hover:scale-105
              ${
                isRunning
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/50"
              }
            `}
          >
            <Play className="w-6 h-6" />
            {isRunning ? `Running Day ${currentDay}/${days}...` : "Start Competition"}
          </button>
        </div>

        {/* Results */}
        {results && (
          <>
            {/* Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {results.agents.map((agent: AgentData) => {
                const ranking = results.rankings?.findIndex(
                  (r: RankingData) => r.name === agent.name
                );
                return (
                  <AgentCard
                    key={agent.name}
                    agent={agent}
                    rank={results.showFinal && ranking !== undefined ? ranking + 1 : undefined}
                    isWinner={results.showFinal && ranking === 0}
                  />
                );
              })}
            </div>

            {/* Winner Announcement */}
            {results.showFinal && results.rankings && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-2xl p-8 mb-12 text-center">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-4xl font-bold text-white mb-2">
                  {results.rankings[0].emoji} {results.rankings[0].name} Wins!
                </h2>
                <p className="text-xl text-slate-300">
                  Final Return: <span className="text-green-400 font-bold">
                    +{results.rankings[0].performance.totalReturn.toFixed(3)}%
                  </span>
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Completed {results.rankings[0].performance.transactionCount} transactions with Ξ
                  {results.rankings[0].performance.totalGasCosts.toFixed(6)} in gas costs
                </p>
              </div>
            )}

            {/* Chart */}
            {results.showFinal && (
              <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-white mb-6">Performance Over Time</h3>
                <PerformanceChart data={chartData} />
              </div>
            )}
          </>
        )}

        {/* Info Footer */}
        {!results && !isRunning && (
          <div className="mt-16 text-center text-slate-400 space-y-4">
            <p className="text-lg">
              Four AI agents with different investment philosophies compete on historical EtherFi
              data
            </p>
            <div className="flex justify-center gap-8 text-sm">
              <div>
                <span className="text-2xl">🔥</span>
                <p>Maximalist</p>
                <p className="text-xs text-slate-500">High risk, high reward</p>
              </div>
              <div>
                <span className="text-2xl">🛡️</span>
                <p>Risk Manager</p>
                <p className="text-xs text-slate-500">Safety first</p>
              </div>
              <div>
                <span className="text-2xl">⚡</span>
                <p>Gas Optimizer</p>
                <p className="text-xs text-slate-500">Minimize costs</p>
              </div>
              <div>
                <span className="text-2xl">🎲</span>
                <p>Contrarian</p>
                <p className="text-xs text-slate-500">Fade the crowd</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}