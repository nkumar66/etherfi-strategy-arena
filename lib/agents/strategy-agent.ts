import Anthropic from "@anthropic-ai/sdk";
import { MarketData, Decision, Transaction, Performance } from "../types";
import { findAllStrategies, StrategyOption } from "../api/strategy-finder";

/** ---------- Types ---------- */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface AgentConstraints {
  maxLeverage: number;
  allowedChains: string[]; // lowercase names, e.g. ["ethereum","base"]
  riskTolerance: RiskLevel;
  minGasPrice: number; // gwei
  maxGasPrice: number; // gwei
  preferredProtocols: string[]; // e.g. ["EtherFi","Aave","Merkl"]
  displayName?: string;
  emoji?: string;
  color?: string;
}

/** ---------- Simple in-process token-bucket limiter for Claude ---------- */

class RateLimiter {
  private capacity: number;
  private tokens: number;
  private refillMs: number;
  private lastRefill: number;

  constructor(capacity: number, refillMs: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillMs = refillMs;
    this.lastRefill = Date.now();
  }
  private refill() {
    const now = Date.now();
    if (now - this.lastRefill >= this.refillMs) {
      const cycles = Math.floor((now - this.lastRefill) / this.refillMs);
      this.tokens = Math.min(this.capacity, this.tokens + cycles * this.capacity);
      this.lastRefill += cycles * this.refillMs;
    }
  }
  take(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// org limit ~5 req/min
const globalLimiter = new RateLimiter(5, 60_000);

/** ---------- Scoring constants (tune to taste) ---------- */

const BASE_WEETH_APY = Number(process.env.BASE_WEETH_APY ?? 3.0); // EtherFi base yield
const GAS_PENALTY_PER_GWEI = Number(process.env.GAS_APY_PENALTY_PER_GWEI ?? 0.02); // APY pts per gwei
const RISK_PENALTY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 2, HIGH: 5, EXTREME: 8 };

/** ---------- Agent ---------- */

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
  private bias: number;

  constructor(config: {
    name: string;
    emoji: string;
    color: string;
    prompt: string;
    constraints?: AgentConstraints;
    decisionMode?: "hybrid" | "numeric" | "ai"; // accepted but "hybrid" is used internally
  }) {
    this.name = config.name;
    this.emoji = config.emoji;
    this.color = config.color;
    this.personality = config.prompt;
    this.portfolio = 10;
    this.transactions = [];
    this.currentStrategy = "Simple weETH Holding";
    this.currentAPY = BASE_WEETH_APY;
    this.constraints = config.constraints;

    // allow UI overrides for identity
    if (this.constraints?.displayName) this.name = this.constraints.displayName;
    if (this.constraints?.emoji) this.emoji = this.constraints.emoji;
    if (this.constraints?.color) this.color = this.constraints.color;

    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // tiny deterministic tiebreaker so agents don't pick identically when scores tie
    this.bias = (Array.from(this.name).reduce((a, c) => a + c.charCodeAt(0), 0) % 7) * 0.1; // 0..0.6
  }

