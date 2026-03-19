import { Currency } from "../utils/getUahRate";

export enum Broker {
  FreedomFinance = 'FreedomFinance',
  InteractiveBrokers = 'InteractiveBrokers',
}

export interface IBaseReport<TInput, TOutput> {
  generateReport(input: TInput, year: number): Promise<TOutput>;
}

// Dividends
export interface IDividend {
  date: string;
  amount: number;
  ticker: string;
  currency: Currency;
}

export interface IDividendEntry {
  amount: number;
  currency: string;
  uahRate: string;
  amountUAH: number;
  date: string;
}

interface ITickerDividends {
  ticker: string;
  entries: IDividendEntry[];
  total: number;
  amountUAH: number;
  dividendsCount: number;
}

export interface IDividendsReportData {
  breakdown: ITickerDividends[];
  totals: Record<string, number>;
}

// Stocks
export enum OperationType {
  BUY = 'buy',
  SELL = 'sell',
}

export interface IOperation {
  id: string;
  ticker: string;
  date: string;
  timestamp: string;
  type: OperationType;
  currency: Currency;
  amount: number;
  commissionCurrency: Currency;
  commissionAmount: number;
  quantity: number;
  price: number;
}

export type InventoryOperationType = 'split' | 'conversion' | 'out';

export interface IInventoryOperation {
  id: string;
  ticker: string;
  date: string;
  timestamp: string;
  type: InventoryOperationType;
  quantity: number;
  comment: string;
}

export interface IWorthlessSecurity {
  ticker: string;
  date: string;
  timestamp: string;
}

export interface IStocksReportInput {
  operations: IOperation[];
  inventoryOperations: IInventoryOperation[];
  worthlessSecurities?: IWorthlessSecurity[];
}

export interface IRelatedBuyOperation {
  date: string;
  currency: Currency;
  amount: number;
  amountUAH: number;
  commissionCurrency: Currency;
  commissionAmount: number;
  commissionAmountUAH: number;
  quantity: number;
  comissionUahRate: string;
  uahRate: string;
}

export interface IOperationTotal {
  date: string;
  currency: Currency;
  amount: number;
  amountUAH: number;
  commissionCurrency: Currency;
  commissionAmount: number;
  commissionAmountUAH: number;
  comissionUahRate: string;
  uahRate: string;
  quantity: number;
  profit: number;
  profitUAH: number;
  relatedBuyOperations: IRelatedBuyOperation[];
}

export interface ITickerTotalDetails {
  profit: number;
  buyAmount: number;
  sellAmount: number;
}

export interface IOperationsReportData {
  breakdown: Record<string, IOperationTotal[]>;
  totals: Record<string, number>;
  tickerTotalsUAH?: Record<string, ITickerTotalDetails>;
}
