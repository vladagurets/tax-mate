import fs from 'fs';
import path from 'path';

let wasLoaded = false;

/**
 * Loads `.env` from project root into `process.env` when present.
 *
 * Existing environment variables are not overwritten.
 */
export function loadDotEnvIfPresent(envFilePath: string = path.resolve(process.cwd(), '.env')): void {
  if (wasLoaded) {
    return;
  }

  wasLoaded = true;

  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const raw = fs.readFileSync(envFilePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const keyPart = trimmed.slice(0, separatorIndex).trim();
    const valuePart = trimmed.slice(separatorIndex + 1).trim();
    const key = keyPart.startsWith('export ') ? keyPart.slice('export '.length).trim() : keyPart;

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unwrapQuotes(valuePart);
  }
}

function unwrapQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
