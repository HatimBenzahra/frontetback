import { useEffect, useState, useMemo } from 'react';
import { statisticsService } from '@/services/statistics.service';
import { zoneService } from '@/services/zone.service';
import type { ZoneFromApi } from '@/services/zone.service';
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Building, Calendar, CheckCircle, XCircle, DoorOpen, Percent, Handshake, Phone, MessageSquare, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Combobox } from '@/components/ui-admin/Combobox';
import type { DateRange } from 'react-day-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui-admin/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui-admin/skeleton';

interface HistoryEntry {
  id: string;
  adresse: string;
  ville: string;
  dateProspection: string;
  nbPortesVisitees: number;
  nbContratsSignes: number;
  nbRdvPris: number;
  nbRefus: number;
  nbAbsents: number;
  nbCurieux: number;
  commentaire: string;
  tauxCouverture: number;
  immeuble: { zoneId: string | null };
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


const PageSkeleton = () => (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
            <Skeleton className="h-10 w-1/3 bg-slate-200 rounded-lg mb-6" />
            <Skeleton className="h-24 w-full rounded-xl bg-slate-200 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl bg-slate-200" />)}
            </div>
        </div>
    </div>
);

const StatItem = ({ icon: Icon, label, value, colorClass }: { icon: React.ElementType, label: string, value: string | number, colorClass: string }) => (
    <div className="flex items-center p-3 bg-slate-100 rounded-lg">
        <Icon className={cn("h-5 w-5 mr-3 flex-shrink-0", colorClass)} />
        <div>
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

const HistoriquePage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [zones, setZones] = useState<ZoneFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY' | null>('MONTHLY');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const [historyData, zonesData] = await Promise.all([
            statisticsService.getCommercialHistory(user.id),
            zoneService.getZones(),
          ]);
          setHistory(historyData);
          setZones(zonesData);
          setError(null);
        } catch (err) {
          setError("Erreur lors de la récupération des données.");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const now = new Date();
    if (selectedPeriod === 'WEEK') {
      setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
    } else if (selectedPeriod === 'MONTH') {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else if (selectedPeriod === 'YEAR') {
      setDateRange({ from: startOfYear(now), to: endOfYear(now) });
    } else {
      setDateRange(undefined);
    }
  }, [selectedPeriod]);

  const zoneOptions = useMemo(() => {
    return zones.map(zone => ({ value: zone.id, label: zone.nom }));
  }, [zones]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = new Date(item.dateProspection);
      const inDateRange = !dateRange || (dateRange.from && dateRange.to && itemDate >= dateRange.from && itemDate <= dateRange.to);
      const isZoneMatch = !selectedZone || (item.immeuble && item.immeuble.zoneId === selectedZone);
      return inDateRange && isZoneMatch;
    });
  }, [history, dateRange, selectedZone]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <div className="text-center py-10 text-red-600 bg-red-50 h-screen flex items-center justify-center">{error}</div>;

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen">
        <motion.div
            className="space-y-8 max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            

            <motion.div variants={itemVariants}>
                <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-4">
                        <div className="w-full md:w-64">
                            <Combobox
                                options={zoneOptions}
                                value={selectedZone}
                                onChange={setSelectedZone}
                                placeholder="Filtrer par zone..."
                                emptyMessage="Aucune zone trouvée."
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                            {(['WEEK', 'MONTH', 'YEAR'] as const).map(period => (
                                <Button
                                    key={period}
                                    variant='ghost'
                                    onClick={() => setSelectedPeriod(period)}
                                    className={cn(
                                        "px-3 py-1.5 text-sm rounded-md font-semibold transition-colors duration-200",
                                        selectedPeriod === period
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-200/60'
                                    )}
                                >{
                                    {WEEK: 'Semaine', MONTH: 'Mois', YEAR: 'Année'}[period]
                                }</Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {paginatedHistory.length === 0 ? (
                <motion.div variants={itemVariants} className="text-center py-20 col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <Search className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                    <p className="text-xl font-semibold text-slate-800">Aucun historique trouvé</p>
                    <p className="text-slate-500 mt-2">Aucune prospection ne correspond à vos filtres pour cette période.</p>
                </motion.div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedHistory.map((item) => (
                            <motion.div
                                key={item.id}
                                variants={itemVariants}
                                className="w-full h-full"
                            >
                                <Card className="flex flex-col h-full rounded-2xl bg-white text-card-foreground shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                    <CardHeader className="pt-5 pb-4 px-5 bg-slate-50 rounded-t-2xl border-b border-slate-200">
                                        <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                                            <Building className="h-6 w-6 text-blue-500 flex-shrink-0" />
                                            <span className="truncate">{item.adresse}, {item.ville}</span>
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 text-sm text-slate-500 pt-1">
                                            <Calendar className="h-4 w-4" />
                                            {format(new Date(item.dateProspection), 'd MMMM yyyy', { locale: fr })}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 flex-grow">
                                        <StatItem icon={DoorOpen} label="Portes visitées" value={item.nbPortesVisitees} colorClass="text-blue-500" />
                                        <StatItem icon={Percent} label="Couverture" value={`${Number(item.tauxCouverture).toFixed(1)}%`} colorClass="text-purple-500" />
                                        <StatItem icon={Handshake} label="Contrats" value={item.nbContratsSignes} colorClass="text-emerald-500" />
                                        <StatItem icon={Phone} label="RDV" value={item.nbRdvPris} colorClass="text-orange-500" />
                                        <StatItem icon={XCircle} label="Refus" value={item.nbRefus} colorClass="text-red-500" />
                                        <StatItem icon={CheckCircle} label="Absents" value={item.nbAbsents} colorClass="text-slate-500" />
                                        <StatItem icon={MessageSquare} label="Curieux" value={item.nbCurieux} colorClass="text-sky-500" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <motion.div variants={itemVariants} className="flex justify-center items-center space-x-3 mt-8">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="h-9 w-9 rounded-full bg-white shadow-sm border-slate-200 hover:bg-slate-100"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-sm font-medium text-slate-700">
                                Page {currentPage} sur {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="h-9 w-9 rounded-full bg-white shadow-sm border-slate-200 hover:bg-slate-100"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </motion.div>
                    )}
                </>
            )}
        </motion.div>
    </div>
  );
};

export default HistoriquePage;