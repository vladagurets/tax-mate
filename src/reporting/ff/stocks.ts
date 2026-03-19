import { RateProvider } from '../rates';
import { BaseStocksReport } from '../stocks.base';
import { Broker, IOperationsReportData, IStocksReportInput } from '../types';

export class FreedomFinanceStocksReport extends BaseStocksReport {
  static brokerName = Broker.FreedomFinance;

  constructor(rateProvider?: RateProvider) {
    super(rateProvider);
  }

  async generateReport(input: IStocksReportInput, year: number): Promise<IOperationsReportData> {
    console.log('Generating FreedomFinance stocks report for year', year);

    await this.processEvents(input, year);

    return this.reportData;
  }
}
