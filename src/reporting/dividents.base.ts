import { Currency } from '../utils/getUahRate';
import { roundToTwoDecimals } from '../utils/roundToTwoDecimals';
import { NbuRateProvider, RateProvider } from './rates';
import { IBaseReport, IDividend, IDividendsReportData } from './types';

export abstract class BaseDividendsReport implements IBaseReport<IDividend[], IDividendsReportData> {
  protected reportData: IDividendsReportData = {
    breakdown: [],
    totals: {}
  };

  protected constructor(private readonly rateProvider: RateProvider = new NbuRateProvider()) {}

  abstract generateReport(dividends: IDividend[], year: number): Promise<IDividendsReportData>;

  protected async processDividends(dividends: IDividend[], year: number): Promise<void> {
    const filteredDividends = dividends
      .filter((div) => new Date(div.date).getFullYear() === year)
      .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));

    const tickerMap = new Map<string, {
      ticker: string;
      entries: {
        date: string;
        amount: number;
        currency: string;
        uahRate: string;
        amountUAH: number;
      }[];
      total: number;
      amountUAH: number;
      dividendsCount: number;
    }>();

    for (const dividend of filteredDividends) {
      const exchangeRateUAH = await this.rateProvider.getRate(dividend.date, dividend.currency);
      const amountInUAH = roundToTwoDecimals(dividend.amount * parseFloat(exchangeRateUAH));

      const existing = tickerMap.get(dividend.ticker) ?? {
        ticker: dividend.ticker,
        entries: [],
        total: 0,
        amountUAH: 0,
        dividendsCount: 0
      };

      existing.entries.push({
        date: dividend.date,
        amount: roundToTwoDecimals(dividend.amount),
        currency: dividend.currency,
        uahRate: exchangeRateUAH,
        amountUAH: amountInUAH,
      });

      existing.total = roundToTwoDecimals(existing.total + dividend.amount);
      existing.amountUAH = roundToTwoDecimals(existing.amountUAH + amountInUAH);
      existing.dividendsCount = existing.entries.length;

      tickerMap.set(dividend.ticker, existing);

      if (this.reportData.totals[dividend.currency] === undefined) {
        this.reportData.totals[dividend.currency] = 0;
      }

      this.reportData.totals[dividend.currency] = roundToTwoDecimals(
        this.reportData.totals[dividend.currency] + dividend.amount
      );

      if (this.reportData.totals[Currency.UAH] === undefined) {
        this.reportData.totals[Currency.UAH] = 0;
      }

      this.reportData.totals[Currency.UAH] = roundToTwoDecimals(
        this.reportData.totals[Currency.UAH] + amountInUAH
      );
    }

    this.reportData.breakdown = Array.from(tickerMap.values());
    console.log(`Processed ${filteredDividends.length} DIVIDENDS for ${year}`);
  }
}
