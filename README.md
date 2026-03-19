# FreedomFinance Tax Report Parser (IBKR soon)

TypeScript utility for generating annual tax-oriented JSON reports from FreedomFinance exports.

It aggregates all reports from `./reports/input` and produces:
- `dividends_YYYY.json`
- `stocks_YYYY.json`

## Purpose

This helper is designed to organize your broker activity into a structured yearly view that can be used to prepare a tax declaration.

Tax scope in the current release:
- **UA only** (Ukrainian tax-reporting context with UAH conversions).

## What It Generates

For a selected year:
- **Dividends report**
  - Aggregates all `dividend` and `dividend_reverted` corporate actions from all input files.
  - Converts each entry to UAH using the dividend date exchange rate.
- **Stocks report**
  - Aggregates stock/options buy/sell activity from all input files.
  - Uses FIFO with full timestamp ordering.
  - Applies inventory operations from `securities_in_outs`:
    - `split`
    - `conversion`
    - `out`
  - Ignores internal account transfer movements in merged-account mode.
  - Supports sell-before-buy (short-like) sequences and keeps attribution in sell year.
  - Applies configured worthless-security write-offs as zero-proceeds synthetic sells (full basis loss realization).

## Input And Output

Input directory:
- `./reports/input/*.json`

Input requirement (important):
- Use **FreedomFinance Broker report** exports (not Custody report).
- Export each account with the full available history (from account opening / first activity up to current export date).
- The calculator relies on full history to build correct FIFO cost basis, including conversions, splits, transfers, and sell matching.
- Partial-history exports can produce incorrect tax results.

Broker support status:
- Current release supports **FreedomFinance** only.
- **IBKR** support is planned for future releases.

Output directory:
- `./reports/output/dividends_YYYY.json`
- `./reports/output/stocks_YYYY.json`

## CLI Usage

Run for a specific year:

```bash
pnpm report:ff --year 2024
```

Run without `--year`:
- defaults to current year.

```bash
pnpm report:ff
```

## Currency Conversion

UAH conversion uses `./currency/uah-rates.json` cache.

Behavior:
- if date/currency rate exists in cache, it is reused
- if missing, rate is fetched from NBU API and cached

## Trade Scope

Included trades:
- `operation` in `{buy, sell}`
- `instr_type !== 6` (FX pair trades are excluded)

## Validation And Failure Policy

Generation fails with explicit errors on broken invariants, including:
- unresolved split/conversion pairings
- impossible inventory mutation (for example, `out` exceeds inventory)
- invalid or missing required input fields
- unresolved open short lots after full ledger processing

Current configured worthless-security write-offs:
- `FTCH.US` on `2025-12-31`
- `FTCHF.US` on `2025-12-31`
- `FTCHQ.US` on `2025-12-31`
- `FRC.US` on `2025-12-31`
- `FRCB.US` on `2025-12-31`

Environment configuration:
- `FF_BANKRUPTCY_WRITE_OFF_TICKERS` - comma-separated tickers to write off
- `FF_BANKRUPTCY_WRITE_OFF_YEAR` - write-off year (default: `2025`)
- `FF_BANKRUPTCY_WRITE_OFF_DATE` - optional override (`YYYY-MM-DD`)
- `FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP` - optional override (`YYYY-MM-DD HH:mm:ss`)
- The script auto-loads `.env` from project root.

## Development

Install dependencies:

```bash
pnpm install
```

Typecheck:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

Test suite includes:
- unit tests for FIFO, conversions, splits, mixed currencies, short/intraday behavior
- dividends aggregation tests
- integration tests for end-to-end generation and CLI/year behavior

## Privacy

All broker reports and generated outputs can contain sensitive financial information.
Treat `reports/input/*`, `reports/output/*`, and any private exports as confidential.
