import type { CatalogDimension } from '@codeverse-gp/plugin-adoption-analytics-common';

const COMMON_DIMENSIONS: ReadonlySet<CatalogDimension> = new Set([
  'kind',
  'namespace',
  'tag',
]);

const DIMENSIONS_BY_KIND: Record<string, ReadonlySet<CatalogDimension>> = {
  component: new Set([
    'kind',
    'type',
    'owner',
    'system',
    'lifecycle',
    'namespace',
    'tag',
  ]),
  api: new Set([
    'kind',
    'type',
    'owner',
    'system',
    'lifecycle',
    'namespace',
    'tag',
  ]),
  resource: new Set(['kind', 'type', 'owner', 'system', 'namespace', 'tag']),
  system: new Set(['kind', 'type', 'owner', 'domain', 'namespace', 'tag']),
  domain: new Set(['kind', 'type', 'owner', 'namespace', 'tag']),
  group: new Set(['kind', 'type', 'namespace', 'tag']),
  user: new Set(['kind', 'namespace', 'tag']),
  template: new Set(['kind', 'type', 'owner', 'namespace', 'tag']),
  location: new Set(['kind', 'type', 'namespace', 'tag']),
};

export function isCatalogDimensionAvailable(
  kind: string | undefined,
  dimension: CatalogDimension,
): boolean {
  if (!kind) return true;

  const supportedDimensions = DIMENSIONS_BY_KIND[kind.toLocaleLowerCase()];
  return supportedDimensions
    ? supportedDimensions.has(dimension)
    : COMMON_DIMENSIONS.has(dimension);
}
