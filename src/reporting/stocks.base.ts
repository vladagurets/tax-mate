import { Currency } from '../utils/getUahRate';
import { roundToTwoDecimals } from '../utils/roundToTwoDecimals';
import { NbuRateProvider, RateProvider } from './rates';
import {
  IBaseReport,
  IInventoryOperation,
  IOperation,
  IOperationTotal,
  IOperationsReportData,
  IRelatedBuyOperation,
  IStocksReportInput,
  OperationType,
} from './types';

const EPSILON = 1e-8;

type StockEvent =
  | { kind: 'trade'; timestamp: string; id: string; operation: IOperation }
  | { kind: 'split'; timestamp: string; id: string; operation: IInventoryOperation }
  | { kind: 'conversion'; timestamp: string; id: string; operation: IInventoryOperation }
  | { kind: 'out'; timestamp: string; id: string; operation: IInventoryOperation };

interface LongLot {
  timestamp: string;
  date: string;
  currency: Currency;
  commissionCurrency: Currency;
  quantity: number;
  amount: number;
  commissionAmount: number;
}

interface ShortLot {
  timestamp: string;
  quantity: number;
  sellRecordId: string;
}

interface TickerInventory {
  longLots: LongLot[];
  shortLots: ShortLot[];
}

interface RelatedBuyOperationRaw {
  date: string;
  currency: Currency;
  amount: number;
  commissionCurrency: Currency;
  commissionAmount: number;
  quantity: number;
}

interface SellRecordInternal {
  id: string;
  operation: IOperation;
  relatedBuyOperationsRaw: RelatedBuyOperationRaw[];
  pendingShortQuantity: number;
}

interface PendingSplitGroup {
  date: string;
  ticker: string;
  comment: string;
  positiveQuantity: number;
  negativeQuantity: number;
}

interface PendingConversionGroup {
  date: string;
  comment: string;
  fromOperations: IInventoryOperation[];
  toOperations: IInventoryOperation[];
}

export abstract class BaseStocksReport implements IBaseReport<IStocksReportInput, IOperationsReportData> {
  protected reportData: IOperationsReportData = {
    breakdown: {},
    totals: {},
    tickerTotalsUAH: {},
  };

  protected constructor(private readonly rateProvider: RateProvider = new NbuRateProvider()) {}

  abstract generateReport(input: IStocksReportInput, year: number): Promise<IOperationsReportData>;

  /**
   * Processes all normalized stock events into an internal ledger and builds
   * the final yearly sell-centric report.
   *
   * The method enforces event ordering, applies inventory mutations
   * (split/conversion/out), resolves short-lot covers, validates invariants,
   * and finally computes per-sell profit/loss in original currency and UAH.
   */
  protected async processEvents(input: IStocksReportInput, year: number): Promise<void> {
    this.reportData = {
      breakdown: {},
      totals: {},
      tickerTotalsUAH: {},
    };

    const inventory = new Map<string, TickerInventory>();
    const sellRecords: SellRecordInternal[] = [];
    const sellRecordById = new Map<string, SellRecordInternal>();

    const pendingSplitGroups = new Map<string, PendingSplitGroup>();
    const pendingConversionGroups = new Map<string, PendingConversionGroup>();

    const events = this.buildSortedEvents(input);

    for (const event of events) {
      if (event.kind === 'trade') {
        this.processTradeOperation(event.operation, inventory, sellRecords, sellRecordById);
        continue;
      }

      if (event.kind === 'out') {
        this.processOutOperation(event.operation, inventory);
        continue;
      }

      if (event.kind === 'split') {
        this.processSplitOperation(event.operation, inventory, pendingSplitGroups);
        continue;
      }

      this.processConversionOperation(event.operation, inventory, pendingConversionGroups);
    }

    this.assertPendingGroupsResolved(pendingSplitGroups, pendingConversionGroups);
    this.assertNoOpenShortLots(inventory);

    await this.buildReportFromSellRecords(sellRecords, year);
    console.log(`Processed ${sellRecords.length} SELL operations in unified ledger for ${year}`);
  }

