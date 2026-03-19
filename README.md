# Freedom24 Tax Report Parser

TypeScript utility for generating annual tax-oriented JSON reports from Freedom24 exports.

It aggregates all reports from `./reports/input` and produces:
- `dividends_YYYY.json`
- `stocks_YYYY.json`

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

## Input And Output

Input directory:
- `./reports/input/*.json`

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
