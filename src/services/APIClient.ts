/**
 * API Client Service
 * Handles HTTP communication with SX.bet API
 */

import { API_ENDPOINTS } from "@/config/constants.js";
import type {
  APIConfig,
  APIResponse,
  CancelPayload,
  CancelResponse,
  Market,
  Metadata,
  OrderResponse,
  SignedOrder,
} from "@/types/index.js";
import type { Logger } from "./Logger.js";

/**
 * API Client for SX.bet
 */
export class APIClient {
  private baseUrl: string;
  private apiKey: string;
  private config: APIConfig;
  private logger: Logger;

  constructor(
    baseUrl: string,
    apiKey: string,
    config: APIConfig,
    logger: Logger
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Makes an HTTP request with retry logic
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    this.logger.logAPIRequest(method, path, body ? { body } : undefined);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const duration = Date.now() - startTime;
      this.logger.logAPIResponse(method, path, response.status, duration);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      const err = error as Error;

      // Handle retries
      if (retryCount < this.config.retryPolicy.maxRetries) {
        const backoff =
          this.config.retryPolicy.backoffMs *
          this.config.retryPolicy.backoffMultiplier ** retryCount;

        this.logger.warn(`Request failed, retrying in ${backoff}ms`, {
          method,
          path,
          retryCount,
          error: err.message,
        });

        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.request<T>(method, path, body, retryCount + 1);
      }

      this.logger.logAPIError(method, path, err);
      throw err;
    }
  }

  /**
   * GET request helper
   */
  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * POST request helper
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * Gets exchange metadata
   */
  public async getMetadata(): Promise<Metadata> {
    const response = await this.get<APIResponse<Metadata>>(
      API_ENDPOINTS.METADATA
    );
    if (response.status !== "success") {
      throw new Error("Failed to get metadata");
    }
    return response.data;
  }

  /**
   * Gets specific markets by hash
   */
  public async getMarkets(marketHashes: string[]): Promise<Market[]> {
    if (marketHashes.length === 0) {
      return [];
    }
    if (marketHashes.length > 30) {
      throw new Error("Maximum 30 market hashes allowed per request");
    }

    const query = `marketHashes=${marketHashes.join(",")}`;
    const response = await this.get<APIResponse<Market[]>>(
      `${API_ENDPOINTS.MARKETS_FIND}?${query}`
    );

    if (response.status !== "success") {
      throw new Error("Failed to get markets");
    }

    return response.data;
  }

  /**
   * Posts new orders to the exchange
   */
  public async postOrders(orders: SignedOrder[]): Promise<OrderResponse> {
    if (orders.length === 0) {
      throw new Error("No orders to post");
    }

    const response = await this.post<OrderResponse>(API_ENDPOINTS.ORDERS_NEW, {
      orders,
    });

    if (response.status !== "success") {
      throw new Error("Failed to post orders");
    }

    return response;
  }

  /**
   * Cancels specific orders
   */
  public async cancelOrders(payload: CancelPayload): Promise<CancelResponse> {
    const response = await this.post<CancelResponse>(
      API_ENDPOINTS.ORDERS_CANCEL,
      payload
    );

    if (response.status !== "success") {
      throw new Error("Failed to cancel orders");
    }

    return response;
  }

  /**
   * Cancels all orders for an event
   */
  public async cancelEventOrders(payload: {
    sportXeventId: string;
    signature: string;
    salt: string;
    maker: string;
    timestamp: number;
  }): Promise<CancelResponse> {
    const response = await this.post<CancelResponse>(
      API_ENDPOINTS.ORDERS_CANCEL_EVENT,
      payload
    );

    if (response.status !== "success") {
      throw new Error("Failed to cancel event orders");
    }

    return response;
  }

  /**
   * Cancels all orders for the maker
   */
  public async cancelAllOrders(payload: {
    signature: string;
    salt: string;
    maker: string;
    timestamp: number;
  }): Promise<CancelResponse> {
    const response = await this.post<CancelResponse>(
      API_ENDPOINTS.ORDERS_CANCEL_ALL,
      payload
    );

    if (response.status !== "success") {
      throw new Error("Failed to cancel all orders");
    }

    return response;
  }

  /**
   * Generates Ably token request for WebSocket authentication
   */
  public async createAblyTokenRequest(): Promise<unknown> {
    const response = await this.get(API_ENDPOINTS.USER_TOKEN);
    return response;
  }
}
