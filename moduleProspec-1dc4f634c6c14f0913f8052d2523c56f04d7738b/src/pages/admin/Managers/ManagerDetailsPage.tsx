import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowLeft, Briefcase, CheckCircle, Target, Users, User, Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui-admin/button';
import { Skeleton } from '@/components/ui-admin/skeleton';
import StatCard from '@/components/ui-admin/StatCard';
import { DataTable } from "@/components/data-table/DataTable";
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { managerService } from '@/services/manager.service';
import type { Commercial } from '../commerciaux/commerciaux-table/columns';
import { createColumns as createCommerciauxColumns } from "../commerciaux/commerciaux-table/columns";
import { createEquipesColumns, type EquipeDuManager } from './managers-table/equipes-columns';
import { Modal } from '@/components/ui-admin/Modal';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';

import { statisticsService } from '@/services/statistics.service';

interface ManagerDetails {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipes: EquipeDuManager[];
}

interface ManagerStats {
  contratsSignes: number;
  rdvPris: number;
  tauxConclusion: number;
}

interface PerformanceHistoryItem {
  name: string;
  performance: number;
  [key: string]: string | number;
}

const ManagerDetailsPage = () => {
    const { managerId } = useParams<{ managerId: string }>();
    const navigate = useNavigate();
    
    const [manager, setManager] = useState<ManagerDetails | null>(null);
    const [stats, setStats] = useState<ManagerStats | null>(null);
    const [perfHistory, setPerfHistory] = useState<PerformanceHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedTeam, setSelectedTeam] = useState<EquipeDuManager | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamRowSelection, setTeamRowSelection] = React.useState<RowSelectionState>({});

    const equipesColumns = useMemo(() => createEquipesColumns(), []);
    const commerciauxColumns = useMemo(() => {
        const allCols = createCommerciauxColumns(false, () => {}, managerId);
        return allCols.filter(col => col.id !== 'manager' && col.id !== 'equipe');
    }, [managerId]);

    useEffect(() => {
        if (managerId) {
            setLoading(true);
            Promise.all([
                managerService.getManagerDetails(managerId),
                statisticsService.getStatsForManager(managerId),
                statisticsService.getManagerPerformanceHistory(managerId)
            ]).then(([managerData, statsData, historyData]) => {
                console.log('📊 Manager Performance History Data:', historyData);
                console.log('📊 Data length:', historyData?.length);
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
                setStats(statsData);
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
        return (
            <div className="space-y-6 animate-pulse">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-24 w-full" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28 rounded-lg" /><Skeleton className="h-28 rounded-lg" />
                    <Skeleton className="h-28 rounded-lg" /><Skeleton className="h-28 rounded-lg" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    if (!manager) return <div>Manager non trouvé.</div>;

    const currentStats = {
      rdvPris: stats?.rdvPris ?? 0,
      contratsSignes: stats?.contratsSignes ?? 0,
      tauxConclusion: stats?.tauxConclusion ?? 0,
    };
    const commerciauxDeLequipeSelectionnee = manager.equipes.find((e) => e.id === selectedTeam?.id)?.commerciaux || [];

    return (
        <div className="space-y-8">
            <Button variant="outline" onClick={() => navigate('/admin/managers')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour
            </Button>
            

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
                <StatCard title="Nb. Équipes" value={manager.equipes.length} Icon={Users} color="text-yellow-500"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Performance Globale</CardTitle>
                    </CardHeader>
                    <CardContent className="h-96">
                        <GenericLineChart 
                            data={perfHistory} 
                            xAxisDataKey="name" 
                            lines={[{ dataKey: 'performance', stroke: '#3b82f6', name: 'Performance (%)' }]} 
                        />
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