#!/usr/bin/env node
/**
 * gf-auto-payment.js
 * Records a Payment Received for every open GF invoice due on the target date.
 * Runs automatically every Friday at 2:30pm CT via OpenClaw automation.
 *
 * Usage:
 *   node scripts/gf-auto-payment.js [--date YYYY-MM-DD] [--dry-run]
 *
 * Env (loaded from /Users/ichiro/.openclaw/workspace/.env.fedex):
 *   BIGCAPITAL_API_KEY           required
 *   BIGCAPITAL_BASE_URL          default: http://localhost
 *   BIGCAPITAL_DEPOSIT_ACCOUNT_ID default: 1000 (Operating Checking / "Bank Account")
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const http  = require('http');
const https = require('https');

// ── Load .env.fedex ────────────────────────────────────────────────────────────
const ENV_PATH = '/Users/ichiro/.openclaw/workspace/.env.fedex';
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
}

// ── Config ─────────────────────────────────────────────────────────────────────
const API_KEY           = process.env.BIGCAPITAL_API_KEY;
const BASE_URL          = (process.env.BIGCAPITAL_BASE_URL || 'http://localhost').replace(/\/$/, '');
const DEPOSIT_ACCOUNT_ID = parseInt(process.env.BIGCAPITAL_DEPOSIT_ACCOUNT_ID || '1000', 10);
const PAGE_SIZE         = 50;

if (!API_KEY) {
  console.error('ERROR: BIGCAPITAL_API_KEY not set in .env.fedex');
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const dateIdx = args.indexOf('--date');
const dateArg = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;

// Default to today in local time (Chicago / wherever this runs)
const targetDate = dateArg || (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
})();

if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error(`ERROR: invalid date "${targetDate}" — use YYYY-MM-DD`);
  process.exit(1);
}

// ── HTTP helper ────────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${BASE_URL}${urlPath}`;
    const parsed  = new URL(fullUrl);
    const lib     = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    let payload = null;
    if (body !== null) {
      payload = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };

    const req = lib.request(opts, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Fetch all open GF invoices due on targetDate ───────────────────────────────
async function fetchOpenGFInvoices(dueDate) {
  const results = [];
  let page = 1;

  while (true) {
    const { status, body } = await apiRequest('GET', `/api/sale-invoices?page=${page}&page_size=${PAGE_SIZE}`);
    if (status !== 200) {
      throw new Error(`Invoice API returned HTTP ${status}: ${JSON.stringify(body)}`);
    }

    const invoices   = body.data || [];
    const pagination = body.pagination || {};
    const total      = pagination.total || 0;

    for (const inv of invoices) {
      const invNo    = inv.invoice_no || '';
      const due      = (inv.due_date || '').slice(0, 10);
      const paid     = inv.is_fully_paid;
      const balance  = parseFloat(inv.balance ?? inv.due_amount ?? 0);

      if (invNo.startsWith('GF-') && due === dueDate && !paid && balance > 0.005) {
        results.push(inv);
      }
    }

    const fetched = (page - 1) * PAGE_SIZE + invoices.length;
    if (fetched >= total || invoices.length === 0) break;
    page++;
  }

  return results;
}

// ── Record a Payment Received for one invoice ──────────────────────────────────
async function recordPayment(inv) {
  const balance    = parseFloat(inv.balance ?? inv.due_amount ?? 0);
  const customerId = inv.customer_id;

  const payload = {
    customerId,
    paymentDate:      targetDate,
    amount:           balance,
    depositAccountId: DEPOSIT_ACCOUNT_ID,
    referenceNo:      `ACH-AUTO-${targetDate}`,
    statement:        `FedEx ACH auto-payment for ${inv.invoice_no}`,
    entries: [
      { invoiceId: inv.id, paymentAmount: balance },
    ],
  };

  return apiRequest('POST', '/api/payments-received', payload);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const tag = dryRun ? '[DRY RUN] ' : '';

  console.log(`${tag}GF Auto-Payment Recorder`);
  console.log(`${tag}Target date:        ${targetDate}`);
  console.log(`${tag}Deposit account ID: ${DEPOSIT_ACCOUNT_ID}`);
  console.log(`${tag}Base URL:           ${BASE_URL}`);
  if (dryRun) console.log(`${tag}*** DRY RUN — no payments will be posted ***`);
  console.log('');

  let invoices;
  try {
    invoices = await fetchOpenGFInvoices(targetDate);
  } catch (err) {
    console.error(`ERROR fetching invoices: ${err.message}`);
    process.exit(1);
  }

  if (invoices.length === 0) {
    console.log(`No open GF invoices due on ${targetDate}. Nothing to record.`);
    return;
  }

  console.log(`Found ${invoices.length} open GF invoice(s) due ${targetDate}:\n`);

  let totalAmount  = 0;
  let successCount = 0;
  let failCount    = 0;

  for (const inv of invoices) {
    const balance  = parseFloat(inv.balance ?? inv.due_amount ?? 0);
    const invNo    = inv.invoice_no;
    const customer = inv.customer?.display_name || `customer_id=${inv.customer_id}`;
    totalAmount   += balance;

    if (dryRun) {
      console.log(`  [WOULD RECORD] ${invNo}  |  ${customer}  |  $${balance.toFixed(2)}`);
      successCount++;
      continue;
    }

    try {
      const { status, body } = await recordPayment(inv);

      if (status === 200 || status === 201) {
        const prNo = body.paymentReceiveNo || body.payment_receive_no || body.id || '?';
        console.log(`  ✓ RECORDED  ${invNo}  |  ${customer}  |  $${balance.toFixed(2)}  →  PR#${prNo}`);
        successCount++;
      } else {
        const errMsg = typeof body === 'object'
          ? (body.message || body.error || JSON.stringify(body))
          : String(body);
        console.error(`  ✗ FAILED    ${invNo}  |  ${customer}  |  $${balance.toFixed(2)}  →  HTTP ${status}: ${errMsg}`);
        failCount++;
      }
    } catch (err) {
      console.error(`  ✗ ERROR     ${invNo}  |  ${customer}  |  $${balance.toFixed(2)}  →  ${err.message}`);
      failCount++;
    }
  }

  console.log('');
  console.log(`${'─'.repeat(60)}`);
  console.log(`${tag}Invoices processed: ${invoices.length}`);
  console.log(`${tag}Total amount:       $${totalAmount.toFixed(2)}`);

  if (!dryRun) {
    console.log(`${tag}Succeeded:          ${successCount}`);
    if (failCount > 0) {
      console.log(`${tag}Failed:             ${failCount}`);
      process.exit(1); // non-zero exit → automation can detect failure and notify
    }
  }

  console.log(`\n${tag}Done.`);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
