/**
 * Configuration Manager
 * Loads and validates configuration from default config file
 */

import config from "@/config/config.js";
import type { Config } from "@/types/index.js";
import { validateConfig } from "@/utils/validation.js";

/**
 * Configuration Manager Service
 * Handles loading and validating configuration from default config file
 */
export class ConfigManager {
  private config: Config | null = null;

  /**
   * Loads configuration from default config file
   */
  public load(): Config {
    this.config = config;
    validateConfig(this.config);
    return this.config;
  }

  /**
   * Gets a specific configuration value by path
   */
  public get<T>(path: string): T {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }

    const keys = path.split(".");
    let value: unknown = this.config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        throw new Error(`Configuration path '${path}' not found`);
      }
    }

    return value as T;
  }
}
