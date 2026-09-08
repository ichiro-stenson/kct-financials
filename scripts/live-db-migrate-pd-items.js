/**
 * live-db-migrate-pd-items.js
 * 
 * Live-DB migration: add granular FedEx P&D line items to the running tenant.
 * Safe to re-run (checks for existence before inserting).
 * 
 * Run: node scripts/live-db-migrate-pd-items.js
 */

// Resolve knex from project server package, or fall back to local node_modules
let knex;
try {
  knex = require('../packages/server/node_modules/knex');
} catch (e) {
  knex = require('knex');
}

const DB = 'bigcapital_tenant_8on8u91mti2udiv';

const db = knex({
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || DB,
  },
});

async function run() {
  // ── Phase 1: Add revenue_type column ──────────────────────────────────────
  const hasCol = await db.schema.hasColumn('ACCOUNTS', 'revenue_type');
  if (!hasCol) {
    console.log('Adding revenue_type column...');
    await db.schema.table('ACCOUNTS', (t) => {
      t.string('revenue_type', 20).nullable().defaultTo(null);
    });
    console.log('  ✓ revenue_type added');
  } else {
    console.log('  revenue_type already exists — skip');
  }

  // ── Phase 2: Deactivate old coarse P&D items (keep for GL history) ────────
  const legacySlugs = ['stops-packages-revenue', 'fuel-surcharge-sra', 'large-package-revenue'];
  for (const slug of legacySlugs) {
    const acct = await db('ACCOUNTS').where('SLUG', slug).first();
    if (acct && !acct.NAME.includes('(Legacy)')) {
      console.log(`Deactivating legacy account: ${acct.NAME}...`);
      await db('ACCOUNTS').where('ID', acct.ID).update({
        NAME: `${acct.NAME} (Legacy)`,
        ACTIVE: 0,
        UPDATED_AT: new Date(),
      });
      // Deactivate matching item(s)
      await db('ITEMS').where('SELL_ACCOUNT_ID', acct.ID).update({
        NAME: db.raw("CONCAT(NAME, ' (Legacy)')"),
        ACTIVE: 0,
        UPDATED_AT: new Date(),
      });
      console.log(`  ✓ deactivated`);
    } else if (acct) {
      console.log(`  legacy account already deactivated: ${acct.NAME} — skip`);
    } else {
      console.log(`  legacy account not found for slug: ${slug} — skip`);
    }
  }

  // ── Phase 3: Rename existing accounts to match GF naming ──────────────────
  const renames = [
    { slug: 'service-charge-income',   name: 'Service Charge',            newSlug: 'service-charge',          code: '4101', revenue_type: 'fixed' },
    { slug: 'brand-promotion-vehicles',name: 'Brand Promotion — Vehicles', newSlug: 'brand-promotion-vehicles', code: '4102', revenue_type: 'fixed' },
    { slug: 'brand-promotion-uniforms',name: 'Brand Promotion — Apparel',  newSlug: 'brand-promotion-apparel',  code: '4103', revenue_type: 'fixed' },
    { slug: 'contingency-revenue',     name: 'Contingency',                newSlug: 'contingency',              code: '4108', revenue_type: 'variable' },
    { slug: 'customer-service-bonus',  name: 'ENC Safe Operating Incentive', newSlug: 'enc-safe-operating-incentive', code: '4104', revenue_type: 'fixed' },
    { slug: 'safety-bonus-incentive',  name: 'Service Premium',            newSlug: 'service-premium',          code: '4107', revenue_type: 'variable' },
    { slug: 'peak-service-income',     name: 'Service Premium',            newSlug: 'service-premium-2',        code: '4107', revenue_type: 'variable' },
    { slug: 'one-time-payments',       name: 'Release Payment',            newSlug: 'release-payment',          code: '4105', revenue_type: 'fixed' },
  ];

  for (const r of renames) {
    const acct = await db('ACCOUNTS').where('SLUG', r.slug).first();
    if (acct) {
      console.log(`Renaming account ${acct.NAME} → ${r.name}...`);
      await db('ACCOUNTS').where('ID', acct.ID).update({
        NAME: r.name,
        SLUG: r.newSlug,
        CODE: r.code,
        revenue_type: r.revenue_type,
        UPDATED_AT: new Date(),
      });
      // Rename matching item
      await db('ITEMS').where('SELL_ACCOUNT_ID', acct.ID).update({
        NAME: r.name,
        UPDATED_AT: new Date(),
      });
      console.log(`  ✓ renamed`);
    } else {
      console.log(`  account not found for slug: ${r.slug} — skip`);
    }
  }

  // ── Phase 4: Insert new granular P&D accounts ──────────────────────────────
  const newAccounts = [
    // P&D Weekly Totals
    { NAME: 'Pickup Packages Revenue',                 SLUG: 'pickup-packages-revenue',                 CODE: '4001', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: PU #PKG × rate', INDEX: 2 },
    { NAME: 'Pickup Stops Revenue',                    SLUG: 'pickup-stops-revenue',                    CODE: '4002', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: PU STOPS × rate', INDEX: 3 },
    { NAME: 'Delivery Packages Revenue',               SLUG: 'delivery-packages-revenue',               CODE: '4003', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: DL #PKG × rate', INDEX: 4 },
    { NAME: 'Delivery Stops Revenue',                  SLUG: 'delivery-stops-revenue',                  CODE: '4004', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: DL STOPS × rate', INDEX: 5 },
    { NAME: 'Fuel Surcharge',                          SLUG: 'fuel-surcharge',                          CODE: '4005', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: FUEL $AMT', INDEX: 6 },
    { NAME: 'Surge',                                   SLUG: 'surge',                                   CODE: '4006', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: SURGE $AMT', INDEX: 7 },
    { NAME: 'Large Package Mix Revenue',               SLUG: 'large-package-mix-revenue',               CODE: '4007', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: LARGE PKG MIX $ AMT', INDEX: 8 },
    { NAME: 'Ecommerce Delivery Packages Revenue',     SLUG: 'ecommerce-delivery-packages-revenue',     CODE: '4008', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: ECOMM DL #PKG × rate', INDEX: 9 },
    { NAME: 'Ecommerce Delivery Stops Revenue',        SLUG: 'ecommerce-delivery-stops-revenue',        CODE: '4009', revenue_type: 'variable', DESCRIPTION: 'GF Weekly Totals: ECOMM DL STOPS × rate', INDEX: 10 },
    // Other P&D — new entries that don't exist yet
    { NAME: 'Post Transition Ramp Up',                 SLUG: 'post-transition-ramp-up',                 CODE: '4106', revenue_type: 'fixed',    DESCRIPTION: 'GF TYPE: "Post Transition Ramp Up"', INDEX: 17 },
    { NAME: 'Additional Charge',                       SLUG: 'additional-charge',                       CODE: '4109', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Additional Charge"', INDEX: 20 },
    { NAME: 'Delivery Packages — ISP Adjustment',      SLUG: 'delivery-packages-isp-adjustment',        CODE: '4110', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Delivery Packages - ISP"', INDEX: 21 },
    { NAME: 'Delivery Stops — ISP Adjustment',         SLUG: 'delivery-stops-isp-adjustment',           CODE: '4111', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Delivery Stops - ISP"', INDEX: 22 },
    { NAME: 'Ecommerce Package — ISP Adjustment',      SLUG: 'ecommerce-package-isp-adjustment',        CODE: '4112', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Ecommerce Package"', INDEX: 23 },
    { NAME: 'Ecommerce Stop — ISP Adjustment',         SLUG: 'ecommerce-stop-isp-adjustment',           CODE: '4113', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Ecommerce Stop"', INDEX: 24 },
    { NAME: 'Fuel Surcharge — ISP Adjustment',         SLUG: 'fuel-surcharge-isp-adjustment',           CODE: '4114', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Fuel Surcharge - ISP"', INDEX: 25 },
    { NAME: 'Large Package Mix — ISP Adjustment',      SLUG: 'large-package-mix-isp-adjustment',        CODE: '4115', revenue_type: 'variable', DESCRIPTION: 'GF TYPE: "Large Package Mix Charge"', INDEX: 26 },
    { NAME: 'Miscellaneous Operating Income',          SLUG: 'miscellaneous-operating-income',          CODE: '4900', revenue_type: null,        DESCRIPTION: '', INDEX: 27 },
  ];

  const insertedAccounts = {}; // slug → id
  for (const a of newAccounts) {
    const existing = await db('ACCOUNTS').where('SLUG', a.SLUG).first();
    if (existing) {
      console.log(`  account already exists: ${a.NAME} — skip`);
      insertedAccounts[a.SLUG] = existing.ID;
    } else {
      console.log(`Inserting account: ${a.NAME}...`);
      const [id] = await db('ACCOUNTS').insert({
        NAME: a.NAME,
        SLUG: a.SLUG,
        ACCOUNT_TYPE: 'income',
        CODE: a.CODE,
        DESCRIPTION: a.DESCRIPTION,
        revenue_type: a.revenue_type,
        ACTIVE: 1,
        INDEX: a.INDEX,
        PREDEFINED: 0,
        CURRENCY_CODE: 'USD',
        IS_SYSTEM_ACCOUNT: 0,
        CREATED_AT: new Date(),
        UPDATED_AT: new Date(),
      });
      insertedAccounts[a.SLUG] = id;
      console.log(`  ✓ inserted (id=${id})`);
    }
  }

  // Also collect IDs for renamed accounts
  const renamedSlugs = ['service-charge','brand-promotion-vehicles','brand-promotion-apparel','contingency','enc-safe-operating-incentive','service-premium','release-payment'];
  for (const slug of renamedSlugs) {
    const acct = await db('ACCOUNTS').where('SLUG', slug).first();
    if (acct) insertedAccounts[slug] = acct.ID;
  }

  // ── Phase 5: Create item categories ───────────────────────────────────────
  const categories = {};
  for (const cat of [
    { name: 'FedEx P&D Revenue',        desc: 'Pickup & Delivery weekly totals from GF statement',    sellSlug: 'fedex-settlement-revenue' },
    { name: 'FedEx Other P&D Charges',  desc: 'Other P&D charges from GF statement OTHERS section',  sellSlug: 'service-charge' },
  ]) {
    const existing = await db('ITEMS_CATEGORIES').where('NAME', cat.name).first();
    if (existing) {
      console.log(`  category already exists: ${cat.name} — skip`);
      categories[cat.name] = existing.ID;
    } else {
      const sellAcct = await db('ACCOUNTS').where('SLUG', cat.sellSlug).first();
      console.log(`Inserting category: ${cat.name}...`);
      const [id] = await db('ITEMS_CATEGORIES').insert({
        NAME: cat.name,
        DESCRIPTION: cat.desc,
        SELL_ACCOUNT_ID: sellAcct?.ID ?? null,
        CREATED_AT: new Date(),
        UPDATED_AT: new Date(),
      });
      categories[cat.name] = id;
      console.log(`  ✓ inserted (id=${id})`);
    }
  }

  // ── Phase 6: Insert new items ─────────────────────────────────────────────
  const pdCatId    = categories['FedEx P&D Revenue'];
  const otherCatId = categories['FedEx Other P&D Charges'];

  const newItems = [
    // P&D granular — category: FedEx P&D Revenue
    { NAME: 'PU Packages',                         slug: 'pickup-packages-revenue',                 catId: pdCatId,    desc: 'GF Weekly Totals: PU #PKG' },
    { NAME: 'PU Stops',                            slug: 'pickup-stops-revenue',                    catId: pdCatId,    desc: 'GF Weekly Totals: PU STOPS' },
    { NAME: 'DL Packages',                         slug: 'delivery-packages-revenue',               catId: pdCatId,    desc: 'GF Weekly Totals: DL #PKG' },
    { NAME: 'DL Stops',                            slug: 'delivery-stops-revenue',                  catId: pdCatId,    desc: 'GF Weekly Totals: DL STOPS' },
    { NAME: 'Fuel Surcharge',                      slug: 'fuel-surcharge',                          catId: pdCatId,    desc: 'GF Weekly Totals: FUEL $AMT' },
    { NAME: 'Surge',                               slug: 'surge',                                   catId: pdCatId,    desc: 'GF Weekly Totals: SURGE $AMT' },
    { NAME: 'Large Package Mix',                   slug: 'large-package-mix-revenue',               catId: pdCatId,    desc: 'GF Weekly Totals: LARGE PKG MIX' },
    { NAME: 'E-Comm Packages',                     slug: 'ecommerce-delivery-packages-revenue',     catId: pdCatId,    desc: 'GF Weekly Totals: ECOMM DL #PKG' },
    { NAME: 'E-Comm Stops',                        slug: 'ecommerce-delivery-stops-revenue',        catId: pdCatId,    desc: 'GF Weekly Totals: ECOMM DL STOPS' },
    // Other P&D — category: FedEx Other P&D Charges
    { NAME: 'Service Charge',                      slug: 'service-charge',                          catId: otherCatId, desc: 'GF TYPE: "Service Charge"' },
    { NAME: 'Brand Promotion — Vehicles',          slug: 'brand-promotion-vehicles',                catId: otherCatId, desc: 'GF TYPE: "Brand Promotion - Vehicles"' },
    { NAME: 'Brand Promotion — Apparel',           slug: 'brand-promotion-apparel',                 catId: otherCatId, desc: 'GF TYPE: "Brand Promotion - Apparel"' },
    { NAME: 'ENC Safe Operating Incentive',        slug: 'enc-safe-operating-incentive',            catId: otherCatId, desc: 'GF TYPE: "ENC Safe Operating Incentive"' },
    { NAME: 'Release Payment',                     slug: 'release-payment',                         catId: otherCatId, desc: 'GF TYPE: "Release Payment"' },
    { NAME: 'Post Transition Ramp Up',             slug: 'post-transition-ramp-up',                 catId: otherCatId, desc: 'GF TYPE: "Post Transition Ramp Up"' },
    { NAME: 'Service Premium',                     slug: 'service-premium',                         catId: otherCatId, desc: 'GF TYPE: "Service Premium"' },
    { NAME: 'Contingency',                         slug: 'contingency',                             catId: otherCatId, desc: 'GF TYPE: "Contingency"' },
    { NAME: 'Additional Charge',                   slug: 'additional-charge',                       catId: otherCatId, desc: 'GF TYPE: "Additional Charge"' },
    // ISP Adjustments
    { NAME: 'DL Packages — ISP Adj',               slug: 'delivery-packages-isp-adjustment',        catId: otherCatId, desc: 'GF TYPE: "Delivery Packages - ISP"' },
    { NAME: 'DL Stops — ISP Adj',                  slug: 'delivery-stops-isp-adjustment',           catId: otherCatId, desc: 'GF TYPE: "Delivery Stops - ISP"' },
    { NAME: 'E-Comm Package — ISP Adj',            slug: 'ecommerce-package-isp-adjustment',        catId: otherCatId, desc: 'GF TYPE: "Ecommerce Package"' },
    { NAME: 'E-Comm Stop — ISP Adj',               slug: 'ecommerce-stop-isp-adjustment',           catId: otherCatId, desc: 'GF TYPE: "Ecommerce Stop"' },
    { NAME: 'Fuel Surcharge — ISP Adj',            slug: 'fuel-surcharge-isp-adjustment',           catId: otherCatId, desc: 'GF TYPE: "Fuel Surcharge - ISP"' },
    { NAME: 'Large Package Mix — ISP Adj',         slug: 'large-package-mix-isp-adjustment',        catId: otherCatId, desc: 'GF TYPE: "Large Package Mix Charge"' },
    // Misc
    { NAME: 'Miscellaneous Income',                slug: 'miscellaneous-operating-income',          catId: otherCatId, desc: 'Catch-all for unclassified GF income' },
  ];

  for (const item of newItems) {
    const accountId = insertedAccounts[item.slug];
    if (!accountId) {
      console.warn(`  ⚠ no account found for slug: ${item.slug} — skipping item ${item.NAME}`);
      continue;
    }
    const existing = await db('ITEMS').where('NAME', item.NAME).where('SELL_ACCOUNT_ID', accountId).first();
    if (existing) {
      console.log(`  item already exists: ${item.NAME} — skip`);
    } else {
      console.log(`Inserting item: ${item.NAME}...`);
      await db('ITEMS').insert({
        NAME: item.NAME,
        TYPE: 'service',
        SELLABLE: 1,
        PURCHASABLE: 0,
        SELL_PRICE: 0,
        SELL_ACCOUNT_ID: accountId,
        SELL_DESCRIPTION: item.desc,
        CATEGORY_ID: item.catId,
        ACTIVE: 1,
        CREATED_AT: new Date(),
        UPDATED_AT: new Date(),
      });
      console.log(`  ✓ inserted`);
    }
  }

  await db.destroy();
  console.log('\n✅ Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
