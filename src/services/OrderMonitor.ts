/**
 * Order Monitor Service
 * Monitors orders from specified wallet addresses via WebSocket
 */

import { EventEmitter } from "node:events";
import { WS_CHANNELS } from "@/config/constants.js";
import type {
  Market,
  Order,
  OrderFilters,
  OrderUpdate,
} from "@/types/index.js";
import type * as Ably from "ably";
import type { APIClient } from "./APIClient.js";
import type { Logger } from "./Logger.js";
import type { WebSocketClient } from "./WebSocketClient.js";

/**
 * Order Monitor
 * Subscribes to order updates for monitored wallets and emits filtered events
 */
export class OrderMonitor extends EventEmitter {
  private wsClient: WebSocketClient;
  private apiClient: APIClient;
  private logger: Logger;
  private monitoredWallets: string[];
  private baseToken: string;
  private filters: OrderFilters;
  private channelHandlers: Map<string, (message: Ably.Message) => void> =
    new Map();
  private marketCache: Map<string, Market> = new Map();
  private selfWalletAddress?: string;

  constructor(
    wsClient: WebSocketClient,
    apiClient: APIClient,
    logger: Logger,
    monitoredWallets: string[],
    baseToken: string,
    filters: OrderFilters,
    selfWalletAddress: string
  ) {
    super();
    this.wsClient = wsClient;
    this.apiClient = apiClient;
    this.logger = logger;
    this.monitoredWallets = monitoredWallets;
    this.baseToken = baseToken;
    this.filters = filters;
    this.selfWalletAddress = selfWalletAddress;
  }

  /**
   * Starts monitoring orders
   */
  public async start(): Promise<void> {
    this.logger.info("Starting order monitor", {
      wallets: this.monitoredWallets.length,
      token: this.baseToken,
    });

    // Subscribe to own wallet if provided
    if (!this.selfWalletAddress) {
      throw new Error("Own wallet address could not be determined");
    }
    await this.subscribeToWallet(this.selfWalletAddress, this.baseToken);

    // Subscribe to each monitored wallet
    for (const wallet of this.monitoredWallets) {
      await this.subscribeToWallet(wallet, this.baseToken);
    }

    this.logger.info("Order monitor started", {
      subscriptions: this.channelHandlers.size,
    });
  }

  /**
   * Stops monitoring orders
   */
  public async stop(): Promise<void> {
    this.logger.info("Stopping order monitor");

    // Unsubscribe from all channels
    for (const channelName of this.channelHandlers.keys()) {
      await this.wsClient.unsubscribe(channelName);
    }

    this.channelHandlers.clear();
    this.marketCache.clear();

    this.logger.info("Order monitor stopped");
  }

  /**
   * Subscribes to orders from a specific wallet
   */
  private async subscribeToWallet(
    wallet: string,
    token: string
  ): Promise<void> {
    const channelName = WS_CHANNELS.ACTIVE_ORDERS(token, wallet);

    const handler = (message: Ably.Message) => {
      this.handleOrderMessage(message, wallet);
    };

    this.channelHandlers.set(channelName, handler);

    await this.wsClient.subscribe(channelName, handler);

    this.logger.info(
      `Subscribed to ${
        wallet === this.selfWalletAddress ? "own" : "monitored"
      } wallet orders`,
      {
        wallet,
        token,
        channel: channelName,
      }
    );
  }

  /**
   * Handles incoming order update messages
   */
  private handleOrderMessage(
    message: Ably.Message,
    monitoredWallet: string
  ): void {
    try {
      const updates = message.data as OrderUpdate[];

      if (!Array.isArray(updates)) {
        this.logger.warn("Invalid order update format", {
          data: message.data,
        });
        return;
      }

      for (const update of updates.sort(
        (a, b) => Number(a.updateTime) - Number(b.updateTime)
      )) {
        this.processOrderUpdate(update, monitoredWallet);
      }
    } catch (error) {
      this.logger.error(
        "Failed to process order update",
        {
          monitoredWallet,
        },
        error as Error
      );
    }
  }

  /**
   * Processes a single order update
   */
  private async processOrderUpdate(
    update: OrderUpdate,
    monitoredWallet: string
  ): Promise<void> {
    const { status, ...order } = update;

    // Handle different statuses
    if (status === "INACTIVE") {
      this.handleOrderCancelled(order, monitoredWallet);
      return;
    }

    if (status === "FILLED") {
      this.handleOrderFilled(order, monitoredWallet);
      return;
    }

    // New or updated active order
    if (status === "ACTIVE") {
      await this.handleNewOrder(order, monitoredWallet);
      return;
    }
  }

  /**
   * Handles new order detection
   */
  private async handleNewOrder(
    order: Order,
    monitoredWallet: string
  ): Promise<void> {
    if (order.pendingFillAmount !== "0") {
      this.logger.debug("Order has pending fills - skipping", {
        orderHash: order.orderHash,
        pendingFillAmount: order.pendingFillAmount,
        monitoredWallet,
      });
      return;
    }

    const isOwnOrder = monitoredWallet === this.selfWalletAddress;
    if (isOwnOrder) {
      this.logger.debug("Own order detected", {
        orderHash: order.orderHash,
        monitoredWallet,
      });
      this.emit("ownOrderDetected", order);
      return;
    }

    if (order.fillAmount !== "0") {
      this.logger.debug(
        "Order already partially filled -> old order - skipping",
        {
          orderHash: order.orderHash,
          fillAmount: order.fillAmount,
          monitoredWallet,
        }
      );
      return;
    }

    this.logger.logOrderDetected(order, monitoredWallet);

    // Apply filters
    const passesFilters = await this.applyFilters(order);

    if (!passesFilters.passed) {
      this.logger.info("Order filtered out", {
        reason: passesFilters.reason || "Filtered by configuration",
        orderHash: order.orderHash,
        marketHash: order.marketHash,
        eventId: order.sportXeventId,
      });
      return;
    }

    // Emit order detected event
    this.emit("orderDetected", order, monitoredWallet);
  }

