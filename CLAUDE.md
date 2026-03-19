# CLAUDE.md

Instructions for Claude (and similar coding assistants) working in this repository.

## Scope

This repo is a FreedomFinance tax report generator in TypeScript.
Primary behavior is financial-calculation correctness; do not make speculative logic changes.

## Required workflow

1. Read `README.md` and the current reporting code before editing.
2. If changing calculation logic, update tests in `src/reporting/ff/__tests__` in the same change.
3. Run full validation locally:
   - `pnpm typecheck`
   - `pnpm test`
4. Summarize exactly what changed in behavior vs. refactor-only changes.

## Contracts to keep stable

- CLI command: `pnpm report:ff`
- Supported year flag: `--year`
- Input location: `reports/input/*.json`
- Output location + names:
  - `reports/output/dividends_YYYY.json`
  - `reports/output/stocks_YYYY.json`
- Stocks output remains sell-centric with existing schema fields.

## Data model and processing

- Dividends:
  - from `corporate_actions.detailed`
  - `type_id` = `dividend` or `dividend_reverted`
- Trades:
  - from `trades.detailed`
  - include only `buy`/`sell`
  - exclude FX pairs (`instr_type == 6`)
- Inventory events:
  - from `securities_in_outs`
  - include only `split`, `conversion`, `out`

## Calculation invariants

- Strict chronological ordering by timestamp.
- FIFO basis matching.
- Split handling must scale open lots correctly.
- Conversion handling must migrate basis/quantity across tickers.
- `out` must reduce inventory without creating taxable sell rows.
- Fail fast on unresolved split/conversion or impossible inventory state.

## FX and rates

- UAH rates are provided via `RateProvider` abstraction.
- Default runtime provider uses cache/API through `src/utils/getUahRate.ts`.
- Cache path: `currency/uah-rates.json`.
- Tests should inject mock providers and never rely on live network.

## Privacy and git hygiene

- Treat report files as sensitive.
- Do not add report artifacts to tracked files.
- Keep edits minimal and focused; avoid unrelated refactors.

## Useful files

- `src/reporting/ff/report.ts`
- `src/reporting/ff/loadInputReports.ts`
- `src/reporting/stocks.base.ts`
- `src/reporting/dividents.base.ts`
- `src/reporting/types.ts`
- `src/reporting/ff/__tests__/*`
