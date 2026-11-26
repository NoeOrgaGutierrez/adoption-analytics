import type { AuthService } from '@backstage/backend-plugin-api';
import { mockServices } from '@backstage/backend-test-utils';
import type { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { EntitySnapshotCollector } from './EntitySnapshotCollector';
import type { AdoptionAnalyticsDatabase } from './AdoptionAnalyticsDatabase';

describe('EntitySnapshotCollector', () => {
  it('stores the grouped counts and dimensions from catalog entities', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'portal',
        namespace: 'engineering',
        tags: ['frontend', 'critical', 'frontend'],
        annotations: {
          'backstage.io/techdocs-ref': 'dir:./docs',
        },
      },
      spec: {
        type: 'service',
        owner: 'group:default/platform',
        system: 'system:default/portal',
        domain: 'domain:default/engineering',
        lifecycle: 'production',
      },
    };
    const auth = {
      getOwnServiceCredentials: jest.fn().mockResolvedValue({}),
    } as unknown as AuthService;
    const db = {
      upsertEntitySnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as AdoptionAnalyticsDatabase;
    const collector = new EntitySnapshotCollector({
      logger: mockServices.logger.mock(),
      catalog: catalogServiceMock({ entities: [entity] }),
      auth,
      db,
    });

    await collector.run();

    expect(db.upsertEntitySnapshot).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      [{ kind: 'Component', type: 'service', count: 1 }],
      [
        {
          entityRef: 'component:engineering/portal',
          kind: 'Component',
          type: 'service',
          dimensions: {
            owner: 'group:default/platform',
            system: 'system:default/portal',
            domain: 'domain:default/engineering',
            lifecycle: 'production',
            namespace: 'engineering',
            tags: ['frontend', 'critical'],
            annotations: {
              'backstage.io/techdocs-ref': 'dir:./docs',
            },
          },
        },
      ],
    );
  });
});
