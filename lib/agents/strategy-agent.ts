// lib/agents/strategy-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { MarketData, Decision } from "../types";
import { findAllStrategies, StrategyOption, RiskLevel } from "../api/strategy-finder";

/** ---------- Types ---------- */

export type AgentRisk = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface AgentConstraints {
  maxLeverage: number;
  allowedChains: string[];             // e.g. ["ethereum","base","arbitrum"]
  riskTolerance: AgentRisk;
  minGasPrice: number;                 // gwei
  maxGasPrice: number;                 // gwei
  preferredProtocols: string[];        // e.g. ["etherfi","aave","morpho","merkl"]
  displayName?: string;

  // soft preferences (if you expose them in UI)
  preferEfficiency?: boolean;
  preferStability?: boolean;
  preferContrarian?: boolean;
}

export interface AgentConfig {
  id: string;                          // stable per-agent id
  constraints: AgentConstraints;
  anthropicModel?: string;             // defaults below
  enableClaudeValidation?: boolean;    // single short validation per simulated day
}

/** ---------- Model fallbacks ---------- */

const FALLBACK_MODELS: string[] = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

/** ---------- Simple day-aware token bucket limiter (1 call/day default) ---------- */

class DailyTokenBucket {
  private capacity: number;
  private tokens: number;
  private refillMs: number;
  private lastRefill: number;
  private lastDaySeen: number | null;

  constructor(capacity: number, refillMs: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillMs = refillMs;
    this.lastRefill = Date.now();
    this.lastDaySeen = null;
  }

