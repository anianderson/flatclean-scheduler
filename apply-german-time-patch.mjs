#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log(`updated ${path.relative(ROOT, file)}`);
}

function findFile(name) {
  return files.find(file => path.basename(file) === name);
}

function replaceFunction(source, signatureRegex, replacement) {
  const match = signatureRegex.exec(source);
  if (!match) return source;

  const start = match.index;
  let index = source.indexOf('{', start);
  if (index === -1) return source;

  let depth = 0;
  for (; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(0, start) + replacement + source.slice(index + 1);
      }
    }
  }

  return source;
}

function removeFunction(source, signatureRegex) {
  const match = signatureRegex.exec(source);
  if (!match) return source;

  const start = match.index;
  let index = source.indexOf('{', start);
  if (index === -1) return source;

  let depth = 0;
  for (; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === '\n' || source[end] === '\r') end += 1;
        return source.slice(0, start) + source.slice(end);
      }
    }
  }

  return source;
}

function ensureSharedTimezoneHelpers(source) {
  if (!source.includes("export const APP_TIME_ZONE = 'Europe/Berlin';")) {
    source = source.replace(
      /(const MILESTONE_LEVELS = \[[^\]]+\];\n)/,
      `$1\nexport const APP_TIME_ZONE = 'Europe/Berlin';\n`
    );
  }

  const helperBlock = `function parseIsoDateParts(date) {\n  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(date || ''));\n  if (!match) return null;\n\n  return {\n    year: Number(match[1]),\n    month: Number(match[2]),\n    day: Number(match[3])\n  };\n}\n\nexport function todayIso() {\n  return new Intl.DateTimeFormat('en-CA', {\n    timeZone: APP_TIME_ZONE,\n    year: 'numeric',\n    month: '2-digit',\n    day: '2-digit'\n  }).format(new Date());\n}\n\n`;

  if (!source.includes('export function todayIso()')) {
    source = source.replace(/export function addDays\(/, helperBlock + 'export function addDays(');
  }

  source = replaceFunction(
    source,
    /export function addDays\s*\([^)]*\)\s*{/,
    `export function addDays(date, days) {\n  const parts = parseIsoDateParts(date);\n  if (!parts) return null;\n\n  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));\n  return d.toISOString().slice(0, 10);\n}`
  );

  source = replaceFunction(
    source,
    /export function diffDays\s*\([^)]*\)\s*{/,
    `export function diffDays(from, to) {\n  const aParts = parseIsoDateParts(from);\n  const bParts = parseIsoDateParts(to);\n  if (!aParts || !bParts) return null;\n\n  const a = Date.UTC(aParts.year, aParts.month - 1, aParts.day);\n  const b = Date.UTC(bParts.year, bParts.month - 1, bParts.day);\n  const diff = Math.round((b - a) / 86400000);\n\n  return Number.isNaN(diff) ? null : diff;\n}`
  );

  return source;
}

function patchShared() {
  const file = findFile('_shared.js');
  if (!file) return console.warn('skipped _shared.js: file not found');
  write(file, ensureSharedTimezoneHelpers(read(file)));
}

function patchAvailability() {
  const file = findFile('availability.js');
  if (!file) return console.warn('skipped availability.js: file not found');
  let source = read(file);

  source = source.replace(
    /import \{([^}]+)\} from '\.\/_shared\.js';/s,
    (full, imports) => {
      const items = imports.split(',').map(item => item.trim()).filter(Boolean);
      if (!items.includes('todayIso')) items.push('todayIso');
      return `import { ${items.join(', ')} } from './_shared.js';`;
    }
  );

  source = removeFunction(source, /function todayIso\s*\([^)]*\)\s*{/);
  write(file, source);
}

function patchLog() {
  const file = findFile('log.js');
  if (!file) return console.warn('skipped log.js: file not found');
  let source = read(file);

  source = source.replace(
    /import \{([^}]+)\} from '\.\/_shared\.js';/s,
    (full, imports) => {
      const items = imports.split(',').map(item => item.trim()).filter(Boolean);
      for (const item of ['addDays', 'todayIso']) {
        if (!items.includes(item)) items.push(item);
      }
      return `import {\n  ${items.join(',\n  ')}\n} from './_shared.js';`;
    }
  );

  source = removeFunction(source, /function todayIso\s*\([^)]*\)\s*{/);
  source = removeFunction(source, /function addDays\s*\([^)]*\)\s*{/);
  write(file, source);
}

function patchMain() {
  const file = findFile('main.jsx');
  if (!file) return console.warn('skipped main.jsx: file not found');
  let source = read(file);

  source = source.replace(
    /const TODAY = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);\n/,
    `const APP_TIME_ZONE = 'Europe/Berlin';\n\nfunction todayIso() {\n  return new Intl.DateTimeFormat('en-CA', {\n    timeZone: APP_TIME_ZONE,\n    year: 'numeric',\n    month: '2-digit',\n    day: '2-digit'\n  }).format(new Date());\n}\n\nfunction parseIsoDateParts(date) {\n  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(date || ''));\n  if (!match) return null;\n\n  return {\n    year: Number(match[1]),\n    month: Number(match[2]),\n    day: Number(match[3])\n  };\n}\n\nconst TODAY = todayIso();\n`
  );

  source = replaceFunction(
    source,
    /function addDays\s*\([^)]*\)\s*{/,
    `function addDays(date, days) {\n  const parts = parseIsoDateParts(date);\n  if (!parts) return null;\n\n  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));\n  return d.toISOString().slice(0, 10);\n}`
  );

  source = replaceFunction(
    source,
    /function diffDays\s*\([^)]*\)\s*{/,
    `function diffDays(from, to) {\n  const aParts = parseIsoDateParts(from);\n  const bParts = parseIsoDateParts(to);\n  if (!aParts || !bParts) return null;\n\n  const a = Date.UTC(aParts.year, aParts.month - 1, aParts.day);\n  const b = Date.UTC(bParts.year, bParts.month - 1, bParts.day);\n  const diff = Math.round((b - a) / 86400000);\n\n  return Number.isNaN(diff) ? null : diff;\n}`
  );

  source = replaceFunction(
    source,
    /function fmt\s*\([^)]*\)\s*{/,
    `function fmt(date, fallback = 'Not scheduled yet', lang = 'de') {\n  if (!date) return fallback;\n\n  const parts = parseIsoDateParts(date);\n  if (!parts) return fallback;\n\n  const locale = lang === 'de' ? 'de-DE' : 'en-GB';\n  const displayDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));\n\n  return new Intl.DateTimeFormat(locale, {\n    timeZone: APP_TIME_ZONE,\n    day: '2-digit',\n    month: 'short',\n    year: 'numeric'\n  }).format(displayDate);\n}`
  );

  write(file, source);
}

walk(ROOT);
patchShared();
patchAvailability();
patchLog();
patchMain();

console.log('\nDone. Restart your dev server/build after applying the patch.');
