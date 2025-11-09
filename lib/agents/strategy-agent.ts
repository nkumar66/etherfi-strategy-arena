import Anthropic from "@anthropic-ai/sdk";
import { MarketData, Decision, Transaction, Performance } from "../types";
import { findAllStrategies } from "../api/strategy-finder";

export interface AgentConstraints {
  maxLeverage: number;
  allowedChains: string[];
  riskTolerance: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  minGasPrice: number;
  maxGasPrice: number;
  preferredProtocols: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class StrategyAgent {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  portfolio: number;
  transactions: Transaction[];
  currentStrategy: string;
  currentAPY: number;
  constraints?: AgentConstraints;
  private client: Anthropic;

  constructor(config: { name: string; emoji: string; color: string; prompt: string; constraints?: AgentConstraints }) {
    this.name = config.name;
    this.emoji = config.emoji;
    this.color = config.color;
    this.personality = config.prompt;
    this.portfolio = 10;
    this.transactions = [];
    this.currentStrategy = "Simple weETH Holding";
    this.currentAPY = 3.0;
    this.constraints = config.constraints;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async makeDecision(marketData: MarketData): Promise<Decision> {
    try {
      // Constraint check
      if (this.constraints) {
        if (
          marketData.gasPrice < this.constraints.minGasPrice ||
          marketData.gasPrice > this.constraints.maxGasPrice
        ) {
          console.log(`${this.name}: Gas ${marketData.gasPrice} outside range, holding position`);
          return {
            strategy: this.currentStrategy,
            action: this.currentStrategy,
            reasoning: `Gas price ${marketData.gasPrice} gwei is outside my allowed range (${this.constraints.minGasPrice}-${this.constraints.maxGasPrice} gwei)`,
            expectedAPY: this.currentAPY,
          };
        }
      }

      const { merklOpportunities, aaveRates, topStrategies } = await findAllStrategies();

      // Filter by constraints
      let filteredStrategies = topStrategies;
      if (this.constraints) {
        filteredStrategies = topStrategies.filter(strat => {
          const riskLevels = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
          const stratRiskIndex = riskLevels.indexOf(strat.risk);
          const maxRiskIndex = riskLevels.indexOf(this.constraints!.riskTolerance);
          if (stratRiskIndex > maxRiskIndex) return false;

          const hasPreferredProtocol =
            strat.protocols.some(p => this.constraints!.preferredProtocols.includes(p));
          if (!hasPreferredProtocol && this.constraints!.preferredProtocols.length > 0) return false;

          const hasAllowedChain =
            strat.networks.some(n => this.constraints!.allowedChains.includes(n.toLowerCase()));
          if (!hasAllowedChain) return false;

          return true;
        });
      }

      const merklText = merklOpportunities
        .slice(0, 8)
        .map(opp => `• ${opp.protocol} on ${opp.network}: ${opp.token} - ${opp.apr.toFixed(2)}% APR`)
        .join("\n");

      const aaveText = aaveRates
        .slice(0, 10)
        .map(rate => `• ${rate.network} - ${rate.symbol}: Supply ${rate.supplyAPY.toFixed(2)}% / Borrow ${rate.borrowAPY.toFixed(2)}%`)
        .join("\n");

      const strategiesText = filteredStrategies
        .map(
          (strat, idx) =>
            `${idx + 1}. ${strat.name} (${strat.risk}): ${strat.expectedAPY.toFixed(2)}% APY\n   ${strat.description}`,
        )
        .join("\n\n");

      const constraintsText = this.constraints
        ? `
YOUR CONSTRAINTS:
- Max Leverage: ${this.constraints.maxLeverage}x
- Allowed Chains: ${this.constraints.allowedChains.join(", ")}
- Risk Tolerance: ${this.constraints.riskTolerance}
- Preferred Protocols: ${this.constraints.preferredProtocols.join(", ")}

You MUST respect these constraints when choosing strategies.
`
        : "";

      // --- API call with retry-on-429 logic ---
      const callClaude = async (): Promise<Decision> => {
        const message = await this.client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 900,
          messages: [
            {
              role: "user",
              content: `${this.personality}

${constraintsText}

CURRENT MARKET DATA (Day ${marketData.day}):
- Gas Price: ${marketData.gasPrice} gwei
- Market Sentiment: ${marketData.sentiment}
- Market Trend: ${marketData.trend}

YOUR PORTFOLIO:
- Current: ${this.portfolio.toFixed(4)} ETH
- Current Strategy: ${this.currentStrategy}
- Current APY: ${this.currentAPY.toFixed(2)}%

REAL DEFI OPPORTUNITIES:

Merkl Incentives:
${merklText}

Aave Markets:
${aaveText}

FILTERED STRATEGIES (matching your constraints):
${strategiesText || "No strategies match your constraints - consider Simple weETH Holding"}

Choose the BEST strategy within your constraints.

RESPOND ONLY WITH VALID JSON (no markdown):
{
  "strategyName": "<strategy name>",
  "expectedAPY": <number>,
  "reasoning": "2-3 sentences",
  "protocols": ["list"],
  "risk": "LOW|MEDIUM|HIGH|EXTREME",
  "confidence": <1-10>
}`,
            },
          ],
        });

        const responseText =
          message.content[0].type === "text" ? message.content[0].text : "{}";
        const decision = this.parseDecision(responseText);
        this.executeDecision(decision, marketData);
        return decision;
      };

      try {
        return await callClaude();
      } catch (e) {
        const err = e as { status?: number; headers?: Headers; message?: string };
        if (err.status === 429 || /rate_limit/i.test(String(err.message))) {
          const retryAfter = Number(err.headers?.get?.("retry-after") ?? "60");
          console.warn(`${this.name}: Rate limited, retrying after ${retryAfter}s...`);
          await sleep(Math.max(retryAfter * 1000, 16000));
          return await callClaude();
        }
        throw e;
      }
    } catch (error) {
      console.error(`Error in ${this.name} decision:`, error);
      const fallbackDecision: Decision = {
        strategy: this.currentStrategy,
        action: this.currentStrategy,
        reasoning: "API error, maintaining current position",
      };
      this.executeDecision(fallbackDecision, marketData);
      return fallbackDecision;
    }
  }

