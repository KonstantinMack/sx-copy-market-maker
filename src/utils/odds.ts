/**
 * Odds calculation and conversion utilities
 */

import { BigNumber } from "ethers";
import { CONSTANTS } from "../config/constants.js";
import { isValidOdds, roundOddsToLadder } from "./validation.js";

/**
 * Converts percentage odds string (in wei format) to implied probability decimal
 * @param percentageOdds - Odds in wei format (e.g., "50000000000000000000" = 50%)
 * @returns Implied probability as decimal (e.g., 0.5)
 */
export function oddsToImplied(percentageOdds: string): number {
  const oddsBN = BigNumber.from(percentageOdds);
  const precision = BigNumber.from(10).pow(CONSTANTS.ODDS_PRECISION);
  return oddsBN.mul(10000).div(precision).toNumber() / 10000;
}

/**
 * Converts implied probability decimal to percentage odds string (wei format)
 * @param implied - Implied probability as decimal (e.g., 0.5)
 * @returns Odds in wei format (e.g., "50000000000000000000")
 */
export function impliedToOdds(implied: number): string {
  const precision = BigNumber.from(10).pow(CONSTANTS.ODDS_PRECISION);
  return precision
    .mul(Math.floor(implied * 10000))
    .div(10000)
    .toString();
}

/**
 * Converts percentage odds to decimal odds
 * @param percentageOdds - Odds in wei format
 * @returns Decimal odds (e.g., 2.0)
 */
export function percentageToDecimal(percentageOdds: string): number {
  const implied = oddsToImplied(percentageOdds);
  if (implied === 0) return 0;
  return 1 / implied;
}

/**
 * Converts decimal odds to percentage odds
 * @param decimalOdds - Decimal odds (e.g., 2.0)
 * @returns Odds in wei format
 */
export function decimalToPercentage(decimalOdds: number): string {
  if (decimalOdds <= 1) return "0";
  const implied = 1 / decimalOdds;
  return impliedToOdds(implied);
}

/**
 * Adjusts maker odds by a percentage (makes them worse for maker = better for taker)
 * @param makerOdds - Original maker odds in wei format
 * @param percentage - Percentage to adjust (e.g., 5 = 5% worse for maker)
 * @param ensureLadder - Whether to ensure result is on odds ladder
 * @param stepSize - Ladder step size
 * @returns Adjusted odds in wei format
 */
export function adjustOddsByPercentage(
  makerOdds: string,
  percentage: number,
  ensureLadder: boolean,
  stepSize: number
): string {
  if (!isValidOdds(makerOdds)) {
    throw new Error("Invalid maker odds");
  }

  const oddsBN = BigNumber.from(makerOdds);

  // Convert percentage to basis points to preserve decimals
  // e.g., 2.5% -> 250 bps
  const factorBps = 10000 + Math.round(percentage * 100);
  const adjusted = oddsBN.mul(factorBps).div(10000);

  let result = adjusted.toString();

  if (ensureLadder) {
    result = roundOddsToLadder(result, stepSize);
  }

  // Ensure result is valid
  if (!isValidOdds(result)) {
    throw new Error("Adjusted odds out of valid range");
  }

  return result;
}

/**
 * Adjusts maker odds by a given number of steps on the odds ladder
 * @param makerOdds - Original maker odds in wei format
 * @param steps - Number of steps to move on the ladder (positive = worse for maker, negative = better for maker)
 * @param stepSize - Ladder step size
 * @returns Adjusted odds in wei format
 */
export function adjustOddsBySteps(
  makerOdds: string,
  steps: number,
  stepSize: number
): string {
  if (!isValidOdds(makerOdds)) {
    throw new Error("Invalid maker odds");
  }

  const oddsBN = BigNumber.from(makerOdds);
  const stepValue = BigNumber.from(10).pow(15).mul(stepSize);

  // Calculate the adjustment amount (steps * stepValue)
  const adjustmentAmount = stepValue.mul(Math.abs(steps));
  const adjusted =
    steps >= 0 ? oddsBN.add(adjustmentAmount) : oddsBN.sub(adjustmentAmount);

  if (adjusted.lt(0)) {
    throw new Error("Adjusted odds would be negative");
  }

  const result = adjusted.toString();

  if (!isValidOdds(result)) {
    throw new Error("Adjusted odds out of valid range");
  }

  return result;
}

/**
 * Calculates taker odds from maker odds
 * @param makerOdds - Maker odds in wei format
 * @returns Taker odds in wei format
 */
export function getTakerOdds(makerOdds: string): string {
  const precision = BigNumber.from(10).pow(CONSTANTS.ODDS_PRECISION);
  const oddsBN = BigNumber.from(makerOdds);
  return precision.sub(oddsBN).toString();
}

/**
 * Formats odds for display
 * @param percentageOdds - Odds in wei format
 * @param format - Display format ('implied' | 'decimal' | 'american')
 * @returns Formatted odds string
 */
export function formatOdds(
  percentageOdds: string,
  format: "implied" | "decimal" | "american" = "implied"
): string {
  const implied = oddsToImplied(percentageOdds);

  switch (format) {
    case "implied":
      return `${(implied * 100).toFixed(2)}%`;

    case "decimal": {
      const decimal = percentageToDecimal(percentageOdds);
      return decimal.toFixed(2);
    }

    case "american": {
      const decimal = percentageToDecimal(percentageOdds);
      if (decimal >= 2) {
        return `+${((decimal - 1) * 100).toFixed(0)}`;
      }
      return `-${(100 / (decimal - 1)).toFixed(0)}`;
    }

    default:
      return `${(implied * 100).toFixed(2)}%`;
  }
}

/**
 * Converts odds between different formats
 */
export const OddsConverter = {
  toImplied: oddsToImplied,
  toDecimal: percentageToDecimal,
  toPercentage: impliedToOdds,
  fromDecimal: decimalToPercentage,
  format: formatOdds,
} as const;
