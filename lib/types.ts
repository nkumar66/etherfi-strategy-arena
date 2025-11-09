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
  leverage?: number;
  action?: string;
  reasoning: string;
  confidence?: number;
  [key: string]: string | number | undefined;
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