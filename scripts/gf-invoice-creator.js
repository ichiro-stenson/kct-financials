#!/usr/bin/env node
/**
 * gf-invoice-creator.js
 *
 * Reads weekly GF statement data from Supabase and creates a BigCapital
 * invoice per terminal per week with line items matching the exact GF
 * settlement breakdown.
 *
 * Usage:
 *   node scripts/gf-invoice-creator.js [--week YYYY-MM-DD] [--dry-run] [--csa CSANO] [--force]
 *
 *   --week YYYY-MM-DD   The Friday (week-end) date. Default: most recent completed Fri.
 *   --dry-run           Log payload without POSTing to BigCapital.
 *   --csa CSANO         Only process one CSA (for testing).
 *   --force             Re-create invoice even if one exists for this week.
 *
 * FedEx GF week: Saturday → Friday (Sat = first day, Fri = last day = --week date).
 * ACH hits Friday; invoice is dated the Tuesday of that week, due the same Friday.
 *
 * Auth: BIGCAPITAL_API_KEY from /Users/ichiro/.openclaw/workspace/.env.fedex
 */

'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');
// supabase-js lives in scripts/node_modules (run `npm install` in scripts/)
const path = require('path');
const { createClient } = require(path.join(__dirname, 'node_modules', '@supabase/supabase-js'));

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

const ENV_FILE = '/Users/ichiro/.openclaw/workspace/.env.fedex';
const SUPABASE_URL = 'https://iprxetnntchgsekdbyon.supabase.co';

