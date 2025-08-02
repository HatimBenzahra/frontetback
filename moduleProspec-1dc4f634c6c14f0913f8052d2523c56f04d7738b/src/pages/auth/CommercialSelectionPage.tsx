// src/pages/commercial/CommercialSelectionPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { commercialService } from '@/services/commercial.service';
import type { CommercialFromAPI } from '@/services/commercial.service';
import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Skeleton } from '@/components/ui-admin/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui-admin/avatar';
import { User } from 'lucide-react';

const CommercialSelectionPage: React.FC = () => {
  const [commerciaux, setCommerciaux] = useState<CommercialFromAPI[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const fetchCommerciaux = async () => {
      try {
        const data = await commercialService.getCommerciaux();
        setCommerciaux(data);
      } catch (err) {
        setError('Impossible de charger la liste des commerciaux.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCommerciaux();
  }, []);

  const handleSelectCommercial = (commercial: CommercialFromAPI) => {
    login({
      id: commercial.id,
      name: `${commercial.prenom} ${commercial.nom}`,
      role: 'commercial',
      email: commercial.email,
    });
    navigate('/commercial/dashboard');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      );
    }

    if (error) {
      return <div className="text-center text-red-500">{error}</div>;
    }

    if (commerciaux.length === 0) {
      return <p className="text-center text-gray-500">Aucun profil de commercial disponible.</p>;
    }

    return (
      <ScrollArea className="h-72 w-full rounded-md border p-4">
        <div className="grid gap-4">
          {commerciaux.map((commercial) => (
            <Button
              key={commercial.id}
              variant="outline"
              className="w-full justify-start h-14 text-md"
              onClick={() => handleSelectCommercial(commercial)}
            >
              <Avatar className="mr-3 h-9 w-9">
                <AvatarFallback>{commercial.prenom[0]}{commercial.nom[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                  <span>{commercial.prenom} {commercial.nom}</span>
                  <span className="text-xs text-muted-foreground">{commercial.email}</span>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    );
  };
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <User className="h-6 w-6"/> Qui êtes-vous ?
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            Choisissez votre profil pour accéder à votre tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommercialSelectionPage;