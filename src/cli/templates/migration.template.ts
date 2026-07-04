export function migrationTemplate(name: string): string {
  return `import type { MigrationModule } from 'qwe';

export const migration: MigrationModule = {
  async up(ctx) {
    await ctx.schema.createTable('${name}', (table) => {
      table.id();
      table.string('name');
      table.dateTime('createdAt').default('NOW()');
    });
  },

  async down(ctx) {
    await ctx.schema.dropTable('${name}');
  },
};
`;
}