  /**
   * Handles order cancellation
   */
  private handleOrderCancelled(order: Order, monitoredWallet: string): void {
    const isOwnOrder = monitoredWallet === this.selfWalletAddress;
    this.logger.debug(`${isOwnOrder ? "Own" : "Copied"} order cancelled`, {
      orderHash: order.orderHash,
      monitoredWallet,
    });
    if (isOwnOrder) {
      this.emit("ownOrderCancelled", order.orderHash, monitoredWallet);
      return;
    }
    this.emit("orderCancelled", order.orderHash, monitoredWallet);
  }

  /**
   * Handles order filled
   */
  private handleOrderFilled(order: Order, monitoredWallet: string): void {
    const isOwnOrder = monitoredWallet === this.selfWalletAddress;
    this.logger.debug(`${isOwnOrder ? "Own" : "Copied"} order filled`, {
      orderHash: order.orderHash,
      fillAmount: order.fillAmount,
      monitoredWallet,
    });

    if (isOwnOrder) {
      this.emit("ownOrderFilled", order.orderHash, monitoredWallet);
      return;
    }

    this.emit("orderFilled", order.orderHash, monitoredWallet);
  }

  /**
   * Applies filters to an order
   */
  private async applyFilters(
    order: Order
  ): Promise<{ passed: boolean; reason?: string }> {
    // Get market details
    const market = await this.getMarket(order.marketHash);

    if (!market) {
      return { passed: false, reason: "Market not found" };
    }

    // Filter by sport
    if (this.filters.sports && this.filters.sports.length > 0) {
      if (!this.filters.sports.includes(market.sportId)) {
        return {
          passed: false,
          reason: `Sport ${market.sportId} not in allowed list`,
        };
      }
    }

    // Filter by market type
    if (this.filters.marketTypes && this.filters.marketTypes.length > 0) {
      if (!this.filters.marketTypes.includes(market.type)) {
        return {
          passed: false,
          reason: `Market type ${market.type} not in allowed list`,
        };
      }
    }

    // Filter by league
    if (this.filters.leagues && this.filters.leagues.length > 0) {
      if (!this.filters.leagues.includes(market.leagueId)) {
        return {
          passed: false,
          reason: `League ${market.leagueId} not in allowed list`,
        };
      }
    }

    // Filter by parlay
    if (this.filters.excludeParlay && market.legs && market.legs.length > 0) {
      return { passed: false, reason: "Parlay markets excluded" };
    }

    // Filter by live
    if (this.filters.excludeLive && market.gameTime * 1000 < Date.now()) {
      return { passed: false, reason: "Live markets excluded" };
    }

    // Filter by odds range
    if (this.filters.minOdds || this.filters.maxOdds) {
      const { passed, reason } = this.filterByOdds(order);
      if (!passed) {
        return { passed: false, reason };
      }
    }

    return { passed: true };
  }

  /**
   * Filters order by odds range
   */
  private filterByOdds(order: Order): { passed: boolean; reason?: string } {
    // Convert percentage odds to implied probability
    const oddsBN = BigInt(order.percentageOdds);
    const precision = BigInt(10) ** BigInt(20);
    const impliedOdds = Number(oddsBN) / Number(precision);

    if (this.filters.minOdds) {
      const minOdds = Number.parseFloat(this.filters.minOdds);
      if (impliedOdds < minOdds) {
        return {
          passed: false,
          reason: `Odds ${impliedOdds.toFixed(4)} below minimum ${minOdds}`,
        };
      }
    }

    if (this.filters.maxOdds) {
      const maxOdds = Number.parseFloat(this.filters.maxOdds);
      if (impliedOdds > maxOdds) {
        return {
          passed: false,
          reason: `Odds ${impliedOdds.toFixed(4)} above maximum ${maxOdds}`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Gets market details (with caching)
   */
  private async getMarket(marketHash: string): Promise<Market | null> {
    // Check cache first
    const cached = this.marketCache.get(marketHash);
    if (cached) {
      return cached;
    }

    // Fetch from API
    try {
      const markets = await this.apiClient.getMarkets([marketHash]);
      if (markets.length > 0) {
        const market = markets[0];
        this.marketCache.set(marketHash, market);
        return market;
      }
      return null;
    } catch (error) {
      this.logger.error(
        "Failed to fetch market",
        {
          marketHash,
        },
        error as Error
      );
      return null;
    }
  }

  /**
   * Gets list of monitored wallets
   */
  public getMonitoredWallets(): string[] {
    return [...this.monitoredWallets];
  }

  /**
   * Gets monitoring statistics
   */
  public getStats(): {
    walletsMonitored: number;
    tokenMonitored: string;
    activeSubscriptions: number;
    cachedMarkets: number;
  } {
    return {
      walletsMonitored: this.monitoredWallets.length,
      tokenMonitored: this.baseToken,
      activeSubscriptions: this.channelHandlers.size,
      cachedMarkets: this.marketCache.size,
    };
  }
}
