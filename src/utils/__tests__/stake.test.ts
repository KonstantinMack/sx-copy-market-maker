/**
 * Tests for stake utilities
 */

import { describe, expect, it } from "vitest";
import { adjustStakeByPercentage } from "../stake.js";

describe("adjustStakeByPercentage", () => {
  it("should adjust stake by percentage correctly", () => {
    // Test basic percentage adjustment
    expect(adjustStakeByPercentage("1000000", 50)).toBe("500000");
    expect(adjustStakeByPercentage("1000000", 100)).toBe("1000000");
    expect(adjustStakeByPercentage("1000000", 200)).toBe("2000000");
    expect(adjustStakeByPercentage("1000000", 66.67)).toBe("666700");
  });

  it("should handle decimal precision correctly", () => {
    // Test with values that require precise calculation
    expect(adjustStakeByPercentage("1000000", 33)).toBe("330000");
    expect(adjustStakeByPercentage("1000000", 67)).toBe("670000");
    expect(adjustStakeByPercentage("1234567", 25)).toBe("308641");
  });

  it("should handle zero percentage", () => {
    expect(adjustStakeByPercentage("1000000", 0)).toBe("0");
  });

  it("should handle large numbers", () => {
    const largeStake = "1000000000000000000"; // 1e18
    expect(adjustStakeByPercentage(largeStake, 100)).toBe(largeStake);
    expect(adjustStakeByPercentage(largeStake, 50)).toBe("500000000000000000");
  });

  it("should throw error for invalid stake format", () => {
    expect(() => adjustStakeByPercentage("invalid", 50)).toThrow(
      "Invalid stake format"
    );
    expect(() => adjustStakeByPercentage("", 50)).toThrow(
      "Invalid stake format"
    );
    expect(() => adjustStakeByPercentage("abc123", 50)).toThrow(
      "Invalid stake format"
    );
    expect(() => adjustStakeByPercentage("1.5", 50)).toThrow(
      "Invalid stake format"
    );
  });

  it("should throw error for negative percentage", () => {
    expect(() => adjustStakeByPercentage("1000000", -1)).toThrow(
      "Percentage must be between 0 and 1000"
    );
    expect(() => adjustStakeByPercentage("1000000", -100)).toThrow(
      "Percentage must be between 0 and 1000"
    );
  });

  it("should throw error for percentage over 1000", () => {
    expect(() => adjustStakeByPercentage("1000000", 1001)).toThrow(
      "Percentage must be between 0 and 1000"
    );
    expect(() => adjustStakeByPercentage("1000000", 2000)).toThrow(
      "Percentage must be between 0 and 1000"
    );
  });

  it("should handle boundary percentage values", () => {
    // Test boundary values
    expect(adjustStakeByPercentage("1000000", 0)).toBe("0");
    expect(adjustStakeByPercentage("1000000", 1)).toBe("10000");
    expect(adjustStakeByPercentage("1000000", 999)).toBe("9990000");
    expect(adjustStakeByPercentage("1000000", 1000)).toBe("10000000");
  });
});
