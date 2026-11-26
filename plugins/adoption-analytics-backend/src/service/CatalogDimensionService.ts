import type {
  CatalogDimension,
  CatalogDimensionAnalytics,
  CatalogDimensionFilter,
  CatalogDimensionOptions,
} from '@codeverse-gp/plugin-adoption-analytics-common';
import type {
  CatalogEntitySnapshotRow,
  AdoptionAnalyticsDatabase,
} from './AdoptionAnalyticsDatabase';

type CatalogEntityRecord = CatalogEntitySnapshotRow & { date: string };

type Options = {
  db: AdoptionAnalyticsDatabase;
};

/**
 * Builds a filtered time series from the per-entity catalog snapshots.
 * Aggregation stays in JavaScript so annotation filtering behaves the same
 * on SQLite and PostgreSQL.
 */
export class CatalogDimensionService {
  constructor(private readonly options: Options) {}

  async getCatalogDimensions(
    days: number,
    groupBy: CatalogDimension,
    filters: CatalogDimensionFilter[],
  ): Promise<CatalogDimensionAnalytics> {
    const records = await this.options.db.getCatalogEntitySnapshots(days);
    const countsByDate = new Map<string, Map<string | null, number>>();

    for (const record of records) {
      const counts = countsByDate.get(record.date) ?? new Map();
      countsByDate.set(record.date, counts);
      if (!matchesFilters(record, filters)) continue;
      for (const value of dimensionValues(record, groupBy)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    return {
      days,
      groupBy,
      filters,
      options: collectOptions(records),
      snapshots: [...countsByDate.entries()]
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, counts]) => ({
          date,
          counts: [...counts.entries()]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => {
              if (b.count !== a.count) return b.count - a.count;
              if (a.value === null) return 1;
              if (b.value === null) return -1;
              return a.value.localeCompare(b.value);
            }),
        })),
    };
  }
}

function matchesFilters(
  record: CatalogEntityRecord,
  filters: CatalogDimensionFilter[],
): boolean {
  const filtersByAttribute = new Map<string, CatalogDimensionFilter[]>();
  for (const filter of filters) {
    const attribute =
      filter.dimension === 'annotation'
        ? `annotation:${filter.key}`
        : filter.dimension;
    const values = filtersByAttribute.get(attribute) ?? [];
    values.push(filter);
    filtersByAttribute.set(attribute, values);
  }

  return [...filtersByAttribute.entries()].every(
    ([attribute, attributeFilters]) => {
      if (attribute !== 'tag') {
        return attributeFilters.some(filter => matchesFilter(record, filter));
      }

      const tagFilters = attributeFilters.filter(
        (
          filter,
        ): filter is Extract<CatalogDimensionFilter, { dimension: 'tag' }> =>
          filter.dimension === 'tag',
      );
      const andFilters = tagFilters.filter(filter => filter.match === 'and');
      const orFilters = tagFilters.filter(filter => filter.match !== 'and');

      return (
        andFilters.every(filter => matchesFilter(record, filter)) &&
        (orFilters.length === 0 ||
          orFilters.some(filter => matchesFilter(record, filter)))
      );
    },
  );
}

function matchesFilter(
  record: CatalogEntityRecord,
  filter: CatalogDimensionFilter,
): boolean {
  if (filter.dimension === 'annotation') {
    const annotationValue = record.dimensions.annotations[filter.key];
    return (
      annotationValue !== undefined &&
      annotationValue.toLowerCase().includes(filter.value.toLowerCase())
    );
  }
  if (filter.dimension === 'tag') {
    return record.dimensions.tags.includes(filter.value);
  }
  return dimensionValues(record, filter.dimension).includes(filter.value);
}

function dimensionValues(
  record: CatalogEntityRecord,
  dimension: CatalogDimension,
): Array<string | null> {
  switch (dimension) {
    case 'kind':
      return [record.kind];
    case 'type':
      return [record.type || null];
    case 'owner':
      return [record.dimensions.owner];
    case 'system':
      return [record.dimensions.system];
    case 'domain':
      return [record.dimensions.domain];
    case 'lifecycle':
      return [record.dimensions.lifecycle];
    case 'namespace':
      return [record.dimensions.namespace];
    case 'tag':
      return record.dimensions.tags.length > 0
        ? record.dimensions.tags
        : [null];
    default:
      return assertNever(dimension);
  }
}

function collectOptions(
  records: CatalogEntityRecord[],
): CatalogDimensionOptions {
  const options: CatalogDimensionOptions = {
    kind: [],
    type: [],
    owner: [],
    system: [],
    domain: [],
    lifecycle: [],
    namespace: [],
    tag: [],
    annotations: [],
  };
  const sets: Record<keyof CatalogDimensionOptions, Set<string>> = {
    kind: new Set(),
    type: new Set(),
    owner: new Set(),
    system: new Set(),
    domain: new Set(),
    lifecycle: new Set(),
    namespace: new Set(),
    tag: new Set(),
    annotations: new Set(),
  };

  for (const record of records) {
    sets.kind.add(record.kind);
    addIfPresent(sets.type, record.type);
    addIfPresent(sets.owner, record.dimensions.owner);
    addIfPresent(sets.system, record.dimensions.system);
    addIfPresent(sets.domain, record.dimensions.domain);
    addIfPresent(sets.lifecycle, record.dimensions.lifecycle);
    addIfPresent(sets.namespace, record.dimensions.namespace);
    for (const tag of record.dimensions.tags) sets.tag.add(tag);
    for (const key of Object.keys(record.dimensions.annotations)) {
      sets.annotations.add(key);
    }
  }

  for (const key of Object.keys(options) as Array<
    keyof CatalogDimensionOptions
  >) {
    options[key] = [...sets[key]].sort((a, b) => a.localeCompare(b));
  }
  return options;
}

function addIfPresent(set: Set<string>, value: string | null): void {
  if (value !== null && value.length > 0) set.add(value);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported catalog dimension: ${String(value)}`);
}
