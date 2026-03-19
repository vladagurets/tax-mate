import fs from 'fs';
import path from 'path';

import { JSON_INDENT, INPUT_REPORTS_DIR, OUTPUT_REPORTS_DIR } from '../constants';
import { loadDotEnvIfPresent } from '../loadDotEnv';
import { RateProvider } from '../rates';
import { IWorthlessSecurity } from '../types';
import { FreedomFinanceDividendsReport } from './dividents';
import { loadFreedomInputData } from './loadInputReports';
import { FreedomFinanceStocksReport } from './stocks';
import { getDefaultWorthlessSecurities } from './worthlessSecurities';

export interface IGenerateFreedomFinanceReportsOptions {
  inputDir?: string;
  outputDir?: string;
  year?: number;
  now?: Date;
  rateProvider?: RateProvider;
  worthlessSecurities?: IWorthlessSecurity[];
}

export interface IFreedomGenerationResult {
  year: number;
  inputFiles: string[];
  dividendsOutputPath: string;
  stocksOutputPath: string;
}

/**
 * End-to-end report generation pipeline for FreedomFinance data.
 *
 * Steps:
 * 1. Resolve runtime options and validate year.
 * 2. Load and normalize all input reports.
 * 3. Build dividends and stocks reports in parallel.
 * 4. Persist outputs to configured directory.
 */
export async function generateFreedomFinanceReports(
  options: IGenerateFreedomFinanceReportsOptions = {}
): Promise<IFreedomGenerationResult> {
  loadDotEnvIfPresent();

  const inputDir = options.inputDir ?? INPUT_REPORTS_DIR;
  const outputDir = options.outputDir ?? OUTPUT_REPORTS_DIR;
  const year = options.year ?? (options.now ?? new Date()).getFullYear();
  const worthlessSecurities = options.worthlessSecurities ?? getDefaultWorthlessSecurities();

  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    throw new Error(`Invalid year value: ${year}`);
  }

  const { sourceFiles, dividends, operations, inventoryOperations } = loadFreedomInputData(inputDir);

  const dividendsReportGenerator = new FreedomFinanceDividendsReport(options.rateProvider);
  const stocksReportGenerator = new FreedomFinanceStocksReport(options.rateProvider);

  const [dividendsReport, stocksReport] = await Promise.all([
    dividendsReportGenerator.generateReport(dividends, year),
    stocksReportGenerator.generateReport(
      {
        operations,
        inventoryOperations,
        worthlessSecurities,
      },
      year
    ),
  ]);

  fs.mkdirSync(outputDir, { recursive: true });

  const dividendsOutputPath = path.join(outputDir, `dividends_${year}.json`);
  const stocksOutputPath = path.join(outputDir, `stocks_${year}.json`);

  fs.writeFileSync(dividendsOutputPath, JSON.stringify(dividendsReport, null, JSON_INDENT));
  fs.writeFileSync(stocksOutputPath, JSON.stringify(stocksReport, null, JSON_INDENT));

  return {
    year,
    inputFiles: sourceFiles,
    dividendsOutputPath,
    stocksOutputPath,
  };
}

/**
 * Extracts `--year` from CLI args.
 *
 * Supported forms:
 * - `--year 2026`
 * - `--year=2026`
 *
 * Returns `undefined` when no year flag is provided.
 */
export function parseCliYearArg(argv: string[]): number | undefined {
  const yearFlag = '--year';
  const yearWithEquals = argv.find((arg) => arg.startsWith(`${yearFlag}=`));

  if (yearWithEquals) {
    const yearValue = yearWithEquals.slice(yearFlag.length + 1);
    return parseYearOrThrow(yearValue);
  }

  const yearIndex = argv.findIndex((arg) => arg === yearFlag);
  if (yearIndex === -1) {
    return undefined;
  }

  const yearValue = argv[yearIndex + 1];
  if (!yearValue) {
    throw new Error(`Missing value for ${yearFlag}`);
  }

  return parseYearOrThrow(yearValue);
}

/**
 * Parses and validates a year value from CLI input.
 */
function parseYearOrThrow(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Year must be an integer, got: ${value}`);
  }

  return parsed;
}

/**
 * CLI runner used when this module is executed directly.
 */
async function runCli(): Promise<void> {
  const year = parseCliYearArg(process.argv.slice(2));
  const result = await generateFreedomFinanceReports({ year });

  console.log('------------');
  console.log('FreedomFinance reports generated');
  console.log(`Year: ${result.year}`);
  console.log(`Input files: ${result.inputFiles.length}`);
  console.log(`Dividends output: ${result.dividendsOutputPath}`);
  console.log(`Stocks output: ${result.stocksOutputPath}`);
  console.log('------------');
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
