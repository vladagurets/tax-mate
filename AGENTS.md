# AGENTS.md

Agent guidance for this repository.

## Project goal

Generate annual tax-oriented JSON reports from FreedomFinance input reports.

Inputs:
- `reports/input/*.json`

Outputs:
- `reports/output/dividends_YYYY.json`
- `reports/output/stocks_YYYY.json`

## Quick commands

- Install: `pnpm install`
- Run report for year: `pnpm report:ff --year 2026`
- Run report with default current year: `pnpm report:ff`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`

## Core code map

- Entrypoint: `src/reporting/ff/report.ts`
- Input normalization: `src/reporting/ff/loadInputReports.ts`
- Stocks engine (FIFO + inventory events): `src/reporting/stocks.base.ts`
- Dividends engine: `src/reporting/dividents.base.ts`
- Freedom wrappers: `src/reporting/ff/stocks.ts`, `src/reporting/ff/dividents.ts`
- FX rate abstraction: `src/reporting/rates.ts`
- UAH cache + API fetch: `src/utils/getUahRate.ts`
- Domain types: `src/reporting/types.ts`

## Business rules to preserve

- Process all input files from `reports/input` together.
- Dividends source: `corporate_actions.detailed` with `type_id in {dividend, dividend_reverted}`.
- Stocks trade source: `trades.detailed` with `operation in {buy,sell}` and `instr_type != 6`.
- Inventory events source: `securities_in_outs` with `type in {split, conversion, out}`.
- Ignore internal account transfers when building merged ledger.
- Use full timestamps for operation ordering.
- Use FIFO basis for profit/loss.
- Sell-before-buy is supported (short-like flow), and attribution is sell-centric.
- UAH conversion uses operation date (buy date for basis, sell date for proceeds, dividend date for dividends).

## Safety and data handling

- Input/output data may contain sensitive personal financial information.
- Do not commit raw report contents or generated report contents unless explicitly requested.
- Keep `reports/` ignored in git.
- `currency/uah-rates.json` is mutable runtime cache; treat as data artifact.

## Change checklist for agents

Before finishing any change:
1. `pnpm typecheck`
2. `pnpm test`
3. Verify CLI output path and naming still match contract.
4. Ensure no violation of rules above (especially split/conversion/out handling).

## Testing expectations

- Add/adjust unit tests under `src/reporting/ff/__tests__` for all calculation changes.
- Prefer deterministic tests with mocked `RateProvider` instead of live API calls.
- Include edge-case tests when touching matching logic:
  - split multiplier handling
  - conversion chains
  - outflow inventory reductions
  - same-day ordering
  - short-lot cover behavior