  /** Main decision loop: math first, then (if allowed) Claude re-scores top candidates. */
  async makeDecision(marketData: MarketData): Promise<Decision> {
    try {
      // Hard gas constraint gate
      if (this.constraints) {
        if (
          marketData.gasPrice < this.constraints.minGasPrice ||
          marketData.gasPrice > this.constraints.maxGasPrice
        ) {
          const hold: Decision = {
            strategy: this.currentStrategy,
            action: this.currentStrategy,
            reasoning: `Holding: gas ${marketData.gasPrice} gwei outside range ${this.constraints.minGasPrice}-${this.constraints.maxGasPrice}.`,
            expectedAPY: this.currentAPY,
            risk: this.constraints.riskTolerance,
          };
          this.executeDecision(hold, marketData);
          return hold;
        }
      }

      // Pull live strategy candidates built from Merkl + Aave data
      const { topStrategies } = await findAllStrategies();

      // Filter by constraints
      const eligible = this.filterByConstraints(topStrategies);

      // Score numerically and pick top-N
      const scored = eligible
        .map((s) => ({
          s,
          score: this.numericScore(s, marketData.gasPrice),
          adjAPY: this.adjustForGas(s.expectedAPY, marketData.gasPrice),
        }))
        .sort((a, b) => b.score - a.score);

      const top = scored.slice(0, Math.min(5, scored.length));
      const bestNumeric = top.length ? top[0] : { s: this.fallbackStrategy(), score: -1e9, adjAPY: this.currentAPY };

      // Try Claude to *reason* over top candidates and choose one
      let chosen: StrategyOption = bestNumeric.s;
      let chosenAPY = bestNumeric.adjAPY;
      let chosenReason = `Selected by numeric score respecting constraints (${this.constraints?.riskTolerance ?? "MEDIUM"} risk).`;

      if (globalLimiter.take()) {
        try {
          const claudePick = await this.askClaudeToChoose(top.map(t => t.s), marketData);
          // Validate Claude's choice against candidates
          const matched = top.find(t => normalize(t.s.name) === normalize(claudePick.strategyName));
          if (matched) {
            chosen = matched.s;
            chosenAPY = this.adjustForGas(claudePick.expectedAPY ?? matched.s.expectedAPY, marketData.gasPrice);
            chosenReason = claudePick.reasoning ?? "Chosen by Claude reasoning.";
          } else if (claudePick.strategyName) {
            // If Claude named something close, keep numeric choice but keep reasoning
            chosenReason = claudePick.reasoning ?? chosenReason;
          }
        } catch {
          // ignore rate limits or parsing errors; keep numeric
        }
      }

      const decision: Decision = {
        strategy: chosen.name,
        action: chosen.name,
        reasoning: chosenReason,
        expectedAPY: chosenAPY,
        protocols: chosen.protocols,
        risk: chosen.risk,
        confidence: 8,
      };

      this.executeDecision(decision, marketData);
      return decision;
    } catch (error) {
      console.error(`Error in ${this.name} decision:`, error);
      const fallback: Decision = {
        strategy: this.currentStrategy,
        action: this.currentStrategy,
        reasoning: "API error, maintaining current position",
        expectedAPY: this.currentAPY,
      };
      this.executeDecision(fallback, marketData);
      return fallback;
    }
  }

  /** ---------- Helper: filter by agent constraints ---------- */
  private filterByConstraints(strategies: StrategyOption[]): StrategyOption[] {
    if (!this.constraints) return strategies;

    const riskOrder: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
    const maxIdx = riskOrder.indexOf(this.constraints.riskTolerance);

    return strategies.filter((s) => {
      const riskOK = riskOrder.indexOf(s.risk) <= maxIdx;

      const chainsOK =
        this.constraints!.allowedChains.length === 0 ||
        s.networks.some((n) => this.constraints!.allowedChains.includes(n.toLowerCase()));

      const protOK =
        this.constraints!.preferredProtocols.length === 0 ||
        s.protocols.some((p) => this.constraints!.preferredProtocols.includes(p));

      return riskOK && chainsOK && protOK;
    });
  }

  /** ---------- Helper: pure numeric scoring ---------- */
  private numericScore(s: StrategyOption, gasGwei: number): number {
    const gasPenalty = gasGwei * GAS_PENALTY_PER_GWEI;
    const riskPenalty = RISK_PENALTY[s.risk];
    return s.expectedAPY - gasPenalty - riskPenalty + this.bias;
  }

  /** ---------- Helper: gas-adjust APY applied to returns ---------- */
  private adjustForGas(apy: number | undefined, gasGwei: number): number {
    const base = typeof apy === "number" ? apy : this.currentAPY;
    const penalty = gasGwei * GAS_PENALTY_PER_GWEI;
    return Math.max(0, base - penalty);
  }

