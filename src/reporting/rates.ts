import { Currency, getUahRate } from '../utils/getUahRate';

export interface RateProvider {
  getRate(date: string, currency: Currency): Promise<string>;
}

export class NbuRateProvider implements RateProvider {
  async getRate(date: string, currency: Currency): Promise<string> {
    if (currency === Currency.UAH) {
      return '1';
    }

    return getUahRate(date, currency);
  }
}
