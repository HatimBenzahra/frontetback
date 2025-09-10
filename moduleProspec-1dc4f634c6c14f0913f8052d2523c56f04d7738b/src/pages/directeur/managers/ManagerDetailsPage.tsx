import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, CheckCircle, Target, Users, User, Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui-admin/button';
import StatCard from '@/components/ui-admin/StatCard';
import { DataTable } from "@/components/data-table/DataTable";
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { directeurSpaceService, type DirecteurManager, type ManagerStats as DirecteurManagerStats } from '@/services/directeur-space.service';
import { createEquipesColumns } from './managers-table/equipes-columns';
import { Modal } from '@/components/ui-admin/Modal';


import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';


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
    
    const [manager, setManager] = useState<DirecteurManager | null>(null);
    const [stats, setStats] = useState<DirecteurManagerStats | null>(null);
    const [perfHistory, setPerfHistory] = useState<PerformanceHistoryData | null>(null);
    const [loading, setLoading] = useState(true);

    // Fonction pour obtenir les données de performance selon la période sélectionnée
    const getPerformanceDataForPeriod = () => {
        if (!perfHistory) return [];
        
        // Utiliser les données mensuelles par défaut
        return perfHistory.month || [];
    };
    
    const [isModalOpen, setIsModalOpen] = useState(false);

    const equipesColumns = useMemo(() => createEquipesColumns(), []);

    useEffect(() => {
        if (managerId) {
            setLoading(true);
            Promise.all([
                directeurSpaceService.getManager(managerId),
                directeurSpaceService.getManagerStats(managerId),
                directeurSpaceService.getManagerPerformanceHistory(managerId)
            ]).then(([managerData, statsData, historyData]) => {
                setManager(managerData);
                setStats(statsData);
                setPerfHistory(historyData);
            }).catch(error => {
                console.error("Erreur lors de la récupération des données:", error);
                setManager(null);
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [managerId]);

    if (loading) {
        return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={4} chartsCount={1} />;
    }

    if (!manager) {
        return <div>Manager non trouvé ou erreur de chargement.</div>;
    }

    return (
        <div className="space-y-8">
            <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la liste des managers
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <User className="h-8 w-8 text-primary" />
                    {manager.prenom} {manager.nom}
                </h1>
                <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {manager.email}
                    </div>
                    {manager.telephone && (
                        <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {manager.telephone}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Contrats Signés" value={stats?.totalContracts || 0} Icon={CheckCircle} color="text-emerald-500" />
                <StatCard title="RDV Pris" value={stats?.totalRdv || 0} Icon={Briefcase} color="text-sky-500"/>
                <StatCard title="Commerciaux" value={stats?.totalCommerciaux || 0} Icon={Users} color="text-blue-500"/>
                <StatCard title="Équipes" value={stats?.totalEquipes || 0} Icon={Target} color="text-purple-500"/>
            </div>

            <GenericLineChart
                data={getPerformanceDataForPeriod()}
                xAxisDataKey="periode"
                lines={[
                    { dataKey: 'Contrats Signés', stroke: 'hsl(var(--chart-1))', name: 'Contrats Signés' },
                    { dataKey: 'RDV Pris', stroke: 'hsl(var(--chart-2))', name: 'RDV Pris' }
                ]}
            />

            <DataTable 
                columns={equipesColumns as any} 
                data={manager.equipes} 
                title={`Équipes gérées (${manager.equipes.length})`}
                filterColumnId="nom"
                filterPlaceholder="Filtrer par nom d'équipe..."
                addEntityButtonText="Ajouter une équipe"
                onAddEntity={() => setIsModalOpen(true)}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Ajouter une équipe au manager"
            >
                <div className="space-y-4">
                    <p>Fonctionnalité d'ajout d'équipe à implémenter.</p>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Fermer
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ManagerDetailsPage;