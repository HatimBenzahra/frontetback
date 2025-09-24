import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowLeft, Briefcase, CheckCircle, Target, Users, User, Mail, Phone, Award } from 'lucide-react';

import { Button } from '@/components/ui-admin/button';
import StatCard from '@/components/ui-admin/StatCard';
import { DataTable } from "@/components/data-table/DataTable";
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { directeurSpaceService, type ManagerStats as DirecteurManagerStats } from '@/services/directeur-space.service';
import type { Commercial } from '../commerciaux/commerciaux-table/columns';
import { createColumns as createCommerciauxColumns } from "../commerciaux/commerciaux-table/columns";
import { createEquipesColumns, type EquipeDuManager } from './managers-table/equipes-columns';
import { Modal } from '@/components/ui-admin/Modal';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';

// import { statisticsService } from '@/services/statistics.service'; // Pas nécessaire pour le directeur
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

interface ManagerDetails {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipes: EquipeDuManager[];
}

// Utilise l'interface du service directeur-space
type ManagerStats = DirecteurManagerStats;

interface PerformanceHistoryItem {
  periode: string;
  'Contrats Signés': number;
  'RDV Pris': number;
  tauxConclusion: number;
  [key: string]: string | number;
}

interface PerformanceHistoryData {
  week: PerformanceHistoryItem[];
  month: PerformanceHistoryItem[];
  year: PerformanceHistoryItem[];
}

