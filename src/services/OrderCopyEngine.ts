/**
 * Order Copy Engine
 * Copies and modifies detected orders before submission
 */

import { CONSTANTS } from "@/config/constants.js";
import type {
  CopyResult,
  CopyingConfig,
  Metadata,
  NewOrder,
  Order,
  OrderModification,
  SignedOrder,
} from "@/types/index.js";
import { adjustOddsByPercentage, adjustOddsBySteps } from "@/utils/odds.js";
import { adjustStakeByPercentage, validateStakeLimits } from "@/utils/stake.js";
import { isOnOddsLadder, roundOddsToLadder } from "@/utils/validation.js";
import type { APIClient } from "./APIClient.js";
import type { Logger } from "./Logger.js";
import type { WalletManager } from "./WalletManager.js";

/**
 * Order Copy Engine
 * Processes detected orders, applies modifications, and submits them
 */
export class OrderCopyEngine {
  private config: CopyingConfig;
  private walletManager: WalletManager;
  private apiClient: APIClient;
  private logger: Logger;
  private metadata: Metadata | null = null;
  private ladderStepSize: number = CONSTANTS.DEFAULT_LADDER_STEP;
  private baseToken: string;

  constructor(
    config: CopyingConfig,
    walletManager: WalletManager,
    apiClient: APIClient,
    logger: Logger,
    baseToken: string
  ) {
    this.config = config;
    this.walletManager = walletManager;
    this.apiClient = apiClient;
    this.logger = logger;
    this.baseToken = baseToken;
  }

  /**
   * Initializes the engine by fetching metadata
   */
  public async initialize(): Promise<void> {
    this.logger.info("Initializing Order Copy Engine");

    try {
      this.metadata = await this.apiClient.getMetadata();
      this.ladderStepSize = this.metadata.oddsLadderStepSize;

      if (this.ladderStepSize < 0 || this.ladderStepSize > 200) {
        throw new Error(
          `Ladder step size has suspicious value: ${this.ladderStepSize}. Double check metadata`
        );
      }

      this.logger.info("Order Copy Engine initialized", {
        executor: this.metadata.executorAddress,
        ladderStepSize: this.ladderStepSize,
      });
    } catch (error) {
      this.logger.error(
        "Failed to initialize Order Copy Engine",
        {},
        error as Error
      );
      throw error;
    }
  }

