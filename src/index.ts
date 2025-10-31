/**
 * SX Market Making Bot
 * Main application entry point
 */

import "dotenv/config";
import { API_URLS, CHAIN_IDS, TOKEN_ADDRESSES } from "./config/constants.js";
import { APIClient } from "./services/APIClient.js";
import { ConfigManager } from "./services/ConfigManager.js";
import { Logger } from "./services/Logger.js";
import { OrderCopyEngine } from "./services/OrderCopyEngine.js";
import { OrderMonitor } from "./services/OrderMonitor.js";
import { RiskManager } from "./services/RiskManager.js";
import { WalletManager } from "./services/WalletManager.js";
import { WebSocketClient } from "./services/WebSocketClient.js";
import type { Order } from "./types/index.js";

/**
 * Main application class
 */
class SXMarketMakingBot {
  private config: ConfigManager;
  private logger: Logger;
  private apiClient: APIClient;
  private walletManager: WalletManager;
  private wsClient: WebSocketClient;
  private orderMonitor: OrderMonitor;
  private copyEngine: OrderCopyEngine;
  private riskManager: RiskManager;
  private isRunning = false;
  private shuttingDown = false;
  private statusInterval?: NodeJS.Timeout;

  constructor() {
    // Initialize configuration
    this.config = new ConfigManager();

    // Load configuration
    const cfg = this.config.load();

    // Initialize logger
    this.logger = new Logger(cfg.logging);

    this.logger.info("SX Market Making Bot starting", { config: this.config });

    // Initialize API client (env vars validated above)
    const apiKey = process.env.SX_API_KEY as string;
    this.apiClient = new APIClient(
      API_URLS[cfg.network.environment].api,
      apiKey,
      cfg.api,
      this.logger
    );

    // Initialize wallet manager (env vars validated above)
    const privateKey = process.env.PRIVATE_KEY as string;
    this.walletManager = new WalletManager(
      privateKey,
      API_URLS[cfg.network.environment].rpc,
      CHAIN_IDS[cfg.network.environment],
      this.logger
    );

    this.logger.info("Bot wallet address", {
      address: this.walletManager.getAddress(),
    });

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient(
      this.apiClient,
      this.logger,
      cfg.network.wsReconnectInterval,
      cfg.network.wsMaxRetries
    );

    // Initialize risk manager
    this.riskManager = new RiskManager(this.logger);

    // Initialize order monitor
    this.orderMonitor = new OrderMonitor(
      this.wsClient,
      this.apiClient,
      this.logger,
      cfg.monitoring.walletAddresses,
      TOKEN_ADDRESSES[cfg.network.environment][cfg.monitoring.baseToken],
      cfg.monitoring.filters,
      this.walletManager.getAddress()
    );

    // Initialize copy engine
    this.copyEngine = new OrderCopyEngine(
      cfg.copying,
      this.walletManager,
      this.apiClient,
      this.logger,
      TOKEN_ADDRESSES[cfg.network.environment][cfg.monitoring.baseToken]
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Sets up event handlers for order events
   */
  private setupEventHandlers(): void {
    // Handle new orders detected
    this.orderMonitor.on(
      "orderDetected",
      async (order: Order, monitoredWallet: string) => {
        await this.handleOrderDetected(order, monitoredWallet);
      }
    );

    // Handle own orders
    this.orderMonitor.on("ownOrderDetected", (order: Order) => {
      this.handleOwnOrderDetected(order);
    });

    // Handle order fills and remove from risk tracking
    this.orderMonitor.on(
      "orderFilled",
      async (orderHash: string, monitoredWallet: string) => {
        await this.handleOrderFilled(orderHash, monitoredWallet);
      }
    );

    // Handle order fills and remove from risk tracking
    this.orderMonitor.on(
      "ownOrderFilled",
      (orderHash: string, monitoredWallet: string) => {
        this.logger.info("Order filled, removing from risk tracking", {
          orderHash,
          monitoredWallet,
        });

        this.handleOwnOrderFilled(orderHash);
      }
    );

    // Handle order cancellations
    this.orderMonitor.on(
      "orderCancelled",
      async (orderHash: string, monitoredWallet: string) => {
        await this.handleOrderCancelled(orderHash, monitoredWallet);
      }
    );

    // Handle own order cancellations
    this.orderMonitor.on("ownOrderCancelled", (orderHash: string) => {
      this.handleOwnOrderCancelled(orderHash);
    });

    // Handle WebSocket events
    this.wsClient.on("error", (error: Error) => {
      this.logger.error("WebSocket error", {}, error);
    });

    this.wsClient.on("disconnected", async () => {
      this.logger.warn("WebSocket disconnected - cancelling all open orders");
      // Cancel all open orders
      await this.cancelAllOpenOrders();
    });

    this.wsClient.on("maxRetriesReached", () => {
      this.logger.error("WebSocket max retries reached, shutting down");
      void this.shutdown("WebSocket connection failed");
    });
  }

  /**
   * Handles detected orders
   */
  private async handleOrderDetected(
    order: Order,
    monitoredWallet: string
  ): Promise<void> {
    try {
      this.logger.info("Processing detected order", {
        orderHash: order.orderHash,
        marketHash: order.marketHash,
        monitoredWallet,
      });

      if (this.riskManager.isOrderCopied(order.orderHash)) {
        this.logger.info("Order has already been copied - skipping", {
          orderHash: order.orderHash,
          monitoredWallet,
        });
        return;
      }

      // Copy the order
      const result = await this.copyEngine.copyOrder(order, monitoredWallet);

      if (result.success && result.copiedOrder && result.modifications) {
        // Record the order with risk manager
        this.riskManager.recordOrderMapping(
          result.copiedOrder,
          order.orderHash
        );

        this.logger.info("Order copied successfully", {
          originalOrderHash: order.orderHash,
          copiedOrderHash: result.copiedOrder.orderHash,
          monitoredWallet: result.modifications.monitoredWallet,
          originalOdds: result.modifications.originalOdds,
          adjustedOdds: result.modifications.adjustedOdds,
          originalStake: result.modifications.originalStake,
          adjustedStake: result.modifications.adjustedStake,
          modifications: result.modifications.modifications,
        });
      } else {
        this.logger.error("Order copy failed", {
          orderHash: order.orderHash,
          reason: result.error || "Unknown error",
        });
      }
    } catch (error) {
      this.logger.error(
        "Failed to handle detected order",
        {
          orderHash: order.orderHash,
          monitoredWallet,
        },
        error as Error
      );
    }
  }

  private handleOwnOrderDetected(order: Order): void {
    this.logger.info("Own order detected - adding order to risk tracking", {
      orderHash: order.orderHash,
    });
    this.riskManager.recordOrder(order);
  }

  private async handleOrderFilled(
    orderHash: string,
    monitoredWallet: string
  ): Promise<void> {
    this.logger.info("Copied order filled - cancelling corresponding order");
    await this.handleOrderCancelled(orderHash, monitoredWallet);
  }

  private handleOwnOrderFilled(orderHash: string): void {
    this.logger.info("Own order filled - removing from open risk tracking");
    this.riskManager.removeOrder(orderHash);
  }

  /**
   * Handles order cancellations from monitored wallets
   */
  private async handleOrderCancelled(
    orderHash: string,
    monitoredWallet: string
  ): Promise<void> {
    if (!this.config.get<boolean>("copying.autoCancelOnSource")) {
      return;
    }

    try {
      const copiedOrder = this.riskManager.findCopiedOrder(orderHash);

      if (!copiedOrder) {
        return;
      }

      this.logger.info("Auto-cancelling copied orders", {
        sourceOrder: orderHash,
        copiedOrder: copiedOrder.orderHash,
        monitoredWallet,
      });

      // Cancel all copied orders
      const orderHashes = [copiedOrder.orderHash];
      const salt = this.walletManager.generateSalt();
      const timestamp = this.walletManager.getCurrentTimestamp();
      const signature = this.walletManager.signCancellation(
        orderHashes,
        salt,
        timestamp
      );

      const response = await this.apiClient.cancelOrders({
        orderHashes,
        signature,
        salt,
        maker: this.walletManager.getAddress(),
        timestamp,
      });

      this.logger.info("Copied orders cancelled", {
        cancelledCount: response.data.cancelledCount,
      });
    } catch (error) {
      this.logger.error(
        "Failed to auto-cancel orders",
        {
          sourceOrder: orderHash,
        },
        error as Error
      );
    }
  }

  private handleOwnOrderCancelled(orderHash: string): void {
    this.logger.info("Own order cancelled - removing from risk tracking", {
      orderHash,
    });

    // Remove from risk tracking
    this.riskManager.removeOrder(orderHash);
  }

  /**
   * Cancel all open orders
   */
  public async cancelAllOpenOrders(): Promise<void> {
    try {
      const salt = this.walletManager.generateSalt();
      const timestamp = this.walletManager.getCurrentTimestamp();
      const signature = this.walletManager.signCancelAll(salt, timestamp);
      const response = await this.apiClient.cancelAllOrders({
        signature,
        salt,
        maker: this.walletManager.getAddress(),
        timestamp,
      });
      this.logger.info("All open orders cancelled", {
        cancelledCount: response.data.cancelledCount,
      });
    } catch (error) {
      this.logger.error("Failed to cancel all open orders", {}, error as Error);
      throw error;
    }
  }

  /**
   * Starts the bot
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Bot is already running");
      return;
    }

    try {
      this.logger.info("Starting SX Market Making Bot");

      // Initialize copy engine (fetches metadata)
      await this.copyEngine.initialize();

      // Connect WebSocket
      await this.wsClient.connect();

      // Start order monitoring
      await this.orderMonitor.start();

      // Status interval
      this.statusInterval = setInterval(() => {
        const status = this.getStatus();
        this.logger.info("Bot Status:", status);
      }, 60 * 1000);

      this.isRunning = true;

      this.logger.info("SX Market Making Bot started successfully", {
        ownWallet: this.walletManager.getAddress(),
        monitoredWallets: this.orderMonitor.getMonitoredWallets(),
        subscriptions: this.orderMonitor.getStats().activeSubscriptions,
      });
    } catch (error) {
      this.logger.error("Failed to start bot", {}, error as Error);
      throw error;
    }
  }

  /**
   * Stops the bot
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop order monitoring
      await this.orderMonitor.stop();

      // Disconnect WebSocket
      await this.wsClient.disconnect();

      // Clear status interval
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = undefined;
      }

      this.isRunning = false;

      this.logger.info("SX Market Making Bot stopped");
    } catch (error) {
      this.logger.error("Error during bot shutdown", {}, error as Error);
    }
  }

  /**
   * Graceful shutdown (public) - does not call process.exit
   */
  public async shutdown(reason: string): Promise<void> {
    if (this.shuttingDown) {
      this.logger.info("Shutdown already in progress");
      return;
    }
    this.shuttingDown = true;

    this.logger.info("SX Market Making Bot shutting down", { reason });

    try {
      await this.stop();
      await this.logger.flush();
    } catch (err) {
      // Last-chance logging; avoid throwing
      try {
        this.logger.warn("Error during shutdown (continuing to exit)", {
          err: (err as Error).message,
        });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Gets bot status
   */
  public getStatus() {
    return {
      running: this.isRunning,
      websocketConnected: this.wsClient.isConnected(),
      monitoredWallets: this.orderMonitor.getMonitoredWallets().length,
      activeSubscriptions: this.orderMonitor.getStats().activeSubscriptions,
      openOrdersExposure: this.riskManager.getExposureStats(),
    };
  }
}

/**
 * Top-level bootstrapping and signal handling
 */

let bot: SXMarketMakingBot | null = null;
let shuttingDown = false;

// Single graceful shutdown coordinator
async function gracefulShutdown(reason: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  // Global force-exit timer (if cleanup hangs)
  const FORCE_EXIT_MS = 15000;
  const forceTimer = setTimeout(() => {
    console.error("Force exiting after timeout during shutdown");
    // As a last resort. Prefer natural exit if possible.
    process.exit(1);
  }, FORCE_EXIT_MS);
  // Allow process to exit if nothing else is keeping it open
  forceTimer.unref();

  try {
    if (bot) {
      await bot.shutdown(reason);
    }
  } catch (e) {
    console.error("Error in gracefulShutdown:", e);
  } finally {
    clearTimeout(forceTimer);
    // Do not call process.exit(0) here; let Node exit naturally once
    // there are no more timers/handles.
  }
}

// Register signal handlers early and persistently
process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

// Catch unhandled errors and attempt graceful shutdown
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  void gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  void gracefulShutdown("unhandledRejection");
});

/**
 * Main entry point
 */
export async function main() {
  try {
    bot = new SXMarketMakingBot();
    await bot.start();
  } catch (error) {
    console.error("Fatal error:", error);
    await gracefulShutdown("startup error");
    process.exit(1);
  }
}

// Start the bot only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
