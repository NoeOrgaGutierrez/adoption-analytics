import { isCatalogDimensionAvailable } from './catalogDimensionApplicability';

describe('isCatalogDimensionAvailable', () => {
  it('allows every dimension when all kinds are selected', () => {
    expect(isCatalogDimensionAvailable(undefined, 'owner')).toBe(true);
    expect(isCatalogDimensionAvailable(undefined, 'lifecycle')).toBe(true);
  });

  it('only allows common metadata dimensions for users', () => {
    expect(isCatalogDimensionAvailable('User', 'owner')).toBe(false);
    expect(isCatalogDimensionAvailable('User', 'type')).toBe(false);
    expect(isCatalogDimensionAvailable('User', 'namespace')).toBe(true);
    expect(isCatalogDimensionAvailable('User', 'tag')).toBe(true);
  });

  it('matches the documented dimensions for systems and components', () => {
    expect(isCatalogDimensionAvailable('System', 'domain')).toBe(true);
    expect(isCatalogDimensionAvailable('System', 'system')).toBe(false);
    expect(isCatalogDimensionAvailable('Component', 'lifecycle')).toBe(true);
    expect(isCatalogDimensionAvailable('Component', 'domain')).toBe(false);
  });

  it.each([
    ['API', 'lifecycle', true],
    ['Resource', 'system', true],
    ['Resource', 'lifecycle', false],
    ['Domain', 'owner', true],
    ['Domain', 'system', false],
    ['Group', 'type', true],
    ['Group', 'owner', false],
    ['Template', 'owner', true],
    ['Template', 'lifecycle', false],
    ['Location', 'type', true],
    ['Location', 'owner', false],
  ] as const)('supports %s.%s: %s', (kind, dimension, available) => {
    expect(isCatalogDimensionAvailable(kind, dimension)).toBe(available);
  });

  it('limits custom kinds to common dimensions', () => {
    expect(isCatalogDimensionAvailable('CustomThing', 'owner')).toBe(false);
    expect(isCatalogDimensionAvailable('CustomThing', 'type')).toBe(false);
    expect(isCatalogDimensionAvailable('CustomThing', 'namespace')).toBe(true);
    expect(isCatalogDimensionAvailable('CustomThing', 'tag')).toBe(true);
  });
});
