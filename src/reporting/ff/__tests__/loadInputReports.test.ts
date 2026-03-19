import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadFreedomInputData } from '../loadInputReports';

const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dirPath of temporaryDirs.splice(0)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-taxmate-loader-tests-'));
  temporaryDirs.push(dirPath);
  return dirPath;
}

function writeReport(dirPath: string, fileName: string, payload: unknown): void {
  fs.writeFileSync(path.join(dirPath, fileName), JSON.stringify(payload, null, 2));
}

describe('loadFreedomInputData', () => {
  it('loads and normalizes all supported operation types', () => {
    const inputDir = createTempDir();

    writeReport(inputDir, 'a.json', {
      corporate_actions: {
        detailed: [
          { type_id: 'dividend', date: '2024-01-01', amount: 10, ticker: 'AAPL.US', currency: 'USD' },
          { type_id: 'conversion', date: '2024-01-01', amount: 1, ticker: 'AAPL.US', currency: 'USD' },
        ],
      },
      trades: {
        detailed: [
          {
            id: 'buy-1',
            operation: 'buy',
            instr_type: 1,
            date: '2024-01-01 10:00:00',
            short_date: '2024-01-01',
            instr_nm: 'AAPL.US',
            curr_c: 'USD',
            summ: 100,
            commission_currency: 'USD',
            commission: 2,
            q: 10,
            p: 10,
          },
          {
            id: 'fx-sell-ignored',
            operation: 'sell',
            instr_type: 6,
            date: '2024-01-01 11:00:00',
            short_date: '2024-01-01',
            instr_nm: 'EUR/USD',
            curr_c: 'USD',
            summ: 100,
            commission_currency: 'USD',
            commission: 0,
            q: 100,
            p: 1,
          },
        ],
      },
      securities_in_outs: [
        {
          id: 1,
          type: 'split',
          datetime: '2024-01-02 10:00:00',
          ticker: 'AAPL.US',
          quantity: '-1',
          comment: 'split',
        },
        {
          id: 2,
          type: 'conversion',
          datetime: '2024-01-03 10:00:00',
          ticker: 'AAPL.US',
          quantity: '-1',
          comment: 'conv',
        },
        {
          id: 3,
          type: 'out',
          datetime: '2024-01-04 10:00:00',
          ticker: 'AAPL.US',
          quantity: '-1',
          comment: '',
        },
        {
          id: 4,
          type: 'internal',
          datetime: '2024-01-05 10:00:00',
          ticker: 'AAPL.US',
          quantity: '1',
          comment: 'internal',
        },
      ],
    });

    writeReport(inputDir, 'b.json', {
      corporate_actions: {
        detailed: [
          { type_id: 'dividend_reverted', date: '2024-01-05', amount: -5, ticker: 'AAPL.US', currency: 'USD' },
        ],
      },
      trades: { detailed: [] },
      securities_in_outs: [],
    });

    const result = loadFreedomInputData(inputDir);

    expect(result.sourceFiles).toHaveLength(2);
    expect(result.dividends).toHaveLength(2);
    expect(result.operations).toHaveLength(1);
    expect(result.inventoryOperations).toHaveLength(3);
    expect(result.operations[0].ticker).toBe('AAPL.US');
    expect(result.operations[0].id).toBe('buy-1');
  });

  it('throws on unsupported currencies', () => {
    const inputDir = createTempDir();

    writeReport(inputDir, 'invalid.json', {
      corporate_actions: {
        detailed: [
          { type_id: 'dividend', date: '2024-01-01', amount: 10, ticker: 'AAPL.US', currency: 'GBP' },
        ],
      },
      trades: { detailed: [] },
      securities_in_outs: [],
    });

    expect(() => loadFreedomInputData(inputDir)).toThrow(/Unsupported currency/);
  });
});
