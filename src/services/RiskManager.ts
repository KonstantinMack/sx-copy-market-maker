/**
 * Risk Manager Service
 * Tracks exposure and enforces risk limits
 */

import type { Order, TrackedOrder } from "@/types/index.js";
import { StakeUtils } from "@/utils/stake.js";
import { BigNumber } from "ethers";
import type { Logger } from "./Logger.js";

/**
 * Risk Manager
 * Manages exposure tracking and risk limits
 */
export class RiskManager {
  private logger: Logger;
  private trackedOrders: Map<string, Order> = new Map();
  private ordersByOriginal: Map<string, string> = new Map();
  private originalOrderHistory: Set<string> = new Set();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Records a mapping between an original order and a copied order
   */
  public recordOrderMapping(order: Order, originalOrderHash: string): void {
    this.originalOrderHistory.add(originalOrderHash);
    const tracked = this.ordersByOriginal.get(originalOrderHash);
    if (tracked) {
      this.logger.debug("Order already mapped", {
        orderHash: order.orderHash,
        originalOrderHash,
      });
    } else {
      this.ordersByOriginal.set(originalOrderHash, order.orderHash);
      this.logger.debug("Order mapping recorded", {
        orderHash: order.orderHash,
        originalOrderHash,
      });
    }
  }

  /**
   * Records a new order
   */
  public recordOrder(order: Order): void {
    this.trackedOrders.set(order.orderHash, order);

    this.logger.debug("Order recorded", {
      orderHash: order.orderHash,
    });
  }

  /**
   * Removes an order from tracking
   */
  public removeOrder(orderHash: string): void {
    const tracked = this.trackedOrders.get(orderHash);
    if (!tracked) {
      return;
    }

    const removed = this.trackedOrders.delete(orderHash);
    if (!removed) {
      this.logger.warn("Failed to remove order from tracking", {
        orderHash,
      });
      return;
    }

    // Remove from ordersByOriginal mapping
    for (const [originalHash, copiedHash] of this.ordersByOriginal.entries()) {
      if (copiedHash === orderHash) {
        this.ordersByOriginal.delete(originalHash);
        break;
      }
    }

    this.logger.debug("Order removed from tracking", {
      orderHash,
    });
  }

  public isOrderCopied(orderHash: string): boolean {
    return this.originalOrderHistory.has(orderHash);
  }

  /**
   * Finds copied orders related to an original order
   */
  public findCopiedOrder(originalOrderHash: string): Order | undefined {
    const copiedHash = this.ordersByOriginal.get(originalOrderHash) || "";
    return this.trackedOrders.get(copiedHash);
  }

  /**
   * Calculates order exposure (total bet size - fill amount)
   */
  private calculateOrderExposure(order: Order | TrackedOrder): string {
    const totalBN = BigNumber.from(order.totalBetSize);
    const fillBN = BigNumber.from(order.fillAmount);
    return totalBN.sub(fillBN).toString();
  }

  /**
   * Gets total exposure across all orders
   */
  private getTotalExposure(): string {
    let total = BigNumber.from(0);

    for (const tracked of this.trackedOrders.values()) {
      const exposure = this.calculateOrderExposure(tracked);
      total = total.add(BigNumber.from(exposure));
    }

    return StakeUtils.USDC.format(total.toString());
  }

  /**
   * Gets exposure statistics
   */
  public getExposureStats(): {
    totalOpenOrders: number;
    totalOpenExposure: string;
  } {
    return {
      totalOpenOrders: this.trackedOrders.size,
      totalOpenExposure: this.getTotalExposure(),
    };
  }

  /**
   * Clears all tracking data
   */
  public clear(): void {
    this.trackedOrders.clear();
    this.ordersByOriginal.clear();

    this.logger.info("Risk manager data cleared");
  }
}
