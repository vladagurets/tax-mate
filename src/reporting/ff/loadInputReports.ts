import fs from 'fs';
import path from 'path';

import { Currency } from '../../utils/getUahRate';
import { IInventoryOperation, IDividend, IOperation, OperationType } from '../types';
import { IFFReport } from './types';

export interface IFreedomInputData {
  sourceFiles: string[];
  dividends: IDividend[];
  operations: IOperation[];
  inventoryOperations: IInventoryOperation[];
}

export function loadFreedomInputData(inputDir: string): IFreedomInputData {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const sourceFiles = fs
    .readdirSync(inputDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => path.join(inputDir, fileName));

  if (sourceFiles.length === 0) {
    throw new Error(`No input JSON files were found in ${inputDir}`);
  }

  const dividends: IDividend[] = [];
  const operations: IOperation[] = [];
  const inventoryOperations: IInventoryOperation[] = [];

  for (const filePath of sourceFiles) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const report = JSON.parse(raw) as IFFReport;

    for (const corporateAction of report.corporate_actions?.detailed ?? []) {
      if (corporateAction.type_id !== 'dividend' && corporateAction.type_id !== 'dividend_reverted') {
        continue;
      }

      const date = requiredString(corporateAction.date, filePath, 'corporate_actions.detailed[].date');
      const ticker = requiredString(corporateAction.ticker, filePath, 'corporate_actions.detailed[].ticker');
      const amount = requiredNumber(corporateAction.amount, filePath, 'corporate_actions.detailed[].amount');
      const currency = parseCurrency(
        requiredString(corporateAction.currency, filePath, 'corporate_actions.detailed[].currency'),
        filePath,
        'corporate_actions.detailed[].currency'
      );

      dividends.push({
        date,
        ticker,
        amount,
        currency,
      });
    }

    for (const trade of report.trades?.detailed ?? []) {
      const operation = requiredString(trade.operation, filePath, 'trades.detailed[].operation').toLowerCase();
      if (operation !== OperationType.BUY && operation !== OperationType.SELL) {
        continue;
      }

      if (trade.instr_type === 6) {
        continue;
      }

      const id = requiredString(trade.id, filePath, 'trades.detailed[].id');
      const ticker = requiredString(trade.instr_nm, filePath, 'trades.detailed[].instr_nm');
      const date = requiredString(trade.short_date, filePath, 'trades.detailed[].short_date');
      const timestamp = requiredString(trade.date, filePath, 'trades.detailed[].date');

      operations.push({
        id,
        ticker,
        date,
        timestamp,
        type: operation,
        currency: parseCurrency(
          requiredString(trade.curr_c, filePath, 'trades.detailed[].curr_c'),
          filePath,
          'trades.detailed[].curr_c'
        ),
        amount: requiredNumber(trade.summ, filePath, 'trades.detailed[].summ'),
        commissionCurrency: parseCurrency(
          requiredString(trade.commission_currency, filePath, 'trades.detailed[].commission_currency'),
          filePath,
          'trades.detailed[].commission_currency'
        ),
        commissionAmount: requiredNumber(trade.commission, filePath, 'trades.detailed[].commission'),
        quantity: requiredNumber(trade.q, filePath, 'trades.detailed[].q'),
        price: requiredNumber(trade.p, filePath, 'trades.detailed[].p'),
      });
    }

    for (const securityOperation of report.securities_in_outs ?? []) {
      if (securityOperation.type !== 'split' && securityOperation.type !== 'conversion' && securityOperation.type !== 'out') {
        continue;
      }

      const id = String(requiredNumber(securityOperation.id, filePath, 'securities_in_outs[].id'));
      const timestamp = requiredString(securityOperation.datetime, filePath, 'securities_in_outs[].datetime');
      const date = timestamp.slice(0, 10);
      const ticker = requiredString(securityOperation.ticker, filePath, 'securities_in_outs[].ticker');

      if (!securityOperation.comment && (securityOperation.type === 'split' || securityOperation.type === 'conversion')) {
        throw new Error(
          `Missing required comment for ${securityOperation.type} in ${filePath} (securities_in_outs[].comment)`
        );
      }

      inventoryOperations.push({
        id,
        timestamp,
        date,
        ticker,
        type: securityOperation.type,
        quantity: requiredNumber(securityOperation.quantity, filePath, 'securities_in_outs[].quantity'),
        comment: typeof securityOperation.comment === 'string' ? securityOperation.comment : '',
      });
    }
  }

  return {
    sourceFiles,
    dividends,
    operations,
    inventoryOperations,
  };
}

function requiredString(value: unknown, filePath: string, fieldPath: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid or missing ${fieldPath} in ${filePath}`);
  }

  return value;
}

function requiredNumber(value: unknown, filePath: string, fieldPath: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Invalid or missing ${fieldPath} in ${filePath}`);
}

function parseCurrency(value: string, filePath: string, fieldPath: string): Currency {
  if (value === Currency.USD || value === Currency.EUR || value === Currency.UAH) {
    return value;
  }

  throw new Error(`Unsupported currency '${value}' in ${filePath} (${fieldPath})`);
}
