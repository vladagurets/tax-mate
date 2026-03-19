import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BANKRUPTCY_WRITE_OFF_TICKERS,
  getDefaultWorthlessSecurities,
} from '../worthlessSecurities';

describe('getDefaultWorthlessSecurities', () => {
  it('returns built-in defaults when env variables are not set', () => {
    const events = getDefaultWorthlessSecurities({});

    expect(events.map((event) => event.ticker)).toEqual(DEFAULT_BANKRUPTCY_WRITE_OFF_TICKERS);
    expect(events.every((event) => event.date === '2025-12-31')).toBe(true);
    expect(events.every((event) => event.timestamp === '2025-12-31 23:59:59')).toBe(true);
  });

  it('uses custom ticker list and year from env', () => {
    const events = getDefaultWorthlessSecurities({
      FF_BANKRUPTCY_WRITE_OFF_TICKERS: 'abc.us, XYZ.US, abc.us',
      FF_BANKRUPTCY_WRITE_OFF_YEAR: '2024',
    });

    expect(events.map((event) => event.ticker)).toEqual(['ABC.US', 'XYZ.US']);
    expect(events.every((event) => event.date === '2024-12-31')).toBe(true);
    expect(events.every((event) => event.timestamp === '2024-12-31 23:59:59')).toBe(true);
  });

  it('throws on invalid env formats', () => {
    expect(() =>
      getDefaultWorthlessSecurities({
        FF_BANKRUPTCY_WRITE_OFF_YEAR: '20x5',
      })
    ).toThrow(/FF_BANKRUPTCY_WRITE_OFF_YEAR/);

    expect(() =>
      getDefaultWorthlessSecurities({
        FF_BANKRUPTCY_WRITE_OFF_DATE: '2025\/12\/31',
      })
    ).toThrow(/FF_BANKRUPTCY_WRITE_OFF_DATE/);

    expect(() =>
      getDefaultWorthlessSecurities({
        FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP: '2025-12-31T23:59:59',
      })
    ).toThrow(/FF_BANKRUPTCY_WRITE_OFF_TIMESTAMP/);
  });
});