  /**
   * Merges trades and inventory operations into one time-ordered stream.
   *
   * Sort order:
   * 1. `timestamp`
   * 2. event kind priority (`conversion` -> `split` -> `out` -> `trade`)
   * 3. stable `id` tie-breaker
   *
   * This guarantees deterministic matching and mutation behavior.
   */
  private buildSortedEvents(input: IStocksReportInput): StockEvent[] {
    const events: StockEvent[] = [];

    for (const operation of input.operations) {
      events.push({
        kind: 'trade',
        timestamp: operation.timestamp,
        id: operation.id,
        operation,
      });
    }

    for (const operation of input.inventoryOperations) {
      events.push({
        kind: operation.type,
        timestamp: operation.timestamp,
        id: operation.id,
        operation,
      });
    }

    const rank: Record<StockEvent['kind'], number> = {
      conversion: 0,
      split: 1,
      out: 2,
      trade: 3,
    };

    events.sort((a, b) => {
      const byTs = a.timestamp.localeCompare(b.timestamp);
      if (byTs !== 0) {
        return byTs;
      }

      const byKind = rank[a.kind] - rank[b.kind];
      if (byKind !== 0) {
        return byKind;
      }

      return a.id.localeCompare(b.id);
    });

    return events;
  }

  private processTradeOperation(
    operation: IOperation,
    inventory: Map<string, TickerInventory>,
    sellRecords: SellRecordInternal[],
    sellRecordById: Map<string, SellRecordInternal>
  ): void {
    if (operation.type === OperationType.BUY) {
      this.processBuyOperation(operation, inventory, sellRecordById);
      return;
    }

    this.processSellOperation(operation, inventory, sellRecords, sellRecordById);
  }

  /**
   * Applies a SELL operation against existing long lots (FIFO).
   *
   * If there are not enough long lots, the unmatched part becomes a short lot
   * and is attached to this sell record for later BUY-cover matching.
   */
  private processSellOperation(
    operation: IOperation,
    inventory: Map<string, TickerInventory>,
    sellRecords: SellRecordInternal[],
    sellRecordById: Map<string, SellRecordInternal>
  ): void {
    const tickerInventory = this.getTickerInventory(inventory, operation.ticker);

    const sellRecord: SellRecordInternal = {
      id: operation.id,
      operation,
      relatedBuyOperationsRaw: [],
      pendingShortQuantity: 0,
    };

    let quantityToSell = operation.quantity;

    while (quantityToSell > EPSILON && tickerInventory.longLots.length > 0) {
      const oldestLongLot = tickerInventory.longLots[0];
      const quantityToTake = Math.min(quantityToSell, oldestLongLot.quantity);

      const ratio = quantityToTake / oldestLongLot.quantity;
      const amountToTake = oldestLongLot.amount * ratio;
      const commissionToTake = oldestLongLot.commissionAmount * ratio;

      oldestLongLot.quantity -= quantityToTake;
      oldestLongLot.amount -= amountToTake;
      oldestLongLot.commissionAmount -= commissionToTake;

      quantityToSell -= quantityToTake;

      sellRecord.relatedBuyOperationsRaw.push({
        date: oldestLongLot.date,
        currency: oldestLongLot.currency,
        amount: amountToTake,
        commissionCurrency: oldestLongLot.commissionCurrency,
        commissionAmount: commissionToTake,
        quantity: quantityToTake,
      });

      if (oldestLongLot.quantity <= EPSILON) {
        tickerInventory.longLots.shift();
      }
    }

    if (quantityToSell > EPSILON) {
      sellRecord.pendingShortQuantity = quantityToSell;
      tickerInventory.shortLots.push({
        timestamp: operation.timestamp,
        quantity: quantityToSell,
        sellRecordId: sellRecord.id,
      });
    }

    sellRecords.push(sellRecord);
    sellRecordById.set(sellRecord.id, sellRecord);
  }

