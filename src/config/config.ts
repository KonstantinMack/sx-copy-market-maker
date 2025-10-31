import { StakeUtils } from "@/utils/stake.js";
import type { Config } from "../types/config.js";

const config: Config = {
  network: {
    environment: "testnet", // "mainnet" | "testnet"
    wsReconnectInterval: 5000,
    wsMaxRetries: 5,
  },
  monitoring: {
    walletAddresses: [], // wallet addresses to monitor for orders
    baseToken: "USDC", // Only USDC supported for now
    filters: {
      // Empty arrays mean no filtering, i.e., include all
      // values are IDs and mean inclusion of only these IDs
      sports: [], // sportIds
      marketTypes: [], // marketTypeIds
      leagues: [], // leagueIds
      // odds range filter for original orders
      // copied orders can have odds adjusted outside this range
      minOdds: "0.2", // -> 0.2 means 20%
      maxOdds: "0.8", // -> 0.8 means 80%
      excludeParlay: true,
      excludeLive: true,
    },
  },
  copying: {
    enabled: true,
    copyDelay: 0, // time in milliseconds between detecting and copying an order
    oddsAdjustment: {
      method: "fixed", // "percentage" | "fixed" (number of ladder steps) | "none"
      value: 4, // percentage value or fixed ladder steps
      ensureLadderCompliance: true,
    },
    stakeAdjustment: {
      method: "percentage", // "percentage" | "fixed" (will use minStake) | "none" (same as percentage 100)
      value: 120, // percentage value 120 = 120% of original stake
      minStake: StakeUtils.USDC.toWei(20), // 20 USDC -> minimum 10 USDC otherwise order will fail
      maxStake: StakeUtils.USDC.toWei(50), // 50 USDC
    },
    autoCancelOnSource: true, // Automatically cancel copied orders if the source order is cancelled
  },
  logging: {
    level: "info",
    console: true,
    file: {
      enabled: false,
      path: "./logs",
      maxSize: "10m",
      maxFiles: 10,
    },
    includeStackTrace: true,
  },
  api: {
    retryPolicy: {
      maxRetries: 1,
      backoffMs: 1000,
      backoffMultiplier: 2,
    },
    timeout: 30000,
  },
};

export default config;
