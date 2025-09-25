import { Settings, BarChart3, Activity, Clock, Eye, Palette, Zap, Timer, Layers, ListOrdered, Archive, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Label } from '@/components/ui-admin/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { Checkbox } from '@/components/ui-admin/checkbox';
import { Input } from '@/components/ui-admin/input';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { TimeFilterType } from '@/types/dashboard-settings';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '@/config';

const ParametresPage = () => {
  const { settings, updateSettings, isLoading } = useDashboardSettings();

  // États pour les seuils de backup
  const [backupSettings, setBackupSettings] = useState({
    maxSessions: 1000,
    maxSizeMB: 50,
    keepRecentSessions: 100
  });
  const [isSavingBackupSettings, setIsSavingBackupSettings] = useState(false);

  // Fonctions pour les paramètres de backup
  const saveBackupSettings = useCallback(async () => {
    try {
      setIsSavingBackupSettings(true);
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${API_BASE_URL}/directeur-space/transcriptions/update-backup-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(backupSettings)
      });

      if (response.ok) {
        alert('Paramètres de sauvegarde mis à jour avec succès !');
      } else {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur sauvegarde paramètres backup:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSavingBackupSettings(false);
    }
  }, [backupSettings]);

  const updateBackupSetting = useCallback((key: string, value: number) => {
    setBackupSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Charger les paramètres au montage du composant
  useEffect(() => {
    const loadBackupSettings = async () => {
      try {
        const token = localStorage.getItem('access_token');

        const response = await fetch(`${API_BASE_URL}/directeur-space/transcriptions/backup-settings`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.settings) {
            setBackupSettings(result.settings);
          }
        }
      } catch (error) {
        console.error('Erreur chargement paramètres backup:', error);
      } finally {
        // Chargement terminé
      }
    };

    loadBackupSettings();
  }, []);

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
            Paramètres Directeur
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Configurez les préférences de votre espace directeur
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
              Paramètres du Dashboard Directeur
            </CardTitle>
            <CardDescription className="text-slate-600">
              Personnalisez l'affichage et le comportement de votre tableau de bord directeur
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

        {/* Backup Settings */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg text-white">
                <Archive className="h-5 w-5" />
              </div>
              Paramètres d'Archivage Automatique
            </CardTitle>
            <CardDescription className="text-slate-600">
              Configurez les seuils de déclenchement de l'archivage automatique des transcriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">

            {/* Seuils de déclenchement */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200/50">
              <div className="flex items-center gap-2 mb-6">
                <Database className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-slate-800">Seuils de déclenchement</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Nombre maximum de sessions</Label>
                  <Input
                    type="number"
                    value={backupSettings.maxSessions}
                    onChange={(e) => updateBackupSetting('maxSessions', parseInt(e.target.value) || 1000)}
                    className="bg-white border-slate-200 hover:border-orange-300 transition-colors"
                    min="100"
                    max="10000"
                  />
                  <p className="text-xs text-slate-500">
                    Déclenche l'archivage automatique lorsque ce nombre est atteint
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Taille maximum estimée (MB)</Label>
                  <Input
                    type="number"
                    value={backupSettings.maxSizeMB}
                    onChange={(e) => updateBackupSetting('maxSizeMB', parseInt(e.target.value) || 50)}
                    className="bg-white border-slate-200 hover:border-orange-300 transition-colors"
                    min="10"
                    max="1000"
                  />
                  <p className="text-xs text-slate-500">
                    Estimation basée sur la taille moyenne des transcriptions
                  </p>
                </div>
              </div>
            </div>

            {/* Paramètres de conservation */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
              <div className="flex items-center gap-2 mb-6">
                <Timer className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Conservation des données</h3>
              </div>
              <div className="space-y-3">
                <Label className="text-slate-700 font-medium">Sessions récentes à conserver</Label>
                <Input
                  type="number"
                  value={backupSettings.keepRecentSessions}
                  onChange={(e) => updateBackupSetting('keepRecentSessions', parseInt(e.target.value) || 100)}
                  className="bg-white border-slate-200 hover:border-blue-300 transition-colors max-w-xs"
                  min="50"
                  max="500"
                />
                <p className="text-xs text-slate-500">
                  Nombre de sessions récentes à toujours garder en base de données (par sécurité)
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <button
                onClick={saveBackupSettings}
                disabled={isSavingBackupSettings}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 font-medium shadow-lg"
              >
                {isSavingBackupSettings ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
              </button>
            </div>

            {/* Informations importantes */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
              <div className="flex gap-3">
                <Archive className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <h4 className="font-semibold text-amber-800">Information importante</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1">
                    <li>L'archivage automatique se déclenche après chaque nouvelle transcription sauvegardée</li>
                    <li>Les données sont sauvegardées au format PDF sur S3 avant suppression</li>
                    <li>Les sessions les plus récentes sont toujours conservées en base</li>
                    <li>Cette opération est irréversible une fois l'archivage effectué</li>
                  </ul>
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