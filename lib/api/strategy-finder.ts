// lib/api/strategy-finder.ts
// Combines Aave and Merkl data into computed StrategyOption[] with real formulas.

import { getAllAaveRates, AaveRate } from "./aave";
import { getMerklOpportunities, MerklOpportunity } from "./merkl";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface StrategyOption {
  name: string;
  description: string;
  expectedAPY: number; // % per year
  protocols: string[];
  networks: string[];
  risk: RiskLevel;
  steps: string[];
}

/** Tunables */
const BASE_WEETH_APY = Number(process.env.BASE_WEETH_APY ?? 3.0); // EtherFi base ~3%
const DEFAULT_LEVERAGE = Number(process.env.DEFAULT_LEVERAGE ?? 5); // safe-ish showcase
const GAS_APY_PENALTY_PER_GWEI = Number(process.env.GAS_APY_PENALTY_PER_GWEI ?? 0.01); // % APY lost per gwei (model)

/** Aave leverage loop: supply earns S, borrow costs B, leverage L -> (S - B) * L */
export function leveragedLoopAPY(supplyAPY: number, borrowAPY: number, leverage: number): number {
  const net = supplyAPY - borrowAPY;
  return Math.max(0, net * leverage);
}

/** Merkl boosted: base + incentive */
export function merklBoostedAPY(baseAPY: number, incentiveAPR: number): number {
  return Math.max(0, baseAPY + incentiveAPR);
}

/** Gas penalty (simple model). Higher gas implies more rebalancing friction → lower effective APY */
export function applyGasPenalty(apy: number, gasGwei: number): number {
  const penalty = gasGwei * GAS_APY_PENALTY_PER_GWEI;
  return Math.max(0, apy - penalty);
}

/** Risk heuristic to tag strategies based on leverage/asset type */
function riskFromContext(opts: { leverage?: number; token?: string; protocol?: string }): RiskLevel {
  const lev = opts.leverage ?? 1;
  const t = (opts.token ?? "").toUpperCase();
  const isStable = t === "USDC" || t === "USDT" || t === "DAI";
  if (lev >= 10) return "EXTREME";
  if (lev >= 6) return "HIGH";
  if (!isStable) return "MEDIUM";
  return "LOW";
}

export async function findAllStrategies(): Promise<{
  merklOpportunities: MerklOpportunity[];
  aaveRates: AaveRate[];
  topStrategies: StrategyOption[];
}> {
  const [merklOpportunities, aaveRates] = await Promise.all([
    getMerklOpportunities(),
    getAllAaveRates(),
  ]);

  const strategies = generateCombinedStrategies(merklOpportunities, aaveRates);

  return {
    merklOpportunities,
    aaveRates,
    topStrategies: strategies,
  };
}

function generateCombinedStrategies(
  merkl: MerklOpportunity[],
  aave: AaveRate[],
): StrategyOption[] {
  const out: StrategyOption[] = [];

  // 1) Baseline: Simple weETH
  out.push({
    name: "Simple weETH Holding",
    description: "Stake ETH via EtherFi to receive weETH and earn base network rewards.",
    expectedAPY: BASE_WEETH_APY,
    protocols: ["EtherFi"],
    networks: ["Ethereum"],
    risk: "LOW",
    steps: ["Stake ETH on EtherFi", "Receive weETH", `Earn ~${BASE_WEETH_APY.toFixed(2)}% APY`],
  });

  // 2) Aave loops for WETH/weETH markets across networks
  const wethMarkets = aave.filter(r => r.symbol.toUpperCase().includes("WETH"));
  for (const m of wethMarkets) {
    const loopApy = leveragedLoopAPY(BASE_WEETH_APY, m.borrowAPY, DEFAULT_LEVERAGE);
    out.push({
      name: `Aave Loop ×${DEFAULT_LEVERAGE} (${m.network})`,
      description:
        `Supply weETH, borrow ETH at ${m.borrowAPY.toFixed(2)}%, convert to weETH, repeat ${DEFAULT_LEVERAGE}×.`,
      expectedAPY: loopApy,
      protocols: ["EtherFi", "Aave"],
      networks: [m.network],
      risk: riskFromContext({ leverage: DEFAULT_LEVERAGE, token: "WETH" }),
      steps: [
        "Supply weETH to Aave",
        `Borrow ETH at ${m.borrowAPY.toFixed(2)}%`,
        "Swap to weETH and resupply",
        `Repeat until ×${DEFAULT_LEVERAGE}`,
        `Net: ${(loopApy).toFixed(2)}% APY (pre-gas)`,
      ],
    });
  }

  // 3) Merkl boosted lending (top few)
  for (const opp of merkl.slice(0, 10)) {
    const boosted = merklBoostedAPY(BASE_WEETH_APY, opp.apr);
    out.push({
      name: `Merkl Boost: ${opp.token} on ${opp.protocol} (${opp.network})`,
      description:
        `Deposit ${opp.token} on ${opp.protocol} and earn extra incentives in ${opp.rewardToken ?? "reward token"}.`,
      expectedAPY: boosted,
      protocols: [opp.protocol, "Merkl", "EtherFi"],
      networks: [opp.network],
      risk: riskFromContext({ token: opp.token }),
      steps: [
        `Bridge/hold ${opp.token} on ${opp.network}`,
        `Lend on ${opp.protocol}`,
        `Earn Merkl incentives (~${opp.apr.toFixed(2)}% APR)`,
        `Total ≈ ${boosted.toFixed(2)}% APY (base + incentives)`,
      ],
    });
  }

  // 4) Aggressive combo: borrow stable on Aave, deploy to best Merkl opp
  const bestMerkl = merkl[0];
  const usdcBorrow = aave.find(r => r.symbol.toUpperCase() === "USDC" && r.borrowAPY > 0);
  if (bestMerkl && usdcBorrow) {
    // Toy model: earn Merkl APR minus borrow cost, with modest leverage
    const lev = Math.min(DEFAULT_LEVERAGE, 4);
    const gross = (bestMerkl.apr - usdcBorrow.borrowAPY) * lev + BASE_WEETH_APY;
    const expected = Math.max(0, gross);
    out.push({
      name: `Aggressive: Borrow ${usdcBorrow.symbol} → Deploy to ${bestMerkl.protocol}`,
      description:
        `Borrow ${usdcBorrow.symbol} on Aave at ${usdcBorrow.borrowAPY.toFixed(2)}% and deploy into ${bestMerkl.protocol} opportunity with Merkl incentives.`,
      expectedAPY: expected,
      protocols: ["EtherFi", "Aave", bestMerkl.protocol, "Merkl"],
      networks: ["Ethereum", bestMerkl.network],
      risk: riskFromContext({ leverage: lev, token: usdcBorrow.symbol }),
      steps: [
        `Supply weETH to Aave`,
        `Borrow ${usdcBorrow.symbol} at ${usdcBorrow.borrowAPY.toFixed(2)}%`,
        `Deploy to ${bestMerkl.protocol} (${bestMerkl.token})`,
        `Leverage ~×${lev}`,
        `Net (pre-gas): ${expected.toFixed(2)}% APY`,
      ],
    });
  }

  // Sort by highest APY first
  return out.sort((a, b) => b.expectedAPY - a.expectedAPY);
}
