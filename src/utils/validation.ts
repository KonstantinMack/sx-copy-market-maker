/**
 * Validation utilities for the SX Market Making Bot
 */

import type { Config } from "@/types/index.js";
import { BigNumber } from "ethers";
import {
  CONSTANTS,
  ERROR_MESSAGES,
  TOKEN_ADDRESSES,
} from "../config/constants.js";

/**
 * Validates Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates that a value is a valid BigNumber string
 */
export function isValidBigNumberString(value: string): boolean {
  try {
    BigNumber.from(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates odds format (must be between 0 and 10^20)
 */
export function isValidOdds(odds: string): boolean {
  try {
    const oddsBN = BigNumber.from(odds);
    const maxOdds = BigNumber.from(10).pow(CONSTANTS.ODDS_PRECISION);
    return oddsBN.gte(0) && oddsBN.lte(maxOdds);
  } catch {
    return false;
  }
}

/**
 * Checks if odds fall on the valid ladder step
 */
export function isOnOddsLadder(odds: string, stepSize: number): boolean {
  try {
    const oddsBN = BigNumber.from(odds);
    const step = BigNumber.from(10).pow(15).mul(stepSize);
    return oddsBN.mod(step).eq(0);
  } catch {
    return false;
  }
}

/**
 * Rounds odds down to nearest ladder step
 */
export function roundOddsToLadder(odds: string, stepSize: number): string {
  const oddsBN = BigNumber.from(odds);
  const step = BigNumber.from(10).pow(15).mul(stepSize);
  return oddsBN.div(step).mul(step).toString();
}

/**
 * Validates configuration object
 */
export function validateConfig(config: unknown): config is Config {
  if (!config || typeof config !== "object") {
    throw new Error(ERROR_MESSAGES.INVALID_CONFIG);
  }

  const cfg = config as Partial<Config>;

  // Validate network config
  if (!cfg.network) {
    throw new Error("Missing network configuration");
  }
  if (!["mainnet", "testnet"].includes(cfg.network.environment)) {
    throw new Error(
      "Invalid network environment. Must be 'mainnet' or 'testnet'"
    );
  }

  // Validate monitoring config
  if (!cfg.monitoring) {
    throw new Error("Missing monitoring configuration");
  }
  if (!Array.isArray(cfg.monitoring.walletAddresses)) {
    throw new Error("walletAddresses must be an array");
  }
  for (const addr of cfg.monitoring.walletAddresses) {
    if (!isValidAddress(addr)) {
      throw new Error(`Invalid wallet address: ${addr}`);
    }
  }
  if (
    !isValidAddress(
      TOKEN_ADDRESSES[cfg.network.environment][cfg.monitoring.baseToken]
    )
  ) {
    throw new Error(
      `Invalid token address for token: ${cfg.monitoring.baseToken}`
    );
  }

  // Validate copying config
  if (!cfg.copying) {
    throw new Error("Missing copying configuration");
  }
  if (
    !["percentage", "fixed", "none"].includes(cfg.copying.oddsAdjustment.method)
  ) {
    throw new Error("Invalid odds adjustment method");
  }
  if (
    !["percentage", "fixed", "copy"].includes(
      cfg.copying.stakeAdjustment.method
    )
  ) {
    throw new Error("Invalid stake adjustment method");
  }

  // Validate logging config
  if (!cfg.logging) {
    throw new Error("Missing logging configuration");
  }
  if (!["debug", "info", "warn", "error"].includes(cfg.logging.level)) {
    throw new Error("Invalid log level");
  }

  // Validate API config
  if (!cfg.api) {
    throw new Error("Missing API configuration");
  }
  if (typeof cfg.api.timeout !== "number" || cfg.api.timeout <= 0) {
    throw new Error("Invalid API timeout");
  }

  return true;
}

/**
 * Sanitizes sensitive data for logging
 */
export function sanitizeForLogging(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...data };
  const sensitiveKeys = [
    "privateKey",
    "apiKey",
    "signature",
    "password",
    "secret",
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      sanitized[key] = "***REDACTED***";
    }
  }

  return sanitized;
}