/** Parse .env file */
function loadEnv(path) {
  const env = {};
  fs.readFileSync(path, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  return env;
}

// ──────────────────────────────────────────────────────────────────────────────
// CSA → Terminal metadata
// ──────────────────────────────────────────────────────────────────────────────

const CSA_MAP = {
  '300665': { terminal: 'Billings',         code: 'BIL', entity: 'KCT-1', customerId: 4 },
  '300948': { terminal: 'Bismarck',         code: 'BIS', entity: 'KCT-1', customerId: 4 },
  '304830': { terminal: 'Cody',             code: 'COD', entity: 'KCT-1', customerId: 4 },
  '307033': { terminal: 'Springfield',      code: 'SPR', entity: 'KCT-2', customerId: 1 }, // KCT Logistics LLC — confirmed 2026-09-12
  '308940': { terminal: 'Milwaukee',        code: 'MIL', entity: 'KCT-1', customerId: 4 },
  '309059': { terminal: 'Madison',          code: 'MAD', entity: 'KCT-1', customerId: 4 },
  '308765': { terminal: 'Unknown-308765',   code: 'UNK', entity: 'KCT-1', customerId: 4 },
};

// ──────────────────────────────────────────────────────────────────────────────
// Item ID map  (confirmed from DB: SELECT I.ID, I.NAME FROM ITEMS I)
// ──────────────────────────────────────────────────────────────────────────────

const ITEM_ID = {
  // Weekly totals
  'pu-packages':            1017,  // PU Packages           (4001)
  'pu-stops':               1018,  // PU Stops              (4002)
  'dl-packages':            1019,  // DL Packages           (4003)
  'dl-stops':               1020,  // DL Stops              (4004)
  'fuel-surcharge':         1021,  // Fuel Surcharge        (4005)
  'surge':                  1022,  // Surge                 (4006)
  'large-package-mix':      1023,  // Large Package Mix     (4007)
  'ecomm-packages':         1024,  // E-Comm Packages       (4008)
  'ecomm-stops':            1025,  // E-Comm Stops          (4009)
  // OTHERS types (exact GF type strings)
  'Service Charge':                 1004,  // (4101)
  'Brand Promotion - Vehicles':     1009,  // (4102)
  'Brand Promotion - Apparel':      1010,  // (4103)
  'ENC Safe Operating Incentive':   1005,  // (4104)
  'Release Payment':                1015,  // (4105)
  'Post Transition Ramp Up':        1026,  // (4106)
  'Service Premium':                1007,  // (4107)
  'Contingency':                    1013,  // (4108)
  'Additional Charge':              1027,  // (4109)
  'Delivery Packages - ISP':        1028,  // (4110)
  'Delivery Stops - ISP':           1029,  // (4111)
  'Ecommerce Package':              1030,  // (4112)
  'Ecommerce Stop':                 1031,  // (4113)
  'Fuel Surcharge - ISP':           1032,  // (4114)
  'Large Package Mix Charge':       1033,  // (4115)
  // Fallback
  '_other':                         1016,  // Other FedEx Settlement Income (4090)
};

/** OTHERS types to always skip (header/label rows) */
const OTHERS_SKIP_TYPES = new Set([
  'CONTRACTED SERVICE AREA:',
  'CONTRACTED SERVICE AREA',
  'FACILITY #:',
  'FACILITY #',
]);

// ──────────────────────────────────────────────────────────────────────────────
// Date helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Return a YYYY-MM-DD string from a Date */
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/** Add days to a date */
function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/**
 * Return the ISO week number for a date.
 * ISO week 1 = first week containing a Thursday.
 */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Most recent completed Friday (Fri = day 5) */
function lastFriday() {
  const today = new Date();
  const dow = today.getUTCDay(); // 0=Sun … 6=Sat
  // Days since last Friday
  const diff = dow >= 5 ? dow - 5 : dow + 2;
  return addDays(today, -diff);
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP helper (simple, no external dep)
// ──────────────────────────────────────────────────────────────────────────────

function httpRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Supabase queries
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and sum weekly_totals rows for a CSA + week range.
 * Returns a single aggregated object or null if no data.
 */
async function fetchWeeklyTotals(sb, csa, weekStart, weekEnd) {
  const { data, error } = await sb
    .from('gf_statement_weekly_totals')
    .select([
      'csa', 'date', 'created_at',
      'pupkg', 'pupkgamt',
      'pustops', 'pustopsamt',
      'dlpkg', 'dlpkgamt',
      'dlstops', 'dlstopsamt',
      'ecommdlpkg', 'ecommdlpkgamt',
      'ecommdlstops', 'ecommdlstopsamt',
      'largepkgamt',
      'fuelamt', 'surgeamt',
      'totalstops', 'totalamt',
    ].join(','))
    .eq('csa', csa)
    .gte('date', weekStart)
    .lte('date', weekEnd);

  if (error) throw new Error(`weekly_totals query failed: ${error.message}`);
  if (!data || data.length === 0) return null;

  // Sum all daily rows
  const sum = {
    csa,
    batchCreatedAt: data.reduce((max, r) => r.created_at > max ? r.created_at : max, ''),
    pupkg: 0, pupkgamt: 0,
    pustops: 0, pustopsamt: 0,
    dlpkg: 0, dlpkgamt: 0,
    dlstops: 0, dlstopsamt: 0,
    ecommdlpkg: 0, ecommdlpkgamt: 0,
    ecommdlstops: 0, ecommdlstopsamt: 0,
    largepkgamt: 0,
    fuelamt: 0, surgeamt: 0,
    totalstops: 0, totalamt: 0,
  };

  for (const r of data) {
    sum.pupkg       += r.pupkg       || 0;
    sum.pupkgamt    += r.pupkgamt    || 0;
    sum.pustops     += r.pustops     || 0;
    sum.pustopsamt  += r.pustopsamt  || 0;
    sum.dlpkg       += r.dlpkg       || 0;
    sum.dlpkgamt    += r.dlpkgamt    || 0;
    sum.dlstops     += r.dlstops     || 0;
    sum.dlstopsamt  += r.dlstopsamt  || 0;
    sum.ecommdlpkg  += r.ecommdlpkg  || 0;
    sum.ecommdlpkgamt += r.ecommdlpkgamt || 0;
    sum.ecommdlstops  += r.ecommdlstops  || 0;
    sum.ecommdlstopsamt += r.ecommdlstopsamt || 0;
    sum.largepkgamt += r.largepkgamt || 0;
    sum.fuelamt     += r.fuelamt     || 0;
    sum.surgeamt    += r.surgeamt    || 0;
    sum.totalstops  += r.totalstops  || 0;
    sum.totalamt    += r.totalamt    || 0;
  }

  return sum;
}

/**
 * Fetch OTHERS for a CSA that belong to this week's batch.
 * Strategy: filter by created_at within ±24h of the weekly_totals batch.
 * Deduplicate by type (keep the one with highest totalamount).
 */
async function fetchOthers(sb, csa, batchCreatedAt) {
  if (!batchCreatedAt) return [];

  // ±24h window around the batch insertion time
  const batchMs = new Date(batchCreatedAt).getTime();
  const from = new Date(batchMs - 24 * 3600 * 1000).toISOString();
  const to   = new Date(batchMs + 24 * 3600 * 1000).toISOString();

  const { data, error } = await sb
    .from('gf_statement_others')
    .select('type, totalamount, description, description_ext, startdate, created_at')
    .eq('csa', csa)
    .gte('created_at', from)
    .lte('created_at', to)
    .gt('totalamount', 0);

  if (error) throw new Error(`others query failed: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Deduplicate by type — keep max totalamount per type
  const byType = {};
  for (const r of data) {
    const key = r.type;
    if (!byType[key] || r.totalamount > byType[key].totalamount) {
      byType[key] = r;
    }
  }

  return Object.values(byType).filter((r) => !OTHERS_SKIP_TYPES.has(r.type));
}

// ──────────────────────────────────────────────────────────────────────────────
// Invoice builder
// ──────────────────────────────────────────────────────────────────────────────

/** Round to n decimal places */
function round(n, places = 4) {
  return Math.round(n * 10 ** places) / 10 ** places;
}

/**
 * Build invoice entries from weekly totals.
 * Returns array of {itemId, quantity, rate, description}.
 */
function buildWeeklyEntries(wt) {
  const entries = [];

  const add = (itemKey, qty, amt, desc) => {
    if (!qty || qty === 0 || !amt || amt === 0) return;
    const rate = round(amt / qty, 4);
    entries.push({ itemId: ITEM_ID[itemKey], quantity: qty, rate, description: desc });
  };

  add('pu-packages',   wt.pupkg,       wt.pupkgamt,        'PU Packages');
  add('pu-stops',      wt.pustops,     wt.pustopsamt,       'PU Stops');
  add('dl-packages',   wt.dlpkg,       wt.dlpkgamt,        'DL Packages');
  add('dl-stops',      wt.dlstops,     wt.dlstopsamt,       'DL Stops');
  add('ecomm-packages',wt.ecommdlpkg,  wt.ecommdlpkgamt,   'E-Comm DL Packages');
  add('ecomm-stops',   wt.ecommdlstops,wt.ecommdlstopsamt, 'E-Comm DL Stops');

  // Large Package Mix — no unit count; use qty=1, rate=total
  if (wt.largepkgamt && wt.largepkgamt !== 0) {
    entries.push({
      itemId: ITEM_ID['large-package-mix'],
      quantity: 1,
      rate: round(wt.largepkgamt, 4),
      description: 'Large Package Mix',
    });
  }

  // Fuel Surcharge — use totalstops as qty
  if (wt.fuelamt && wt.fuelamt !== 0 && wt.totalstops > 0) {
    entries.push({
      itemId: ITEM_ID['fuel-surcharge'],
      quantity: wt.totalstops,
      rate: round(wt.fuelamt / wt.totalstops, 6),
      description: 'Fuel Surcharge',
    });
  }

  // Surge — use totalstops as qty
  if (wt.surgeamt && wt.surgeamt !== 0 && wt.totalstops > 0) {
    entries.push({
      itemId: ITEM_ID['surge'],
      quantity: wt.totalstops,
      rate: round(wt.surgeamt / wt.totalstops, 6),
      description: 'Surge',
    });
  }

  return entries;
}

/**
 * Build invoice entries from OTHERS rows.
 */
function buildOthersEntries(others) {
  return others.map((r) => {
    const itemId = ITEM_ID[r.type] ?? ITEM_ID['_other'];
    const desc = r.description_ext
      ? `${r.type}: ${r.description_ext}`
      : r.type;
    return {
      itemId,
      quantity: 1,
      rate: round(r.totalamount, 4),
      description: desc,
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// BigCapital API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if an invoice already exists for this CSA+week.
 * Returns the invoice ID or null.
 */
async function findExistingInvoice(bcUrl, apiKey, invoiceNo) {
  const res = await httpRequest(
    `${bcUrl}/api/sale-invoices?page=1&pageSize=50`,
    'GET',
    { Authorization: `Bearer ${apiKey}` },
  );
  if (res.status !== 200) return null;
  const invoices = res.body?.data ?? [];
  const match = invoices.find((inv) => inv.invoice_no === invoiceNo);
  return match?.id ?? null;
}

/**
 * POST a new invoice to BigCapital.
 */
async function createInvoice(bcUrl, apiKey, payload) {
  return httpRequest(
    `${bcUrl}/api/sale-invoices`,
    'POST',
    { Authorization: `Bearer ${apiKey}` },
    payload,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  // ── Parse args ──────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const force   = args.includes('--force');
  const weekIdx = args.indexOf('--week');
  const csaIdx  = args.indexOf('--csa');

  const targetCsa = csaIdx >= 0 ? args[csaIdx + 1] : null;

  let weekEndDate;
  if (weekIdx >= 0 && args[weekIdx + 1]) {
    weekEndDate = new Date(args[weekIdx + 1] + 'T00:00:00Z');
  } else {
    weekEndDate = lastFriday();
  }

  const weekEndStr   = ymd(weekEndDate);
  const weekStartStr = ymd(addDays(weekEndDate, -6)); // Saturday
  const invoiceDate  = ymd(addDays(weekEndDate, -3)); // Tuesday (statement release day)
  const dueDate      = ymd(addDays(weekEndDate, 7));  // Friday +1 week (ACH settlement day)
  const weekYear     = weekEndDate.getUTCFullYear();
  const weekNum      = String(isoWeek(weekEndDate)).padStart(2, '0');

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`GF Invoice Creator`);
  console.log(`Week: ${weekStartStr} → ${weekEndDate.toISOString().slice(0, 10)}`);
  console.log(`Invoice date: ${invoiceDate}  Due: ${dueDate}`);
  console.log(`ISO week: ${weekYear}-W${weekNum}`);
  if (dryRun) console.log(`*** DRY RUN — no invoices will be created ***`);
  if (targetCsa) console.log(`Filtering to CSA: ${targetCsa}`);
  console.log(`${'─'.repeat(70)}\n`);

  // ── Load env & init clients ─────────────────────────────────────────────────
  const env = loadEnv(ENV_FILE);
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const apiKey      = env.BIGCAPITAL_API_KEY;
  const bcUrl       = (env.BIGCAPITAL_URL || 'http://localhost').replace(/\/$/, '');

  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY not found in env');
  if (!apiKey)      throw new Error('BIGCAPITAL_API_KEY not found in env');

  const sb = createClient(SUPABASE_URL, supabaseKey);

  // ── Process each CSA ────────────────────────────────────────────────────────
  const csaList = targetCsa
    ? [targetCsa]
    : Object.keys(CSA_MAP);

  const results = [];

  for (const csa of csaList) {
    const meta = CSA_MAP[csa];
    if (!meta) {
      console.warn(`⚠  CSA ${csa} not in CSA_MAP — skipping`);
      continue;
    }

    const invoiceNo  = `GF-${csa}-${weekYear}-${weekNum}`;
    const referenceNo = csa;

    console.log(`\n┌─ ${meta.terminal} (CSA ${csa})`);
    console.log(`│  Invoice: ${invoiceNo}  Customer: ${meta.customerId}  Entity: ${meta.entity}`);

    // Fetch weekly totals
    const wt = await fetchWeeklyTotals(sb, csa, weekStartStr, weekEndStr);
    if (!wt) {
      console.log(`│  ⚠  No weekly_totals data for ${weekStartStr}→${weekEndStr} — skipping`);
      results.push({ csa, invoiceNo, status: 'no-data' });
      continue;
    }

    console.log(`│  Weekly totals: ${wt.totalstops} stops  $${wt.totalamt.toFixed(2)} raw total`);

    // Fetch OTHERS
    const others = await fetchOthers(sb, csa, wt.batchCreatedAt);
    console.log(`│  Others: ${others.length} line items (non-zero, deduped)`);

    // Build entries
    const wtEntries     = buildWeeklyEntries(wt);
    const othersEntries = buildOthersEntries(others);
    const entries       = [...wtEntries, ...othersEntries];

    if (entries.length === 0) {
      console.log(`│  ⚠  No entries generated — skipping`);
      results.push({ csa, invoiceNo, status: 'no-entries' });
      continue;
    }

    // Compute invoice total
    const invoiceTotal = entries.reduce((sum, e) => sum + e.quantity * e.rate, 0);

    console.log(`│  Entries: ${entries.length}  Invoice total: $${invoiceTotal.toFixed(2)}`);

    // Build payload
    const payload = {
      customerId:  meta.customerId,
      invoiceDate,
      dueDate,
      invoiceNo,
      referenceNo,
      note: `GF settlement week ${weekStartStr}–${weekEndStr} (CSA ${csa})`,
      entries: entries.map((e, idx) => ({ ...e, index: idx + 1 })),
    };

    if (dryRun) {
      console.log(`│  ── DRY RUN payload ──`);
      console.log(JSON.stringify(payload, null, 2).split('\n').map(l => `│  ${l}`).join('\n'));
      results.push({ csa, invoiceNo, status: 'dry-run', total: invoiceTotal });
      continue;
    }

    // Check for existing invoice
    if (!force) {
      const existingId = await findExistingInvoice(bcUrl, apiKey, invoiceNo);
      if (existingId) {
        console.log(`│  ⚠  Invoice ${invoiceNo} already exists (ID ${existingId}) — use --force to recreate`);
        results.push({ csa, invoiceNo, status: 'exists', invoiceId: existingId });
        continue;
      }
    }

    // POST invoice
    const res = await createInvoice(bcUrl, apiKey, payload);

    if (res.status === 200 || res.status === 201) {
      const invoiceId = res.body?.id;
      console.log(`│  ✅ Created invoice ID ${invoiceId}`);
      results.push({ csa, invoiceNo, status: 'created', invoiceId, total: invoiceTotal });
    } else {
      console.error(`│  ❌ Error ${res.status}:`, JSON.stringify(res.body));
      results.push({ csa, invoiceNo, status: 'error', httpStatus: res.status, error: res.body });
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Summary: ${results.length} CSA(s) processed`);
  console.log(`${'─'.repeat(70)}`);
  for (const r of results) {
    const meta = CSA_MAP[r.csa] ?? { terminal: r.csa };
    const total = r.total != null ? `  $${r.total.toFixed(2)}` : '';
    const id    = r.invoiceId ? `  ID=${r.invoiceId}` : '';
    console.log(`  ${r.invoiceNo.padEnd(22)}  ${r.status.padEnd(10)}${id}${total}  ${meta.terminal}`);
  }
  console.log(`${'═'.repeat(70)}\n`);

  // Exit non-zero if any errors
  const hasError = results.some((r) => r.status === 'error');
  process.exit(hasError ? 1 : 0);
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
