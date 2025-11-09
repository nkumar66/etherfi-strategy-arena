// app/api/agents/compete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { StrategyAgent, AgentConstraints } from "@/lib/agents/strategy-agent";
import { AGENT_PERSONALITIES } from "@/lib/agents/personalities";
import { generateMockData } from "@/lib/data/mock-market-data";
import { Decision, MarketData, Performance } from "@/lib/types";

type AgentKey = "The Maximalist" | "Risk Manager" | "Gas Optimizer" | "Yield Hunter";

interface AgentSnapshot {
  name: string;            // "Agent 1/2/3/4" (not the old labels)
  portfolio: number;       // simple simulated value
  decision: Decision;
  currentStrategy: string;
  currentAPY: number;
  strategyDetails: {
    name: string;
    description: string;
    riskLevel: string;
  };
  performance: Performance;
}

interface ResultDay {
  day: number;
  date: string;
  marketData: MarketData;
  agents: AgentSnapshot[];
}

interface RankingRow {
  name: string;
  currentStrategy: string;
  currentAPY: number;
  performance: Performance;
}

// Defaults merged with per-agent constraints coming from the UI
const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxLeverage: 3,
  allowedChains: ["ethereum", "base", "arbitrum"],
  riskTolerance: "MEDIUM",
  minGasPrice: 0,
  maxGasPrice: 200,
  preferredProtocols: ["etherfi", "aave", "morpho", "merkl"],
  preferEfficiency: true,
  preferStability: true,
  preferContrarian: false,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const days: number = typeof body.days === "number" ? body.days : 10;

    // constraints is shaped like { [AgentKey]: AgentConstraintsLike }
    const constraints: Partial<Record<AgentKey, AgentConstraints>> | undefined = body.constraints;

    // Build agents using displayName (or "Agent i") and ignore emoji/color
    const agents = (Object.entries(AGENT_PERSONALITIES) as Array<
      [AgentKey, { name: string; emoji: string; color: string; prompt: string }]
    >).map(([key, _meta], idx) => {
      const mergedConstraints: AgentConstraints = {
        ...DEFAULT_CONSTRAINTS,
        ...(constraints?.[key] ?? {}),
      };
      const display = mergedConstraints.displayName || `Agent ${idx + 1}`;
      return {
        name: display,
        agent: new StrategyAgent({ id: display, constraints: mergedConstraints }),
        perf: <Performance>{
          initialValue: 1000,
          currentValue: 1000,
          totalReturn: 0,
          totalGasCosts: 0,
          transactionCount: 0,
        },
      };
    });

    const marketData = generateMockData(days);
    const results: ResultDay[] = [];

    // Simulate day-by-day decisions and a tiny PnL update so returns are not all 0.00%
    for (let i = 0; i < marketData.length; i++) {
      const dayData: MarketData = marketData[i];

      const decisions: Decision[] = await Promise.all(agents.map(({ agent }) => agent.decide(dayData)));

      // naive daily compounding from expectedAPY
      decisions.forEach((d, idx) => {
        const perf = agents[idx].perf;
        const apy = (d.expectedAPY ?? 0) / 100;
        const daily = apy / 365;
        perf.currentValue = perf.currentValue * (1 + daily);
        perf.totalReturn = ((perf.currentValue - perf.initialValue) / perf.initialValue) * 100;
        perf.transactionCount += d.action !== "HOLD" ? 1 : 0;
      });

      const snapshots: AgentSnapshot[] = agents.map(({ name, agent, perf }, idx) => {
        const strat = agent.getCurrentStrategy();
        const d = decisions[idx];
        return {
          name,
          portfolio: perf.currentValue,
          decision: d,
          currentStrategy: strat.strategy,
          currentAPY: strat.apy,
          strategyDetails: {
            name: strat.strategy,
            description: strat.description,
            riskLevel: "MEDIUM", // store/compute from chosen strategy if you want
          },
          performance: perf,
        };
      });

      const dateIso =
        typeof dayData.date === "string"
          ? new Date(dayData.date).toISOString()
          : dayData.date instanceof Date
          ? dayData.date.toISOString()
          : new Date().toISOString();

      results.push({
        day: dayData.day,
        date: dateIso,
        marketData: dayData,
        agents: snapshots,
      });
    }

    const rankings: RankingRow[] = agents
      .map(({ name, agent, perf }) => {
        const strat = agent.getCurrentStrategy();
        return {
          name,
          currentStrategy: strat.strategy,
          currentAPY: strat.apy,
          performance: perf,
        };
      })
      .sort((a, b) => b.performance.totalReturn - a.performance.totalReturn);

    return NextResponse.json({
      success: true,
      results,
      rankings,
    });
  } catch (error) {
    console.error("Competition error:", error);
    const message = error instanceof Error ? error.message : "Competition failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
