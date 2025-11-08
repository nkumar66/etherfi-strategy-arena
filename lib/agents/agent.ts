import Anthropic from "@anthropic-ai/sdk";
import { MarketData, Decision, Transaction, Performance } from "../types";

export class StrategyAgent {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  portfolio: number;
  transactions: Transaction[];
  private client: Anthropic;

  constructor(config: { name: string; emoji: string; color: string; prompt: string }) {
    this.name = config.name;
    this.emoji = config.emoji;
    this.color = config.color;
    this.personality = config.prompt;
    this.portfolio = 10; // Start with 10 ETH
    this.transactions = [];
    
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async makeDecision(marketData: MarketData): Promise<Decision> {
    try {
      // Call Claude API with personality prompt
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${this.personality}

CURRENT MARKET DATA:
- Day: ${marketData.day}
- EtherFi APY: ${marketData.apy}%
- Gas Price: ${marketData.gasPrice} gwei
- TVL: $${marketData.tvl}B
- Market Trend: ${marketData.trend}
- Market Sentiment: ${marketData.sentiment}

Your current portfolio: ${this.portfolio.toFixed(4)} ETH

Make your decision now.`,
          },
        ],
      });

      // Extract the response text
      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "{}";

      // Parse Claude's JSON response
      const decision = this.parseDecision(responseText);

      // Execute the decision (simulate the transaction)
      this.executeDecision(decision, marketData);

      return decision;
    } catch (error) {
      console.error(`Error in ${this.name} decision:`, error);
      
      // Fallback decision if API fails
      const fallbackDecision: Decision = {
        action: "HOLD",
        reasoning: "API error, holding position",
      };
      
      this.executeDecision(fallbackDecision, marketData);
      return fallbackDecision;
    }
  }

  private parseDecision(response: string): Decision {
    try {
      // Remove markdown code blocks if present
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/```json\n?/g, "");
      cleanResponse = cleanResponse.replace(/```\n?/g, "");
      cleanResponse = cleanResponse.trim();

      // Find JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("No JSON found in response");
    } catch (e) {
      console.error(`Failed to parse decision from ${this.name}:`, e);
      return {
        action: "HOLD",
        reasoning: "Unable to parse decision, holding position",
      };
    }
  }

  private executeDecision(decision: Decision, marketData: MarketData): void {
    const transaction: Transaction = {
      day: marketData.day,
      action: decision.action,
      reasoning: decision.reasoning,
      portfolioBefore: this.portfolio,
      portfolioAfter: this.portfolio,
      gasCost: 0,
    };

    // Simple simulation logic
    const shouldTransact = ["REBALANCE", "EXECUTE", "ENTER", "INCREASE", "EXIT"].includes(
      decision.action
    );

    if (shouldTransact) {
      // Simulate gas cost (scaled by current gas price)
      const gasCost = (marketData.gasPrice / 1000) * 0.002; // ~$2 worth of ETH per transaction
      this.portfolio -= gasCost;
      transaction.gasCost = gasCost;
    }

    // Accumulate daily yield (simplified)
    const dailyYield = (this.portfolio * marketData.apy) / 100 / 365;
    this.portfolio += dailyYield;

    transaction.portfolioAfter = this.portfolio;
    this.transactions.push(transaction);
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
}