  private parseDecision(response: string): Decision {
    try {
      const cleanResponse = response.trim()
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          strategy: parsed.strategyName || this.currentStrategy,
          action: parsed.strategyName || this.currentStrategy,
          reasoning: parsed.reasoning || "No reasoning provided",
          expectedAPY: parsed.expectedAPY || this.currentAPY,
          protocols: parsed.protocols || [],
          risk: parsed.risk || "MEDIUM",
          confidence: parsed.confidence || 5,
        };
      }
      throw new Error("No JSON found in response");
    } catch (e) {
      console.error(`Failed to parse decision from ${this.name}:`, e);
      return {
        strategy: this.currentStrategy,
        action: this.currentStrategy,
        reasoning: "Unable to parse decision, maintaining position",
        expectedAPY: this.currentAPY,
      };
    }
  }

  private executeDecision(decision: Decision, marketData: MarketData): void {
    const newStrategy = decision.strategy || this.currentStrategy;
    const newAPY = decision.expectedAPY || this.currentAPY;

    const transaction: Transaction = {
      day: marketData.day,
      action: newStrategy,
      reasoning: decision.reasoning || "No reasoning provided",
      portfolioBefore: this.portfolio,
      portfolioAfter: this.portfolio,
      gasCost: 0,
    };

    const isChanging = newStrategy !== this.currentStrategy;
    if (isChanging) {
      const gasCost = (marketData.gasPrice / 1000) * 0.003;
      this.portfolio -= gasCost;
      transaction.gasCost = gasCost;
    }

    const dailyYield = (this.portfolio * newAPY) / 100 / 365;
    this.portfolio += dailyYield;

    transaction.portfolioAfter = this.portfolio;
    this.transactions.push(transaction);

    this.currentStrategy = newStrategy;
    this.currentAPY = newAPY;
  }

  getPerformance(): Performance {
    const initialValue = 10;
    const currentValue = this.portfolio;
    const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
    const totalGasCosts = this.transactions.reduce(
      (sum, tx) => sum + tx.gasCost,
      0,
    );

    return {
      initialValue,
      currentValue,
      totalReturn,
      totalGasCosts,
      transactionCount: this.transactions.length,
    };
  }

  getCurrentStrategy() {
    return {
      strategy: this.currentStrategy,
      apy: this.currentAPY,
      description: this.currentStrategy,
    };
  }
}
