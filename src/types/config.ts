/**
 * Configuration type definitions for the SX Market Making Bot
 */

/**
 * Main configuration structure
 */
export interface Config {
  network: NetworkConfig;
  monitoring: MonitoringConfig;
  copying: CopyingConfig;
  logging: LoggingConfig;
  api: APIConfig;
}

/**
 * Network and connection configuration
 */
export interface NetworkConfig {
  environment: "mainnet" | "testnet";
  wsReconnectInterval: number;
  wsMaxRetries: number;
}

export type BaseToken = "USDC";

/**
 * Order monitoring configuration
 */
export interface MonitoringConfig {
  walletAddresses: string[];
  baseToken: BaseToken;
  filters: OrderFilters;
}

/**
 * Order filtering rules
 */
export interface OrderFilters {
  sports?: number[];
  marketTypes?: number[];
  leagues?: number[];
  minOdds?: string;
  maxOdds?: string;
  excludeParlay?: boolean;
  excludeLive?: boolean;
}

/**
 * Order copying behavior configuration
 */
export interface CopyingConfig {
  enabled: boolean;
  copyDelay: number;
  oddsAdjustment: OddsAdjustmentConfig;
  stakeAdjustment: StakeAdjustmentConfig;
  autoCancelOnSource: boolean;
}

/**
 * Odds adjustment strategy
 */
export interface OddsAdjustmentConfig {
  method: "percentage" | "fixed" | "none";
  value: number;
  ensureLadderCompliance: boolean;
}

/**
 * Stake adjustment strategy
 */
export interface StakeAdjustmentConfig {
  method: "percentage" | "fixed" | "copy";
  value: number;
  minStake: string;
  maxStake: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  console: boolean;
  file: FileLoggingConfig;
  includeStackTrace: boolean;
}

/**
 * File logging configuration
 */
export interface FileLoggingConfig {
  enabled: boolean;
  path: string;
  maxSize: string;
  maxFiles: number;
}

/**
 * API client configuration
 */
export interface APIConfig {
  retryPolicy: RetryPolicyConfig;
  timeout: number;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}
