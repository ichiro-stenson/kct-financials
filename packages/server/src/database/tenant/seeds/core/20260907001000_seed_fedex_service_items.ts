import { TenantSeeder } from '@/libs/migration-seed/TenantSeeder';

/**
 * Seed FedEx ISP service items — one per GF statement income line.
 *
 * Each item is:
 *   type       = 'service'
 *   sellable   = true
 *   purchasable = false
 *   sell_price  = 0  (actual amounts vary each week; entered on the invoice)
 *   active      = true
 *
 * sell_account_id is resolved from the accounts slug so it works regardless
 * of the auto-increment ID assigned at seed time.
 *
 * The `gf_type` in sell_description is the exact TYPE string from the
 * GF statement CSV (col0 of the OTHERS section, or "Weekly Totals" for
 * the P&D core lines) — useful for auto-categorization later.
 */

const FEDEX_ITEMS: Array<{
  name: string;
  accountSlug: string;
  sellDescription: string;
}> = [
  // ── P&D Revenue — Weekly Totals ─────────────────────────────────────────
  {
    name: 'Pickup Packages',
    accountSlug: 'pickup-packages-revenue',
    sellDescription: 'GF Weekly Totals: PU #PKG × rate',
  },
  {
    name: 'Pickup Stops',
    accountSlug: 'pickup-stops-revenue',
    sellDescription: 'GF Weekly Totals: PU STOPS × rate',
  },
  {
    name: 'Delivery Packages',
    accountSlug: 'delivery-packages-revenue',
    sellDescription: 'GF Weekly Totals: DL #PKG × rate',
  },
  {
    name: 'Delivery Stops',
    accountSlug: 'delivery-stops-revenue',
    sellDescription: 'GF Weekly Totals: DL STOPS × rate',
  },
  {
    name: 'Fuel Surcharge',
    accountSlug: 'fuel-surcharge',
    sellDescription: 'GF Weekly Totals: FUEL $AMT',
  },
  {
    name: 'Surge',
    accountSlug: 'surge',
    sellDescription: 'GF Weekly Totals: SURGE $AMT',
  },
  {
    name: 'Large Package Mix',
    accountSlug: 'large-package-mix-revenue',
    sellDescription: 'GF Weekly Totals: LARGE PKG MIX $ AMT',
  },
  {
    name: 'Ecommerce Delivery Packages',
    accountSlug: 'ecommerce-delivery-packages-revenue',
    sellDescription: 'GF Weekly Totals: ECOMM DL #PKG × rate',
  },
  {
    name: 'Ecommerce Delivery Stops',
    accountSlug: 'ecommerce-delivery-stops-revenue',
    sellDescription: 'GF Weekly Totals: ECOMM DL STOPS × rate',
  },

  // ── Other P&D Charges ────────────────────────────────────────────────────
  {
    name: 'Service Charge',
    accountSlug: 'service-charge',
    sellDescription: 'GF TYPE: "Service Charge"',
  },
  {
    name: 'Brand Promotion — Vehicles',
    accountSlug: 'brand-promotion-vehicles',
    sellDescription: 'GF TYPE: "Brand Promotion - Vehicles"',
  },
  {
    name: 'Brand Promotion — Apparel',
    accountSlug: 'brand-promotion-apparel',
    sellDescription: 'GF TYPE: "Brand Promotion - Apparel"',
  },
  {
    name: 'ENC Safe Operating Incentive',
    accountSlug: 'enc-safe-operating-incentive',
    sellDescription: 'GF TYPE: "ENC Safe Operating Incentive"',
  },
  {
    name: 'Release Payment',
    accountSlug: 'release-payment',
    sellDescription: 'GF TYPE: "Release Payment"',
  },
  {
    name: 'Post Transition Ramp Up',
    accountSlug: 'post-transition-ramp-up',
    sellDescription: 'GF TYPE: "Post Transition Ramp Up"',
  },
  {
    name: 'Service Premium',
    accountSlug: 'service-premium',
    sellDescription: 'GF TYPE: "Service Premium"',
  },
  {
    name: 'Contingency',
    accountSlug: 'contingency',
    sellDescription: 'GF TYPE: "Contingency"',
  },
  {
    name: 'Additional Charge',
    accountSlug: 'additional-charge',
    sellDescription: 'GF TYPE: "Additional Charge"',
  },

  // ── ISP Adjustment Line Items ────────────────────────────────────────────
  {
    name: 'Delivery Packages — ISP Adjustment',
    accountSlug: 'delivery-packages-isp-adjustment',
    sellDescription:
      'GF TYPE: "Delivery Packages - ISP" (prior-week adjustment)',
  },
  {
    name: 'Delivery Stops — ISP Adjustment',
    accountSlug: 'delivery-stops-isp-adjustment',
    sellDescription: 'GF TYPE: "Delivery Stops - ISP" (prior-week adjustment)',
  },
  {
    name: 'Ecommerce Package — ISP Adjustment',
    accountSlug: 'ecommerce-package-isp-adjustment',
    sellDescription: 'GF TYPE: "Ecommerce Package" (prior-week adjustment)',
  },
  {
    name: 'Ecommerce Stop — ISP Adjustment',
    accountSlug: 'ecommerce-stop-isp-adjustment',
    sellDescription: 'GF TYPE: "Ecommerce Stop" (prior-week adjustment)',
  },
  {
    name: 'Fuel Surcharge — ISP Adjustment',
    accountSlug: 'fuel-surcharge-isp-adjustment',
    sellDescription: 'GF TYPE: "Fuel Surcharge - ISP" (prior-week adjustment)',
  },
  {
    name: 'Large Package Mix — ISP Adjustment',
    accountSlug: 'large-package-mix-isp-adjustment',
    sellDescription:
      'GF TYPE: "Large Package Mix Charge" (prior-week adjustment)',
  },

  // ── Miscellaneous ────────────────────────────────────────────────────────
  {
    name: 'Miscellaneous Income',
    accountSlug: 'miscellaneous-operating-income',
    sellDescription: 'Catch-all for unclassified GF settlement income',
  },
];

export default class SeedFedExServiceItems extends TenantSeeder {
  async up(knex) {
    // Resolve all account slugs to IDs in one query.
    const slugs = FEDEX_ITEMS.map((i) => i.accountSlug);
    const accounts = await knex('accounts')
      .whereIn('slug', slugs)
      .select('id', 'slug');
    const accountBySlug = Object.fromEntries(
      accounts.map((a) => [a.slug, a.id]),
    );

    const rows = FEDEX_ITEMS.map((item) => ({
      name: item.name,
      type: 'service',
      sellable: true,
      purchasable: false,
      sell_price: 0,
      sell_account_id: accountBySlug[item.accountSlug] ?? null,
      sell_description: item.sellDescription,
      active: true,
    }));

    return knex('items').insert(rows);
  }

  async down(knex) {
    const names = FEDEX_ITEMS.map((i) => i.name);
    return knex('items').whereIn('name', names).delete();
  }
}
