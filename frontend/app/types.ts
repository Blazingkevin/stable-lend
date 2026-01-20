
export enum View {
  Dashboard = 'dashboard',
  Lend = 'lend',
  Borrow = 'borrow',
  Stats = 'stats',
  Bridge = 'bridge'
}

export interface UserPosition {
  supplied: number;
  borrowed: number;
  netApy: number;
  healthFactor: number;
  liquidationPrice: number;
}

export interface Asset {
  symbol: string;
  name: string;
  price: number;
  supplyApy: number;
  borrowApy: number;
  totalSupplied: number;
  totalBorrowed: number;
  utilization: number;
  icon: string;
}

export interface HistoryPoint {
  date: string;
  apy: number;
}
