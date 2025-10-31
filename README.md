# SX Market Making Copy Bot

A sophisticated market making bot for the [SX.bet](https://sx.bet) decentralized sports betting exchange. This bot monitors specified wallet addresses in real-time and automatically copies their orders with configurable modifications including odds adjustments, stake sizing, and filtering rules.

[![Node.js](https://img.shields.io/badge/Node.js-22+-000000?style=flat-square&logo=node.js&logoColor=5CAA47)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-000000?style=flat-square&logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org/)

## Features

- ✅ **Real-time Monitoring**: WebSocket-based order tracking via Ably SDK
- ✅ **Intelligent Copying**: Configurable odds and stake adjustment
- ✅ **Smart Filtering**: Filter by sport, market type, odds range, and more
- ✅ **Auto-cancellation**: Cancel copied orders when source orders are cancelled
- ✅ **Robust Error Handling**: Automatic reconnection and graceful error recovery
- ✅ **Detailed Logging**: Track every operation with structured logs

## Quick Start

### Prerequisites

- Node.js 22 or higher
- SX.bet account with API key ([Get one here](https://sx.bet))
- Private key for a wallet on SX Network
- Approve `TokenTransferProxy` contract on SX Network (just place one bet manually on the website and this will be done)
- USDC tokens on SX Network for placing orders

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sx-copy-market-maker

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

1. **Edit `.env` file**:

```bash
# Required
PRIVATE_KEY=0x1234567890abcdef...  # Your wallet private key
SX_API_KEY=your-api-key-here        # From sx.bet account settings
```

2. **Adjust `config/config.ts`**:

Change the settings of the bot to your liking, these are the main sections:

```ts
{
  network: {
    environment: "testnet", // "mainnet" | "testnet"
    wsReconnectInterval: 5000,
    wsMaxRetries: 5,
  },
  monitoring: {
    walletAddresses: [],
    baseToken: "USDC", // Only USDC supported for now
    filters: {
      // Empty arrays mean no filtering, i.e., include all
      // values are IDs and mean inclusion of only these IDs
      sports: [], // sportIds
      marketTypes: [], // marketTypeIds
      leagues: [], // leagueIds
      // odds range filter for original orders
      // copied orders can have odds adjusted outside this range
      minOdds: "0.2", // -> 0.2 means 20%
      maxOdds: "0.8", // -> 0.8 means 80%
      excludeParlay: true,
      excludeLive: true,
    },
  },
  copying: {
    enabled: true,
    copyDelay: 0, // time in milliseconds between detecting and copying an order
    oddsAdjustment: {
      method: "fixed", // "percentage" | "fixed" (number of ladder steps) | "none"
      value: 4, // percentage value or fixed ladder steps
      ensureLadderCompliance: true,
    },
    stakeAdjustment: {
      method: "percentage", // "percentage" | "fixed" (will use minStake) | "none" (same as percentage 100)
      value: 120,
      minStake: StakeUtils.USDC.toWei(20), // 20 USDC -> minimum 10 USDC otherwise order will fail
      maxStake: StakeUtils.USDC.toWei(50), // 50 USDC
    },
    autoCancelOnSource: true, // Automatically cancel copied orders if the source order is cancelled
  }
}
```

## Configuration Guide

### Odds Adjustment

**Percentage Method**:
```ts
{
  method: "percentage",
  value: 5
}
```
- Adjusts odds by 5% worse for the maker
- Example: 50% original maker odds → 52.5% copied maker order odds → better taker odds for copied order

**Fixed Amount Method**:
```ts
{
  method: "fixed",
  value: 5
}
```
- Adds/subtracts 5 ladder steps (0.125%) from original odds
- Example: 50% original maker odds → 50.625% (50 + 0.125 * 5) copied maker order odds -> better taker odds for copied order

**No Adjustment**:
```ts
{
  method: "none",
  value: 0 // doesn't matter here
}
```
- Copied order will use same odds as original order

### Stake Adjustment

**Percentage of Original**:
```ts
{
  method: "percentage",
  value: 50
}
```
- Uses 50% of the original stake for the copied order

**Fixed Amount**:
```ts
{
  method: "fixed",
  value: 120, // doesn't matter here
  minStake: StakeUtils.USDC.toWei(20)
}
```
- Uses "minStake" as the stake for the copied order

**No Adjustment**:
```ts
{
  method: "none",
  value: 0 // doesn't matter here
}
```
- Copied order will use same stake as original order

**Stake limits**:
```ts
{
  minStake: StakeUtils.USDC.toWei(20), // 20 USDC
  maxStake: StakeUtils.USDC.toWei(50), // 50 USDC
}
```
- Hard limits for order stakes
- If adjusted original stake is below minStake then the stake for the copied order will be minStake
- If adjusted original stake is above maxStake then the stake for the copied order will be maxStake


### Filtering

```ts
{
  filters: {
    sports: [], // sportIds
    marketTypes: [], // marketTypeIds
    leagues: [], // leagueIds
    minOdds: "0.2", // -> 0.2 means 20%
    maxOdds: "0.8", // -> 0.8 means 80%
    excludeParlay: true,
    excludeLive: true,
  },
}
```
- empty arrays mean no filtering, i.e. include all
- values are IDs and mean inclusion of only these IDs, i.e. `sports: [5]` means only copy soccer bets
- `minOdds` and `maxOdds` determine the range of odds from original orders that should be copied, i.e. any original order with odds outside that range will not be copied. The odds from copied orders (i.e. after odds adjustment can be outside this range)

See [SX API Documentation](https://api.docs.sx.bet) for complete list of sports, leagues and marketType IDs.

### Running the Bot
```bash
# Start
npm start
```

## How It Works

1. **Monitor**: Bot connects to SX API via WebSocket and monitors specified wallet addresses
2. **Detect**: When a monitored wallet places an order, the bot receives a real-time event
3. **Filter**: Order is checked against configured filters (sport, market type, odds range, etc.)
4. **Modify**: Odds and stakes are adjusted according to configuration
5. **Execute**: Copied order is signed with EIP-712 and submitted to the exchange
6. **Track**: Order lifecycle is monitored for fills, cancellations, and settlements



## Logging

Logs are written to both console and files (if enabled in `config/config.ts`):

```
logs/
├── app.log              # All logs
├── error.log            # Error logs only
└── orders.log           # Order-specific logs
```

**Log Levels**:
- `debug`: Detailed information for debugging
- `info`: General operational messages
- `warn`: Warning messages
- `error`: Error messages (operation failed)


## Security Considerations

⚠️ **Important Security Notes**:

1. **Never commit your `.env` file** to github or expose your private key
2. **Use a dedicated wallet** for the bot with limited funds
3. **Start on testnet**
4. **Start with small amounts**
5. **Monitor regularly** for unusual activity


## Support

- [**SX Discord**](https://discord.gg/C9sktXBJsP)
- [**SX API Docs**](https://api.docs.sx.bet)
- [**SX Website**](https://sx.bet)
- **Issues**: Open an issue on GitHub


## License

This project is licensed under the MIT License.

## Disclaimer

This software is provided for educational and research purposes. Trading and betting involve risk. The authors are not responsible for any financial losses incurred while using this software. Always:

- Test thoroughly on testnet
- Start with small amounts
- Monitor regularly
- Understand the risks
- Comply with local regulations

---

**Built with** ❤️ **for the SX.bet community**

If this project helps you, consider giving it a ⭐ on GitHub!
