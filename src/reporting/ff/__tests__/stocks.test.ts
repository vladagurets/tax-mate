import { describe, expect, it } from 'vitest';

import { Currency } from '../../../utils/getUahRate';
import { RateProvider } from '../../rates';
import { IInventoryOperation, IOperation, IStocksReportInput, OperationType } from '../../types';
import { FreedomFinanceStocksReport } from '../stocks';

class FixedRateProvider implements RateProvider {
  constructor(private readonly rates: Record<string, Partial<Record<Currency, string>>> = {}) {}

  async getRate(date: string, currency: Currency): Promise<string> {
    return this.rates[date]?.[currency] ?? '1';
  }
}

function trade(input: Partial<IOperation> & Pick<IOperation, 'id' | 'ticker' | 'date' | 'timestamp' | 'type'>): IOperation {
  return {
    currency: Currency.USD,
    amount: 0,
    commissionCurrency: Currency.USD,
    commissionAmount: 0,
    quantity: 0,
    price: 0,
    ...input,
  };
}

function inventoryOp(input: IInventoryOperation): IInventoryOperation {
  return input;
}

async function generateStocksReport(
  input: IStocksReportInput,
  year: number,
  rates: Record<string, Partial<Record<Currency, string>>> = {}
) {
  const report = new FreedomFinanceStocksReport(new FixedRateProvider(rates));
  return report.generateReport(input, year);
}

