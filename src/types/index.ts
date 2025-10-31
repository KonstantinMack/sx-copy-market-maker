/**
 * Internal type definitions for the SX Market Making Bot
 */

import type { Market, Order } from "./sx.js";

/**
 * Export all types from other files
 */
export * from "./sx.js";
export * from "./config.js";

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Order modification details for logging
 */
export interface OrderModification {
  originalOrderHash: string;
  monitoredWallet: string;
  originalOdds: string;
  adjustedOdds: string;
  originalStake: string;
  adjustedStake: string;
  modifications: string[];
}

/**
 * Copy result from order copying
 */
export interface CopyResult {
  success: boolean;
  orderHash?: string;
  error?: string;
  originalOrder: Order;
  copiedOrder?: Order;
  modifications?: OrderModification;
}

/**
 * Tracked order information
 */
export interface TrackedOrder {
  orderHash: string;
  marketHash: string;
  eventId: string;
  sportId: number;
  totalBetSize: string;
  fillAmount: string;
  createdAt: number;
  originalOrderHash?: string; // If this is a copied order
  monitoredWallet?: string; // If this is a copied order
}

/**
 * Error context for error handling
 */
export interface ErrorContext {
  operation: string;
  orderHash?: string;
  marketHash?: string;
  wallet?: string;
  retryCount?: number;
  timestamp: number;
  additionalData?: Record<string, unknown>;
}

/**
 * Error categories
 */
export type ErrorCategory =
  | "network"
  | "api"
  | "validation"
  | "blockchain"
  | "critical";

/**
 * Error handling result
 */
export interface ErrorResult {
  action: "retry" | "skip" | "pause" | "shutdown";
  reason: string;
  retryAfter?: number;
}

/**
 * WebSocket connection state
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/**
 * WebSocket event types
 */
export type WSEventType =
  | "orderDetected"
  | "orderCancelled"
  | "orderFilled"
  | "orderUpdated"
  | "marketUpdated"
  | "error"
  | "reconnecting"
  | "connected"
  | "disconnected";

/**
 * WebSocket event payload
 */
export interface WSEvent {
  type: WSEventType;
  data: unknown;
  timestamp: number;
}

/**
 * Order event from WebSocket
 */
export interface OrderEvent {
  type: "detected" | "cancelled" | "filled" | "updated";
  order: Order;
  monitoredWallet: string;
  timestamp: number;
}

/**
 * Market update event from WebSocket
 */
export interface MarketEvent {
  type: "added" | "removed" | "updated";
  market: Market;
  timestamp: number;
}

/**
 * Rate limiter state
 */
export interface RateLimiterState {
  requestsPerSecond: number;
  requestsPerMinute: number;
  lastSecondReset: number;
  lastMinuteReset: number;
}

/**
 * API request options
 */
export interface APIRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * Balance information
 */
export interface BalanceInfo {
  token: string;
  balance: string;
  decimals: number;
  symbol: string;
  normalized: string; // Human-readable format
}

/**
 * Token information
 */
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

/**
 * Health check status
 */
export interface HealthStatus {
  healthy: boolean;
  websocket: {
    connected: boolean;
    lastHeartbeat: number;
  };
  api: {
    responsive: boolean;
    lastRequest: number;
  };
  balance: {
    sufficient: boolean;
    current: string;
    minimum: string;
  };
  exposure: {
    withinLimits: boolean;
    current: string;
    limit: string;
  };
  lastOrderDetected: number;
  uptime: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  ordersDetected: number;
  ordersCopied: number;
  ordersFiltered: number;
  ordersRejected: number;
  copySuccessRate: number;
  averageCopyLatency: number;
  apiErrors: number;
  wsReconnections: number;
  timestamp: number;
}

/**
 * Error codes
 */
export enum ErrorCode {
  // Network errors
  CONNECTION_FAILED = "CONNECTION_FAILED",
  TIMEOUT = "TIMEOUT",
  WEBSOCKET_DISCONNECTED = "WEBSOCKET_DISCONNECTED",

  // API errors
  API_ERROR = "API_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_RESPONSE = "INVALID_RESPONSE",

  // Validation errors
  INVALID_ORDER = "INVALID_ORDER",
  INVALID_ODDS = "INVALID_ODDS",
  INVALID_STAKE = "INVALID_STAKE",
  MARKET_NOT_FOUND = "MARKET_NOT_FOUND",

  // Risk management errors
  EXPOSURE_LIMIT_EXCEEDED = "EXPOSURE_LIMIT_EXCEEDED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ORDER_LIMIT_EXCEEDED = "ORDER_LIMIT_EXCEEDED",

  // Blockchain errors
  SIGNATURE_FAILED = "SIGNATURE_FAILED",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  APPROVAL_FAILED = "APPROVAL_FAILED",

  // Configuration errors
  INVALID_CONFIG = "INVALID_CONFIG",
  MISSING_API_KEY = "MISSING_API_KEY",
  MISSING_PRIVATE_KEY = "MISSING_PRIVATE_KEY",

  // Critical errors
  UNRECOVERABLE_ERROR = "UNRECOVERABLE_ERROR",
  SHUTDOWN_REQUIRED = "SHUTDOWN_REQUIRED",
}

/**
 * Custom error class
 */
export class BotError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public category: ErrorCategory,
    public context?: ErrorContext,
    public originalError?: Error
  ) {
    super(message);
    this.name = "BotError";
  }
}
