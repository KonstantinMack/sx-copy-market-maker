/**
 * WebSocket Client Service
 * Manages WebSocket connection to SX API via Ably
 */

import { EventEmitter } from "node:events";
import { CONSTANTS } from "@/config/constants.js";
import type { ConnectionState } from "@/types/index.js";
import * as Ably from "ably";
import type { APIClient } from "./APIClient.js";
import type { Logger } from "./Logger.js";

/**
 * WebSocket Client
 * Handles real-time communication with SX.bet via Ably
 */
export class WebSocketClient extends EventEmitter {
  private client: Ably.Realtime | null = null;
  private apiClient: APIClient;
  private logger: Logger;
  private reconnectInterval: number;
  private maxRetries: number;
  private reconnectAttempts = 0;
  private connectionState: ConnectionState = "disconnected";
  private subscribedChannels: Set<string> = new Set();

  constructor(
    apiClient: APIClient,
    logger: Logger,
    reconnectInterval?: number,
    maxRetries?: number
  ) {
    super();
    this.apiClient = apiClient;
    this.logger = logger;
    this.reconnectInterval = reconnectInterval || CONSTANTS.WS_RECONNECT_DELAY;
    this.maxRetries = maxRetries || CONSTANTS.MAX_WS_RECONNECT_ATTEMPTS;
  }

  /**
   * Connects to Ably WebSocket
   */
  public async connect(): Promise<void> {
    if (this.client) {
      this.logger.warn("WebSocket client already exists");
      return;
    }

    this.connectionState = "connecting";
    this.logger.info("Connecting to WebSocket...");

    try {
      // Create Ably client with auth callback
      this.client = new Ably.Realtime({
        authCallback: async (_tokenParams, callback) => {
          try {
            const tokenRequest = await this.apiClient.createAblyTokenRequest();
            callback(null, tokenRequest as Ably.TokenRequest);
          } catch (error) {
            this.logger.error("Failed to get Ably token", {}, error as Error);
            callback((error as Error).message, null);
          }
        },
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 30000);

        this.client?.connection.once("connected", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client?.connection.once("failed", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.setupConnectionHandlers();
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      this.logger.info("WebSocket connected");
      this.emit("connected");
    } catch (error) {
      this.connectionState = "failed";
      this.logger.error("Failed to connect to WebSocket", {}, error as Error);
      throw error;
    }
  }

  /**
   * Sets up connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.client) return;

    this.client.connection.on("connected", () => {
      this.connectionState = "connected";
      this.logger.info("WebSocket connected");
      this.emit("connected");
      this.reconnectAttempts = 0;

      // Resubscribe to channels after reconnection
      this.resubscribeChannels();
    });

    this.client.connection.on("disconnected", () => {
      this.connectionState = "disconnected";
      this.logger.info("WebSocket disconnected");
      this.emit("disconnected");
    });

    this.client.connection.on("suspended", () => {
      this.connectionState = "disconnected";
      this.logger.warn(
        "WebSocket connection suspended, will attempt reconnection"
      );
      this.emit("disconnected");
    });

    this.client.connection.on("failed", (stateChange) => {
      this.connectionState = "failed";
      const error = new Error(
        stateChange.reason?.message || "Connection failed"
      );
      this.logger.error("WebSocket connection failed", {}, error);
      this.emit("error", error);
      this.handleReconnect();
    });

    this.client.connection.on("closed", () => {
      this.connectionState = "disconnected";
      this.logger.info("WebSocket connection closed");
      this.emit("disconnected");
    });
  }

  /**
   * Handles reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxRetries) {
      this.logger.error("Max reconnection attempts reached", {
        attempts: this.reconnectAttempts,
        maxRetries: this.maxRetries,
      });
      this.emit("maxRetriesReached");
      return;
    }

    this.reconnectAttempts++;
    this.connectionState = "reconnecting";

    const backoffDelay =
      this.reconnectInterval * Math.min(this.reconnectAttempts, 5);

    this.logger.info("Attempting to reconnect WebSocket", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxRetries,
    });

    setTimeout(() => {
      this.reconnect();
    }, backoffDelay);
  }

  /**
   * Reconnects to WebSocket
   */
  private async reconnect(): Promise<void> {
    this.logger.info("Attempting to reconnect WebSocket", {
      attempt: this.reconnectAttempts,
    });

    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      this.logger.error("Reconnection failed", {}, error as Error);
      this.handleReconnect();
    }
  }

  /**
   * Resubscribes to all channels after reconnection
   */
  private async resubscribeChannels(): Promise<void> {
    if (!this.client || this.subscribedChannels.size === 0) {
      return;
    }

    this.logger.info("Resubscribing to channels", {
      count: this.subscribedChannels.size,
    });

    const channels = Array.from(this.subscribedChannels);
    this.subscribedChannels.clear();

    for (const channelName of channels) {
      try {
        await this.subscribe(channelName);
      } catch (error) {
        this.logger.error(
          `Failed to resubscribe to channel ${channelName}`,
          {},
          error as Error
        );
      }
    }
  }

  /**
   * Subscribes to a channel
   */
  public async subscribe(
    channelName: string,
    handler?: (message: Ably.Message) => void,
    rewind = "10s"
  ): Promise<Ably.RealtimeChannel> {
    if (!this.client) {
      throw new Error("WebSocket client not connected");
    }

    const channel = this.client.channels.get(channelName, {
      params: { rewind },
    });

    // Subscribe with handler if provided
    if (handler) {
      channel.subscribe(handler);
    }

    this.subscribedChannels.add(channelName);

    this.logger.debug("Subscribed to channel", {
      channel: channelName,
      rewind,
    });

    return channel;
  }

  /**
   * Unsubscribes from a channel
   */
  public async unsubscribe(channelName: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const channel = this.client.channels.get(channelName);
    channel.unsubscribe();
    await channel.detach();

    this.subscribedChannels.delete(channelName);

    this.logger.debug("Unsubscribed from channel", {
      channel: channelName,
    });
  }

  /**
   * Disconnects from WebSocket
   */
  public async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.logger.info("Disconnecting WebSocket");

    // Unsubscribe from all channels
    const channels = Array.from(this.subscribedChannels);
    for (const channelName of channels) {
      await this.unsubscribe(channelName);
    }

    // Close connection
    this.client.close();
    this.client = null;
    this.connectionState = "disconnected";

    this.emit("disconnected");
  }

  /**
   * Checks if connected
   */
  public isConnected(): boolean {
    return this.connectionState === "connected" && this.client !== null;
  }
}
