"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

interface AgentCardProps {
  agent: AgentData;
  rank?: number;
  isWinner?: boolean;
}

export default function AgentCard({ agent, rank, isWinner }: AgentCardProps) {
  const colorClasses = {
    red: "from-red-500/20 to-orange-500/20 border-red-500/50",
    blue: "from-blue-500/20 to-cyan-500/20 border-blue-500/50",
    yellow: "from-yellow-500/20 to-amber-500/20 border-yellow-500/50",
    purple: "from-purple-500/20 to-pink-500/20 border-purple-500/50",
  };

  const bgClass = colorClasses[agent.color as keyof typeof colorClasses] || colorClasses.purple;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{
        scale: isWinner ? 1.05 : 1,
        opacity: 1,
      }}
      transition={{ duration: 0.3 }}
      className={`
        relative rounded-xl p-6 backdrop-blur-sm border-2
        bg-gradient-to-br ${bgClass}
        ${isWinner ? "ring-4 ring-green-400 shadow-2xl shadow-green-500/50" : ""}
      `}
    >
      {rank && (
        <div className="absolute -top-3 -right-3 bg-slate-900 border-2 border-slate-700 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
          #{rank}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="text-5xl">{agent.emoji}</div>
        <div>
          <h3 className="text-xl font-bold text-white">{agent.name}</h3>
          <p className="text-sm text-slate-300">
            {agent.performance.transactionCount} transactions
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Portfolio Value */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Portfolio Value</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            Ξ {agent.portfolio.toFixed(4)}
            {agent.performance.totalReturn > 0.05 ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : agent.performance.totalReturn < -0.05 ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <Minus className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div
            className={`text-sm mt-1 ${
              agent.performance.totalReturn > 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {agent.performance.totalReturn > 0 ? "+" : ""}
            {agent.performance.totalReturn.toFixed(3)}%
          </div>
        </div>

        {/* Latest Decision */}
        <div className="bg-slate-900/30 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Latest Action</div>
          <div className="text-sm font-semibold text-white mb-1">
            {agent.decision.action}
          </div>
          <div className="text-xs text-slate-300 line-clamp-2">
            {agent.decision.reasoning}
          </div>
        </div>

        {/* Gas Costs */}
        <div className="flex justify-between text-xs text-slate-400">
          <span>Total Gas Spent:</span>
          <span className="text-orange-400 font-mono">
            Ξ {agent.performance.totalGasCosts.toFixed(6)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}