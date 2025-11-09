import { NextRequest, NextResponse } from "next/server";
import { StrategyAgent } from "@/lib/agents/strategy-agent";
import { AGENT_PERSONALITIES } from "@/lib/agents/personalities";
import { generateMockData } from "@/lib/data/mock-market-data";

const AGENT_DELAY_MS = Number(process.env.ANTHROPIC_DELAY_MS ?? 13000); // ~13s keeps <5 req/min

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { days = 10, constraints } = body;

    console.log(`Starting REAL DATA competition for ${days} days...`);

    // build agents (optionally with constraints)
    const agents = Object.entries(AGENT_PERSONALITIES).map(([key, config]) => {
      const agentConstraints = constraints?.[key];
      return new StrategyAgent({ ...config, constraints: agentConstraints });
    });

    console.log(`Created ${agents.length} agents:`, agents.map(a => a.name));
    if (constraints) console.log("Using custom constraints:", constraints);

    const marketData = generateMockData(days);
    const results: Array<Record<string, unknown>> = [];

    for (let day = 0; day < marketData.length; day++) {
      const dayData = marketData[day];
      console.log(`Day ${day}: Gas ${dayData.gasPrice} gwei, Sentiment: ${dayData.sentiment}`);

      // ✅ SEQUENTIAL calls (no Promise.all) + delay between each agent
      const decisions: Array<{ action?: string; reasoning?: string; risk?: string }> = [];
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        try {
          const decision = await agent.makeDecision(dayData);
          decisions.push(decision);
        } catch (e) {
          console.warn(`Agent ${agent.name} decision failed on day ${day}:`, e);
          decisions.push({ action: "HOLD", reasoning: "API error, holding position" });
        }

        // delay between agent requests to stay under 5 req/min org limit
        if (i < agents.length - 1) {
          await sleep(AGENT_DELAY_MS);
        }
      }

      results.push({
        day: dayData.day,
        date: dayData.date,
        marketData: dayData,
        agents: agents.map((agent, idx) => {
          const currentStrat = agent.getCurrentStrategy();
          return {
            name: agent.name,
            emoji: agent.emoji,
            color: agent.color,
            portfolio: agent.portfolio,
            decision: decisions[idx],
            currentStrategy: currentStrat.strategy,
            currentAPY: currentStrat.apy,
            strategyDetails: {
              name: currentStrat.strategy,
              description: currentStrat.description,
              riskLevel: decisions[idx]?.risk || "MEDIUM",
            },
            performance: agent.getPerformance(),
          };
        }),
      });
    }

    const finalRankings = agents
      .map((agent) => {
        const currentStrat = agent.getCurrentStrategy();
        return {
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          currentStrategy: currentStrat.strategy,
          currentAPY: currentStrat.apy,
          performance: agent.getPerformance(),
        };
      })
      .sort((a, b) => b.performance.totalReturn - a.performance.totalReturn);

    console.log("Competition complete!");
    return NextResponse.json({ success: true, results, rankings: finalRankings });
  } catch (error) {
    console.error("Competition error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Competition failed" },
      { status: 500 }
    );
  }
}
