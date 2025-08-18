import { Settings, RotateCcw, BarChart3, Activity, Clock, Eye, Palette, Zap, Timer, Layers, ListOrdered } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Label } from '@/components/ui-admin/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { Checkbox } from '@/components/ui-admin/checkbox';
import { Button } from '@/components/ui-admin/button';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { TimeFilterType } from '@/types/dashboard-settings';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

const ParametresPage = () => {
  const { settings, updateSettings, resetSettings, isLoading } = useDashboardSettings();

  if (isLoading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={3} />;
  }

  const timeFilterOptions: { value: TimeFilterType; label: string }[] = [
    { value: 'week', label: 'Semaine actuelle' },
    { value: 'month', label: 'Mois actuel' },
    { value: 'quarter', label: 'Trimestre actuel' },
    { value: 'year', label: 'Année actuelle' },
  ];

  const refreshIntervals = [
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 30, label: '30 minutes' },
  ];

  const chartPeriods = [
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
    { value: 'year', label: 'Année' },
  ];

  const activityPageSizes = [5, 10, 15, 20];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg">
              <Settings className="h-8 w-8" />
            </div>
            Paramètres
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Configurez les préférences de votre espace d'administration
          </p>
        </div>
      </header>

      <div className="grid gap-8 max-w-5xl">
        {/* Dashboard Settings */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white">
                <BarChart3 className="h-5 w-5" />
              </div>
              Paramètres du Dashboard
            </CardTitle>
            <CardDescription className="text-slate-600">
              Personnalisez l'affichage et le comportement de votre tableau de bord
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-6">
            
            {/* Time Filter Settings */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200/50">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Préférences temporelles</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="timeFilter" className="text-slate-700 font-medium">Période par défaut</Label>
                  <Select 
                    value={settings.defaultTimeFilter} 
                    onValueChange={(value: TimeFilterType) => updateSettings({ defaultTimeFilter: value })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 hover:border-blue-300 transition-colors">
                      <SelectValue placeholder="Sélectionner une période" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeFilterOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-refresh Settings */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Checkbox 
                      id="autoRefresh"
                      checked={settings.autoRefresh}
                      onCheckedChange={(checked) => updateSettings({ autoRefresh: !!checked })}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label htmlFor="autoRefresh" className="text-slate-700 font-medium cursor-pointer">
                      Actualisation automatique
                    </Label>
                    <Zap className="h-4 w-4 text-blue-600" />
                  </div>
                  
                  {settings.autoRefresh && (
                    <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                      <Label htmlFor="refreshInterval" className="text-slate-700 font-medium">Intervalle d'actualisation</Label>
                      <Select 
                        value={settings.refreshInterval.toString()} 
                        onValueChange={(value) => updateSettings({ refreshInterval: parseInt(value) })}
                      >
                        <SelectTrigger className="bg-white border-slate-200 hover:border-blue-300 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {refreshIntervals.map(interval => (
                            <SelectItem key={interval.value} value={interval.value.toString()}>
                              {interval.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dashboard - Affichage avancé */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Affichage du Dashboard</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Période par défaut des graphiques</Label>
                  <Select 
                    value={settings.chartDefaultPeriod}
                    onValueChange={(value) => updateSettings({ chartDefaultPeriod: value as any })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 hover:border-blue-300 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {chartPeriods.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Éléments par page (activité récente)</Label>
                  <Select 
                    value={settings.activityItemsPerPage.toString()}
                    onValueChange={(value) => updateSettings({ activityItemsPerPage: parseInt(value) })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 hover:border-blue-300 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activityPageSizes.map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                    <Checkbox 
                      id="showCountdownCard"
                      checked={settings.showCountdownCard}
                      onCheckedChange={(checked) => updateSettings({ showCountdownCard: !!checked })}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Timer className="h-5 w-5 text-blue-600" />
                    <Label htmlFor="showCountdownCard" className="text-slate-700 font-medium cursor-pointer">Afficher la carte de compte à rebours (Objectif global)</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Visibility Settings */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200/50">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-slate-800">Affichage des graphiques</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showChartsSection"
                    checked={settings.chartVisibility.showChartsSection}
                    onCheckedChange={(checked) => updateSettings({ 
                      chartVisibility: { ...settings.chartVisibility, showChartsSection: !!checked }
                    })}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <Label htmlFor="showChartsSection" className="text-slate-700 font-medium cursor-pointer">Section Analyses de Performance</Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showPerformanceChart"
                    checked={settings.chartVisibility.showPerformanceChart}
                    onCheckedChange={(checked) => updateSettings({ 
                      chartVisibility: { ...settings.chartVisibility, showPerformanceChart: !!checked }
                    })}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <Label htmlFor="showPerformanceChart" className="text-slate-700 font-medium cursor-pointer">Graphique de performance globale</Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showRepassageChart"
                    checked={settings.chartVisibility.showRepassageChart}
                    onCheckedChange={(checked) => updateSettings({ 
                      chartVisibility: { ...settings.chartVisibility, showRepassageChart: !!checked }
                    })}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Activity className="h-5 w-5 text-green-600" />
                  <Label htmlFor="showRepassageChart" className="text-slate-700 font-medium cursor-pointer">Graphique des repassages</Label>
                </div>
              </div>
            </div>

            {/* Statistiques - Préférences */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200/50">
              <div className="flex items-center gap-2 mb-6">
                <ListOrdered className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-800">Statistiques</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Période par défaut de la page Statistiques</Label>
                  <Select 
                    value={settings.statisticsDefaultPeriod}
                    onValueChange={(value) => updateSettings({ statisticsDefaultPeriod: value as any })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 hover:border-blue-300 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Cette semaine</SelectItem>
                      <SelectItem value="MONTHLY">Ce mois</SelectItem>
                      <SelectItem value="YEARLY">Cette année</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Stats Visibility Settings */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200/50">
              <div className="flex items-center gap-2 mb-6">
                <Eye className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-800">Affichage des statistiques</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showCommercialStats"
                    checked={settings.statsVisibility.showCommercialStats}
                    onCheckedChange={(checked) => updateSettings({ 
                      statsVisibility: { ...settings.statsVisibility, showCommercialStats: !!checked }
                    })}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <Label htmlFor="showCommercialStats" className="text-slate-700 font-medium cursor-pointer">Indicateurs commerciaux</Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showManagerStats"
                    checked={settings.statsVisibility.showManagerStats}
                    onCheckedChange={(checked) => updateSettings({ 
                      statsVisibility: { ...settings.statsVisibility, showManagerStats: !!checked }
                    })}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <Settings className="h-5 w-5 text-purple-600" />
                  <Label htmlFor="showManagerStats" className="text-slate-700 font-medium cursor-pointer">Indicateurs managers</Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showActivityFeed"
                    checked={settings.statsVisibility.showActivityFeed}
                    onCheckedChange={(checked) => updateSettings({ 
                      statsVisibility: { ...settings.statsVisibility, showActivityFeed: !!checked }
                    })}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <Activity className="h-5 w-5 text-purple-600" />
                  <Label htmlFor="showActivityFeed" className="text-slate-700 font-medium cursor-pointer">Flux d'activité récent</Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                  <Checkbox 
                    id="showCommercialsProgress"
                    checked={settings.statsVisibility.showCommercialsProgress}
                    onCheckedChange={(checked) => updateSettings({ 
                      statsVisibility: { ...settings.statsVisibility, showCommercialsProgress: !!checked }
                    })}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <Label htmlFor="showCommercialsProgress" className="text-slate-700 font-medium cursor-pointer">Progress bars des commerciaux</Label>
                </div>
              </div>
            </div>


          </CardContent>
        </Card>


      </div>
    </div>
  );
};

export default ParametresPage;