  /**
   * Applies a BUY operation.
   *
   * BUY first closes open short lots in FIFO order and allocates proportional
   * buy amount/commission to the originating sell records. Any remaining BUY
   * quantity is stored as a new long lot.
   */
  private processBuyOperation(
    operation: IOperation,
    inventory: Map<string, TickerInventory>,
    sellRecordById: Map<string, SellRecordInternal>
  ): void {
    const tickerInventory = this.getTickerInventory(inventory, operation.ticker);

    let quantityToBuy = operation.quantity;

    while (quantityToBuy > EPSILON && tickerInventory.shortLots.length > 0) {
      const oldestShortLot = tickerInventory.shortLots[0];
      const quantityToTake = Math.min(quantityToBuy, oldestShortLot.quantity);

      const ratio = quantityToTake / operation.quantity;
      const amountToTake = operation.amount * ratio;
      const commissionToTake = operation.commissionAmount * ratio;

      const linkedSellRecord = sellRecordById.get(oldestShortLot.sellRecordId);
      if (!linkedSellRecord) {
        throw new Error(`Cannot find SELL record ${oldestShortLot.sellRecordId} for short lot matching.`);
      }

      linkedSellRecord.relatedBuyOperationsRaw.push({
        date: operation.date,
        currency: operation.currency,
        amount: amountToTake,
        commissionCurrency: operation.commissionCurrency,
        commissionAmount: commissionToTake,
        quantity: quantityToTake,
      });

      linkedSellRecord.pendingShortQuantity = roundToTwoDecimals(
        linkedSellRecord.pendingShortQuantity - quantityToTake
      );

      oldestShortLot.quantity -= quantityToTake;
      quantityToBuy -= quantityToTake;

      if (oldestShortLot.quantity <= EPSILON) {
        tickerInventory.shortLots.shift();
      }
    }

    if (quantityToBuy > EPSILON) {
      const ratio = quantityToBuy / operation.quantity;
      tickerInventory.longLots.push({
        timestamp: operation.timestamp,
        date: operation.date,
        currency: operation.currency,
        commissionCurrency: operation.commissionCurrency,
        quantity: quantityToBuy,
        amount: operation.amount * ratio,
        commissionAmount: operation.commissionAmount * ratio,
      });
    }
  }

  /**
   * Applies an `out` inventory event by removing long lots in FIFO order.
   *
   * This operation does not create taxable sell rows. It only changes
   * inventory state. If requested quantity exceeds available long inventory,
   * processing fails.
   */
  private processOutOperation(
    operation: IInventoryOperation,
    inventory: Map<string, TickerInventory>
  ): void {
    const tickerInventory = this.getTickerInventory(inventory, operation.ticker);
    let quantityToMoveOut = Math.abs(operation.quantity);

    while (quantityToMoveOut > EPSILON && tickerInventory.longLots.length > 0) {
      const oldestLongLot = tickerInventory.longLots[0];
      const quantityToTake = Math.min(quantityToMoveOut, oldestLongLot.quantity);
      const ratio = quantityToTake / oldestLongLot.quantity;

      oldestLongLot.quantity -= quantityToTake;
      oldestLongLot.amount -= oldestLongLot.amount * ratio;
      oldestLongLot.commissionAmount -= oldestLongLot.commissionAmount * ratio;
      quantityToMoveOut -= quantityToTake;

      if (oldestLongLot.quantity <= EPSILON) {
        tickerInventory.longLots.shift();
      }
    }

    if (quantityToMoveOut > EPSILON) {
      throw new Error(
        `OUT operation cannot be applied for ${operation.ticker} on ${operation.timestamp}. ` +
        `Missing quantity: ${roundToTwoDecimals(quantityToMoveOut)}.`
      );
    }
  }

  /**
   * Collects split legs and applies split ratio to open lots once both legs
   * are present.
   *
   * Ratio formula: `positiveQuantity / abs(negativeQuantity)`.
   * Both long and short open quantities for the ticker are scaled.
   */
  private processSplitOperation(
    operation: IInventoryOperation,
    inventory: Map<string, TickerInventory>,
    pendingSplitGroups: Map<string, PendingSplitGroup>
  ): void {
    const key = this.getSplitGroupKey(operation);
    const existing = pendingSplitGroups.get(key) ?? {
      date: operation.date,
      ticker: operation.ticker,
      comment: this.normalizeComment(operation.comment),
      positiveQuantity: 0,
      negativeQuantity: 0,
    };

    if (operation.quantity > 0) {
      existing.positiveQuantity += operation.quantity;
    } else {
      existing.negativeQuantity += Math.abs(operation.quantity);
    }

    pendingSplitGroups.set(key, existing);

    if (existing.positiveQuantity <= EPSILON || existing.negativeQuantity <= EPSILON) {
      return;
    }

    const splitMultiplier = existing.positiveQuantity / existing.negativeQuantity;
    const tickerInventory = this.getTickerInventory(inventory, operation.ticker);

    for (const longLot of tickerInventory.longLots) {
      longLot.quantity *= splitMultiplier;
    }

    for (const shortLot of tickerInventory.shortLots) {
      shortLot.quantity *= splitMultiplier;
    }

    pendingSplitGroups.delete(key);
  }

