/**
 * Tests for odds adjustment utilities
 */

import { describe, expect, it } from "vitest";
import { CONSTANTS } from "../../config/constants.js";
import { adjustOddsByPercentage, adjustOddsBySteps } from "../odds.js";

describe("adjustOddsByPercentage", () => {
  describe("basic percentage adjustments", () => {
    it("should increase odds by positive percentage", () => {
      // 50% odds + 10% adjustment = 55% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsByPercentage(
        fiftyPercent,
        10,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("55000000000000000000");
    });

    it("should increase odds by small percentage", () => {
      // 50% odds + 1% adjustment = 50.5% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsByPercentage(
        fiftyPercent,
        1,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("50500000000000000000");
    });

    it("should increase odds by large percentage", () => {
      // 50% odds + 100% adjustment = 100% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsByPercentage(
        fiftyPercent,
        100,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("100000000000000000000");
    });

    it("should handle zero percentage adjustment", () => {
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsByPercentage(
        fiftyPercent,
        0,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe(fiftyPercent);
    });
  });

  describe("ladder rounding", () => {
    it("should round to ladder when ensureLadder is true", () => {
      // Create odds that don't fall on ladder
      const oddsBN = "50123456789012345678"; // Not on ladder
      const result = adjustOddsByPercentage(
        oddsBN,
        5,
        true,
        CONSTANTS.DEFAULT_LADDER_STEP
      );

      // Result should be on ladder (divisible by 10^15 * 125)
      const step = BigInt(10 ** 15) * BigInt(CONSTANTS.DEFAULT_LADDER_STEP);
      const resultBN = BigInt(result);
      expect(resultBN % step).toBe(BigInt(0));
    });

    it("should not round when ensureLadder is false", () => {
      const odds = "50000000000000000000";
      const result = adjustOddsByPercentage(
        odds,
        3.21,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      // 50% + 3.21% adjustment = 51.605%
      expect(result).toBe("51605000000000000000");
    });

    it("should accept custom step size", () => {
      const odds = "50000000000000000000";
      const customStep = 133; // 0.133%
      const result = adjustOddsByPercentage(odds, 5, true, customStep);

      // Result should be on custom ladder
      const step = BigInt(10 ** 15) * BigInt(customStep);
      const resultBN = BigInt(result);
      expect(resultBN % step).toBe(BigInt(0));
    });
  });

  describe("edge cases", () => {
    it("should handle very small odds", () => {
      const smallOdds = "1000000000000000"; // 0.001%
      const result = adjustOddsByPercentage(
        smallOdds,
        10,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("1100000000000000");
    });

    it("should handle odds near maximum", () => {
      // 95% odds + 5% = 99.75% (still valid)
      const highOdds = "95000000000000000000";
      const result = adjustOddsByPercentage(
        highOdds,
        5,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("99750000000000000000");
    });

    it("should handle negative percentage (decrease odds)", () => {
      // 50% odds - 10% = 45% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsByPercentage(
        fiftyPercent,
        -10,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("45000000000000000000");
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid maker odds", () => {
      expect(() =>
        adjustOddsByPercentage(
          "invalid",
          5,
          false,
          CONSTANTS.DEFAULT_LADDER_STEP
        )
      ).toThrow("Invalid maker odds");
      expect(() =>
        adjustOddsByPercentage("", 5, false, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
      expect(() =>
        adjustOddsByPercentage("abc", 5, false, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
    });

    it("should throw error for negative odds", () => {
      expect(() =>
        adjustOddsByPercentage(
          "-1000000000000000000",
          5,
          false,
          CONSTANTS.DEFAULT_LADDER_STEP
        )
      ).toThrow("Invalid maker odds");
    });

    it("should throw error for odds above maximum", () => {
      const aboveMax = "100000000000000000001"; // Above 10^20
      expect(() =>
        adjustOddsByPercentage(
          aboveMax,
          5,
          false,
          CONSTANTS.DEFAULT_LADDER_STEP
        )
      ).toThrow("Invalid maker odds");
    });

    it("should throw error if adjusted odds exceed maximum", () => {
      // 99% odds + 10% = 108.9% (invalid)
      const highOdds = "99000000000000000000";
      expect(() =>
        adjustOddsByPercentage(
          highOdds,
          10,
          false,
          CONSTANTS.DEFAULT_LADDER_STEP
        )
      ).toThrow("Adjusted odds out of valid range");
    });
  });

  describe("precision handling", () => {
    it("should maintain precision in calculations", () => {
      const odds = "33333333333333333333"; // ~33.33%
      const result = adjustOddsByPercentage(
        odds,
        5,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("34999999999999999999"); // ~35%
    });

    it("should handle integer division correctly", () => {
      const odds = "10000000000000000000"; // 10%
      const result = adjustOddsByPercentage(
        odds,
        33,
        false,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("13300000000000000000"); // 13.3%
    });
  });
});

describe("adjustOddsBySteps", () => {
  describe("basic step adjustments", () => {
    it("should increase odds by positive steps", () => {
      // 50% odds + 1 step (0.125%) = 50.125% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsBySteps(
        fiftyPercent,
        1,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("50125000000000000000");
    });

    it("should increase odds by multiple steps", () => {
      // 50% odds + 4 steps (0.5%) = 50.5% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsBySteps(
        fiftyPercent,
        4,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("50500000000000000000");
    });

    it("should decrease odds by negative steps", () => {
      // 50% odds - 1 step (0.125%) = 49.875% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsBySteps(
        fiftyPercent,
        -1,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("49875000000000000000");
    });

    it("should handle zero steps", () => {
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsBySteps(
        fiftyPercent,
        0,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe(fiftyPercent);
    });
  });

  describe("custom step sizes", () => {
    it("should work with custom step size", () => {
      // 50% odds + 1 step with custom step size of 500 (0.5%) = 50.5% odds
      const fiftyPercent = "50000000000000000000";
      const customStep = 500; // 0.5%
      const result = adjustOddsBySteps(fiftyPercent, 1, customStep);
      expect(result).toBe("50500000000000000000");
    });

    it("should handle multiple steps with custom step size", () => {
      // 50% odds + 2 steps with custom step size of 250 (0.25%) = 50.5% odds
      const fiftyPercent = "50000000000000000000";
      const customStep = 250; // 0.25%
      const result = adjustOddsBySteps(fiftyPercent, 2, customStep);
      expect(result).toBe("50500000000000000000");
    });
  });

  describe("edge cases", () => {
    it("should handle odds near maximum", () => {
      // 95% odds + 3 steps (0.375%) = 95.375% (still valid)
      const highOdds = "95000000000000000000";
      const result = adjustOddsBySteps(
        highOdds,
        3,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("95375000000000000000");
    });

    it("should handle large number of steps", () => {
      // 50% odds + 10 steps (1.25%) = 51.25% odds
      const fiftyPercent = "50000000000000000000";
      const result = adjustOddsBySteps(
        fiftyPercent,
        10,
        CONSTANTS.DEFAULT_LADDER_STEP
      );
      expect(result).toBe("51250000000000000000");
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid maker odds", () => {
      expect(() =>
        adjustOddsBySteps("invalid", 5, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
      expect(() =>
        adjustOddsBySteps("", 5, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
      expect(() =>
        adjustOddsBySteps("abc", 5, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
    });

    it("should throw error for negative odds", () => {
      expect(() =>
        adjustOddsBySteps(
          "-1000000000000000000",
          5,
          CONSTANTS.DEFAULT_LADDER_STEP
        )
      ).toThrow("Invalid maker odds");
    });

    it("should throw error for odds above maximum", () => {
      const aboveMax = "100000000000000000001"; // Above 10^20
      expect(() =>
        adjustOddsBySteps(aboveMax, 5, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Invalid maker odds");
    });

    it("should throw error if adjusted odds would be negative", () => {
      // Very small odds with negative steps would go negative
      const tinyOdds = "1000000000000000"; // 0.001%
      expect(() =>
        adjustOddsBySteps(tinyOdds, -10, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Adjusted odds would be negative");
    });

    it("should throw error if adjusted odds exceed maximum", () => {
      // 99% odds + 10 steps (1.25%) = 100.25% (invalid)
      const highOdds = "99000000000000000000";
      expect(() =>
        adjustOddsBySteps(highOdds, 10, CONSTANTS.DEFAULT_LADDER_STEP)
      ).toThrow("Adjusted odds out of valid range");
    });
  });

  describe("ladder compliance", () => {
    it("should always return odds on ladder", () => {
      // Start with odds on ladder
      const odds = "50000000000000000000"; // 50%
      const result = adjustOddsBySteps(odds, 1, CONSTANTS.DEFAULT_LADDER_STEP);

      // Result should be on ladder (divisible by 10^15 * 125)
      const step = BigInt(10 ** 15) * BigInt(CONSTANTS.DEFAULT_LADDER_STEP);
      const resultBN = BigInt(result);
      expect(resultBN % step).toBe(BigInt(0));
    });

    it("should work with custom ladder step", () => {
      // Start with odds on ladder
      const odds = "50000000000000000000"; // 50%
      const customStep = 500; // 0.5%
      const result = adjustOddsBySteps(odds, 1, customStep);

      // Result should be on custom ladder
      const step = BigInt(10 ** 15) * BigInt(customStep);
      const resultBN = BigInt(result);
      expect(resultBN % step).toBe(BigInt(0));
    });
  });
});
