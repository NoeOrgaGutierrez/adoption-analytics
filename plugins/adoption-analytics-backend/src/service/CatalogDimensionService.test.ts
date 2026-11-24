import type { CatalogDimensionFilter } from '@codeverse-gp/plugin-adoption-analytics-common';
import type { AdoptionAnalyticsDatabase } from './AdoptionAnalyticsDatabase';
import { CatalogDimensionService } from './CatalogDimensionService';

function entity(
  date: string,
  entityRef: string,
  dimensions: {
    owner?: string | null;
    tags?: string[];
    annotations?: Record<string, string>;
  } = {},
) {
  return {
    date,
    entityRef,
    kind: 'Component',
    type: 'service',
    dimensions: {
      owner: dimensions.owner ?? null,
      system: null,
      domain: null,
      lifecycle: null,
      namespace: 'default',
      tags: dimensions.tags ?? [],
      annotations: dimensions.annotations ?? {},
    },
  };
}

function createService(records: ReturnType<typeof entity>[]) {
  const getCatalogEntitySnapshots = jest.fn().mockResolvedValue(records);
  return {
    service: new CatalogDimensionService({
      db: {
        getCatalogEntitySnapshots,
      } as unknown as AdoptionAnalyticsDatabase,
    }),
    getCatalogEntitySnapshots,
  };
}

describe('CatalogDimensionService', () => {
  it('groups matching entities over time and exposes filter options', async () => {
    const records = [
      entity('2026-11-20', 'component:default/a', {
        owner: 'group:default/team-a',
        tags: ['frontend', 'critical'],
        annotations: { 'docs/url': 'https://docs.example/a' },
      }),
      entity('2026-11-20', 'component:default/b', {
        owner: 'group:default/team-a',
        tags: ['frontend'],
        annotations: { 'docs/url': 'https://docs.example/b' },
      }),
      entity('2026-11-21', 'component:default/a', {
        owner: 'group:default/team-a',
        tags: ['critical'],
        annotations: { 'docs/url': 'https://docs.example/a' },
      }),
    ];
    const { service, getCatalogEntitySnapshots } = createService(records);

    const result = await service.getCatalogDimensions(30, 'tag', []);

    expect(getCatalogEntitySnapshots).toHaveBeenCalledWith(30);
    expect(result.snapshots).toEqual([
      {
        date: '2026-11-20',
        counts: [
          { value: 'frontend', count: 2 },
          { value: 'critical', count: 1 },
        ],
      },
      {
        date: '2026-11-21',
        counts: [{ value: 'critical', count: 1 }],
      },
    ]);
    expect(result.options).toMatchObject({
      owner: ['group:default/team-a'],
      tag: ['critical', 'frontend'],
      annotations: ['docs/url'],
    });
  });

  it('applies exact dimension filters and annotation text filters together', async () => {
    const records = [
      entity('2026-11-20', 'component:default/a', {
        owner: 'group:default/team-a',
        annotations: { 'docs/url': 'https://docs.example/a' },
      }),
      entity('2026-11-20', 'component:default/b', {
        owner: 'group:default/team-a',
        annotations: { 'docs/url': 'https://other.example/b' },
      }),
      entity('2026-11-20', 'component:default/c', {
        owner: 'group:default/team-b',
        annotations: { 'docs/url': 'https://docs.example/c' },
      }),
    ];
    const { service } = createService(records);
    const filters: CatalogDimensionFilter[] = [
      { dimension: 'owner', value: 'group:default/team-a' },
      { dimension: 'annotation', key: 'docs/url', value: 'DOCS.EXAMPLE' },
    ];

    const result = await service.getCatalogDimensions(7, 'kind', filters);

    expect(result.snapshots).toEqual([
      {
        date: '2026-11-20',
        counts: [{ value: 'Component', count: 1 }],
      },
    ]);
  });

  it('treats multiple selected values as alternatives within a dimension', async () => {
    const records = [
      entity('2026-11-20', 'component:default/a', {
        owner: 'group:default/team-a',
        tags: ['frontend'],
      }),
      entity('2026-11-20', 'component:default/b', {
        owner: 'group:default/team-a',
        tags: ['critical'],
      }),
      entity('2026-11-20', 'component:default/c', {
        owner: 'group:default/team-b',
        tags: ['frontend'],
      }),
    ];
    const { service } = createService(records);
    const filters: CatalogDimensionFilter[] = [
      { dimension: 'owner', value: 'group:default/team-a' },
      { dimension: 'tag', value: 'frontend' },
      { dimension: 'tag', value: 'critical' },
    ];

    const result = await service.getCatalogDimensions(7, 'kind', filters);

    expect(result.snapshots).toEqual([
      {
        date: '2026-11-20',
        counts: [{ value: 'Component', count: 2 }],
      },
    ]);
  });

  it('requires all selected tags when tag matching is AND', async () => {
    const records = [
      entity('2026-11-20', 'component:default/a', {
        tags: ['frontend', 'critical'],
      }),
      entity('2026-11-20', 'component:default/b', {
        tags: ['frontend'],
      }),
      entity('2026-11-20', 'component:default/c', {
        tags: ['critical'],
      }),
    ];
    const { service } = createService(records);
    const filters: CatalogDimensionFilter[] = [
      { dimension: 'tag', value: 'frontend', match: 'and' },
      { dimension: 'tag', value: 'critical', match: 'and' },
    ];

    const result = await service.getCatalogDimensions(7, 'kind', filters);

    expect(result.snapshots).toEqual([
      {
        date: '2026-11-20',
        counts: [{ value: 'Component', count: 1 }],
      },
    ]);
  });

  it('keeps backward-compatible tag filters as OR', async () => {
    const records = [
      entity('2026-11-20', 'component:default/a', {
        tags: ['frontend'],
      }),
      entity('2026-11-20', 'component:default/b', {
        tags: ['critical'],
      }),
    ];
    const { service } = createService(records);
    const filters: CatalogDimensionFilter[] = [
      { dimension: 'tag', value: 'frontend' },
      { dimension: 'tag', value: 'critical' },
    ];

    const result = await service.getCatalogDimensions(7, 'kind', filters);

    expect(result.snapshots).toEqual([
      {
        date: '2026-11-20',
        counts: [{ value: 'Component', count: 2 }],
      },
    ]);
  });

  it('keeps entities without a selected attribute in an unassigned group', async () => {
    const { service } = createService([
      entity('2026-11-20', 'component:default/a'),
      entity('2026-11-20', 'component:default/b', { owner: 'team-a' }),
    ]);

    const result = await service.getCatalogDimensions(30, 'owner', []);

    expect(result.snapshots[0].counts).toEqual([
      { value: 'team-a', count: 1 },
      { value: null, count: 1 },
    ]);
  });
});
