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
  strategy?: string;
  action?: string;
  reasoning: string;
  expectedAPY?: number;
  protocols?: string[];
  risk?: string;
  confidence?: number;
  [key: string]: string | number | string[] | undefined;
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