  /**
   * Collects conversion legs and migrates basis/quantity between tickers.
   *
   * For each matched from/to pair:
   * - long lots are moved first, preserving basis
   * - short lots are moved next, preserving sell linkage
   * - conversion ratio is applied to moved quantities
   *
   * Processing fails if inventory is insufficient.
   */
  private processConversionOperation(
    operation: IInventoryOperation,
    inventory: Map<string, TickerInventory>,
    pendingConversionGroups: Map<string, PendingConversionGroup>
  ): void {
    const key = this.getConversionGroupKey(operation);
    const existing = pendingConversionGroups.get(key) ?? {
      date: operation.date,
      comment: this.normalizeComment(operation.comment),
      fromOperations: [],
      toOperations: [],
    };

    if (operation.quantity < 0) {
      existing.fromOperations.push(operation);
    } else {
      existing.toOperations.push(operation);
    }

    pendingConversionGroups.set(key, existing);

    while (existing.fromOperations.length > 0 && existing.toOperations.length > 0) {
      const fromOperation = existing.fromOperations.shift() as IInventoryOperation;
      const toOperation = existing.toOperations.shift() as IInventoryOperation;

      const fromQuantity = Math.abs(fromOperation.quantity);
      const toQuantity = Math.abs(toOperation.quantity);
      const conversionRatio = toQuantity / fromQuantity;

      let missingQuantity = fromQuantity;
      missingQuantity = this.moveLongLotsBetweenTickers(
        inventory,
        fromOperation.ticker,
        toOperation.ticker,
        conversionRatio,
        missingQuantity
      );

      missingQuantity = this.moveShortLotsBetweenTickers(
        inventory,
        fromOperation.ticker,
        toOperation.ticker,
        conversionRatio,
        missingQuantity
      );

      if (missingQuantity > EPSILON) {
        throw new Error(
          `Conversion cannot be applied ${fromOperation.ticker} -> ${toOperation.ticker} on ${fromOperation.timestamp}. ` +
          `Missing quantity: ${roundToTwoDecimals(missingQuantity)}.`
        );
      }
    }

    if (existing.fromOperations.length === 0 && existing.toOperations.length === 0) {
      pendingConversionGroups.delete(key);
    }
  }

  /**
   * Moves long lots from one ticker to another during conversion, preserving
   * lot date, basis, and commission basis.
   *
   * @returns Remaining source quantity that could not be moved.
   */
  private moveLongLotsBetweenTickers(
    inventory: Map<string, TickerInventory>,
    fromTicker: string,
    toTicker: string,
    conversionRatio: number,
    quantityToMove: number
  ): number {
    const fromInventory = this.getTickerInventory(inventory, fromTicker);
    const toInventory = this.getTickerInventory(inventory, toTicker);

    while (quantityToMove > EPSILON && fromInventory.longLots.length > 0) {
      const oldestLongLot = fromInventory.longLots[0];
      const quantityToTake = Math.min(quantityToMove, oldestLongLot.quantity);
      const ratio = quantityToTake / oldestLongLot.quantity;

      const amountToTake = oldestLongLot.amount * ratio;
      const commissionToTake = oldestLongLot.commissionAmount * ratio;

      oldestLongLot.quantity -= quantityToTake;
      oldestLongLot.amount -= amountToTake;
      oldestLongLot.commissionAmount -= commissionToTake;

      toInventory.longLots.push({
        timestamp: oldestLongLot.timestamp,
        date: oldestLongLot.date,
        currency: oldestLongLot.currency,
        commissionCurrency: oldestLongLot.commissionCurrency,
        quantity: quantityToTake * conversionRatio,
        amount: amountToTake,
        commissionAmount: commissionToTake,
      });

      quantityToMove -= quantityToTake;

      if (oldestLongLot.quantity <= EPSILON) {
        fromInventory.longLots.shift();
      }
    }

    toInventory.longLots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return quantityToMove;
  }

  /**
   * Moves short lots from one ticker to another during conversion while
   * preserving sell-record linkage.
   *
   * @returns Remaining source quantity that could not be moved.
   */
  private moveShortLotsBetweenTickers(
    inventory: Map<string, TickerInventory>,
    fromTicker: string,
    toTicker: string,
    conversionRatio: number,
    quantityToMove: number
  ): number {
    const fromInventory = this.getTickerInventory(inventory, fromTicker);
    const toInventory = this.getTickerInventory(inventory, toTicker);

    while (quantityToMove > EPSILON && fromInventory.shortLots.length > 0) {
      const oldestShortLot = fromInventory.shortLots[0];
      const quantityToTake = Math.min(quantityToMove, oldestShortLot.quantity);

      oldestShortLot.quantity -= quantityToTake;

      toInventory.shortLots.push({
        timestamp: oldestShortLot.timestamp,
        quantity: quantityToTake * conversionRatio,
        sellRecordId: oldestShortLot.sellRecordId,
      });

      quantityToMove -= quantityToTake;

      if (oldestShortLot.quantity <= EPSILON) {
        fromInventory.shortLots.shift();
      }
    }

    toInventory.shortLots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return quantityToMove;
  }

