import type { DatabaseService } from '@backstage/backend-plugin-api';
import { mockServices } from '@backstage/backend-test-utils';
import knexFactory from 'knex';
import {
  AdoptionAnalyticsDatabase,
  type CatalogEntitySnapshotRow,
} from './AdoptionAnalyticsDatabase';

describe('AdoptionAnalyticsDatabase catalog snapshots', () => {
  it('replaces a day atomically and reads entity dimensions', async () => {
    const client = knexFactory({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    const database = {
      getClient: jest.fn().mockResolvedValue(client),
    } as unknown as DatabaseService;
    const db = await AdoptionAnalyticsDatabase.create({
      database,
      logger: mockServices.logger.mock(),
    });
    const date = new Date().toISOString().slice(0, 10);
    const entity: CatalogEntitySnapshotRow = {
      entityRef: 'component:default/portal',
      kind: 'Component',
      type: 'service',
      dimensions: {
        owner: 'group:default/platform',
        system: null,
        domain: null,
        lifecycle: 'production',
        namespace: 'default',
        tags: ['frontend'],
        annotations: { 'docs/url': 'https://docs.example/portal' },
      },
    };

    try {
      await db.upsertEntitySnapshot(
        date,
        [{ kind: 'Component', type: 'service', count: 1 }],
        [entity],
      );

      expect(await db.getEntityCountSnapshots(30)).toEqual([
        {
          date,
          counts: { Component: 1 },
          countsByType: { Component: { service: 1 } },
          total: 1,
        },
      ]);
      expect(await db.getCatalogEntitySnapshots(30)).toEqual([
        { date, ...entity },
      ]);

      await db.upsertEntitySnapshot(date, [], []);
      expect(await db.getEntityCountSnapshots(30)).toEqual([]);
      expect(await db.getCatalogEntitySnapshots(30)).toEqual([]);

      const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      await db.upsertEntitySnapshot(oldDate, [], [entity]);
      expect(await db.deleteCatalogEntitySnapshotsOlderThan(365)).toBe(1);
    } finally {
      await client.destroy();
    }
  });
});