const ManagerDetailsPage = () => {
    const { managerId } = useParams<{ managerId: string }>();
    const navigate = useNavigate();
    
    const [manager, setManager] = useState<ManagerDetails | null>(null);
    const [stats, setStats] = useState<ManagerStats | null>(null);
    const [perfHistory, setPerfHistory] = useState<PerformanceHistoryData | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
    const [loading, setLoading] = useState(true);

    // Fonction pour obtenir les données de performance selon la période sélectionnée
    const getPerformanceDataForPeriod = () => {
        if (!perfHistory) return [];
        
        switch (selectedPeriod) {
            case 'week':
                return perfHistory.week || [];
            case 'month':
                return perfHistory.month || [];
            case 'year':
                return perfHistory.year || [];
            default:
                return perfHistory.month || [];
        }
    };
    
    const [selectedTeam, setSelectedTeam] = useState<EquipeDuManager | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamRowSelection, setTeamRowSelection] = React.useState<RowSelectionState>({});

    const equipesColumns = useMemo(() => createEquipesColumns(), []);
    const commerciauxColumns = useMemo(() => {
        const allCols = createCommerciauxColumns(false, () => {});
        return allCols.filter(col => col.id !== 'manager' && col.id !== 'equipe');
    }, []);

    useEffect(() => {
        if (managerId) {
            setLoading(true);
            Promise.all([
                directeurSpaceService.getManager(managerId),
                directeurSpaceService.getManagerStats(managerId),
                directeurSpaceService.getManagerPerformanceHistory(managerId)
            ]).then(([managerData, statsData, historyData]) => {
                console.log('📊 Manager Performance History Data:', historyData);
                console.log('📊 Data length:', historyData?.week?.length || 0);
                const formattedEquipes = managerData.equipes.map((e: any) => ({
                    id: e.id,
                    nom: e.nom,
                    nbCommerciaux: e.commerciaux.length,
                    commerciaux: e.commerciaux.map((c: Commercial, index: number) => ({
                        ...c,
                        manager: `${managerData.prenom} ${managerData.nom}`,
                        managerId: managerData.id,
                        equipe: e.nom,
                        equipeId: e.id,
                        classement: index + 1,
                        telephone: c.telephone || '',
                    }))
                }));
                setManager({ ...managerData, equipes: formattedEquipes });
                
                // Utiliser directement les statistiques du service directeur-space
                const adaptedStats: ManagerStats = {
                    totalContracts: statsData?.totalContracts || 0,
                    totalRdv: statsData?.totalRdv || 0,
                    totalCommerciaux: statsData?.totalCommerciaux || 0,
                    totalEquipes: statsData?.totalEquipes || 0,
                    totalPortes: statsData?.totalPortes || 0,
                    totalProspections: statsData?.totalProspections || 0,
                    conversionRate: statsData?.conversionRate || 0
                };
                
                setStats(adaptedStats);
                setPerfHistory(historyData);
                setLoading(false);
            }).catch(err => {
                console.error("Erreur de chargement des détails du manager:", err);
                setLoading(false);
            });
        }
    }, [managerId]);

    const explanations = [
        {
            title: "À Propos de la Performance Globale",
            content: (
                <div className="text-sm text-gray-600 space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-800">Qu'est-ce que c'est ?</h4>
                        <p>Cet indicateur illustre l'évolution mensuelle du taux de conversion des RDV en contrats pour l'ensemble des équipes.</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800">Comment est-ce calculé ?</h4>
                        <p>(Contrats Signés du mois / RDV Pris du mois) * 100.</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800">À quoi ça sert ?</h4>
                        <p>Il permet de visualiser les tendances de performance et d'identifier les mois les plus productifs.</p>
                    </div>
                </div>
            )
        },
        {
            title: "À Propos du Taux de Conclusion",
            content: (
                <div className="text-sm text-gray-600 space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-800">Qu'est-ce que c'est ?</h4>
                        <p>C'est le pourcentage global de RDV qui ont abouti à un contrat signé sur toute la période.</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800">Comment est-ce calculé ?</h4>
                        <p>(Total Contrats Signés / Total RDV Pris) * 100.</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800">À quoi ça sert ?</h4>
                        <p>Il donne une mesure de l'efficacité de la conversion finale, un indicateur clé de la performance commerciale.</p>
                    </div>
                </div>
            )
        }
    ];

    const [activeExplanationIndex, setActiveExplanationIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveExplanationIndex(prevIndex => (prevIndex + 1) % explanations.length);
        }, 7000); // Change slide every 7 seconds

        return () => clearInterval(interval);
    }, []);

    const handleTeamRowClick = (equipe: EquipeDuManager) => {
        setSelectedTeam(equipe);
        setIsModalOpen(true);
    };
    
    if (loading) {
        return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={4} chartsCount={1} />;
    }
    
    if (!manager) return <div>Manager non trouvé.</div>;

    const currentStats = {
      rdvPris: stats?.totalRdv ?? 0,
      contratsSignes: stats?.totalContracts ?? 0,
      tauxConclusion: stats?.conversionRate ?? 0,
    };
    const commerciauxDeLequipeSelectionnee = manager.equipes.find((e) => e.id === selectedTeam?.id)?.commerciaux || [];

    return (
        <div className="space-y-5 p-6 pb-4 bg-gradient-to-br from-white via-green-50/60 to-green-100/30">
            {/* Header compact avec gradient */}
            <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-green-700 to-green-800 rounded-xl p-6 text-white shadow-lg">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                    {/* Bouton retour */}
                    <div className="mb-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-sm border border-white/30"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Retour aux managers
                        </Button>
                    </div>

                    {/* Informations principales du manager - Version compacte */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Avatar plus petit */}
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm border border-white/30">
                                    {manager.prenom[0]}{manager.nom[0]}
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                    <Award className="h-3 w-3 text-yellow-800" />
                                </div>
                            </div>

                            {/* Informations du manager */}
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight mb-1">
                                    {manager.prenom} {manager.nom}
                                </h1>
                                <div className="flex items-center gap-3 text-green-100 text-sm">
                                    <div className="flex items-center gap-1">
                                        <Briefcase className="h-4 w-4" />
                                        <span>Manager</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Award className="h-4 w-4" />
                                        <span>Classement N/A</span>
                                    </div>
                                </div>
                                <p className="text-green-200 mt-1 text-sm">
                                    {stats?.totalEquipes || 0} équipes • {stats?.totalCommerciaux || 0} commerciaux
                                </p>
                            </div>
                        </div>

                        {/* Métriques de performance - Version horizontale compacte */}
                        <div className="flex gap-3">
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                                <div className="text-center">
                                    <div className="text-xl font-bold text-white">
                                        {currentStats.contratsSignes || 0}
                                    </div>
                                    <div className="text-green-100 text-xs">Contrats</div>
                                </div>
                            </div>
                            
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                                <div className="text-center">
                                    <div className="text-xl font-bold text-white">
                                        {currentStats.rdvPris || 0}
                                    </div>
                                    <div className="text-green-100 text-xs">RDV</div>
                                </div>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                                <div className="text-center">
                                    <div className="text-xl font-bold text-white">
                                        {Math.round((currentStats.tauxConclusion || 0) * 100) / 100}%
                                    </div>
                                    <div className="text-green-100 text-xs">Taux</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informations Personnelles</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2">
                        <User className="h-5 w-5 text-gray-500" />
                        <span>{manager.prenom} {manager.nom}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-gray-500" />
                        <span>{manager.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Phone className="h-5 w-5 text-gray-500" />
                        <span>{manager.telephone || 'N/A'}</span>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Contrats (Total)" value={currentStats.contratsSignes} Icon={CheckCircle} color="text-emerald-500" />
                <StatCard title="RDV (Total)" value={currentStats.rdvPris} Icon={Briefcase} color="text-sky-500"/>
                <StatCard title="Taux Conclusion" value={currentStats.tauxConclusion} Icon={Target} suffix="%" color="text-amber-500"/>
                <StatCard title="Nb. Équipes" value={stats?.totalEquipes ?? manager.equipes.length} Icon={Users} color="text-yellow-500"/>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Commerciaux" value={stats?.totalCommerciaux ?? 0} Icon={User} color="text-violet-500" />
                <StatCard title="Portes Visitées" value={stats?.totalPortes ?? 0} Icon={Target} color="text-indigo-500" />
                <StatCard title="Prospections" value={stats?.totalProspections ?? 0} Icon={Target} color="text-blue-500" />
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Taux de Conversion</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-green-500" />
                            <span className="text-lg font-semibold">{Math.round((stats?.conversionRate ?? 0) * 100) / 100}%</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Performance Globale</CardTitle>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedPeriod('week')}
                                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedPeriod === 'week' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'}`}
                                >
                                    Semaine
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('month')}
                                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedPeriod === 'month' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'}`}
                                >
                                    Mois
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('year')}
                                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedPeriod === 'year' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'}`}
                                >
                                    Année
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-96">
                        {perfHistory && getPerformanceDataForPeriod().length > 0 ? (
                            <GenericLineChart 
                                data={getPerformanceDataForPeriod()} 
                                xAxisDataKey="periode" 
                                lines={[
                                    { dataKey: 'Contrats Signés', stroke: '#10b981', name: 'Contrats Signés' },
                                    { dataKey: 'RDV Pris', stroke: '#f59e0b', name: 'RDV Pris' }
                                ]} 
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Aucune donnée disponible pour cette période
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md">{explanations[activeExplanationIndex].title}</CardTitle>
                    </CardHeader>
                    <CardContent key={activeExplanationIndex} className="animate-in fade-in duration-500">
                        {explanations[activeExplanationIndex].content}
                    </CardContent>
                    <div className="flex justify-center p-4">
                        {explanations.map((_, index) => (
                            <span
                                key={index}
                                className={`h-2 w-2 rounded-full mx-1 cursor-pointer ${index === activeExplanationIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
                                onClick={() => setActiveExplanationIndex(index)}
                            />
                        ))}
                    </div>
                </Card>
            </div>
            
            <div className="space-y-4">
                <DataTable
                    columns={equipesColumns}
                    data={manager.equipes}
                    title="Équipes Managées"
                    filterColumnId="nom"
                    filterPlaceholder="Filtrer par équipe..."
                    onRowClick={handleTeamRowClick}
                    isDeleteMode={false}
                    onToggleDeleteMode={() => {}}
                    onConfirmDelete={() => {}}
                    rowSelection={teamRowSelection}
                    setRowSelection={setTeamRowSelection}
                />
            </div>

            {selectedTeam && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={`Commerciaux de l'équipe : ${selectedTeam.nom}`}
                >
                    {commerciauxDeLequipeSelectionnee.length > 0 ? (
                        <DataTable
                            columns={commerciauxColumns} data={commerciauxDeLequipeSelectionnee}
                            title=""
                            filterColumnId="nom" filterPlaceholder="Filtrer par commercial..."
                            isDeleteMode={false} onToggleDeleteMode={() => {}} rowSelection={{}} setRowSelection={() => {}} onConfirmDelete={() => {}}
                        />
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            <p>Cette équipe n'a aucun commercial pour le moment.</p>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default ManagerDetailsPage;