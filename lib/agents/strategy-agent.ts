import Anthropic from "@anthropic-ai/sdk";
import { MarketData, Decision, Transaction, Performance } from "../types";
import { ETHERFI_STRATEGIES, calculateStrategyYield } from "../strategies/etherfi-strategies";

export class StrategyAgent {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  portfolio: number;
  transactions: Transaction[];
  currentStrategy: string;
  currentLeverage: number;
  private client: Anthropic;

  constructor(config: { name: string; emoji: string; color: string; prompt: string }) {
    this.name = config.name;
    this.emoji = config.emoji;
    this.color = config.color;
    this.personality = config.prompt;
    this.portfolio = 10; // Start with 10 ETH
    this.transactions = [];
    this.currentStrategy = "SIMPLE_STAKE";
    this.currentLeverage = 1;

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async makeDecision(marketData: MarketData): Promise<Decision> {
    try {
      // Build strategy options summary for Claude
      const strategyOptions = Object.entries(ETHERFI_STRATEGIES)
        .map(([key, strat]) => {
          const calc = calculateStrategyYield(strat, strat.maxLeverage, marketData.gasPrice, this.portfolio);
          return `${key}: ${strat.description} | Net APY: ${calc.netAPY.toFixed(2)}% | Risk: ${strat.riskLevel} | Gas Cost: Ξ${calc.gasCost.toFixed(6)}`;
        })
        .join("\n");

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${this.personality}

CURRENT MARKET DATA:
- Day: ${marketData.day}
- EtherFi Base APY: ${marketData.apy}%
- Gas Price: ${marketData.gasPrice} gwei
- Market Trend: ${marketData.trend}
- Market Sentiment: ${marketData.sentiment}

YOUR CURRENT POSITION:
- Portfolio: ${this.portfolio.toFixed(4)} ETH
- Current Strategy: ${this.currentStrategy}
- Current Leverage: ${this.currentLeverage}x

AVAILABLE STRATEGIES (with current market conditions):
${strategyOptions}

DECIDE YOUR ACTION:
Choose a strategy and leverage level based on market conditions.

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "strategy": "<STRATEGY_KEY from above>",
  "leverage": <1-10>,
  "reasoning": "Brief 1-2 sentence explanation mentioning specific strategy choice and why",
  "confidence": <1-10>
}`,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "{}";

      const decision = this.parseDecision(responseText);

      // Execute the decision
      this.executeDecision(decision, marketData);

      return decision;
    } catch (error) {
      console.error(`Error in ${this.name} decision:`, error);

      const fallbackDecision: Decision = {
        strategy: this.currentStrategy,
        leverage: this.currentLeverage,
        reasoning: "API error, maintaining current position",
        action: this.currentStrategy,
        };

      this.executeDecision(fallbackDecision, marketData);
      return fallbackDecision;
    }
  }

  private parseDecision(response: string): Decision {
    try {
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/```json\n?/g, "");
      cleanResponse = cleanResponse.replace(/```\n?/g, "");
      cleanResponse = cleanResponse.trim();

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate strategy exists
        if (!ETHERFI_STRATEGIES[parsed.strategy]) {
          parsed.strategy = this.currentStrategy;
        }

        return parsed;
      }

      throw new Error("No JSON found in response");
    } catch (e) {
      console.error(`Failed to parse decision from ${this.name}:`, e);
      return {
        strategy: this.currentStrategy,
        leverage: this.currentLeverage,
        reasoning: "Unable to parse decision, maintaining position",
      };
    }
  }

  private executeDecision(decision: Decision, marketData: MarketData): void {
  const strategyKey = decision.strategy || this.currentStrategy;
  const leverage = Number(decision.leverage) || this.currentLeverage;
  const strategy = ETHERFI_STRATEGIES[strategyKey];

  if (!strategy) {
    console.error(`Invalid strategy: ${strategyKey}`);
    return;
  }

  // Calculate yields
  const yields = calculateStrategyYield(strategy, leverage, marketData.gasPrice, this.portfolio);

  const transaction: Transaction = {
    day: marketData.day,
    action: strategyKey,
    reasoning: decision.reasoning || "No reasoning provided",
    portfolioBefore: this.portfolio,
    portfolioAfter: this.portfolio,
    gasCost: 0,
  };

  // Apply gas costs if changing strategy
  const isChanging = strategyKey !== this.currentStrategy || leverage !== this.currentLeverage;
  
  if (isChanging) {
    this.portfolio -= yields.gasCost;
    transaction.gasCost = yields.gasCost;
  }

  // Apply daily yield (annual APY / 365)
  const dailyYield = (this.portfolio * yields.netAPY) / 100 / 365;
  this.portfolio += dailyYield;

  transaction.portfolioAfter = this.portfolio;
  this.transactions.push(transaction);

  // Update current strategy
  this.currentStrategy = strategyKey;
  this.currentLeverage = leverage;
}

  getPerformance(): Performance {
    const initialValue = 10;
    const currentValue = this.portfolio;
    const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
    const totalGasCosts = this.transactions.reduce((sum, tx) => sum + tx.gasCost, 0);

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
      leverage: this.currentLeverage,
      details: ETHERFI_STRATEGIES[this.currentStrategy]
    };
  }
}