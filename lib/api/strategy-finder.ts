import { getMerklOpportunities, MerklOpportunity } from './merkl';
import { getAllAaveRates, AaveRate } from './aave';

export interface StrategyOption {
  name: string;
  description: string;
  expectedAPY: number;
  protocols: string[];
  networks: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  steps: string[];
}

export async function findAllStrategies(): Promise<{
  merklOpportunities: MerklOpportunity[];
  aaveRates: AaveRate[];
  topStrategies: StrategyOption[];
}> {
  // Fetch all data in parallel
  const [merklOpportunities, aaveRates] = await Promise.all([
    getMerklOpportunities(),
    getAllAaveRates(),
  ]);

  // Generate some example combined strategies
  const topStrategies = generateCombinedStrategies(merklOpportunities, aaveRates);

  return {
    merklOpportunities,
    aaveRates,
    topStrategies,
  };
}

function generateCombinedStrategies(
  merkl: MerklOpportunity[],
  aave: AaveRate[]
): StrategyOption[] {
  const strategies: StrategyOption[] = [];

  // Strategy 1: Simple weETH holding
  strategies.push({
    name: 'Simple weETH Holding',
    description: 'Hold weETH and earn base staking rewards',
    expectedAPY: 3.0,
    protocols: ['EtherFi'],
    networks: ['Ethereum'],
    risk: 'LOW',
    steps: ['Stake ETH on EtherFi', 'Receive weETH', 'Earn 3% APY'],
  });

  // Strategy 2: Aave Loop on Ethereum
  const ethWETH = aave.find(r => r.symbol === 'WETH' && r.network === 'Ethereum');
  if (ethWETH) {
    const loopAPY = 3.0 + (3.0 - ethWETH.borrowAPY) * 5; // 5x leverage
    strategies.push({
      name: 'Aave Loop 5x (Ethereum)',
      description: 'Supply weETH, borrow ETH, loop 5x',
      expectedAPY: loopAPY,
      protocols: ['EtherFi', 'Aave'],
      networks: ['Ethereum'],
      risk: 'MEDIUM',
      steps: [
        'Supply weETH to Aave',
        `Borrow ETH at ${ethWETH.borrowAPY}%`,
        'Convert to weETH',
        'Repeat 5x',
        `Net: ${loopAPY.toFixed(2)}% APY`,
      ],
    });
  }

  // Strategy 3: Cross-chain with Merkl incentives
  const topMerkl = merkl[0];
  if (topMerkl) {
    const baseAPY = 3.0 + topMerkl.apr;
    strategies.push({
      name: `Merkl Boosted (${topMerkl.network})`,
      description: `Lend ${topMerkl.token} on ${topMerkl.protocol} (${topMerkl.network}) with extra ${topMerkl.rewardToken} rewards`,
      expectedAPY: baseAPY,
      protocols: ['EtherFi', topMerkl.protocol, 'Merkl'],
      networks: [topMerkl.network],
      risk: 'MEDIUM',
      steps: [
        'Bridge weETH to ' + topMerkl.network,
        `Lend ${topMerkl.token} on ${topMerkl.protocol}`,
        `Earn ${topMerkl.apr}% APR in ${topMerkl.rewardToken}`,
        `Total: ${baseAPY.toFixed(2)}% APY`,
      ],
    });
  }

  // Strategy 4: Aggressive multi-protocol
  const baseUSDC = aave.find(r => r.symbol === 'USDC' && r.network === 'Base');
  if (baseUSDC && merkl[1]) {
    const aggressiveAPY = 3.0 + (merkl[1].apr - baseUSDC.borrowAPY) * 3;
    strategies.push({
      name: 'Aggressive Multi-Protocol',
      description: 'Leverage across multiple chains and protocols',
      expectedAPY: aggressiveAPY,
      protocols: ['EtherFi', 'Aave', merkl[1].protocol, 'Merkl'],
      networks: ['Ethereum', 'Base', merkl[1].network],
      risk: 'HIGH',
      steps: [
        'Supply weETH on Aave',
        `Borrow ${baseUSDC.symbol} at ${baseUSDC.borrowAPY}%`,
        `Deploy to ${merkl[1].protocol} for ${merkl[1].apr}% APR`,
        '3x leverage',
        `Net: ${aggressiveAPY.toFixed(2)}% APY`,
      ],
    });
  }

  return strategies.sort((a, b) => b.expectedAPY - a.expectedAPY);
}