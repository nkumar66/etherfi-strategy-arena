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
  currentStrategy?: string;
  currentLeverage?: number;
  strategyDetails?: {
    name: string;
    description: string;
    riskLevel: string;
  };
  decision: {
    strategy?: string;
    leverage?: number;
    action?: string;
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
  currentStrategy: string;
  currentLeverage: number;
  performance: {
    totalReturn: number;
    totalGasCosts: number;
    transactionCount: number;
  };
}

interface DayResult {
  day: number;
  agents: AgentData[];
}

interface ResultsData {
  agents: AgentData[];
  rankings?: RankingData[];
  showFinal?: boolean;
  allDays?: DayResult[];
}

export default function CompetitionView() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [currentDay, setCurrentDay] = useState(0);
  const [days, setDays] = useState(10);

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
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Show final results with all days for chart
      setResults({
        ...data.results[data.results.length - 1],
        rankings: data.rankings,
        showFinal: true,
        allDays: data.results,
      });
    } catch (error) {
      console.error("Error running competition:", error);
      alert("Competition failed. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  };

  // Prepare chart data from actual results
  const chartData = results?.showFinal && results.allDays
    ? results.allDays.map((dayResult: DayResult) => ({
        day: dayResult.day,
        maximalist: dayResult.agents.find((a: AgentData) => a.name === "The Maximalist")?.portfolio || 10,
        riskManager: dayResult.agents.find((a: AgentData) => a.name === "Risk Manager")?.portfolio || 10,
        gasOptimizer: dayResult.agents.find((a: AgentData) => a.name === "Gas Optimizer")?.portfolio || 10,
        contrarian: dayResult.agents.find((a: AgentData) => a.name === "The Contrarian")?.portfolio || 10,
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
            Watch AI agents compete using real EtherFi strategies like Aave looping, PYUSD lending, and
            leverage optimization
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-12">
          <div className="flex items-center gap-3">
            <label className="text-slate-300 font-medium">Simulation Days:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={isRunning}
              className="bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
            >
              <option value={5}>5 days (Quick Demo)</option>
              <option value={10}>10 days</option>
              <option value={15}>15 days</option>
              <option value={20}>20 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days (Full Simulation)</option>
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
            {results.showFinal && results.rankings && results.rankings.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-2xl p-8 mb-12 text-center">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-4xl font-bold text-white mb-2">
                  {results.rankings[0].emoji} {results.rankings[0].name} Wins!
                </h2>
                <p className="text-xl text-slate-300 mb-2">
                  Final Return:{" "}
                  <span className="text-green-400 font-bold">
                    +{results.rankings[0].performance.totalReturn.toFixed(3)}%
                  </span>
                </p>
                <p className="text-lg text-slate-300 mb-2">
                  Winning Strategy:{" "}
                  <span className="text-purple-400 font-semibold">
                    {results.rankings[0].currentStrategy} @ {results.rankings[0].currentLeverage}x
                  </span>
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Completed {results.rankings[0].performance.transactionCount} transactions with Ξ
                  {results.rankings[0].performance.totalGasCosts.toFixed(6)} in gas costs
                </p>
              </div>
            )}

            {/* Chart */}
            {results.showFinal && chartData.length > 0 && (
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
              Four AI agents with different strategies compete using real EtherFi protocols
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-8">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-3xl mb-2">🔥</div>
                <h4 className="font-bold text-white mb-1">Maximalist</h4>
                <p className="text-xs text-slate-400">10x Aave loops</p>
                <p className="text-xs text-slate-500">High risk, high reward</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-3xl mb-2">🛡️</div>
                <h4 className="font-bold text-white mb-1">Risk Manager</h4>
                <p className="text-xs text-slate-400">2-3x leverage max</p>
                <p className="text-xs text-slate-500">Safety first approach</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-3xl mb-2">⚡</div>
                <h4 className="font-bold text-white mb-1">Gas Optimizer</h4>
                <p className="text-xs text-slate-400">Waits for cheap gas</p>
                <p className="text-xs text-slate-500">Efficiency focused</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-3xl mb-2">🎲</div>
                <h4 className="font-bold text-white mb-1">Contrarian</h4>
                <p className="text-xs text-slate-400">Fades the crowd</p>
                <p className="text-xs text-slate-500">Buy fear, sell greed</p>
              </div>
            </div>
            <div className="mt-8 text-sm text-slate-500">
              <p>Strategies include: Aave ETH Looping, PYUSD Lending, RLUSD Strategies & More</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}