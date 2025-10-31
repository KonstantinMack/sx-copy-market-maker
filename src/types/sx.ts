/**
 * Type definitions for SX.bet API
 * Based on https://api.docs.sx.bet
 */

/**
 * Market status on SX exchange
 */
export type MarketStatus = "ACTIVE" | "INACTIVE";

/**
 * Order status for updates
 */
export type OrderStatus = "ACTIVE" | "INACTIVE" | "FILLED";

/**
 * Market outcome result
 */
export type MarketOutcome = 0 | 1 | 2; // 0 = void, 1 = outcome one, 2 = outcome two

/**
 * Market type definitions
 */
export enum MarketType {
  ONE_X_TWO = 1,
  UNDER_OVER = 2,
  ASIAN_HANDICAP = 3,
  TWELVE = 52,
  TO_QUALIFY = 88,
  ASIAN_HANDICAP_GAMES = 201,
  FIRST_PERIOD_WINNER = 202,
  SECOND_PERIOD_WINNER = 203,
  THIRD_PERIOD_WINNER = 204,
  FOURTH_PERIOD_WINNER = 205,
  TWELVE_INCLUDING_OT = 226,
  OUTRIGHT_WINNER = 274,
  ASIAN_HANDICAP_INCLUDING_OT = 342,
  UNDER_OVER_INCLUDING_OT = 28,
  UNDER_OVER_ROUNDS = 29,
  UNDER_OVER_GAMES = 166,
  UNDER_OVER_MAPS = 1536,
  SET_SPREAD = 866,
  SET_TOTAL = 165,
}

/**
 * Sport IDs
 */
export enum SportId {
  BASKETBALL = 1,
  HOCKEY = 2,
  BASEBALL = 3,
  GOLF = 4,
  SOCCER = 5,
  TENNIS = 6,
  MMA = 7,
  FOOTBALL = 8,
  ESPORTS = 9,
  CUSTOM = 10,
  RUGBY_UNION = 11,
  RACING = 12,
  BOXING = 13,
  CRYPTO = 14,
  CRICKET = 15,
  ECONOMICS = 16,
  POLITICS = 17,
  ENTERTAINMENT = 18,
  MEDICINAL = 19,
  RUGBY_LEAGUE = 20,
}

/**
 * Metadata from /metadata endpoint
 */
export interface Metadata {
  executorAddress: string;
  oracleFees: Record<string, string>;
  sportXAffiliate: {
    address: string;
    amount: string;
  };
  makerOrderMinimums: Record<string, string>;
  takerMinimums: Record<string, string>;
  addresses: {
    [chainId: string]: {
      WETH?: string;
      USDC?: string;
      WSX?: string;
    };
  };
  totalVolume: number;
  domainVersion: string;
  EIP712FillHasher: string;
  TokenTransferProxy: string;
  bridgeFee: number;
  oddsLadderStepSize: number;
}

/**
 * Market object from SX API
 */
export interface Market {
  status: MarketStatus;
  marketHash: string;
  outcomeOneName: string;
  outcomeTwoName: string;
  outcomeVoidName: string;
  teamOneName: string;
  teamTwoName: string;
  type: MarketType;
  gameTime: number;
  line?: number;
  sportXEventId: string;
  liveEnabled: boolean;
  sportLabel: string;
  sportId: SportId;
  leagueId: number;
  leagueLabel: string;
  mainLine?: boolean;
  group1: string;
  group2?: string;
  teamOneMeta?: string;
  teamTwoMeta?: string;
  marketMeta?: string;
  legs?: Market[]; // For parlay markets
  reportedDate?: number;
  outcome?: MarketOutcome;
  teamOneScore?: number;
  teamTwoScore?: number;
}

/**
 * Order object from SX API
 */
export interface Order {
  orderHash: string;
  marketHash: string;
  fillAmount: string;
  pendingFillAmount?: string;
  totalBetSize: string;
  percentageOdds: string;
  expiry: number;
  apiExpiry: number;
  salt: string;
  isMakerBettingOutcomeOne: boolean;
  signature: string;
  updateTime?: string;
  sportXeventId: string;
}

/**
 * Order update from WebSocket
 */
export interface OrderUpdate extends Order {
  status: OrderStatus;
}

/**
 * New order for submission
 */
export interface NewOrder {
  marketHash: string;
  maker: string;
  totalBetSize: string;
  percentageOdds: string;
  expiry: number;
  apiExpiry: number;
  baseToken: string;
  executor: string;
  salt: string;
  isMakerBettingOutcomeOne: boolean;
}

/**
 * Signed order for submission
 */
export interface SignedOrder extends NewOrder {
  signature: string;
}

/**
 * Order post response
 */
export interface OrderResponse {
  status: "success" | "failure";
  data: {
    orders: string[];
    statuses: string[];
    inserted: number;
  };
}

/**
 * Order cancellation payload
 */
export interface CancelPayload {
  orderHashes: string[];
  signature: string;
  salt: string;
  maker: string;
  timestamp: number;
}

/**
 * Cancellation response
 */
export interface CancelResponse {
  status: "success" | "failure";
  data: {
    cancelledCount: number;
    orders?: CancelledOrder[];
  };
}

/**
 * Cancelled order details
 */
export interface CancelledOrder {
  orderHash: string;
  pendingFills: PendingFill[];
}

/**
 * Pending fill information
 */
export interface PendingFill {
  fillHash: string;
  pendingFillAmount: string;
}

/**
 * Parlay market request payload
 */
export interface ParlayMarketRequest {
  marketHash: string;
  baseToken: string;
  requestSize: string;
  legs: ParlayMarketLeg[];
}

/**
 * Parlay market leg
 */
export interface ParlayMarketLeg {
  marketHash: string;
  bettingOutcomeOne: boolean;
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  status: "success" | "failure";
  data: T;
}
