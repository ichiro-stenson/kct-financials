import { TenantSeeder } from '@/libs/migration-seed/TenantSeeder';
import { AccountsData } from '../data/accounts';

// Slugs for the accounts that Playwright E2E tests depend on.
// These are inserted in a separate call with a future createdAt so they
// always sort first when the accounts chart orders by created_at DESC.
const E2E_ACCOUNT_SLUGS = [
  'petty-cash',
  'rent',
  'sales-of-product-income',
  'cost-of-goods-sold',
  'inventory-asset',
];

export default class SeedAccounts extends TenantSeeder {
  /**
   * Seeds initial accounts to the organization.
   *
   * E2E accounts are inserted in a separate statement with a createdAt
   * 10 years in the future so they reliably sort first in the accounts
   * chart (which orders by created_at DESC). All other accounts receive
   * no explicit createdAt and let the DB default apply.
   */
  up(knex) {
    const mapAccount = (account: (typeof AccountsData)[number]) => ({
      ...account,
      name: this.i18n.t(account.name),
      description: account.description ? this.i18n.t(account.description) : '',
      currencyCode: this.tenant.metadata.baseCurrency,
    });

    const bulkAccounts = AccountsData.filter(
      (a) => !E2E_ACCOUNT_SLUGS.includes(a.slug),
    ).map(mapAccount);

    const e2eAccounts = AccountsData.filter((a) =>
      E2E_ACCOUNT_SLUGS.includes(a.slug),
    ).map((account) => ({
      ...mapAccount(account),
      // 10 years in the future — guarantees DESC sort puts these first
      // regardless of when other rows were inserted.
      createdAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    }));

    return knex('accounts').then(async () => {
      // Insert the bulk of the chart of accounts first.
      await knex('accounts').insert(bulkAccounts);
      // Insert E2E accounts separately so createdAt is set explicitly.
      await knex('accounts').insert(e2eAccounts);
    });
  }
}
