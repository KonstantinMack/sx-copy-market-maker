/**
 * Stake calculation and conversion utilities
 */

import { BigNumber } from "ethers";
import { isValidBigNumberString } from "./validation.js";

/**
 * Converts token amount to wei format
 * @param amount - Amount in human-readable format (e.g., 100)
 * @param decimals - Token decimals (e.g., 6 for USDC)
 * @returns Amount in wei format
 */
export function toWei(amount: number, decimals: number): string {
  const amountBN = BigNumber.from(Math.floor(amount * 10 ** decimals));
  return amountBN.toString();
}

/**
 * Converts wei format to token amount
 * @param amountWei - Amount in wei format
 * @param decimals - Token decimals (e.g., 6 for USDC)
 * @returns Amount in human-readable format
 */
export function fromWei(amountWei: string, decimals: number): number {
  const amountBN = BigNumber.from(amountWei);
  const divisor = BigNumber.from(10).pow(decimals);
  return amountBN.mul(10000).div(divisor).toNumber() / 10000;
}

/**
 * Formats stake for display
 * @param stakeWei - Stake in wei format
 * @param decimals - Token decimals
 * @param symbol - Token symbol (e.g., 'USDC')
 * @returns Formatted string (e.g., '100.00 USDC')
 */
export function formatStake(
  stakeWei: string,
  decimals: number,
  symbol: string
): string {
  const amount = fromWei(stakeWei, decimals);
  return `${amount.toFixed(decimals === 6 ? 2 : 4)} ${symbol}`;
}

/**
 * Adjusts stake by percentage
 * @param originalStake - Original stake in wei
 * @param percentage - Percentage to apply (e.g., 50 = 50% of original)
 * @returns Adjusted stake in wei
 */
export function adjustStakeByPercentage(
  originalStake: string,
  percentage: number
): string {
  if (!isValidBigNumberString(originalStake)) {
    throw new Error("Invalid stake format");
  }
  if (percentage < 0 || percentage > 1000) {
    throw new Error("Percentage must be between 0 and 1000");
  }

  const stakeBN = BigNumber.from(originalStake);
  // Use basis points (1% = 100 bps). Adjust precision as needed.
  const pctBps = Math.round(percentage * 100);
  return stakeBN.mul(pctBps).div(10000).toString();
}

/**
 * Validates stake is within limits
 * @param stake - Stake to validate in wei
 * @param minStake - Minimum allowed stake in wei
 * @param maxStake - Maximum allowed stake in wei
 * @returns Object with validation result and clamped value if needed
 */
export function validateStakeLimits(
  stake: string,
  minStake: string,
  maxStake: string
): { valid: boolean; reason?: string; clamped?: string } {
  const stakeBN = BigNumber.from(stake);
  const minBN = BigNumber.from(minStake);
  const maxBN = BigNumber.from(maxStake);

  if (stakeBN.lt(minBN)) {
    return {
      valid: false,
      reason: `Stake ${stake} is below minimum ${minStake}`,
      clamped: minStake,
    };
  }

  if (stakeBN.gt(maxBN)) {
    return {
      valid: false,
      reason: `Stake ${stake} exceeds maximum ${maxStake}`,
      clamped: maxStake,
    };
  }

  return { valid: true };
}

/**
 * Token-specific utilities
 */
export const StakeUtils = {
  // USDC utilities (6 decimals)
  USDC: {
    toWei: (amount: number) => toWei(amount, 6),
    fromWei: (amountWei: string) => fromWei(amountWei, 6),
    format: (amountWei: string) => formatStake(amountWei, 6, "USDC"),
  },

  // WSX utilities (18 decimals)
  WSX: {
    toWei: (amount: number) => toWei(amount, 18),
    fromWei: (amountWei: string) => fromWei(amountWei, 18),
    format: (amountWei: string) => formatStake(amountWei, 18, "WSX"),
  },

  // Generic utilities
  toWei,
  fromWei,
  format: formatStake,
  adjustByPercentage: adjustStakeByPercentage,
  validate: validateStakeLimits,
} as const;
