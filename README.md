# WalletDNA

**Track smart money on Base before Twitter finds it.**

WalletDNA monitors 370 verified alpha wallets on Base chain. When 2 or more of them buy the same token at the same time, you get an alert — before the crowd.

---

## What's included

- **Alpha Feed** — live stream of smart money activity
- **Smart Clusters** — real-time detection when multiple alpha wallets pile into the same token
- **Leaderboard** — 370 wallets ranked by alpha score across 133,000+ analyzed trades
- **Wallet Profiles** — deep-dive into any wallet: win rate, ROI, open positions
- **Signal History** — verified past signals with real GeckoTerminal price outcomes
- **Telegram Alerts** — instant notification when a cluster forms or smart money exits

---

## Quick Start

**Step 1** — Install Node.js (free, version 18+)
Download from: https://nodejs.org — choose the LTS version

**Step 2** — Launch WalletDNA

- **Windows**: double-click `start.bat`
- **Mac / Linux**: open Terminal, run `./start.sh`

**Step 3** — Open the dashboard
Your browser will open automatically at: http://localhost:3001

The launcher installs everything on first run. This takes 1–2 minutes. After that it starts instantly.

---

## System Requirements

- Node.js 18 or newer
- Windows 10+ / macOS 10.15+ / Ubuntu 20.04+
- 500 MB free disk space
- Internet connection

---

## Configuration

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

The default settings work immediately. The app uses a public Base RPC endpoint.

**Optional — faster RPC:** Get a free API key at https://alchemy.com and set:
```
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Telegram Alerts Setup

1. Open Telegram → search **@BotFather** → send `/newbot` → follow the steps → copy the **Bot Token**
2. Send any message to your new bot (just type "hi")
3. Search **@userinfobot** → it replies with your **Chat ID** (a number)
4. In WalletDNA → go to **Alerts** in the sidebar → paste your Bot Token and Chat ID → click **Send Test Alert**

Done. You will receive a Telegram message every time a new smart money cluster forms.

---

## Activate your license

1. After purchase you receive a license key by email (format: `GUM-XXXX-XXXX-XXXX-XXXX`)
2. Open WalletDNA → click **Pricing** in the sidebar
3. Paste your key → click **Activate**

---

## Troubleshooting

**The app does not open**
Make sure Node.js is installed. Open a terminal and run:
```
node --version
```
If you see an error, download Node.js from nodejs.org and install it, then try again.

**Signal History page is empty**
Run this once in the WalletDNA folder:
```
node scripts/backtest.js 120
```
Then refresh the page.

**No clusters appear**
The first wallet sync takes 10–30 minutes. Leave the app running and check back later.

**Telegram test alert fails**
Make sure you sent a message to your bot before testing. The Chat ID must be a plain number with no spaces.

---

## Data sources

- Wallet trades: Blockscout Base API (on-chain)
- Token prices: DexScreener and GeckoTerminal (on-chain)
- Signal backtest: GeckoTerminal historical OHLCV data

---

*Not financial advice. Past signals do not guarantee future results.*
