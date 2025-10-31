/**
 * Application constants
 */
export const CONSTANTS = {
  // Odds constants
  ODDS_PRECISION: 20, // 10^20
  DEFAULT_LADDER_STEP: 125, // 0.125% = 125 basis points

  // Expiry
  DEFAULT_ORDER_EXPIRY: 2209006800, // Year 2040 (deprecated field)
  DEFAULT_API_EXPIRY_OFFSET: 24 * 60 * 60, // 24 hours from now

  // WebSocket
  WS_RECONNECT_DELAY: 5 * 1000, // 5 seconds
  MAX_WS_RECONNECT_ATTEMPTS: 10,
} as const;

/**
 * Chain ids by network
 */
export const CHAIN_IDS = {
  mainnet: 4162,
  testnet: 79479957,
} as const;

/**
 * Token addresses by network
 */
export const TOKEN_ADDRESSES = {
  mainnet: {
    USDC: "0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B",
  },
  testnet: {
    USDC: "0x1BC6326EA6aF2aB8E4b6Bc83418044B1923b2956",
  },
} as const;

/**
 * API URLs by network
 */
export const API_URLS = {
  mainnet: {
    api: "https://api.sx.bet",
    rpc: "https://rpc.sx-rollup.gelato.digital",
    explorer: "https://explorerl2.sx.technology",
  },
  testnet: {
    api: "https://api.toronto.sx.bet",
    rpc: "https://rpc.sx-rollup-testnet.t.raas.gelato.cloud",
    explorer: "https://explorerl2.toronto.sx.technology",
  },
} as const;

/**
 * WebSocket channel patterns
 */
export const WS_CHANNELS = {
  ACTIVE_ORDERS: (token: string, wallet: string) =>
    `active_orders_v2:${token}:${wallet}`,
  ORDER_BOOK: (token: string, marketHash: string) =>
    `order_book_v2:${token}:${marketHash}`,
  BEST_ODDS: (baseToken: string) => `best_odds:${baseToken}`,
  MARKETS: "markets",
  RECENT_TRADES: "recent_trades",
  RECENT_TRADES_CONSOLIDATED: "recent_trades_consolidated",
  MAIN_LINE: "main_line",
  LIVE_SCORES: (eventId: string) => `live_scores:${eventId}`,
  PARLAY_MARKETS: "markets:parlay",
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  METADATA: "/metadata",
  MARKETS_ACTIVE: "/markets/active",
  MARKETS_FIND: "/markets/find",
  MARKETS_POPULAR: "/markets/popular",
  ORDERS: "/orders",
  ORDERS_NEW: "/orders/new",
  ORDERS_CANCEL: "/orders/cancel/v2",
  ORDERS_CANCEL_EVENT: "/orders/cancel/event",
  ORDERS_CANCEL_ALL: "/orders/cancel/all",
  ORDERS_APPROVE: "/orders/approve",
  ORDERS_FILL: "/orders/fill/v2",
  ORDERS_BEST_ODDS: "/orders/odds/best",
  TRADES: "/trades",
  TRADES_ORDERS: "/trades/orders",
  TRADES_CONSOLIDATED: "/trades/consolidated",
  LEAGUES: "/leagues",
  LEAGUES_ACTIVE: "/leagues/active",
  LEAGUES_TEAMS: (id: number) => `/leagues/teams/${id}`,
  SPORTS: "/sports",
  FIXTURES_ACTIVE: "/fixture/active",
  FIXTURES_STATUS: "/fixture/status",
  LIVE_SCORES: "/live-scores",
  HEARTBEAT: "/heartbeat",
  USER_TOKEN: "/user/token",
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  MISSING_PRIVATE_KEY: "Private key is required. Set PRIVATE_KEY in .env",
  MISSING_API_KEY: "SX API key is required. Set SX_API_KEY in .env",
  INVALID_CONFIG: "Invalid configuration",
  INVALID_NETWORK: "Invalid network environment",
  CONNECTION_FAILED: "Failed to connect to SX API",
  WEBSOCKET_FAILED: "WebSocket connection failed",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  EXPOSURE_EXCEEDED: "Exposure limit exceeded",
  INVALID_ODDS: "Invalid odds format or not on ladder",
  INVALID_STAKE: "Invalid stake amount",
  ORDER_SUBMISSION_FAILED: "Failed to submit order",
  SIGNATURE_FAILED: "Failed to sign order",
  RATE_LIMIT_EXCEEDED: "API rate limit exceeded",
} as const;
