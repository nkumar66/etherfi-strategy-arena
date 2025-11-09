import { NextRequest, NextResponse } from "next/server";
import { StrategyAgent } from "@/lib/agents/strategy-agent";
import { AGENT_PERSONALITIES } from "@/lib/agents/personalities";
import { generateMockData } from "@/lib/data/mock-market-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { days = 30 } = body;

    console.log(`Starting competition for ${days} days...`);

    // Create 4 agents with their personalities
    const agents = Object.values(AGENT_PERSONALITIES).map(
      (config) => new StrategyAgent(config)
    );

    console.log(`Created ${agents.length} agents:`, agents.map(a => a.name));

    // Generate market data
    const marketData = generateMockData(days);
    console.log(`Generated ${marketData.length} days of market data`);

    // Results array to store each day's state
    const results = [];

    // Run competition day by day
    for (let day = 0; day < marketData.length; day++) {
      const dayData = marketData[day];

      // Add delay every day to avoid rate limits (15 seconds)
      if (day > 0) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log(`Day ${day}: APY ${dayData.apy}%, Gas ${dayData.gasPrice} gwei`);

      // Each agent makes a decision (in parallel for speed)
      const decisions = await Promise.all(
        agents.map((agent) => agent.makeDecision(dayData))
      );

      // Collect current state for this day
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
            currentLeverage: currentStrat.leverage,
            strategyDetails: currentStrat.details,
            performance: agent.getPerformance(),
          };
        }),
      });
    }

    // Calculate final rankings
    const finalRankings = agents
      .map((agent) => {
        const currentStrat = agent.getCurrentStrategy();
        return {
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          currentStrategy: currentStrat.strategy,
          currentLeverage: currentStrat.leverage,
          performance: agent.getPerformance(),
        };
      })
      .sort((a, b) => b.performance.totalReturn - a.performance.totalReturn);

    console.log("Competition complete! Final rankings:");
    finalRankings.forEach((agent, idx) => {
      console.log(
        `${idx + 1}. ${agent.emoji} ${agent.name}: ${agent.performance.totalReturn.toFixed(3)}% ` +
        `(Strategy: ${agent.currentStrategy} @ ${agent.currentLeverage}x)`
      );
    });

    return NextResponse.json({
      success: true,
      results,
      rankings: finalRankings,
    });
  } catch (error) {
    console.error("Competition error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Competition failed",
      },
      { status: 500 }
    );
  }
}