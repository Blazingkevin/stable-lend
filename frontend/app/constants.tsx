
import React from 'react';
import { Asset } from './types';

export const ASSETS: Asset[] = [
  {
    symbol: 'USDCx',
    name: 'Bridged USDC',
    price: 1.00,
    supplyApy: 8.42,
    borrowApy: 12.15,
    totalSupplied: 2450000,
    totalBorrowed: 1620000,
    utilization: 66.1,
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
  },
  {
    symbol: 'STX',
    name: 'Stacks',
    price: 1.85,
    supplyApy: 2.15,
    borrowApy: 4.80,
    totalSupplied: 15400000,
    totalBorrowed: 8200000,
    utilization: 53.2,
    icon: 'https://cryptologos.cc/logos/stacks-stx-logo.png'
  },
  {
    symbol: 'sBTC',
    name: 'Stacks Bitcoin',
    price: 42500,
    supplyApy: 1.80,
    borrowApy: 3.50,
    totalSupplied: 125,
    totalBorrowed: 45,
    utilization: 36.0,
    icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
  }
];

export const HISTORY_DATA = [
  { date: 'Jan 1', apy: 6.2 },
  { date: 'Jan 5', apy: 7.1 },
  { date: 'Jan 10', apy: 6.8 },
  { date: 'Jan 15', apy: 8.4 },
  { date: 'Jan 20', apy: 8.1 },
  { date: 'Jan 25', apy: 8.6 },
];
