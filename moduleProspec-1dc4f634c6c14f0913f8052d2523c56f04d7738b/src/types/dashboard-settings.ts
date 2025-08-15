export type TimeFilterType = 'week' | 'month' | 'quarter' | 'year';

export interface ChartVisibilitySettings {
  showPerformanceChart: boolean;
  showRepassageChart: boolean;
}

export interface StatsVisibilitySettings {
  showCommercialStats: boolean;
  showManagerStats: boolean;
  showActivityFeed: boolean;
  showCommercialsProgress: boolean;
}

export interface DashboardSettings {
  defaultTimeFilter: TimeFilterType;
  autoRefresh: boolean;
  refreshInterval: number;
  chartVisibility: ChartVisibilitySettings;
  statsVisibility: StatsVisibilitySettings;
}

export const defaultDashboardSettings: DashboardSettings = {
  defaultTimeFilter: 'month',
  autoRefresh: false,
  refreshInterval: 5,
  chartVisibility: {
    showPerformanceChart: true,
    showRepassageChart: true,
  },
  statsVisibility: {
    showCommercialStats: true,
    showManagerStats: true,
    showActivityFeed: true,
    showCommercialsProgress: true,
  },
};