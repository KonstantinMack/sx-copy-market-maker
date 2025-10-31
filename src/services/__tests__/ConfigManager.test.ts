/**
 * Tests for ConfigManager
 */

import { describe, expect, it } from "vitest";
import { ConfigManager } from "../ConfigManager.js";

describe("ConfigManager", () => {
  it("should load default configuration", () => {
    const manager = new ConfigManager();
    const config = manager.load();

    expect(config).toBeDefined();
    expect(config.network).toBeDefined();
    expect(config.monitoring).toBeDefined();
    expect(config.copying).toBeDefined();
    expect(config.logging).toBeDefined();
    expect(config.api).toBeDefined();
  });

  it("should get configuration values by path", () => {
    const manager = new ConfigManager();
    manager.load();

    const logLevel = manager.get<string>("logging.level");
    expect(["debug", "info", "warn", "error"]).toContain(logLevel);
  });

  it("should throw error when getting path that doesn't exist", () => {
    const manager = new ConfigManager();
    manager.load();

    expect(() => manager.get("invalid.path")).toThrow();
  });

  it("should throw error when getting path before config is loaded", () => {
    const manager = new ConfigManager();

    expect(() => manager.get("network.apiUrl")).toThrow(
      "Configuration not loaded"
    );
  });
});