  tryConsume(day?: number): boolean {
    const now = Date.now();

    if (now - this.lastRefill >= this.refillMs) {
      const cycles = Math.floor((now - this.lastRefill) / this.refillMs);
      this.tokens = Math.min(this.capacity, this.tokens + cycles);
      this.lastRefill += cycles * this.refillMs;
    }

    if (typeof day === "number") {
      if (this.lastDaySeen === null || day !== this.lastDaySeen) {
        this.tokens = this.capacity;
        this.lastDaySeen = day;
      }
    }

    if (this.tokens > 0) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

/** ---------- Utility helpers ---------- */

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function withinGasWindow(gwei: number, min: number, max: number): boolean {
  return gwei >= min && gwei <= max;
}

function riskRank(r: RiskLevel | AgentRisk): number {
  switch (r) {
    case "LOW": return 0;
    case "MEDIUM": return 1;
    case "HIGH": return 2;
    case "EXTREME": return 3;
    default: return 2;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function estimateGasBps(steps: number, gasGwei: number): number {
  // ~5 bps per step at 20 gwei, scale linearly with gas price
  const baseAt20 = 5;
  const perStep = (gasGwei / 20) * baseAt20;
  return perStep * Math.max(1, steps);
}

function inferLeverageFromText(opt: StrategyOption): number {
  const text = `${opt.description} ${opt.steps.join(" ")}`.toLowerCase();
  const match = text.match(/(?:x|×|leverage\s*|loop\s*)(\d{1,2}(?:\.\d+)?)/);
  if (!match) return 1;
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function effectiveAPYPercent(
  opt: StrategyOption,
  market: MarketData,
  agentMaxLev: number,
  preferEfficiency?: boolean
): number {
  const gasBps = estimateGasBps(opt.steps.length, market.gasPrice);
  const lev = clamp(inferLeverageFromText(opt), 1, Math.max(1, agentMaxLev));

  let net = opt.expectedAPY;

  // penalty if the original idea implies more leverage than allowed
  const implied = inferLeverageFromText(opt);
  if (implied > lev) {
    const over = implied - lev;
    net -= over * 0.75;
  }

  // convert bps to percent
  net -= gasBps / 100;

  if (preferEfficiency) {
    const stepPenalty = Math.max(0, opt.steps.length - 3) * 0.25; // 0.25% beyond 3 steps
    net -= stepPenalty;
  }

  return net;
}

function stabilityPenalty(
  opt: StrategyOption,
  tolerance: AgentRisk,
  preferStability?: boolean
): number {
  if (!preferStability) return 0;
  const diff = riskRank(opt.risk) - riskRank(tolerance);
  return diff > 0 ? diff * 0.75 : 0; // 0.75% per tier above tolerance
}

function contrarianNudge(
  market: MarketData,
  preferContrarian?: boolean
): number {
  if (!preferContrarian) return 0;
  const t = `${market.trend || ""} ${market.sentiment || ""}`.toLowerCase();
  return /(bull|bear|greed|fear|extreme)/.test(t) ? 0.25 : 0;
}

/** ---------- Claude validation wrapper ---------- */

type ClaudeVerdict = {
  approve: boolean;
  reason: string;
  concerns?: string[];
};

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicContentBlock = AnthropicTextBlock | { type: string; [k: string]: unknown };
type AnthropicMessageLike = { content: AnthropicContentBlock[] };

function isTextBlock(b: unknown): b is AnthropicTextBlock {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "text" &&
    typeof (b as { text?: unknown }).text === "string"
  );
}

function extractFirstText(msg: unknown): string {
  if (
    typeof msg === "object" &&
    msg !== null &&
    Array.isArray((msg as { content?: unknown }).content)
  ) {
    const arr = (msg as AnthropicMessageLike).content;
    for (const block of arr) {
      if (isTextBlock(block)) return block.text;
    }
  }
  return "";
}

function safeParseClaudeJson(s: string): ClaudeVerdict | null {
  const trimmed = s.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const jsonStr = start >= 0 && end >= 0 ? trimmed.slice(start, end + 1) : trimmed;

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { approve?: unknown }).approve === "boolean" &&
      typeof (parsed as { reason?: unknown }).reason === "string"
    ) {
      const concernsVal = (parsed as { concerns?: unknown }).concerns;
      const concerns =
        Array.isArray(concernsVal) && concernsVal.every((c) => typeof c === "string")
          ? (concernsVal as string[])
          : undefined;

      return {
        approve: (parsed as { approve: boolean }).approve,
        reason: (parsed as { reason: string }).reason,
        concerns,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function claudeValidatePick(args: {
  models: string[];              // try these in order
  apiKey: string;
  agentName: string;
  market: MarketData;
  candidate: StrategyOption;
  candidateNetAPY: number;
  constraints: AgentConstraints;
}): Promise<ClaudeVerdict | null> {
  const client = new Anthropic({ apiKey: args.apiKey });

  const sys =
    "You are a terse DeFi risk checker. Sanity-check one EtherFi-centric strategy. Return ONLY tiny JSON under 600 chars.";

  const user = [
    `Agent: ${args.agentName || "Unnamed Agent"}`,
    `Market: { day: ${args.market.day}, gasGwei: ${args.market.gasPrice}, trend: ${args.market.trend}, sentiment: ${args.market.sentiment} }`,
    `Constraints: ${JSON.stringify(args.constraints)}`,
    `Candidate: ${args.candidate.name} | expectedAPY: ${args.candidate.expectedAPY.toFixed(2)}%`,
    `CandidateNetAPY: ${args.candidateNetAPY.toFixed(2)}%`,
    `Risk: ${args.candidate.risk} | Protocols: ${args.candidate.protocols.join(", ")}`,
    `Steps: ${args.candidate.steps.join(" -> ")}`,
    "",
    `Reply STRICT JSON: {"approve": boolean, "reason": "short", "concerns": ["short", "..."]}`,
  ].join("\n");

  type MinimalError = { status?: number; message?: string };

  for (const m of args.models) {
    try {
      const msg = await client.messages.create({
        model: m,
        max_tokens: 250,
        system: sys,
        temperature: 0,
        messages: [{ role: "user", content: user }],
      });
      const text = extractFirstText(msg);
      return safeParseClaudeJson(text);
    } catch (e) {
      const err = e as MinimalError;
      const is404 = err.status === 404 || (err.message ? /not[_-]?found/i.test(err.message) : false);
      if (!is404) {
        // Non-404 error: stop trying further models
        break;
      }
      // else: try next fallback model
    }
  }
  return null; // no model worked or all failed with 404
}

/** ---------- StrategyAgent ---------- */

type Scored = { opt: StrategyOption; netAPY: number; score: number };

export class StrategyAgent {
  private id: string;
  private cfg: AgentConfig;
  private claudeBucket: DailyTokenBucket;
  private lastChosen?: StrategyOption;
  private lastAPY?: number;

  constructor(cfg: AgentConfig) {
    this.id = cfg.id;
    this.cfg = {
      anthropicModel: "claude-3-sonnet-20240229", // safe default most keys can access
      enableClaudeValidation: true,
      ...cfg,
    };
    // 1 token per simulated day (86,400,000 ms)
    this.claudeBucket = new DailyTokenBucket(1, 86_400_000);
  }

  get displayName(): string {
    return this.cfg.constraints.displayName || this.id;
  }

  async decide(market: MarketData): Promise<Decision> {
    const { constraints } = this.cfg;

    // Gate by gas window
    if (!withinGasWindow(market.gasPrice, constraints.minGasPrice, constraints.maxGasPrice)) {
      return this.wrapDecision({
        strategy: "HOLD",
        action: "HOLD",
        reasoning: `Gas ${market.gasPrice} gwei outside window [${constraints.minGasPrice}, ${constraints.maxGasPrice}]`,
        expectedAPY: 0,
        protocols: [],
      });
    }

    // Pull candidate strategies (support either array or object with topStrategies)
    const all = await findAllStrategies();
    const candidates: StrategyOption[] = Array.isArray(all)
      ? all
      : ("topStrategies" in all && Array.isArray((all as { topStrategies: unknown }).topStrategies))
        ? (all as { topStrategies: StrategyOption[] }).topStrategies
        : [];

    const allowedChains = new Set(constraints.allowedChains.map(normalize));
    const preferredProtocols = new Set(constraints.preferredProtocols.map(normalize));

    const filtered: StrategyOption[] = candidates.filter((opt: StrategyOption) => {
      const onAllowedChain =
        opt.networks.length === 0 ||
        opt.networks.some((net: string) => allowedChains.has(normalize(net)));
      if (!onAllowedChain) return false;

      if (preferredProtocols.size > 0) {
        const match = opt.protocols.some((p: string) => preferredProtocols.has(normalize(p)));
        if (!match) return false;
      }

      // allow at most one tier above stated tolerance
      if (riskRank(opt.risk) - riskRank(constraints.riskTolerance) > 1) return false;

      return true;
    });

    if (filtered.length === 0) {
      return this.wrapDecision({
        strategy: "HOLD",
        action: "HOLD",
        reasoning: "No strategies satisfied constraints. Holding position.",
        expectedAPY: 0,
        protocols: [],
      });
    }

    const scored: Scored[] = filtered.map((opt: StrategyOption): Scored => {
      const net: number = effectiveAPYPercent(
        opt,
        market,
        constraints.maxLeverage,
        constraints.preferEfficiency
      );
      const stab: number = stabilityPenalty(opt, constraints.riskTolerance, constraints.preferStability);
      const contrarian: number = contrarianNudge(market, constraints.preferContrarian);
      const finalScore: number = net - stab + contrarian;
      return { opt, netAPY: net, score: finalScore };
    });

    scored.sort((a: Scored, b: Scored) => b.score - a.score);
    let chosen: Scored = scored[0];

    let reasoning: string = `Picked by math: ${chosen.opt.name} at ~${chosen.netAPY.toFixed(
      2
    )}% net APY after gas and caps.`;
    let approved = true;

    const wantsValidation = !!this.cfg.enableClaudeValidation;
    const hasKey =
      typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;

    if (wantsValidation && hasKey) {
      const canValidate = this.claudeBucket.tryConsume(market.day);
      if (canValidate) {
        const models = [
          ...(this.cfg.anthropicModel ? [this.cfg.anthropicModel] : []),
          ...FALLBACK_MODELS,
        ];

        const verdict = await claudeValidatePick({
          models,
          apiKey: process.env.ANTHROPIC_API_KEY as string,
          agentName: this.displayName,
          market,
          candidate: chosen.opt,
          candidateNetAPY: chosen.netAPY,
          constraints,
        });

        if (verdict) {
          approved = verdict.approve;
          const parts: string[] = [
            reasoning,
            `Claude: ${verdict.approve ? "approve" : "reject"}`,
            verdict.reason ? `(${verdict.reason})` : "",
            verdict.concerns && verdict.concerns.length ? `Concerns: ${verdict.concerns.join("; ")}` : "",
          ].filter((p: string) => p.length > 0);
          reasoning = parts.join(" ");
        } else {
          reasoning += " (Skipped/failed Claude validation.)";
        }
      } else {
        reasoning += " Skipped Claude validation due to daily rate limit.";
      }
    } else if (wantsValidation && !hasKey) {
      reasoning += " Skipped Claude validation (no API key).";
    }

    if (!approved) {
      const fallback: Scored | undefined = scored.find(
        (s: Scored) =>
          s.opt.name !== chosen.opt.name &&
          Math.abs(s.netAPY - chosen.netAPY) > 0.25 &&
          riskRank(s.opt.risk) <= riskRank(constraints.riskTolerance) + 1
      );
      if (fallback) {
        chosen = fallback;
        reasoning += ` Switching to alternative: ${fallback.opt.name} at ~${fallback.netAPY.toFixed(2)}% net APY.`;
      } else {
        reasoning += " No safe alternative found. Holding.";
        return this.wrapDecision({
          strategy: "HOLD",
          action: "HOLD",
          reasoning,
          expectedAPY: 0,
          protocols: [],
        });
      }
    }

    this.lastChosen = chosen.opt;
    this.lastAPY = chosen.netAPY;

    const decision: Decision = {
      strategy: chosen.opt.name,
      action: "ENTER_OR_MAINTAIN",
      reasoning,
      expectedAPY: Number(chosen.netAPY.toFixed(2)),
      protocols: chosen.opt.protocols,
    };
    return decision;
  }

  getCurrentStrategy() {
    return {
      strategy: this.lastChosen?.name ?? "HOLD",
      apy: typeof this.lastAPY === "number" ? this.lastAPY : 0,
      description: this.lastChosen?.description ?? "No active strategy",
    };
  }

  private wrapDecision(partial: {
    strategy: string;
    action: string;
    reasoning: string;
    protocols?: string[];
    expectedAPY?: number;
  }): Decision {
    return {
      strategy: partial.strategy,
      action: partial.action,
      reasoning: partial.reasoning,
      expectedAPY: partial.expectedAPY ?? 0,
      protocols: partial.protocols ?? [],
    };
  }
}

export default StrategyAgent;
