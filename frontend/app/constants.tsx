
import React from 'react';
import { Asset } from './types';

export const ASSETS: Asset[] = [
  {
    symbol: 'USDCx',
    name: 'Bridged USDC',
    price: 1.00,
    supplyApy: 0, // Will be populated from protocol stats
    borrowApy: 8.0,
    totalSupplied: 0, // Will be populated from protocol stats
    totalBorrowed: 0, // Will be populated from protocol stats
    utilization: 0, // Will be populated from protocol stats
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
  },
  {
    symbol: 'STX',
    name: 'Stacks',
    price: 0, // Dynamic - fetch from oracle
    supplyApy: 0,
    borrowApy: 0,
    totalSupplied: 0,
    totalBorrowed: 0,
    utilization: 0,
    icon: 'https://cryptologos.cc/logos/stacks-stx-logo.png'
  },
  {
    symbol: 'sBTC',
    name: 'Stacks Bitcoin',
    price: 42500,
    supplyApy: 0,
    borrowApy: 0,
    totalSupplied: 0,
    totalBorrowed: 0,
    utilization: 0,
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
