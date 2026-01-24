// Helper functions for USDCx bridging between Ethereum and Stacks
// Based on Circle xReserve protocol documentation

import { bytesToHex, hexToBytes } from '@stacks/common';
import { c32addressDecode } from 'c32check';

/**
 * Encodes a Stacks address into the format required by xReserve
 * Stacks addresses need to be reformatted to bytes32 for Ethereum contracts
 * Format: 11 zero bytes + 1 version byte + 20 hash160 bytes = 32 bytes total
 */
export const remoteRecipientCoder = {
  encode: (stacksAddress: string): Uint8Array => {
    // Decode c32 address to get version and hash160
    const decoded = c32addressDecode(stacksAddress);
    const version = decoded[0];
    const hash160 = decoded[1];
    
    // Create a 32-byte buffer (Circle xReserve format)
    const buffer = new Uint8Array(32);
    
    // Fill first 11 bytes with zeros (padding)
    // bytes[0-10] = 0x00 (11 zero bytes)
    
    // Set version at position 11
    buffer[11] = version;
    
    // Set hash160 (20 bytes) starting at position 12
    buffer.set(hexToBytes(hash160), 12);
    
    return buffer;
  },
  
  decode: (bytes: Uint8Array): string => {
    // Extract version and hash160 from Circle xReserve format
    // Skip first 11 zero bytes, version at byte 11, hash160 at bytes 12-31
    const version = bytes[11];
    const hash160 = bytesToHex(bytes.slice(12, 32));
    
    // Re-encode as c32 address (simplified - would need full c32 encoding)
    return `Decoded: v${version} hash:${hash160}`;
  }
};

/**
 * Converts a Uint8Array to a hex string with 0x prefix (bytes32 format)
 */
export function bytes32FromBytes(bytes: Uint8Array): `0x${string}` {
  return `0x${bytesToHex(bytes)}` as `0x${string}`;
}

/**
 * Format microseconds to USDC display value
 */
export function formatUSDC(microUSDC: bigint | number): string {
  const value = typeof microUSDC === 'bigint' ? Number(microUSDC) : microUSDC;
  return (value / 1_000_000).toFixed(2);
}

/**
 * Parse USDC display value to microseconds
 */
export function parseUSDC(usdc: string): bigint {
  const value = parseFloat(usdc);
  if (isNaN(value)) return BigInt(0);
  return BigInt(Math.floor(value * 1_000_000));
}
