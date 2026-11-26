import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
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
import type { AdoptionAnalyticsApi } from './index';

type Options = {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
};

/**
 * Default implementation of `AdoptionAnalyticsApi` that talks to the
 * `adoption-analytics-backend` plugin over HTTP.
 */
export class AdoptionAnalyticsClient implements AdoptionAnalyticsApi {
  constructor(private readonly options: Options) {}

  async postEvents(events: AdoptionAnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;
    const base = await this.baseUrl();
    const res = await this.options.fetchApi.fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      // Best-effort — do not surface analytics failures to the user.
      keepalive: true,
    });
    if (!res.ok) {
      throw new Error(
        `adoption-analytics: failed to post events (${res.status} ${res.statusText})`,
      );
    }
  }

  async getEntityCounts(days = 30): Promise<EntityCountSnapshot[]> {
    const base = await this.baseUrl();
    const res = await this.options.fetchApi.fetch(
      `${base}/stats/entity-counts?days=${days}`,
    );
    return (await this.parseJson<{ snapshots: EntityCountSnapshot[] }>(res))
      .snapshots;
  }

  async getCatalogDimensions(
    days: number,
    groupBy: CatalogDimension,
    filters: CatalogDimensionFilter[],
  ): Promise<CatalogDimensionAnalytics> {
    const base = await this.baseUrl();
    const query = new URLSearchParams({
      days: String(days),
      groupBy,
      filters: JSON.stringify(filters),
    });
    const res = await this.options.fetchApi.fetch(
      `${base}/stats/catalog-dimensions?${query.toString()}`,
    );
    return this.parseJson<CatalogDimensionAnalytics>(res);
  }

  async getActiveUsers(
    window: 'daily' | 'weekly',
    days = 30,
  ): Promise<ActiveUsersSummary> {
    const base = await this.baseUrl();
    const res = await this.options.fetchApi.fetch(
      `${base}/stats/active-users?window=${window}&days=${days}`,
    );
    return this.parseJson<ActiveUsersSummary>(res);
  }

  async getRecentLogins(limit = 50): Promise<LoginEvent[]> {
    const base = await this.baseUrl();
    const res = await this.options.fetchApi.fetch(
      `${base}/stats/logins?limit=${limit}`,
    );
    return (await this.parseJson<{ logins: LoginEvent[] }>(res)).logins;
  }

  async getDashboard(
    range: AdoptionAnalyticsTimeRange,
  ): Promise<AdoptionAnalyticsDashboard> {
    const base = await this.baseUrl();
    const res = await this.options.fetchApi.fetch(
      `${base}/stats/dashboard?range=${range}`,
    );
    return this.parseJson<AdoptionAnalyticsDashboard>(res);
  }

  private async baseUrl(): Promise<string> {
    return this.options.discoveryApi.getBaseUrl('adoption-analytics');
  }

  private async parseJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      throw new Error(
        `adoption-analytics: request failed (${res.status} ${res.statusText})`,
      );
    }
    return (await res.json()) as T;
  }
}
