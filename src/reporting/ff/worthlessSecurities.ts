import { IWorthlessSecurity } from '../types';

/**
 * Built-in fallback tickers for bankruptcy write-off realization.
 */
export const DEFAULT_BANKRUPTCY_WRITE_OFF_TICKERS = [
  'FTCH.US',
  'FTCHF.US',
  'FTCHQ.US',
  'FRC.US',
  'FRCB.US',
];

const DEFAULT_BANKRUPTCY_WRITE_OFF_YEAR = 2025;

/**
 * Builds configured bankruptcy write-off events from environment variables.
 *
 * Supported vars:
 * - `FF_BANKRUPTCY_WRITE_OFF_TICKERS` - comma-separated ticker list
 * - `FF_BANKRUPTCY_WRITE_OFF_YEAR` - write-off year (used when date is omitted)
 * - `FF_BANKRUPTCY_WRITE_OFF_DATE` - explicit date `YYYY-MM-DD`
 * - `FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP` - explicit timestamp `YYYY-MM-DD HH:mm:ss`
 */
export function getDefaultWorthlessSecurities(env: NodeJS.ProcessEnv = process.env): IWorthlessSecurity[] {
  const configuredTickers = parseTickerList(env.FF_BANKRUPTCY_WRITE_OFF_TICKERS);
  const tickers = configuredTickers.length > 0 ? configuredTickers : DEFAULT_BANKRUPTCY_WRITE_OFF_TICKERS;

  const year = parseYearOrDefault(env.FF_BANKRUPTCY_WRITE_OFF_YEAR, DEFAULT_BANKRUPTCY_WRITE_OFF_YEAR);
  const date = parseDateOrDefault(env.FF_BANKRUPTCY_WRITE_OFF_DATE, `${year}-12-31`);
  const timestamp = parseTimestampOrDefault(env.FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP, `${date} 23:59:59`);

  return tickers.map((ticker) => ({
    ticker,
    date,
    timestamp,
  }));
}

function parseTickerList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0)
    )
  );
}

function parseYearOrDefault(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 3000) {
    throw new Error(`Invalid FF_BANKRUPTCY_WRITE_OFF_YEAR value: ${value}`);
  }

  return parsed;
}

function parseDateOrDefault(value: string | undefined, fallback: string): string {
  if (!value || value.trim() === '') {
    return fallback;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid FF_BANKRUPTCY_WRITE_OFF_DATE format: ${value}. Expected YYYY-MM-DD.`);
  }

  return value;
}

function parseTimestampOrDefault(value: string | undefined, fallback: string): string {
  if (!value || value.trim() === '') {
    return fallback;
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error(
      `Invalid FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP format: ${value}. Expected YYYY-MM-DD HH:mm:ss.`
    );
  }

  return value;
}