  /**
   * Converts resolved internal sell records into output report rows for a
   * selected year.
   *
   * This step computes:
   * - per-sell net amount
   * - matched buy basis (incl. commissions)
   * - profit/loss in trade currency and UAH
   * - ticker and global totals
   */
  private async buildReportFromSellRecords(sellRecords: SellRecordInternal[], year: number): Promise<void> {
    const sortedSellRecords = sellRecords
      .filter((record) => new Date(record.operation.date).getFullYear() === year)
      .sort((a, b) => a.operation.timestamp.localeCompare(b.operation.timestamp));

    for (const sellRecord of sortedSellRecords) {
      if (sellRecord.pendingShortQuantity > EPSILON) {
        throw new Error(
          `SELL operation ${sellRecord.operation.id} for ${sellRecord.operation.ticker} still has unresolved short quantity ` +
          `${roundToTwoDecimals(sellRecord.pendingShortQuantity)}.`
        );
      }

      const { operation } = sellRecord;
      const ticker = operation.ticker;

      if (!this.reportData.breakdown[ticker]) {
        this.reportData.breakdown[ticker] = [];
      }

      if (!this.reportData.tickerTotalsUAH?.[ticker]) {
        this.reportData.tickerTotalsUAH = this.reportData.tickerTotalsUAH ?? {};
        this.reportData.tickerTotalsUAH[ticker] = {
          profit: 0,
          buyAmount: 0,
          sellAmount: 0,
        };
      }

      const sellAmount = roundToTwoDecimals(operation.amount - operation.commissionAmount);
      const [sellAmountUAH, sellUahRate] = await this.convertToUAH(sellAmount, operation.currency, operation.date);
      const [sellCommissionUAH, sellCommissionUahRate] = await this.convertToUAH(
        operation.commissionAmount,
        operation.commissionCurrency,
        operation.date
      );

      const relatedBuyOperations: IRelatedBuyOperation[] = [];
      let totalBuyAmount = 0;
      let totalBuyAmountUAH = 0;

      for (const related of sellRecord.relatedBuyOperationsRaw) {
        const relatedAmount = roundToTwoDecimals(related.amount);
        const relatedCommission = roundToTwoDecimals(related.commissionAmount);

        const [buyAmountUAH, buyUahRate] = await this.convertToUAH(relatedAmount, related.currency, related.date);
        const [buyCommissionUAH, buyCommissionUahRate] = await this.convertToUAH(
          relatedCommission,
          related.commissionCurrency,
          related.date
        );

        totalBuyAmount = roundToTwoDecimals(totalBuyAmount + relatedAmount + relatedCommission);
        totalBuyAmountUAH = roundToTwoDecimals(totalBuyAmountUAH + buyAmountUAH + buyCommissionUAH);

        relatedBuyOperations.push({
          date: related.date,
          currency: related.currency,
          amount: relatedAmount,
          amountUAH: buyAmountUAH,
          uahRate: buyUahRate,
          comissionUahRate: buyCommissionUahRate,
          commissionCurrency: related.commissionCurrency,
          commissionAmount: relatedCommission,
          commissionAmountUAH: buyCommissionUAH,
          quantity: roundToTwoDecimals(related.quantity),
        });
      }

      const profit = roundToTwoDecimals(sellAmount - totalBuyAmount);
      const profitUAH = roundToTwoDecimals(sellAmountUAH - totalBuyAmountUAH);

      const operationReport: IOperationTotal = {
        date: operation.date,
        currency: operation.currency,
        amount: sellAmount,
        amountUAH: sellAmountUAH,
        uahRate: sellUahRate,
        commissionCurrency: operation.commissionCurrency,
        commissionAmount: roundToTwoDecimals(operation.commissionAmount),
        commissionAmountUAH: sellCommissionUAH,
        comissionUahRate: sellCommissionUahRate,
        quantity: roundToTwoDecimals(operation.quantity),
        profit,
        profitUAH,
        relatedBuyOperations,
      };

      this.reportData.breakdown[ticker].push(operationReport);
      this.updateTotals(operationReport, ticker, totalBuyAmountUAH);
    }
  }

