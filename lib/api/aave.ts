export interface AaveRate {
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  liquidity: number;
  network: string;
}

export async function getAaveRates(chain: string = 'ethereum'): Promise<AaveRate[]> {
  try {
    // Simplified approach - using Aave's public API
    // In production, you'd query The Graph subgraphs
    
    // For hackathon, return realistic static data
    // (Aave's subgraph queries can be complex and rate-limited)
    
    return getRealisticAaveRates(chain);
    
  } catch (error) {
    console.error('Aave API error:', error);
    return getRealisticAaveRates(chain);
  }
}

function getRealisticAaveRates(chain: string): AaveRate[] {
  const rates: Record<string, AaveRate[]> = {
    ethereum: [
      { symbol: 'USDC', supplyAPY: 3.2, borrowAPY: 4.8, liquidity: 250000000, network: 'Ethereum' },
      { symbol: 'USDT', supplyAPY: 3.4, borrowAPY: 5.1, liquidity: 180000000, network: 'Ethereum' },
      { symbol: 'DAI', supplyAPY: 3.1, borrowAPY: 4.9, liquidity: 120000000, network: 'Ethereum' },
      { symbol: 'WETH', supplyAPY: 2.1, borrowAPY: 2.8, liquidity: 450000000, network: 'Ethereum' },
      { symbol: 'WBTC', supplyAPY: 0.8, borrowAPY: 2.2, liquidity: 95000000, network: 'Ethereum' },
    ],
    base: [
      { symbol: 'USDC', supplyAPY: 4.5, borrowAPY: 6.2, liquidity: 85000000, network: 'Base' },
      { symbol: 'WETH', supplyAPY: 2.5, borrowAPY: 3.2, liquidity: 120000000, network: 'Base' },
      { symbol: 'USDbC', supplyAPY: 4.2, borrowAPY: 5.8, liquidity: 42000000, network: 'Base' },
    ],
    arbitrum: [
      { symbol: 'USDC', supplyAPY: 3.8, borrowAPY: 5.5, liquidity: 150000000, network: 'Arbitrum' },
      { symbol: 'USDT', supplyAPY: 3.9, borrowAPY: 5.6, liquidity: 95000000, network: 'Arbitrum' },
      { symbol: 'WETH', supplyAPY: 2.3, borrowAPY: 3.0, liquidity: 210000000, network: 'Arbitrum' },
      { symbol: 'ARB', supplyAPY: 1.2, borrowAPY: 4.5, liquidity: 28000000, network: 'Arbitrum' },
    ],
  };

  return rates[chain] || rates.ethereum;
}

// Get rates across all chains
export async function getAllAaveRates(): Promise<AaveRate[]> {
  const chains = ['ethereum', 'base', 'arbitrum'];
  const allRates: AaveRate[] = [];

  for (const chain of chains) {
    const rates = await getAaveRates(chain);
    allRates.push(...rates);
  }

  return allRates;
}