import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { Currency } from '../../../utils/getUahRate';
import { RateProvider } from '../../rates';
import { generateFreedomFinanceReports } from '../report';

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
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-taxmate-tests-'));
  temporaryDirs.push(dirPath);
  return dirPath;
}

describe('generateFreedomFinanceReports integration', () => {
  it('generates yearly output files from all input reports', async () => {
    const inputDir = path.resolve(process.cwd(), 'reports/input');
    const outputDir = createTempDir();

    const result = await generateFreedomFinanceReports({
      inputDir,
      outputDir,
      year: 2024,
      rateProvider: new ConstantRateProvider(),
    });

    expect(result.year).toBe(2024);
    expect(result.inputFiles.length).toBeGreaterThan(0);
    expect(fs.existsSync(result.dividendsOutputPath)).toBe(true);
    expect(fs.existsSync(result.stocksOutputPath)).toBe(true);

    const stocks = JSON.parse(fs.readFileSync(result.stocksOutputPath, 'utf8')) as {
      breakdown: Record<string, Array<{ quantity: number; relatedBuyOperations: Array<{ quantity: number }> }>>;
    };

    expect(stocks.breakdown['EUR/USD']).toBeUndefined();

    const smciRows = stocks.breakdown['SMCI.US'];
    expect(smciRows).toBeDefined();

    const splitAffectedSell = smciRows.find((row) => row.quantity === 30);
    expect(splitAffectedSell).toBeDefined();

    if (!splitAffectedSell) {
      throw new Error('Expected SMCI split-affected sell row to exist.');
    }

    const matchedQty = splitAffectedSell.relatedBuyOperations
      .reduce((sum, operation) => sum + operation.quantity, 0);

    expect(matchedQty).toBe(30);
  });

  it('preserves sell-year attribution for NVO short-like sequence', async () => {
    const inputDir = path.resolve(process.cwd(), 'reports/input');
    const outputDir = createTempDir();

    const result = await generateFreedomFinanceReports({
      inputDir,
      outputDir,
      year: 2025,
      rateProvider: new ConstantRateProvider(),
    });

    const stocks = JSON.parse(fs.readFileSync(result.stocksOutputPath, 'utf8')) as {
      breakdown: Record<string, Array<{ date: string; relatedBuyOperations: Array<{ date: string }> }>>;
    };

    const nvoRows = stocks.breakdown['NVO.US'];
    expect(nvoRows).toBeDefined();
    expect(nvoRows.length).toBeGreaterThan(0);
    expect(nvoRows[0].date).toBe('2025-01-10');
    expect(nvoRows[0].relatedBuyOperations.length).toBeGreaterThan(0);
  });

  it('fails fast when input directory is missing', async () => {
    const outputDir = createTempDir();

    await expect(
      generateFreedomFinanceReports({
        inputDir: path.resolve(process.cwd(), 'reports/input-does-not-exist'),
        outputDir,
        year: 2024,
        rateProvider: new ConstantRateProvider(),
      })
    ).rejects.toThrow(/Input directory does not exist/);
  });
});
