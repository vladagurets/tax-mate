import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';

export enum Currency {
  USD = 'USD', // United States Dollar
  EUR = 'EUR', // Euro
  UAH = 'UAH', // Ukrainian Hryvnia
  // Note: This enum can be extended with other currencies as needed for brokers
  // Example: GBP = 'GBP', // British Pound
  // Example: JPY = 'JPY', // Japanese Yen
}

interface UahRates {
  [date: string]: Partial<Record<Currency, string>>; // Dynamic currency rates
}

export const UA_BANK__CURRENCY_RATE_API_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';

/**
 * @description Extracts UAH rates for specified currencies from the bank.gov.ua
 * @param date YYYY-MM-DD
 * @param currencies Array of currency codes to fetch rates for
 * @returns An object containing the date and rates for the specified currencies
 */
async function fetchUahRate(date: string, currency: Currency) {
  const parsedDate = DateTime.fromISO(date);
  if (!parsedDate.isValid) {
    throw new Error(`Invalid date value: ${date}`);
  }

  const res = await axios.get(UA_BANK__CURRENCY_RATE_API_URL, {
    params: {
      valcode: currency,
      date: date.replace(/-/g, ''),
      json: true,
    }
  });

  const rate = res.data[0]?.rate;

  if (!rate) {
    throw new Error(`Rate for ${currency} on ${date} is not available.`);
  }

  return rate;
}

/**
 * @description Gets the UAH rate for a specific currency on a specific day.
 * @param date YYYY-MM-DD
 * @param currency The currency code to fetch the rate for
 * @returns The UAH rate for the specified currency on the specified date, or null if not available
 */
export async function getUahRate(date: string, currency: Currency): Promise<string> {
  const filePath = path.join(__dirname, '../../currency/uah-rates.json');

  if (!fs.existsSync(filePath)) {
    console.error('Rates file does not exist. Creating a new one.');
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
  }

  const rates: UahRates = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const isRateNotExist = !rates[date]?.[currency];

  if (isRateNotExist) {
    console.warn(`Rate for ${currency} on ${date} is not available. Fetching now...`);

    const rate = await fetchUahRate(date, currency);

    rates[date] = { ...rates[date], [currency]: rate };

    fs.writeFileSync(filePath, JSON.stringify(rates, null, 2));
  }

  return rates[date][currency] as string;
}