  /**
   * Updates global currency totals and per-ticker UAH totals from a finalized
   * sell row.
   */
  private updateTotals(operationReport: IOperationTotal, ticker: string, totalBuyAmountUAH: number): void {
    const currency = operationReport.currency;

    if (this.reportData.totals[currency] === undefined) {
      this.reportData.totals[currency] = 0;
    }

    this.reportData.totals[currency] = roundToTwoDecimals(this.reportData.totals[currency] + operationReport.profit);

    if (this.reportData.totals[Currency.UAH] === undefined) {
      this.reportData.totals[Currency.UAH] = 0;
    }

    this.reportData.totals[Currency.UAH] = roundToTwoDecimals(
      this.reportData.totals[Currency.UAH] + operationReport.profitUAH
    );

    const tickerTotals = this.reportData.tickerTotalsUAH?.[ticker];
    if (!tickerTotals) {
      return;
    }

    tickerTotals.profit = roundToTwoDecimals(tickerTotals.profit + operationReport.profitUAH);
    tickerTotals.buyAmount = roundToTwoDecimals(tickerTotals.buyAmount + totalBuyAmountUAH);
    tickerTotals.sellAmount = roundToTwoDecimals(tickerTotals.sellAmount + operationReport.amountUAH);
  }

  /**
   * Ensures all collected split and conversion groups were fully resolved.
   *
   * Throws an error with unresolved group details if any pending group remains.
   */
  private assertPendingGroupsResolved(
    pendingSplitGroups: Map<string, PendingSplitGroup>,
    pendingConversionGroups: Map<string, PendingConversionGroup>
  ): void {
    if (pendingSplitGroups.size > 0) {
      const unresolved = Array.from(pendingSplitGroups.values())
        .map((group) => `${group.ticker} ${group.date}`)
        .join(', ');

      throw new Error(`Unresolved split operations detected: ${unresolved}`);
    }

    if (pendingConversionGroups.size > 0) {
      const unresolved = Array.from(pendingConversionGroups.values())
        .map((group) => `${group.date} ${group.comment}`)
        .join(', ');

      throw new Error(`Unresolved conversion operations detected: ${unresolved}`);
    }
  }

  /**
   * Ensures there are no open short lots left after processing the full ledger.
   *
   * Open short lots imply incomplete data for sell-cover flow and would make
   * annual P/L ambiguous, so processing fails.
   */
  private assertNoOpenShortLots(inventory: Map<string, TickerInventory>): void {
    const unresolvedShorts: string[] = [];

    for (const [ticker, tickerInventory] of inventory.entries()) {
      const openShortQuantity = roundToTwoDecimals(
        tickerInventory.shortLots.reduce((acc, lot) => acc + lot.quantity, 0)
      );

      if (openShortQuantity > EPSILON) {
        unresolvedShorts.push(`${ticker}:${openShortQuantity}`);
      }
    }

    if (unresolvedShorts.length > 0) {
      throw new Error(`Unresolved short lots detected: ${unresolvedShorts.join(', ')}`);
    }
  }

  private getTickerInventory(inventory: Map<string, TickerInventory>, ticker: string): TickerInventory {
    const existing = inventory.get(ticker);
    if (existing) {
      return existing;
    }

    const created: TickerInventory = {
      longLots: [],
      shortLots: [],
    };

    inventory.set(ticker, created);
    return created;
  }

  private getSplitGroupKey(operation: IInventoryOperation): string {
    return `${operation.date}|${operation.ticker}|${this.normalizeComment(operation.comment)}`;
  }

  private getConversionGroupKey(operation: IInventoryOperation): string {
    return `${operation.date}|${this.normalizeComment(operation.comment)}`;
  }

  private normalizeComment(comment: string): string {
    return comment.replace(/\s+/g, ' ').trim();
  }

  /**
   * Converts an amount to UAH using the configured exchange-rate provider.
   *
   * @returns Tuple of `[amountInUAH, exchangeRate]`.
   */
  private async convertToUAH(amount: number, currency: Currency, date: string): Promise<[number, string]> {
    const exchangeRateUAH = await this.rateProvider.getRate(date, currency);
    return [roundToTwoDecimals(amount * parseFloat(exchangeRateUAH)), exchangeRateUAH];
  }
}