  /**
   * Copies an order with configured modifications
   */
  public async copyOrder(
    originalOrder: Order,
    monitoredWallet: string
  ): Promise<CopyResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: "Order copying is disabled",
        originalOrder,
      };
    }

    if (!this.metadata) {
      return {
        success: false,
        error: "Engine not initialized",
        originalOrder,
      };
    }

    this.logger.debug("Copying order", {
      orderHash: originalOrder.orderHash,
      monitoredWallet,
    });

    try {
      // Apply copy delay if configured
      if (this.config.copyDelay > 0) {
        await this.sleep(this.config.copyDelay);
      }

      // Adjust odds
      const adjustedOdds = this.adjustOdds(originalOrder.percentageOdds);

      // Adjust stake
      const adjustedStake = this.adjustStake(originalOrder.totalBetSize);

      // Validate adjusted stake
      const stakeValidation = validateStakeLimits(
        adjustedStake,
        this.config.stakeAdjustment.minStake,
        this.config.stakeAdjustment.maxStake
      );

      if (!stakeValidation.valid) {
        return {
          success: false,
          error: stakeValidation.reason,
          originalOrder,
        };
      }

      // Create new order
      const newOrder: NewOrder = {
        marketHash: originalOrder.marketHash,
        maker: this.walletManager.getAddress(),
        totalBetSize: adjustedStake,
        percentageOdds: adjustedOdds,
        expiry: CONSTANTS.DEFAULT_ORDER_EXPIRY,
        apiExpiry:
          Math.floor(Date.now() / 1000) + CONSTANTS.DEFAULT_API_EXPIRY_OFFSET,
        baseToken: this.baseToken,
        executor: this.metadata.executorAddress,
        salt: this.walletManager.generateSalt(),
        isMakerBettingOutcomeOne: originalOrder.isMakerBettingOutcomeOne,
      };

      // Sign the order
      const signature = await this.walletManager.signOrder(newOrder);
      const signedOrder: SignedOrder = {
        ...newOrder,
        signature,
      };

      // Track modifications
      const modifications: OrderModification = {
        originalOrderHash: originalOrder.orderHash,
        monitoredWallet,
        originalOdds: originalOrder.percentageOdds,
        adjustedOdds,
        originalStake: originalOrder.totalBetSize,
        adjustedStake,
        modifications: this.getModificationList(
          originalOrder,
          newOrder,
          monitoredWallet
        ),
      };

      this.logger.debug("Order modified before copying", {
        originalOrderHash: modifications.originalOrderHash,
        modifications: modifications.modifications,
        originalOdds: modifications.originalOdds,
        adjustedOdds,
        originalStake: modifications.originalStake,
        adjustedStake,
      });

      // Submit to API
      const response = await this.apiClient.postOrders([signedOrder]);

      if (response.data.inserted === 0) {
        const status = response.data.statuses[0];
        return {
          success: false,
          error: `Order submission failed: ${status}`,
          originalOrder,
          modifications,
        };
      }

      const copiedOrderHash = response.data.orders[0];

      this.logger.logOrderSuccess(copiedOrderHash, {
        originalOrderHash: originalOrder.orderHash,
        monitoredWallet,
      });

      // Convert signed order to Order type for result
      const copiedOrder: Order = {
        ...signedOrder,
        orderHash: copiedOrderHash,
        fillAmount: "0",
        sportXeventId: originalOrder.sportXeventId,
      };

      return {
        success: true,
        orderHash: copiedOrderHash,
        originalOrder,
        copiedOrder,
        modifications,
      };
    } catch (error) {
      this.logger.error(
        "Failed to copy order",
        {
          orderHash: originalOrder.orderHash,
          monitoredWallet,
        },
        error as Error
      );

      return {
        success: false,
        error: (error as Error).message,
        originalOrder,
      };
    }
  }

  /**
   * Adjusts odds according to configuration
   */
  private adjustOdds(originalOdds: string): string {
    const method = this.config.oddsAdjustment.method;
    const value = this.config.oddsAdjustment.value;
    const ensureLadder = this.config.oddsAdjustment.ensureLadderCompliance;

    let adjustedOdds: string;

    switch (method) {
      case "percentage":
        adjustedOdds = adjustOddsByPercentage(
          originalOdds,
          value,
          ensureLadder,
          this.ladderStepSize
        );
        break;

      case "fixed": {
        adjustedOdds = adjustOddsBySteps(
          originalOdds,
          value,
          this.ladderStepSize
        );
        break;
      }

      default:
        adjustedOdds = originalOdds;
    }

    // Double-check ladder compliance if required
    if (ensureLadder && !isOnOddsLadder(adjustedOdds, this.ladderStepSize)) {
      adjustedOdds = roundOddsToLadder(adjustedOdds, this.ladderStepSize);
    }

    return adjustedOdds;
  }

  /**
   * Adjusts stake according to configuration
   */
  private adjustStake(originalStake: string): string {
    const method = this.config.stakeAdjustment.method;
    const value = this.config.stakeAdjustment.value;

    let adjustedStake: string;

    switch (method) {
      case "percentage":
        adjustedStake = adjustStakeByPercentage(originalStake, value);
        break;

      case "fixed":
        adjustedStake = this.config.stakeAdjustment.minStake; // Use minStake as fixed amount
        break;

      default:
        adjustedStake = originalStake;
    }

    // Ensure stake is within limits
    const validation = validateStakeLimits(
      adjustedStake,
      this.config.stakeAdjustment.minStake,
      this.config.stakeAdjustment.maxStake
    );

    if (!validation.valid && validation.clamped) {
      return validation.clamped;
    }

    return adjustedStake;
  }

  /**
   * Gets list of modifications applied to an order
   */
  private getModificationList(
    original: Order,
    modified: NewOrder,
    monitoredWallet: string
  ): string[] {
    const modifications: string[] = [];

    if (original.percentageOdds !== modified.percentageOdds) {
      modifications.push(
        `Odds: ${original.percentageOdds} -> ${modified.percentageOdds}`
      );
    }

    if (original.totalBetSize !== modified.totalBetSize) {
      modifications.push(
        `Stake: ${original.totalBetSize} -> ${modified.totalBetSize}`
      );
    }

    if (monitoredWallet !== modified.maker) {
      modifications.push(`Maker: ${monitoredWallet} -> ${modified.maker}`);
    }

    if (modifications.length === 0) {
      modifications.push("No modifications (exact copy)");
    }

    return modifications;
  }

  /**
   * Helper to sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
