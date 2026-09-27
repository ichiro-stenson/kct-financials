/**
 * Add revenue_type column to accounts table.
 *
 * Used to classify income accounts as 'variable' (volume-driven) or
 * 'fixed' (contractual flat amounts) for FedEx ISP P&L analysis.
 */
exports.up = function (knex) {
  return knex.schema.table('accounts', (table) => {
    table.string('revenue_type', 20).nullable().defaultTo(null);
  });
};

exports.down = function (knex) {
  return knex.schema.table('accounts', (table) => {
    table.dropColumn('revenue_type');
  });
};
