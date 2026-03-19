import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { Currency } from '../../../utils/getUahRate';
import { RateProvider } from '../../rates';
import { generateFreedomFinanceReports, parseCliYearArg } from '../report';

class ConstantRateProvider implements RateProvider {
  async getRate(_date: string, currency: Currency): Promise<string> {
    if (currency === Currency.EUR) {
      return '45';
    }

    if (currency === Currency.USD) {
      return '40';
    }

    return '1';
  }
}

const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dirPath of temporaryDirs.splice(0)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-taxmate-cli-tests-'));
  temporaryDirs.push(dirPath);
  return dirPath;
}

describe('report CLI helpers', () => {
  it('parses --year flag values', () => {
    expect(parseCliYearArg(['--year', '2024'])).toBe(2024);
    expect(parseCliYearArg(['--year=2025'])).toBe(2025);
    expect(parseCliYearArg([])).toBeUndefined();
  });

  it('throws on invalid --year values', () => {
    expect(() => parseCliYearArg(['--year'])).toThrow(/Missing value/);
    expect(() => parseCliYearArg(['--year=20x4'])).toThrow(/integer/);
  });

  it('uses current year by default when --year is not provided', async () => {
    const inputDir = path.resolve(process.cwd(), 'reports/input');
    const outputDir = createTempDir();

    const result = await generateFreedomFinanceReports({
      inputDir,
      outputDir,
      now: new Date('2026-03-19T12:00:00Z'),
      rateProvider: new ConstantRateProvider(),
    });

    expect(result.year).toBe(2026);
    expect(path.basename(result.dividendsOutputPath)).toBe('dividends_2026.json');
    expect(path.basename(result.stocksOutputPath)).toBe('stocks_2026.json');
  });
});
