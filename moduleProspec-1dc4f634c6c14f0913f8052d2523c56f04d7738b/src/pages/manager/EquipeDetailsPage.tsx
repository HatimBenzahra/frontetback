import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Badge } from "@/components/ui-admin/badge";
import { ArrowLeft, Users, CheckCircle, Briefcase, Target, Trophy, Flag, Mail, Eye } from "lucide-react";
import StatCard from "@/components/ui-admin/StatCard";
import { GenericLineChart } from "@/components/charts/GenericLineChart";
import { equipeService, type EquipeDetailsFromApi } from "@/services/equipe.service";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import type { Commercial } from "@/types/types";

const EquipeDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumb();
  const [equipeDetails, setEquipeDetails] = useState<EquipeDetailsFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      equipeService.getEquipeDetails(id)
        .then(data => {
          setEquipeDetails(data);
          setError(null);
        })
        .catch(error => {
          console.error("Erreur lors de la récupération des données:", error);
          setError('Erreur lors du chargement des données');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  useEffect(() => {
    if (equipeDetails) {
      setBreadcrumbs([
        { label: 'Espace Manager', path: '/manager' },
        { label: 'Mes Équipes', path: '/manager/equipes' },
        { label: equipeDetails.nom, path: `/manager/equipes/${equipeDetails.id}` }
      ]);
    }
  }, [setBreadcrumbs, equipeDetails]);

  const commerciauxColumns = useMemo(() => [
    {
      accessorKey: "nom",
      header: "Nom",
      cell: ({ row }: any) => <div className="font-medium">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "prenom",
      header: "Prénom",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }: any) => (
        <a href={`mailto:${row.getValue("email")}`} className="flex items-center gap-2 hover:underline">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {row.getValue("email")}
        </a>
      )
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
      cell: ({ row }: any) => {
        const telephone = row.getValue("telephone");
        if (!telephone) {
          return <span className="text-slate-500">Non renseigné</span>;
        }
        return (
          <a href={`tel:${telephone}`} className="hover:underline">
            {telephone}
          </a>
        );
      }
    },
    {
      accessorKey: "totalContratsSignes",
      header: "Contrats",
      cell: ({ row }: any) => {
        const contrats = row.getValue("totalContratsSignes") || 0;
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {contrats}
          </Badge>
        );
      },
    },
    {
      accessorKey: "totalRdv",
      header: "RDV",
      cell: ({ row }: any) => {
        const rdv = row.getValue("totalRdv") || 0;
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {rdv}
          </Badge>
        );
      },
    },
    {
      accessorKey: "tauxConversion",
      header: "Taux Conv.",
      cell: ({ row }: any) => {
        const taux = row.getValue("tauxConversion") || 0;
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {taux}%
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        const commercial = row.original;
        return (
          <div className="text-right">
            <Link 
              to={`/manager/commerciaux/${commercial.id}`} 
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="h-4 w-4" />
            </Link>
          </div>
        );
      },
    },
  ], []);

  const handleBackClick = () => {
    navigate('/manager/equipes');
  };

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={4} chartsCount={1} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <p className="text-lg font-semibold">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!equipeDetails) {
    return <div>Équipe non trouvée ou erreur de chargement.</div>;
  }

  return (
    <div className="space-y-8 bg-gradient-to-br from-white via-green-50/60 to-green-100/30 p-4 sm:p-6 rounded-2xl border border-green-100">
      {/* Header avec bouton retour */}
      <div className="flex items-center animate-in fade-in duration-500 border-b border-green-100/70 pb-4">
        <Button variant="outline" size="icon" onClick={handleBackClick} className="mr-4">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-600/90 text-white flex items-center justify-center shadow-lg">
            <Flag className="h-5 w-5"/>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
              Équipe {equipeDetails.nom}
            </h1>
            <p className="text-sm text-zinc-600">Manager : {equipeDetails.manager}</p>
          </div>
        </div>
      </div>
      
      {/* Statistiques principales */}
      <section className="animate-in fade-in-0 [animation-delay:100ms] duration-500">
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Performance de l'équipe</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Contrats Signés" value={equipeDetails.stats.contratsSignes} Icon={CheckCircle} color="text-emerald-500" />
          <StatCard title="RDV Pris" value={equipeDetails.stats.rdvPris} Icon={Briefcase} color="text-sky-500"/>
          <StatCard title="Performance Moyenne" value={equipeDetails.stats.perfMoyenne} Icon={Target} suffix="%" color="text-amber-500"/>
          <StatCard title="Classement Général" value={Number(equipeDetails.stats.classementGeneral)} Icon={Trophy} prefix="#" color="text-yellow-500"/>
        </div>
      </section>

      {/* Graphique de performance */}
      <section className="animate-in fade-in-0 [animation-delay:200ms] duration-500">
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Évolution de la performance</h3>
        <div className="bg-white p-4 rounded-xl border border-green-100">
          <GenericLineChart
            data={equipeDetails.perfHistory}
            xAxisDataKey="name"
            lines={[{ dataKey: 'perf', stroke: 'hsl(var(--chart-2))', name: 'Performance (%)' }]}
          />
        </div>
      </section>

      {/* Tableau des commerciaux */}
      <section className="animate-in fade-in-0 [animation-delay:300ms] duration-500">
        <DataTable 
          columns={commerciauxColumns as any} 
          data={equipeDetails.commerciaux} 
          title={`Membres de l'équipe (${equipeDetails.commerciaux.length})`}
          filterColumnId="nom"
          filterPlaceholder="Filtrer par nom de commercial..."
          isDeleteMode={false}
          onToggleDeleteMode={() => {}}
          rowSelection={{}}
          setRowSelection={() => {}}
          onConfirmDelete={() => {}}
        />
      </section>
    </div>
  );
};

export default EquipeDetailsPage;