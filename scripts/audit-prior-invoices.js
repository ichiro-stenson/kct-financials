#!/usr/bin/env node
/**
 * audit-prior-invoices.js
 * Audit invoices ID 1-212 (pre-automation) against GF statement CSVs.
 *
 * DB lives in Docker container bigcapital-mysql (no published host port),
 * so we query via docker exec. CSV files live in the data dir below.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────
const GF_DATA_DIR   = '/Users/ichiro/.openclaw/workspace/data';
const DOCKER_CMD    = 'docker exec bigcapital-mysql mysql -u root -proot bigcapital_tenant_8on8u91mti2udiv --batch --skip-column-names';
const BALANCE_TOL   = 0.02;   // cents tolerance for floating-point comparison

// ── 1. Fetch all 212 invoices from DB ──────────────────────────────────────
console.log('Fetching invoices from DB...');

const sql = `
SELECT
  SI.ID,
  SI.INVOICE_NO,
  DATE_FORMAT(SI.INVOICE_DATE,'%Y-%m-%d') AS INVOICE_DATE,
  SI.REFERENCE_NO,
  CAST(SI.BALANCE AS DECIMAL(12,2)) AS BALANCE,
  C.DISPLAY_NAME
FROM SALES_INVOICES SI
JOIN CONTACTS C ON C.ID = SI.CUSTOMER_ID
WHERE SI.ID <= 212
ORDER BY SI.INVOICE_DATE, SI.ID;
`.replace(/\n/g, ' ');

let rawRows;
try {
  rawRows = execSync(`${DOCKER_CMD} -e "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    timeout: 15000,
  });
} catch (e) {
  console.error('DB query failed:', e.message);
  process.exit(1);
}

const invoices = rawRows.trim().split('\n').map(line => {
  const [id, invoiceNo, invoiceDate, referenceNo, balance, customerName] = line.split('\t');
  return {
    id:           parseInt(id, 10),
    invoiceNo:    invoiceNo.trim(),
    invoiceDate:  invoiceDate.trim(),  // YYYY-MM-DD
    referenceNo:  referenceNo.trim(),
    balance:      parseFloat(balance),
    customerName: customerName.trim(),
  };
});

console.log(`Loaded ${invoices.length} invoices.\n`);

// ── 2. Index available GF CSV files ────────────────────────────────────────
// Filename: GF_STMT_{vendor}_{csa}_{MM-DD-YYYY}.csv
// Build a map: { `${csa}|${YYYY-MM-DD}` => [filepath, ...] }

console.log('Indexing GF CSV files...');

const allCsvFiles = fs.readdirSync(GF_DATA_DIR)
  .filter(f => f.startsWith('GF_STMT_') && f.endsWith('.csv'));

console.log(`Found ${allCsvFiles.length} GF CSV files in ${GF_DATA_DIR}`);

// Parse filename: GF_STMT_V0020980_300665_05-29-2026.csv
const csvIndex = new Map(); // key: "CSA|YYYY-MM-DD" → [fullpath]

for (const fname of allCsvFiles) {
  // GF_STMT_{vendor}_{csa}_{MM}-{DD}-{YYYY}.csv
  const m = fname.match(/^GF_STMT_[^_]+_([^_]+)_(\d{2})-(\d{2})-(\d{4})\.csv$/);
  if (!m) continue;
  const [, csa, mm, dd, yyyy] = m;
  const isoDate = `${yyyy}-${mm}-${dd}`;        // YYYY-MM-DD
  const key = `${csa}|${isoDate}`;
  if (!csvIndex.has(key)) csvIndex.set(key, []);
  csvIndex.get(key).push(path.join(GF_DATA_DIR, fname));
}

console.log(`Indexed ${csvIndex.size} unique (CSA, week-end date) combinations.\n`);

// ── 3. Parse a GF CSV → extract grand total ────────────────────────────────
// "TOTAL CHARGES:" line: last non-empty column holds the dollar amount.
function parseCsvTotal(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  for (const line of content.split('\n')) {
    // Lines look like: "TOTAL CHARGES:","","",... ,"43444.65"
    if (!line.includes('TOTAL CHARGES:')) continue;
    // Split on commas respecting quoted fields
    const cols = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    // Find last non-empty column
    for (let i = cols.length - 1; i >= 0; i--) {
      const v = cols[i].trim().replace(/,/g, '');
      if (v !== '') return parseFloat(v);
    }
  }
  return null; // not found
}

// ── 4. Match logic ─────────────────────────────────────────────────────────
// REFERENCE_NO format: {CSA}-{YYYY-MM-DD}
// The embedded date may be:
//   (a) the Friday week-end date itself  → try as-is
//   (b) the Monday after the Friday     → subtract 3 days to get Friday
//   (c) the Tuesday after the Friday    → subtract 4 days to get Friday
// We also try the INVOICE_DATE directly (offsets 0, ±1, ±2, ±3, ±4 days).

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function findCsvMatch(csa, refDate, invoiceDate) {
  // Candidate dates to try (from refDate and invoiceDate)
  const candidates = new Set();
  for (const base of [refDate, invoiceDate]) {
    if (!base) continue;
    for (const offset of [0, -1, -2, -3, -4, 1, 2, 3, 4]) {
      candidates.add(addDays(base, offset));
    }
  }
  for (const d of candidates) {
    const key = `${csa}|${d}`;
    if (csvIndex.has(key)) return { paths: csvIndex.get(key), matchDate: d };
  }
  return null;
}

// Parse CSA from REFERENCE_NO: everything before the first "-YYYY-" pattern
function parseRef(referenceNo) {
  // Format: {CSA}-{YYYY}-{MM}-{DD}  e.g.  300665-2025-01-03
  const m = referenceNo.match(/^(.+?)-(\d{4}-\d{2}-\d{2})$/);
  if (m) return { csa: m[1], refDate: m[2] };
  return { csa: referenceNo, refDate: null };
}

// ── 5. Run audit ────────────────────────────────────────────────────────────
const results = {
  matches:    [],
  mismatches: [],
  noCsv:      [],
};

for (const inv of invoices) {
  const { csa, refDate } = parseRef(inv.referenceNo);
  const found = findCsvMatch(csa, refDate, inv.invoiceDate);

  if (!found) {
    results.noCsv.push({ ...inv, csa, refDate });
    continue;
  }

  // Use first matching file (there should be exactly one per CSA/week)
  const csvPath   = found.paths[0];
  const gfTotal   = parseCsvTotal(csvPath);
  const delta     = gfTotal !== null ? Math.abs(inv.balance - gfTotal) : null;
  const isMatch   = delta !== null && delta <= BALANCE_TOL;

  const entry = {
    ...inv,
    csa,
    refDate,
    csvPath:   path.basename(csvPath),
    matchDate: found.matchDate,
    gfTotal,
    delta:     delta !== null ? inv.balance - gfTotal : null,
  };

  if (isMatch)  results.matches.push(entry);
  else          results.mismatches.push(entry);
}

// ── 6. Report ───────────────────────────────────────────────────────────────
const TOTAL = invoices.length;
const fmt   = n => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

console.log('═'.repeat(72));
console.log('  AUDIT REPORT — Pre-Automation Invoices (ID 1–212) vs GF Statements');
console.log('═'.repeat(72));
console.log();

// ── Date range covered
const dates     = invoices.map(i => i.invoiceDate).sort();
const csas      = [...new Set(invoices.map(i => parseRef(i.referenceNo).csa))].sort();
const refDates  = [...new Set(invoices.map(i => parseRef(i.referenceNo).refDate))].filter(Boolean).sort();
console.log(`Invoice date range : ${dates[0]}  →  ${dates[dates.length - 1]}`);
console.log(`CSAs in old invoices: ${csas.join(', ')}`);
console.log(`Ref dates  (sample) : ${refDates.slice(0, 3).join(', ')} ... ${refDates[refDates.length - 1]}`);
console.log();

// ── Summary
console.log('─'.repeat(72));
console.log('  SUMMARY');
console.log('─'.repeat(72));
console.log(`  Total invoices  : ${TOTAL}`);
console.log(`  ✅ Matches      : ${results.matches.length}`);
console.log(`  ❌ Mismatches   : ${results.mismatches.length}`);
console.log(`  ⚠️  No CSV found : ${results.noCsv.length}`);
console.log();

// ── Mismatches detail
if (results.mismatches.length > 0) {
  console.log('─'.repeat(72));
  console.log('  ❌ MISMATCHES');
  console.log('─'.repeat(72));
  console.log(
    `  ${'ID'.padEnd(5)} ${'Invoice No'.padEnd(22)} ${'Date'.padEnd(12)} ${'CSA'.padEnd(8)} ` +
    `${'Invoice $'.padStart(12)} ${'GF Total $'.padStart(12)} ${'Delta $'.padStart(12)}`
  );
  console.log('  ' + '-'.repeat(88));
  for (const r of results.mismatches) {
    const gf  = r.gfTotal !== null ? fmt(r.gfTotal) : 'parse-err';
    const del = r.delta   !== null ? fmt(r.delta)   : '?';
    console.log(
      `  ${String(r.id).padEnd(5)} ${r.invoiceNo.padEnd(22)} ${r.invoiceDate.padEnd(12)} ${r.csa.padEnd(8)} ` +
      `${fmt(r.balance).padStart(12)} ${gf.padStart(12)} ${del.padStart(12)}`
    );
    console.log(`      CSV: ${r.csvPath}`);
  }
  console.log();
}

// ── No CSV detail
if (results.noCsv.length > 0) {
  console.log('─'.repeat(72));
  console.log('  ⚠️  NO MATCHING GF CSV FOUND');
  console.log('─'.repeat(72));

  // Group by CSA for compactness
  const byCsa = {};
  for (const r of results.noCsv) {
    if (!byCsa[r.csa]) byCsa[r.csa] = [];
    byCsa[r.csa].push(r);
  }

  for (const [csa, rows] of Object.entries(byCsa)) {
    const datesSpan = [rows[0].refDate, rows[rows.length - 1].refDate].join(' → ');
    const totalAmt  = rows.reduce((s, r) => s + r.balance, 0);
    console.log(`  CSA ${csa} : ${rows.length} invoices  |  dates ${datesSpan}  |  total billed $${fmt(totalAmt)}`);
  }
  console.log();
  console.log('  NOTE: GF CSV files only exist from 2026-05-29 onward.');
  console.log('        Old invoices cover 2025, predating the CSV archive.');
}

// ── Matches detail (brief)
if (results.matches.length > 0) {
  console.log('─'.repeat(72));
  console.log('  ✅ MATCHES (invoice balance = GF TOTAL CHARGES ± $0.02)');
  console.log('─'.repeat(72));
  for (const r of results.matches) {
    console.log(`  ID ${r.id}  ${r.invoiceNo}  ${r.invoiceDate}  CSA ${r.csa}  $${fmt(r.balance)}  ✅`);
  }
  console.log();
}

// ── Analysis
console.log('─'.repeat(72));
console.log('  ANALYSIS');
console.log('─'.repeat(72));

if (results.noCsv.length === TOTAL) {
  console.log('  All 212 invoices predate the CSV archive (2025 vs CSVs from 2026-05-29).');
  console.log('  No balance verification is possible against GF statement files.');
  console.log();
  console.log('  To audit these invoices, the 2025 GF statement PDFs/CSVs would need');
  console.log('  to be exported from FedEx Ground and placed in the data directory.');

} else if (results.mismatches.length > 0) {
  // Check if deltas are systematic (same delta per CSA)
  const deltasByCsa = {};
  for (const r of results.mismatches) {
    if (!deltasByCsa[r.csa]) deltasByCsa[r.csa] = [];
    if (r.delta !== null) deltasByCsa[r.csa].push(r.delta.toFixed(2));
  }
  const systematic = Object.entries(deltasByCsa).filter(([, deltas]) => {
    const uniq = new Set(deltas);
    return uniq.size === 1;
  });
  if (systematic.length > 0) {
    console.log('  Deltas appear SYSTEMATIC — same delta per CSA suggests a rate or');
    console.log('  line-item mapping difference, not a data entry error.');
    for (const [csa, deltas] of systematic) {
      console.log(`    CSA ${csa}: constant delta $${deltas[0]}`);
    }
  } else {
    console.log('  Deltas appear RANDOM — likely individual entry errors, not systematic.');
  }
}

console.log();
console.log('═'.repeat(72));
console.log('  END REPORT');
console.log('═'.repeat(72));
