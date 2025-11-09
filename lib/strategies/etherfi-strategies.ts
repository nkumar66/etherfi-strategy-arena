export interface Strategy {
  name: string;
  type: "SIMPLE" | "LOOP" | "BORROW_LEND";
  baseAPY: number;
  borrowAPY?: number;
  lendAPY?: number;
  maxLeverage: number;
  gasMultiplier: number; // How many transactions needed
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  minGasPrice?: number; // Below this gas price is optimal
  description: string;
}

export const ETHERFI_STRATEGIES: Record<string, Strategy> = {
  SIMPLE_STAKE: {
    name: "Simple weETH Holding",
    type: "SIMPLE",
    baseAPY: 3.0,
    maxLeverage: 1,
    gasMultiplier: 0, // No transactions needed
    riskLevel: "LOW",
    description: "Hold weETH and earn base staking yield (3%)"
  },

  AAVE_LOOP_2X: {
    name: "Aave Loop 2x",
    type: "LOOP",
    baseAPY: 3.0, // Supply APY
    borrowAPY: 2.0, // Borrow cost
    maxLeverage: 2,
    gasMultiplier: 2, // 2 transactions (supply + borrow)
    riskLevel: "LOW",
    minGasPrice: 40,
    description: "Supply weETH (3%), borrow ETH (2%), loop 2x = 2% net yield"
  },

  AAVE_LOOP_5X: {
    name: "Aave Loop 5x",
    type: "LOOP",
    baseAPY: 3.0,
    borrowAPY: 2.0,
    maxLeverage: 5,
    gasMultiplier: 5,
    riskLevel: "MEDIUM",
    minGasPrice: 35,
    description: "Supply weETH (3%), borrow ETH (2%), loop 5x = 5% net yield"
  },

  AAVE_LOOP_10X: {
    name: "Aave Loop 10x",
    type: "LOOP",
    baseAPY: 3.0,
    borrowAPY: 2.0,
    maxLeverage: 10,
    gasMultiplier: 10,
    riskLevel: "HIGH",
    minGasPrice: 25,
    description: "Supply weETH (3%), borrow ETH (2%), loop 10x = 10% net yield"
  },

  AAVE_PYUSD: {
    name: "Aave PYUSD Strategy",
    type: "BORROW_LEND",
    baseAPY: 3.0, // weETH supply
    borrowAPY: 5.0, // PYUSD borrow cost
    lendAPY: 12.0, // PYUSD lending yield elsewhere
    maxLeverage: 3,
    gasMultiplier: 4,
    riskLevel: "HIGH",
    minGasPrice: 30,
    description: "Supply weETH (3%), borrow PYUSD (5%), lend PYUSD (12%) = 10% net"
  },

  AAVE_RLUSD: {
    name: "Aave RLUSD Strategy",
    type: "BORROW_LEND",
    baseAPY: 3.0,
    borrowAPY: 4.5,
    lendAPY: 11.0,
    maxLeverage: 3,
    gasMultiplier: 4,
    riskLevel: "HIGH",
    minGasPrice: 30,
    description: "Supply weETH (3%), borrow RLUSD (4.5%), lend RLUSD (11%) = 9.5% net"
  },

  AGGRESSIVE_MIX: {
    name: "Aggressive Multi-Strategy",
    type: "BORROW_LEND",
    baseAPY: 3.0,
    borrowAPY: 3.0,
    lendAPY: 15.0, // High-risk DeFi yields
    maxLeverage: 5,
    gasMultiplier: 8,
    riskLevel: "EXTREME",
    minGasPrice: 20,
    description: "Mix of high-yield strategies across multiple protocols = 15%+ potential"
  }
};

// Calculate actual yield for a strategy given leverage and market conditions
export function calculateStrategyYield(
  strategy: Strategy,
  leverage: number,
  gasPrice: number,
  portfolioSize: number
): {
  grossAPY: number;
  gasCost: number;
  netAPY: number;
  liquidationRisk: number;
} {
  leverage = Math.min(leverage, strategy.maxLeverage);

  let grossAPY = 0;

  if (strategy.type === "SIMPLE") {
    grossAPY = strategy.baseAPY;
  } else if (strategy.type === "LOOP") {
    // Net = (Supply APY - Borrow APY) * leverage
    const netPerLoop = strategy.baseAPY - (strategy.borrowAPY || 0);
    grossAPY = netPerLoop * leverage;
  } else if (strategy.type === "BORROW_LEND") {
    // Net = Supply APY + (Lend APY - Borrow APY) * leverage
    const borrowLendSpread = (strategy.lendAPY || 0) - (strategy.borrowAPY || 0);
    grossAPY = strategy.baseAPY + borrowLendSpread * (leverage - 1);
  }

  // Calculate gas costs
  const transactionsNeeded = strategy.gasMultiplier * (leverage / strategy.maxLeverage);
  const gasCostPerTx = (gasPrice / 1000) * 0.002; // Simplified: ~$2 per tx at 30 gwei
  const totalGasCost = gasCostPerTx * transactionsNeeded;

  // Annualized gas cost as % of portfolio
  const annualizedGasCost = (totalGasCost / portfolioSize) * 12; // Assume monthly rebalancing
  const netAPY = grossAPY - annualizedGasCost;

  // Liquidation risk increases with leverage
  const liquidationRisk = Math.min((leverage / strategy.maxLeverage) * 100, 100);

  return {
    grossAPY,
    gasCost: totalGasCost,
    netAPY,
    liquidationRisk
  };
}