describe('FreedomFinanceStocksReport', () => {
  it('calculates FIFO profit across years with fees and UAH conversion', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-2020',
          ticker: 'AAPL.US',
          date: '2020-01-10',
          timestamp: '2020-01-10 10:00:00',
          type: OperationType.BUY,
          amount: 100,
          commissionAmount: 2,
          quantity: 10,
          price: 10,
        }),
        trade({
          id: 'sell-2026',
          ticker: 'AAPL.US',
          date: '2026-02-01',
          timestamp: '2026-02-01 10:00:00',
          type: OperationType.SELL,
          amount: 80,
          commissionAmount: 1,
          quantity: 5,
          price: 16,
        }),
      ],
      inventoryOperations: [],
    };

    const report = await generateStocksReport(input, 2026, {
      '2020-01-10': { USD: '40' },
      '2026-02-01': { USD: '50' },
    });

    const row = report.breakdown['AAPL.US'][0];
    expect(row.quantity).toBe(5);
    expect(row.amount).toBe(79);
    expect(row.profit).toBe(28);
    expect(row.amountUAH).toBe(3950);
    expect(row.profitUAH).toBe(1910);
    expect(row.relatedBuyOperations[0].quantity).toBe(5);
    expect(row.relatedBuyOperations[0].amount).toBe(50);
    expect(row.relatedBuyOperations[0].commissionAmount).toBe(1);
    expect(report.totals.USD).toBe(28);
    expect(report.totals.UAH).toBe(1910);
  });

  it('handles sell-before-buy as short and attributes P/L to sell year', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'sell-short',
          ticker: 'META.US',
          date: '2024-08-20',
          timestamp: '2024-08-20 10:00:00',
          type: OperationType.SELL,
          amount: 500,
          quantity: 5,
          price: 100,
        }),
        trade({
          id: 'buy-cover',
          ticker: 'META.US',
          date: '2024-08-20',
          timestamp: '2024-08-20 11:00:00',
          type: OperationType.BUY,
          amount: 450,
          quantity: 5,
          price: 90,
        }),
      ],
      inventoryOperations: [],
    };

    const report = await generateStocksReport(input, 2024);
    const row = report.breakdown['META.US'][0];

    expect(row.date).toBe('2024-08-20');
    expect(row.quantity).toBe(5);
    expect(row.profit).toBe(50);
    expect(row.relatedBuyOperations).toHaveLength(1);
    expect(row.relatedBuyOperations[0].date).toBe('2024-08-20');
    expect(row.relatedBuyOperations[0].amount).toBe(450);
  });

  it('keeps short profit in sell year even when covered next year', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'sell-2024',
          ticker: 'NVO.US',
          date: '2024-12-30',
          timestamp: '2024-12-30 19:00:00',
          type: OperationType.SELL,
          amount: 300,
          quantity: 3,
          price: 100,
        }),
        trade({
          id: 'buy-2025',
          ticker: 'NVO.US',
          date: '2025-01-02',
          timestamp: '2025-01-02 10:00:00',
          type: OperationType.BUY,
          amount: 240,
          quantity: 3,
          price: 80,
        }),
      ],
      inventoryOperations: [],
    };

    const report2024 = await generateStocksReport(input, 2024);
    expect(report2024.breakdown['NVO.US'][0].profit).toBe(60);

    const report2025 = await generateStocksReport(input, 2025);
    expect(report2025.breakdown['NVO.US']).toBeUndefined();
  });

  it('applies split operations before sell matching', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-smci',
          ticker: 'SMCI.US',
          date: '2024-09-26',
          timestamp: '2024-09-26 18:11:18',
          type: OperationType.BUY,
          amount: 1200,
          commissionAmount: 3,
          quantity: 3,
          price: 400,
        }),
        trade({
          id: 'sell-smci',
          ticker: 'SMCI.US',
          date: '2024-10-31',
          timestamp: '2024-10-31 15:30:17',
          type: OperationType.SELL,
          amount: 900,
          commissionAmount: 2,
          quantity: 30,
          price: 30,
        }),
      ],
      inventoryOperations: [
        inventoryOp({
          id: 'split-neg',
          type: 'split',
          ticker: 'SMCI.US',
          date: '2024-10-01',
          timestamp: '2024-10-01 15:00:00',
          quantity: -3,
          comment: 'Stock split SMCI.US ratio 1/10',
        }),
        inventoryOp({
          id: 'split-pos',
          type: 'split',
          ticker: 'SMCI.US',
          date: '2024-10-01',
          timestamp: '2024-10-01 15:00:01',
          quantity: 30,
          comment: 'Stock split SMCI.US ratio 1/10',
        }),
      ],
    };

    const report = await generateStocksReport(input, 2024);
    const row = report.breakdown['SMCI.US'][0];
    const matchedQty = row.relatedBuyOperations.reduce((acc, related) => acc + related.quantity, 0);

    expect(row.quantity).toBe(30);
    expect(matchedQty).toBe(30);
    expect(row.relatedBuyOperations[0].amount).toBe(1200);
    expect(row.relatedBuyOperations[0].commissionAmount).toBe(3);
  });

  it('moves basis through conversion chains', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-old',
          ticker: 'OLD.US',
          date: '2023-01-01',
          timestamp: '2023-01-01 10:00:00',
          type: OperationType.BUY,
          amount: 100,
          quantity: 10,
          price: 10,
        }),
        trade({
          id: 'sell-new2',
          ticker: 'NEW2.US',
          date: '2026-03-01',
          timestamp: '2026-03-01 10:00:00',
          type: OperationType.SELL,
          amount: 130,
          quantity: 10,
          price: 13,
        }),
      ],
      inventoryOperations: [
        inventoryOp({
          id: 'conv-1-from',
          type: 'conversion',
          ticker: 'OLD.US',
          date: '2024-01-01',
          timestamp: '2024-01-01 15:00:00',
          quantity: -10,
          comment: 'OLD -> NEW ratio 1/1',
        }),
        inventoryOp({
          id: 'conv-1-to',
          type: 'conversion',
          ticker: 'NEW.US',
          date: '2024-01-01',
          timestamp: '2024-01-01 15:00:00',
          quantity: 10,
          comment: 'OLD -> NEW ratio 1/1',
        }),
        inventoryOp({
          id: 'conv-2-from',
          type: 'conversion',
          ticker: 'NEW.US',
          date: '2025-01-01',
          timestamp: '2025-01-01 15:00:00',
          quantity: -10,
          comment: 'NEW -> NEW2 ratio 1/1',
        }),
        inventoryOp({
          id: 'conv-2-to',
          type: 'conversion',
          ticker: 'NEW2.US',
          date: '2025-01-01',
          timestamp: '2025-01-01 15:00:00',
          quantity: 10,
          comment: 'NEW -> NEW2 ratio 1/1',
        }),
      ],
    };

    const report = await generateStocksReport(input, 2026);
    const row = report.breakdown['NEW2.US'][0];

    expect(row.relatedBuyOperations).toHaveLength(1);
    expect(row.relatedBuyOperations[0].date).toBe('2023-01-01');
    expect(row.relatedBuyOperations[0].amount).toBe(100);
    expect(row.profit).toBe(30);
  });

  it('applies out operations as inventory reduction without taxable sell row', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-voo',
          ticker: 'VOO.US',
          date: '2023-01-01',
          timestamp: '2023-01-01 10:00:00',
          type: OperationType.BUY,
          amount: 1000,
          quantity: 10,
          price: 100,
        }),
        trade({
          id: 'sell-voo',
          ticker: 'VOO.US',
          date: '2026-01-01',
          timestamp: '2026-01-01 10:00:00',
          type: OperationType.SELL,
          amount: 720,
          quantity: 6,
          price: 120,
        }),
      ],
      inventoryOperations: [
        inventoryOp({
          id: 'out-voo',
          type: 'out',
          ticker: 'VOO.US',
          date: '2025-01-01',
          timestamp: '2025-01-01 10:00:00',
          quantity: -4,
          comment: 'Transfer to external custody',
        }),
      ],
    };

    const report = await generateStocksReport(input, 2026);
    const row = report.breakdown['VOO.US'][0];

    expect(row.relatedBuyOperations[0].quantity).toBe(6);
    expect(row.relatedBuyOperations[0].amount).toBe(600);
    expect(row.profit).toBe(120);
  });

  it('throws when split legs are unresolved', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-smci',
          ticker: 'SMCI.US',
          date: '2024-09-26',
          timestamp: '2024-09-26 18:11:18',
          type: OperationType.BUY,
          amount: 1200,
          quantity: 3,
          price: 400,
        }),
      ],
      inventoryOperations: [
        inventoryOp({
          id: 'split-neg',
          type: 'split',
          ticker: 'SMCI.US',
          date: '2024-10-01',
          timestamp: '2024-10-01 15:00:00',
          quantity: -3,
          comment: 'Stock split SMCI.US ratio 1/10',
        }),
      ],
    };

    await expect(generateStocksReport(input, 2024)).rejects.toThrow(/Unresolved split operations/);
  });

  it('throws when out operation exceeds available inventory', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-1',
          ticker: 'AAPL.US',
          date: '2024-01-01',
          timestamp: '2024-01-01 10:00:00',
          type: OperationType.BUY,
          amount: 100,
          quantity: 1,
          price: 100,
        }),
      ],
      inventoryOperations: [
        inventoryOp({
          id: 'out-too-much',
          type: 'out',
          ticker: 'AAPL.US',
          date: '2024-01-02',
          timestamp: '2024-01-02 10:00:00',
          quantity: -2,
          comment: 'Transfer to external custody',
        }),
      ],
    };

    await expect(generateStocksReport(input, 2024)).rejects.toThrow(/OUT operation cannot be applied/);
  });

  it('supports mixed trade and commission currencies', async () => {
    const input: IStocksReportInput = {
      operations: [
        trade({
          id: 'buy-eur',
          ticker: 'RYA.EU',
          date: '2024-01-01',
          timestamp: '2024-01-01 10:00:00',
          type: OperationType.BUY,
          currency: Currency.EUR,
          amount: 100,
          commissionCurrency: Currency.USD,
          commissionAmount: 2,
          quantity: 10,
          price: 10,
        }),
        trade({
          id: 'sell-eur',
          ticker: 'RYA.EU',
          date: '2024-06-01',
          timestamp: '2024-06-01 10:00:00',
          type: OperationType.SELL,
          currency: Currency.EUR,
          amount: 150,
          commissionCurrency: Currency.USD,
          commissionAmount: 3,
          quantity: 10,
          price: 15,
        }),
      ],
      inventoryOperations: [],
    };

    const report = await generateStocksReport(input, 2024, {
      '2024-01-01': { EUR: '40', USD: '50' },
      '2024-06-01': { EUR: '42', USD: '52' },
    });

    const row = report.breakdown['RYA.EU'][0];
    expect(row.currency).toBe(Currency.EUR);
    expect(row.commissionCurrency).toBe(Currency.USD);
    expect(row.amount).toBe(147);
    expect(row.relatedBuyOperations[0].commissionCurrency).toBe(Currency.USD);
    expect(row.profitUAH).toBe(2074);
  });
});
