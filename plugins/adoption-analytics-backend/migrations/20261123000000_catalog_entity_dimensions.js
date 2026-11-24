/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('insights_catalog_entity_snapshots', table => {
    table.increments('id');
    table.string('date').notNullable();
    table.text('entity_ref').notNullable();
    table.string('kind').notNullable();
    table.string('type').notNullable().defaultTo('');
    table.text('dimensions').notNullable();
    table.unique(['date', 'entity_ref']);
    table.index('date');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('insights_catalog_entity_snapshots');
};
