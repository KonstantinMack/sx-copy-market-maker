/**
 * Wallet Manager Service
 * Handles wallet operations, signing, and balance checking
 */

import { ERROR_MESSAGES } from "@/config/constants.js";
import type { NewOrder } from "@/types/index.js";
import { SignTypedDataVersion, signTypedData } from "@metamask/eth-sig-util";
import { type BigNumber, Contract, Wallet, providers, utils } from "ethers";
import type { Logger } from "./Logger.js";

/**
 * Wallet Manager
 * Manages private key, signing operations, and balance checking
 */
export class WalletManager {
  private wallet: Wallet;
  private provider: providers.JsonRpcProvider;
  private logger: Logger;
  private chainId: number;

  constructor(
    privateKey: string,
    rpcUrl: string,
    chainId: number,
    logger: Logger
  ) {
    if (!privateKey || !privateKey.startsWith("0x")) {
      throw new Error(ERROR_MESSAGES.MISSING_PRIVATE_KEY);
    }

    this.provider = new providers.JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.logger = logger;
    this.chainId = chainId;
  }

  /**
   * Gets the wallet address
   */
  public getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Gets balance for a specific token
   */
  public async getBalance(tokenAddress: string): Promise<string> {
    try {
      const contract = new Contract(
        tokenAddress,
        [
          {
            constant: true,
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            type: "function",
          },
        ],
        this.provider
      );

      const balance: BigNumber = await contract.balanceOf(this.wallet.address);
      return balance.toString();
    } catch (error) {
      this.logger.error(
        "Failed to get balance",
        {
          tokenAddress,
          wallet: this.wallet.address,
        },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Signs a new order using EIP-712
   */
  public async signOrder(order: NewOrder): Promise<string> {
    try {
      const orderHash = utils.arrayify(
        utils.solidityKeccak256(
          [
            "bytes32",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "address",
            "address",
            "bool",
          ],
          [
            order.marketHash,
            order.baseToken,
            order.totalBetSize,
            order.percentageOdds,
            order.expiry,
            order.salt,
            order.maker,
            order.executor,
            order.isMakerBettingOutcomeOne,
          ]
        )
      );

      const signature = await this.wallet.signMessage(orderHash);
      return signature;
    } catch (error) {
      this.logger.error(
        "Failed to sign order",
        {
          marketHash: order.marketHash,
        },
        error as Error
      );
      throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
    }
  }

  /**
   * Signs order cancellation using EIP-712
   */
  public signCancellation(
    orderHashes: string[],
    salt: string,
    timestamp: number
  ): string {
    try {
      const privateKeyBuffer = Buffer.from(
        this.wallet.privateKey.substring(2),
        "hex"
      );

      const payload = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "salt", type: "bytes32" },
          ],
          Details: [
            { name: "orderHashes", type: "string[]" },
            { name: "timestamp", type: "uint256" },
          ],
        },
        primaryType: "Details" as const,
        domain: {
          name: "CancelOrderV2SportX",
          version: "1.0",
          chainId: this.chainId,
          salt,
        },
        message: {
          orderHashes,
          timestamp,
        },
      };

      const signature = signTypedData({
        privateKey: privateKeyBuffer,
        data: payload as never,
        version: SignTypedDataVersion.V4,
      });

      return signature;
    } catch (error) {
      this.logger.error(
        "Failed to sign cancellation",
        {
          orderCount: orderHashes.length,
        },
        error as Error
      );
      throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
    }
  }

  /**
   * Signs event order cancellation using EIP-712
   */
  public signEventCancellation(
    sportXeventId: string,
    salt: string,
    timestamp: number
  ): string {
    try {
      const privateKeyBuffer = Buffer.from(
        this.wallet.privateKey.substring(2),
        "hex"
      );

      const payload = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "salt", type: "bytes32" },
          ],
          Details: [
            { name: "sportXeventId", type: "string" },
            { name: "timestamp", type: "uint256" },
          ],
        },
        primaryType: "Details" as const,
        domain: {
          name: "CancelOrderEventsSportX",
          version: "1.0",
          chainId: this.chainId,
          salt,
        },
        message: {
          sportXeventId,
          timestamp,
        },
      };

      const signature = signTypedData({
        privateKey: privateKeyBuffer,
        data: payload as never,
        version: SignTypedDataVersion.V4,
      });

      return signature;
    } catch (error) {
      this.logger.error(
        "Failed to sign event cancellation",
        {
          eventId: sportXeventId,
        },
        error as Error
      );
      throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
    }
  }

  /**
   * Signs cancel all orders using EIP-712
   */
  public signCancelAll(salt: string, timestamp: number): string {
    try {
      const privateKeyBuffer = Buffer.from(
        this.wallet.privateKey.substring(2),
        "hex"
      );

      const payload = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "salt", type: "bytes32" },
          ],
          Details: [{ name: "timestamp", type: "uint256" }],
        },
        primaryType: "Details" as const,
        domain: {
          name: "CancelAllOrdersSportX",
          version: "1.0",
          chainId: this.chainId,
          salt,
        },
        message: {
          timestamp,
        },
      };

      const signature = signTypedData({
        privateKey: privateKeyBuffer,
        data: payload as never,
        version: SignTypedDataVersion.V4,
      });

      return signature;
    } catch (error) {
      this.logger.error("Failed to sign cancel all", {}, error as Error);
      throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
    }
  }

  /**
   * Generates a random salt for orders/cancellations
   */
  public generateSalt(): string {
    return `0x${Buffer.from(utils.randomBytes(32)).toString("hex")}`;
  }

  /**
   * Gets current timestamp in seconds
   */
  public getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}
