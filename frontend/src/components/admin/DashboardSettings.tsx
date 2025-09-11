import { Settings, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Label } from '@/components/ui-admin/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { Checkbox } from '@/components/ui-admin/checkbox';
import { Button } from '@/components/ui-admin/button';
import { Separator } from '@/components/ui-admin/separator';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { TimeFilterType } from '@/types/dashboard-settings';

export const DashboardSettings = () => {
  const { settings, updateSettings, resetSettings, isLoading } = useDashboardSettings();

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-gray-100 rounded-lg" />;
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Paramètres du Dashboard
        </CardTitle>
        <CardDescription>
          Personnalisez l'affichage et le comportement de votre tableau de bord
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Time Filter Settings */}
        <div className="space-y-2">
          <Label htmlFor="timeFilter">Période par défaut</Label>
          <Select 
            value={settings.defaultTimeFilter} 
            onValueChange={(value: TimeFilterType) => updateSettings({ defaultTimeFilter: value })}
          >
            <SelectTrigger>
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

        <Separator />

        {/* Auto-refresh Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoRefresh"
              checked={settings.autoRefresh}
              onCheckedChange={(checked) => updateSettings({ autoRefresh: !!checked })}
            />
            <Label htmlFor="autoRefresh">Actualisation automatique</Label>
          </div>
          
          {settings.autoRefresh && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="refreshInterval">Intervalle d'actualisation</Label>
              <Select 
                value={settings.refreshInterval.toString()} 
                onValueChange={(value) => updateSettings({ refreshInterval: parseInt(value) })}
              >
                <SelectTrigger className="w-48">
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

        <Separator />

        {/* Chart Visibility Settings */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Affichage des graphiques</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showPerformanceChart"
                checked={settings.chartVisibility.showPerformanceChart}
                onCheckedChange={(checked) => updateSettings({ 
                  chartVisibility: { ...settings.chartVisibility, showPerformanceChart: !!checked }
                })}
              />
              <Label htmlFor="showPerformanceChart">Graphique de performance</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showRepassageChart"
                checked={settings.chartVisibility.showRepassageChart}
                onCheckedChange={(checked) => updateSettings({ 
                  chartVisibility: { ...settings.chartVisibility, showRepassageChart: !!checked }
                })}
              />
              <Label htmlFor="showRepassageChart">Graphique des repassages</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Stats Visibility Settings */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Affichage des statistiques</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showCommercialStats"
                checked={settings.statsVisibility.showCommercialStats}
                onCheckedChange={(checked) => updateSettings({ 
                  statsVisibility: { ...settings.statsVisibility, showCommercialStats: !!checked }
                })}
              />
              <Label htmlFor="showCommercialStats">Indicateurs commerciaux</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showManagerStats"
                checked={settings.statsVisibility.showManagerStats}
                onCheckedChange={(checked) => updateSettings({ 
                  statsVisibility: { ...settings.statsVisibility, showManagerStats: !!checked }
                })}
              />
              <Label htmlFor="showManagerStats">Indicateurs managers</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showActivityFeed"
                checked={settings.statsVisibility.showActivityFeed}
                onCheckedChange={(checked) => updateSettings({ 
                  statsVisibility: { ...settings.statsVisibility, showActivityFeed: !!checked }
                })}
              />
              <Label htmlFor="showActivityFeed">Flux d'activité récent</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showCommercialsProgress"
                checked={settings.statsVisibility.showCommercialsProgress}
                onCheckedChange={(checked) => updateSettings({ 
                  statsVisibility: { ...settings.statsVisibility, showCommercialsProgress: !!checked }
                })}
              />
              <Label htmlFor="showCommercialsProgress">Progress bars des commerciaux</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Reset Button */}
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={resetSettings}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};