  /** ---------- Claude chooser: reasons over top candidates, returns JSON ---------- */
  private async askClaudeToChoose(candidates: StrategyOption[], marketData: MarketData): Promise<{
    strategyName: string;
    expectedAPY?: number;
    reasoning?: string;
  }> {
    // Build compact candidate list for Claude
    const list = candidates
      .map(
        (c, i) =>
          `${i + 1}. name="${c.name}" apy=${c.expectedAPY.toFixed(2)} risk=${c.risk} protocols=[${c.protocols.join(
            ","
          )}] networks=[${c.networks.join(",")}]`
      )
      .join("\n");

    const constraintsText = this.constraints
      ? `Constraints:
- riskTolerance: ${this.constraints.riskTolerance}
- allowedChains: ${this.constraints.allowedChains.join(", ") || "any"}
- preferredProtocols: ${this.constraints.preferredProtocols.join(", ") || "any"}
- gasRange: ${this.constraints.minGasPrice}-${this.constraints.maxGasPrice} gwei`
      : "Constraints: none";

    const msg = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content:
            `You are a quantitative DeFi strategist. Choose ONE strategy that maximizes net APY while respecting constraints and gas realities.\n` +
            `Return STRICT JSON only, no markdown, with fields: strategyName (string), expectedAPY (number), reasoning (string <= 2 sentences).\n\n` +
            `Market:\n- gas=${marketData.gasPrice} gwei, trend=${marketData.trend}, sentiment=${marketData.sentiment}\n\n` +
            `${constraintsText}\n\n` +
            `Candidates:\n${list}\n\n` +
            `JSON: {"strategyName":"...", "expectedAPY": <number>, "reasoning":"..."}`
        }
      ]
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { strategyName: candidates[0]?.name ?? "Simple weETH Holding" };
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { strategyName: string; expectedAPY?: number; reasoning?: string };
      return parsed.strategyName
        ? parsed
        : { strategyName: candidates[0]?.name ?? "Simple weETH Holding" };
    } catch {
      return { strategyName: candidates[0]?.name ?? "Simple weETH Holding" };
    }
  }

  /** ---------- Fallback when we have zero candidates ---------- */
  private fallbackStrategy(): StrategyOption {
    return {
      name: "Simple weETH Holding",
      description: "Hold weETH and earn base staking rewards",
      expectedAPY: BASE_WEETH_APY,
      protocols: ["EtherFi"],
      networks: ["ethereum"],
      risk: "LOW",
      steps: ["Stake ETH on EtherFi", "Receive weETH", `Earn ~${BASE_WEETH_APY.toFixed(1)}% APY`],
    };
  }

  /** ---------- Apply decision to portfolio & record tx ---------- */
  private executeDecision(decision: Decision, marketData: MarketData): void {
    const newStrategy = decision.strategy || this.currentStrategy;
    const newAPY = typeof decision.expectedAPY === "number" ? decision.expectedAPY : this.currentAPY;

    const tx: Transaction = {
      day: marketData.day,
      action: newStrategy,
      reasoning: decision.reasoning || "No reasoning provided",
      portfolioBefore: this.portfolio,
      portfolioAfter: this.portfolio,
      gasCost: 0,
    };

    // Gas cost if changing strategy
    const isChanging = newStrategy !== this.currentStrategy;
    if (isChanging) {
      // simple gas cost model (heavier if cross-chain; here we just scale on gwei)
      const gasCost = (marketData.gasPrice / 1000) * 0.003;
      this.portfolio -= gasCost;
      tx.gasCost = gasCost;
    }

    // Daily yield
    const dailyYield = (this.portfolio * newAPY) / 100 / 365;
    this.portfolio += dailyYield;

    tx.portfolioAfter = this.portfolio;
    this.transactions.push(tx);

    // Update state
    this.currentStrategy = newStrategy;
    this.currentAPY = newAPY;
  }

  /** ---------- Public getters ---------- */

  getPerformance(): Performance {
    const initialValue = 10;
    const currentValue = this.portfolio;
    const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
    const totalGasCosts = this.transactions.reduce((sum, t) => sum + t.gasCost, 0);

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

/** ---------- Helpers ---------- */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}
