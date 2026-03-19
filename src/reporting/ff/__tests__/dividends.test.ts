import { describe, expect, it } from 'vitest';

import { Currency } from '../../../utils/getUahRate';
import { RateProvider } from '../../rates';
import { IDividend } from '../../types';
import { FreedomFinanceDividendsReport } from '../dividents';

class FixedRateProvider implements RateProvider {
  constructor(private readonly rates: Record<string, Partial<Record<Currency, string>>> = {}) {}

  async getRate(date: string, currency: Currency): Promise<string> {
    return this.rates[date]?.[currency] ?? '1';
  }
}

async function generate(dividends: IDividend[], year: number, rates: Record<string, Partial<Record<Currency, string>>> = {}) {
  return new FreedomFinanceDividendsReport(new FixedRateProvider(rates)).generateReport(dividends, year);
}

describe('FreedomFinanceDividendsReport', () => {
  it('filters by year and aggregates by ticker across multiple sources', async () => {
    const dividends: IDividend[] = [
      { ticker: 'AAPL.US', date: '2024-01-01', amount: 10, currency: Currency.USD },
      { ticker: 'AAPL.US', date: '2024-03-01', amount: 15, currency: Currency.USD },
      { ticker: 'AAPL.US', date: '2025-01-01', amount: 999, currency: Currency.USD },
      { ticker: 'MSFT.US', date: '2024-02-01', amount: 5, currency: Currency.USD },
    ];

    const report = await generate(dividends, 2024, {
      '2024-01-01': { USD: '40' },
      '2024-02-01': { USD: '41' },
      '2024-03-01': { USD: '42' },
    });

    expect(report.breakdown).toHaveLength(2);
    expect(report.totals.USD).toBe(30);
    expect(report.totals.UAH).toBe(1235);

    const aapl = report.breakdown.find((entry) => entry.ticker === 'AAPL.US');
    expect(aapl?.total).toBe(25);
    expect(aapl?.dividendsCount).toBe(2);
  });

  it('keeps dividend_reverted entries as source-provided amounts', async () => {
    const dividends: IDividend[] = [
      { ticker: 'TLT.US', date: '2024-08-07', amount: 6.96, currency: Currency.USD },
      { ticker: 'TLT.US', date: '2024-09-07', amount: -6.96, currency: Currency.USD },
    ];

    const report = await generate(dividends, 2024, {
      '2024-08-07': { USD: '40' },
      '2024-09-07': { USD: '40' },
    });

    const tlt = report.breakdown.find((entry) => entry.ticker === 'TLT.US');
    expect(tlt?.entries).toHaveLength(2);
    expect(tlt?.total).toBe(0);
    expect(report.totals.USD).toBe(0);
    expect(report.totals.UAH).toBe(0);
  });

  it('supports multiple dividend currencies with independent totals', async () => {
    const dividends: IDividend[] = [
      { ticker: 'RYA.EU', date: '2024-01-10', amount: 10, currency: Currency.EUR },
      { ticker: 'AAPL.US', date: '2024-01-10', amount: 10, currency: Currency.USD },
    ];

    const report = await generate(dividends, 2024, {
      '2024-01-10': { EUR: '45', USD: '40' },
    });

    expect(report.totals.EUR).toBe(10);
    expect(report.totals.USD).toBe(10);
    expect(report.totals.UAH).toBe(850);
  });
});
