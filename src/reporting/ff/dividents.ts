import { RateProvider } from '../rates';
import { BaseDividendsReport } from '../dividents.base';
import { Broker, IDividend, IDividendsReportData } from '../types';

export class FreedomFinanceDividendsReport extends BaseDividendsReport {
  static brokerName = Broker.FreedomFinance;

  constructor(rateProvider?: RateProvider) {
    super(rateProvider);
  }

  async generateReport(dividends: IDividend[], year: number): Promise<IDividendsReportData> {
    console.log('Generating FreedomFinance dividends report for year', year);

    await this.processDividends(dividends, year);

    return this.reportData;
  }
}
