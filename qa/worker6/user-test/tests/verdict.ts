import { test } from '@playwright/test';
import * as fs from 'fs';
// Each check = yes/no. Any "no" means the ticket gets "send back for rewrite".
export function verdict(feature: string, check: string, pass: boolean, detail = '') {
  fs.mkdirSync('results', { recursive: true });
  fs.appendFileSync('results/verdicts.jsonl', JSON.stringify({ feature, check, pass, detail, ts: new Date().toISOString() }) + '\n');
  test.info().annotations.push({ type: pass ? 'YES' : 'NO', description: `${feature}: ${check} ${detail}` });
  if (!pass) test.info().annotations.push({ type: 'TICKET', description: 'send back for rewrite' });
}
