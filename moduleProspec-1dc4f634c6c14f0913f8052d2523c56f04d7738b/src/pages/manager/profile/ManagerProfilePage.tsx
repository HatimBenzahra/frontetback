// src/pages/manager/profile/ManagerProfilePage.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { managerService } from '@/services/manager.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Badge } from '@/components/ui-admin/badge';
import { Avatar, AvatarFallback } from '@/components/ui-admin/avatar';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Building2, 
  Users, 
  Target,
  Edit,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';

interface ManagerProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  // Statistiques du manager
  totalCommerciaux?: number;
  totalEquipes?: number;
  totalZones?: number;
  totalImmeubles?: number;
}

const ManagerProfilePage = () => {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Espace Manager', path: '/manager' },
      { label: 'Mon Profil', path: '/manager/profile' }
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Récupérer les statistiques
        const [commerciaux, equipes, zones, immeubles] = await Promise.all([
          managerService.getManagerCommerciaux().catch(() => []),
          managerService.getManagerEquipes().catch(() => []),
          managerService.getManagerZones().catch(() => []),
          managerService.getManagerImmeubles().catch(() => [])
        ]);

        // Utiliser les informations du contexte d'authentification
        const profileData: ManagerProfile = {
          id: user.id,
          nom: user.nom || '',
          prenom: user.name?.split(' ')[0] || '',
          email: user.email || '',
          telephone: '', // Pas disponible dans le contexte
          role: user.role,
          createdAt: new Date().toISOString(), // Date approximative
          updatedAt: new Date().toISOString(),
          totalCommerciaux: commerciaux.length,
          totalEquipes: equipes.length,
          totalZones: zones.length,
          totalImmeubles: immeubles.length
        };

        setProfile(profileData);
        setEditForm({
          nom: profileData.nom,
          prenom: profileData.prenom,
          email: profileData.email,
          telephone: profileData.telephone
        });
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setEditForm({
        nom: profile.nom || '',
        prenom: profile.prenom || '',
        email: profile.email || '',
        telephone: profile.telephone || ''
      });
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setSaving(true);
      // Pour l'instant, on met à jour seulement localement
      // TODO: Créer un endpoint spécifique pour les managers dans manager-space
      const updatedProfile = {
        ...profile,
        nom: editForm.nom,
        prenom: editForm.prenom,
        email: editForm.email,
        telephone: editForm.telephone,
        updatedAt: new Date().toISOString()
      };
      
      setProfile(updatedProfile);
      setIsEditing(false);
      
      // Afficher un message de succès (optionnel)
      console.log('Profil mis à jour localement');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable />;
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Impossible de charger le profil</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = `${profile.prenom} ${profile.nom}`;
  const initials = `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête du profil */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20 border-4 border-[hsl(var(--winvest-green-moyen))]">
                <AvatarFallback className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))] text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{displayName}</CardTitle>
                <CardDescription className="text-lg">
                  <Badge variant="secondary" className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))]">
                    Manager
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={isEditing ? handleSave : handleEdit}
              disabled={saving}
              className="bg-[hsl(var(--winvest-green-nuit))] hover:bg-[hsl(var(--winvest-green-moyen))]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isEditing ? (
                <Save className="h-4 w-4 mr-2" />
              ) : (
                <Edit className="h-4 w-4 mr-2" />
              )}
              {isEditing ? 'Sauvegarder' : 'Modifier'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations personnelles */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Vos informations de contact et de profil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                {isEditing ? (
                  <Input
                    id="prenom"
                    value={editForm.prenom}
                    onChange={(e) => handleInputChange('prenom', e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.prenom || 'Non renseigné'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                {isEditing ? (
                  <Input
                    id="nom"
                    value={editForm.nom}
                    onChange={(e) => handleInputChange('nom', e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.nom || 'Non renseigné'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.email || 'Non renseigné'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                {isEditing ? (
                  <Input
                    id="telephone"
                    value={editForm.telephone}
                    onChange={(e) => handleInputChange('telephone', e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.telephone || 'Non renseigné'}</span>
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving} className="bg-[hsl(var(--winvest-green-nuit))] hover:bg-[hsl(var(--winvest-green-moyen))]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistiques et informations système */}
        <div className="space-y-6">
          {/* Statistiques */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Mes Statistiques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[hsl(var(--winvest-green-nuit))]" />
                  <span className="text-sm font-medium">Commerciaux</span>
                </div>
                <Badge variant="secondary" className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))]">
                  {profile.totalCommerciaux || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[hsl(var(--winvest-green-nuit))]" />
                  <span className="text-sm font-medium">Équipes</span>
                </div>
                <Badge variant="secondary" className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))]">
                  {profile.totalEquipes || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[hsl(var(--winvest-green-nuit))]" />
                  <span className="text-sm font-medium">Zones</span>
                </div>
                <Badge variant="secondary" className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))]">
                  {profile.totalZones || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[hsl(var(--winvest-green-nuit))]" />
                  <span className="text-sm font-medium">Immeubles</span>
                </div>
                <Badge variant="secondary" className="bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))]">
                  {profile.totalImmeubles || 0}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Informations système */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informations système
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">ID Manager:</span>
                <p className="font-mono text-xs bg-muted p-2 rounded mt-1">{profile.id}</p>
              </div>
              
              <div className="text-sm">
                <span className="text-muted-foreground">Compte créé le:</span>
                <p className="font-medium">
                  {new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Dernière mise à jour:</span>
                <p className="font-medium">
                  {new Date(profile.updatedAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ManagerProfilePage;
