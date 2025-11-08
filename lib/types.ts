export interface MarketData {
  day: number;
  date: Date;
  apy: number;
  gasPrice: number;
  tvl: number;
  trend: string;
  sentiment: string;
}

export interface Decision {
  action: string;
  reasoning: string;
  [key: string]: string | number | undefined; // Allow additional properties from different agents
}

export interface Transaction {
  day: number;
  action: string;
  reasoning: string;
  portfolioBefore: number;
  portfolioAfter: number;
  gasCost: number;
}

export interface Performance {
  initialValue: number;
  currentValue: number;
  totalReturn: number;
  totalGasCosts: number;
  transactionCount: number;
}