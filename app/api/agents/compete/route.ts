import { NextRequest, NextResponse } from 'next/server';
import { StrategyAgent, AgentConstraints } from '@/lib/agents/strategy-agent';
import { AGENT_PERSONALITIES } from '@/lib/agents/personalities';
import { generateMockData } from '@/lib/data/mock-market-data';
import { Decision, MarketData, Performance } from '@/lib/types';

type AgentKey = 'The Maximalist' | 'Risk Manager' | 'Gas Optimizer' | 'Yield Hunter';

interface AgentSnapshot {
  name: string;
  emoji: string;
  color: string;
  portfolio: number;
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
  emoji: string;
  color: string;
  currentStrategy: string;
  currentAPY: number;
  performance: Performance;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const days: number = typeof body.days === 'number' ? body.days : 10;
    const constraints: Partial<Record<AgentKey, AgentConstraints>> | undefined = body.constraints;

    console.log(`Starting competition for ${days} days (hybrid engine)…`);

    // Build agents with optional per-agent constraints
    const agents = (Object.entries(AGENT_PERSONALITIES) as Array<[AgentKey, { name: string; emoji: string; color: string; prompt: string }]>)
      .map(([key, config]) => {
        const agentConstraints = constraints?.[key];
        return new StrategyAgent({
          ...config,
          constraints: agentConstraints,
        });
      });

    console.log(`Created ${agents.length} agents: ${agents.map((a) => a.name).join(', ')}`);

    const marketData = generateMockData(days);
    const results: ResultDay[] = [];

    for (let i = 0; i < marketData.length; i++) {
      const dayData = marketData[i];

      console.log(
        `Day ${dayData.day}: Gas ${dayData.gasPrice} gwei, Sentiment: ${dayData.sentiment}, Trend: ${dayData.trend}`
      );

      // Hybrid engine is inside StrategyAgent.makeDecision (math + optional Claude under limiter)
      const decisions: Decision[] = await Promise.all(agents.map((agent) => agent.makeDecision(dayData)));

      const snapshots: AgentSnapshot[] = agents.map((agent, idx) => {
        const strat = agent.getCurrentStrategy();
        const d = decisions[idx];
        return {
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          portfolio: agent.portfolio,
          decision: d,
          currentStrategy: strat.strategy,
          currentAPY: strat.apy,
          strategyDetails: {
            name: strat.strategy,
            description: strat.description,
            riskLevel: d.risk ?? 'MEDIUM',
          },
          performance: agent.getPerformance(),
        };
      });

      results.push({
        day: dayData.day,
        date: new Date(dayData.date).toISOString(),
        marketData: dayData,
        agents: snapshots,
      });
    }

    const rankings: RankingRow[] = agents
      .map((agent) => {
        const strat = agent.getCurrentStrategy();
        return {
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          currentStrategy: strat.strategy,
          currentAPY: strat.apy,
          performance: agent.getPerformance(),
        };
      })
      .sort((a, b) => b.performance.totalReturn - a.performance.totalReturn);

    console.log('Competition complete!');

    return NextResponse.json({
      success: true,
      results,
      rankings,
    });
  } catch (error) {
    console.error('Competition error:', error);
    const message = error instanceof Error ? error.message : 'Competition failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
