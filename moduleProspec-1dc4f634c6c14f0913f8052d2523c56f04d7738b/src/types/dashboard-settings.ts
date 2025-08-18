export type TimeFilterType = 'week' | 'month' | 'quarter' | 'year';

export interface ChartVisibilitySettings {
  showPerformanceChart: boolean;
  showRepassageChart: boolean;
  showChartsSection: boolean;
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
  chartDefaultPeriod: 'week' | 'month' | 'year';
  activityItemsPerPage: number;
  showCountdownCard: boolean;
  statisticsDefaultPeriod: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
}

export const defaultDashboardSettings: DashboardSettings = {
  defaultTimeFilter: 'month',
  autoRefresh: false,
  refreshInterval: 5,
  chartVisibility: {
    showPerformanceChart: true,
    showRepassageChart: true,
    showChartsSection: true,
  },
  statsVisibility: {
    showCommercialStats: true,
    showManagerStats: true,
    showActivityFeed: true,
    showCommercialsProgress: true,
  },
  chartDefaultPeriod: 'week',
  activityItemsPerPage: 5,
  showCountdownCard: true,
  statisticsDefaultPeriod: 'MONTHLY',
};