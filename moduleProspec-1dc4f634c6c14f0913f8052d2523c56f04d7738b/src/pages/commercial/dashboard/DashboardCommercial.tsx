import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { statisticsService } from '@/services/statistics.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { immeubleService, type ImmeubleFromApi } from '@/services/immeuble.service';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// --- Composants UI ---
import StatCard from '@/components/ui-admin/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { CheckCircle, DoorOpen, MapPin, ZapOff, Percent, Building, ArrowRight, History } from 'lucide-react';
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { ZoneFocusMap } from './ZoneFocusMap';
import { GoalProgressCard } from '@/components/ui-commercial/GoalProgressCard';
import { Skeleton } from '@/components/ui-admin/skeleton';

// --- Types ---
interface ZoneData {
    id: string;
    nom: string;
    latitude: number;
    longitude: number;
    rayonMetres: number;
    couleur: string;
}

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// --- Composant Squelette ---
const DashboardSkeleton = () => (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen">
        <Skeleton className="h-10 w-1/3 bg-slate-200 rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
                <Skeleton className="h-96 w-full rounded-xl bg-slate-200" />
                <Skeleton className="h-96 w-full rounded-xl bg-slate-200" />
            </div>
            <div className="xl:col-span-1 space-y-8">
                <Skeleton className="h-60 w-full rounded-xl bg-slate-200" />
                <Skeleton className="h-60 w-full rounded-xl bg-slate-200" />
            </div>
        </div>
    </div>
);

// --- Composant pour Zone non assignée ---
const NoZoneAssigned = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-100 rounded-2xl">
        <ZapOff className="mx-auto h-16 w-16 text-slate-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Aucune zone de prospection</h2>
        <p className="text-slate-500 mt-2 max-w-sm">
            Contactez votre manager pour obtenir une assignation.
        </p>
    </div>
);

const CommercialDashboardPage = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [assignedZone, setAssignedZone] = useState<ZoneData | null>(null);
    const [immeubles, setImmeubles] = useState<ImmeubleFromApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !user.id) {
                setError('ID du commercial non disponible.');
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const [statsData, historyData, zonesData, immeublesData] = await Promise.all([
                    statisticsService.getStatsForCommercial(user.id),
                    statisticsService.getCommercialHistory(user.id),
                    assignmentGoalsService.getAssignedZonesForCommercial(user.id),
                    immeubleService.getImmeublesForCommercial(user.id),
                ]);
                setStats(statsData);
                setHistory(historyData);
                setAssignedZone(zonesData.length > 0 ? zonesData[0] : null);
                setImmeubles(immeublesData);
            } catch (err) {
                console.error('Erreur lors du chargement des données du commercial:', err);
                setError('Erreur lors du chargement de vos données.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const activitePortesData = history
        .map((item: any) => ({
            name: new Date(item.dateProspection).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            'Portes Visitées': item.nbPortesVisitees,
            'RDV Pris': item.nbRdvPris,
            'Contrats Signés': item.nbContratsSignes,
        }))
        .reverse();

    if (loading) return <DashboardSkeleton />;
    if (error) return <div className="text-center py-10 text-red-600 bg-red-50 h-screen flex items-center justify-center">{error}</div>;

    const currentStats = stats?.kpis || {};

    const QuickAccessButton = ({ to, icon: Icon, text }: { to: string, icon: React.ElementType, text: string }) => (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <button
                className="w-full text-left flex items-center gap-4 p-4 rounded-xl bg-slate-100 hover:bg-blue-100 group transition-colors duration-200"
                onClick={() => navigate(to)}
            >
                <div className="p-2 rounded-full bg-white group-hover:bg-blue-200 transition-colors duration-200">
                    <Icon className="h-5 w-5 text-blue-500" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-blue-800">{text}</span>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
        </motion.div>
    );

    return (
        <div className="bg-slate-50 text-slate-800 min-h-screen">
            <motion.div
                className="space-y-8 max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                

                {/* KPIs */}
                <motion.div variants={itemVariants} className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Immeubles Visitées" value={currentStats.immeublesVisites || 0} Icon={Building} color="text-blue-500" />
                    <StatCard title="Portes Visitées" value={currentStats.portesVisitees || 0} Icon={DoorOpen} color="text-orange-500" />
                    <StatCard title="Contrats Signés" value={currentStats.contratsSignes || 0} Icon={CheckCircle} color="text-emerald-500" />
                    <StatCard title="Taux de Conversion" value={currentStats.tauxDeConversion || 0} Icon={Percent} color="text-purple-500" suffix="%" />
                </motion.div>

                {/* Grille principale */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Colonne principale */}
                    <div className="xl:col-span-2 space-y-8">
                        <motion.div variants={itemVariants}>
                            <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-slate-900">Activité de Prospection</CardTitle>
                                    <CardDescription>Évolution de vos visites, RDV et contrats.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[350px] pt-4">
                                    <GenericLineChart
                                        data={activitePortesData}
                                        xAxisDataKey="name"
                                        lines={[
                                            { dataKey: 'Portes Visitées', name: 'Portes', stroke: '#3b82f6' },
                                            { dataKey: 'RDV Pris', name: 'RDV', stroke: '#f97316' },
                                            { dataKey: 'Contrats Signés', name: 'Contrats', stroke: '#10b981' },
                                        ]}
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                             <Card className="h-[450px] w-full overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-2">
                                {assignedZone ? (
                                    <ZoneFocusMap
                                        zone={{
                                            nom: assignedZone.nom,
                                            latlng: [assignedZone.latitude, assignedZone.longitude],
                                            radius: assignedZone.rayonMetres,
                                            color: assignedZone.couleur,
                                        }}
                                        immeubles={immeubles}
                                    />
                                ) : (
                                    <NoZoneAssigned />
                                )}
                            </Card>
                        </motion.div>
                    </div>

                    {/* Colonne latérale */}
                    <div className="xl:col-span-1 space-y-8">
                        <motion.div variants={itemVariants}>
                            <GoalProgressCard
                                title="Objectif du Mois"
                                description="Progression de votre objectif de contrats."
                                value={currentStats.contratsSignes || 0}
                                total={currentStats.objectifMensuel || 0}
                            />
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-slate-900">Accès Rapide</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <QuickAccessButton to="/commercial/prospecting" icon={MapPin} text="Lancer une Prospection" />
                                    <QuickAccessButton to="/commercial/history" icon={History} text="Voir mon Historique" />
                                    <QuickAccessButton to="/commercial/immeubles" icon={Building} text="Gérer mes Immeubles" />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default CommercialDashboardPage;