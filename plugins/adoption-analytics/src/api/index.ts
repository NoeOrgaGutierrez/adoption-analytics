import { createApiRef } from '@backstage/core-plugin-api';
import type {
  ActiveUsersSummary,
  CatalogDimension,
  CatalogDimensionAnalytics,
  CatalogDimensionFilter,
  EntityCountSnapshot,
  AdoptionAnalyticsDashboard,
  AdoptionAnalyticsEvent,
  AdoptionAnalyticsTimeRange,
  LoginEvent,
} from '@codeverse-gp/plugin-adoption-analytics-common';

/**
 * Client used by the adoption analytics plugin to talk to
 * `plugin-adoption-analytics-backend`.
 */
export interface AdoptionAnalyticsApi {
  postEvents: (events: AdoptionAnalyticsEvent[]) => Promise<void>;
  getEntityCounts: (days?: number) => Promise<EntityCountSnapshot[]>;
  getCatalogDimensions: (
    days: number,
    groupBy: CatalogDimension,
    filters: CatalogDimensionFilter[],
  ) => Promise<CatalogDimensionAnalytics>;
  getActiveUsers: (
    window: 'daily' | 'weekly',
    days?: number,
  ) => Promise<ActiveUsersSummary>;
  getRecentLogins: (limit?: number) => Promise<LoginEvent[]>;
  getDashboard: (
    range: AdoptionAnalyticsTimeRange,
  ) => Promise<AdoptionAnalyticsDashboard>;
}

export const adoptionAnalyticsApiRef = createApiRef<AdoptionAnalyticsApi>({
  id: 'plugin.adoption-analytics.service',
});

export { AdoptionAnalyticsClient } from './AdoptionAnalyticsClient';
