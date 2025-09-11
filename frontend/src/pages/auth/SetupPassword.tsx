import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Lock, Eye, EyeOff, CheckCircle, UserCheck } from 'lucide-react';
import logoImage from '@/assets/logo.png';

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token manquant ou invalide');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password || password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!token) {
      setError('Token manquant ou invalide');
      return;
    }

    setIsLoading(true);

    try {
      await authService.setupPassword(token, password);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Mot de passe configuré avec succès. Vous pouvez maintenant vous connecter.' }
        });
      }, 3000);
    } catch (err: any) {
      console.error('Setup password error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 400) {
        setError('Token invalide ou expiré. Veuillez demander un nouveau lien.');
      } else {
        setError('Erreur lors de la configuration du mot de passe. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -left-4 w-72 h-72 bg-gradient-to-r from-green-400/10 to-green-600/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute -bottom-8 -right-4 w-72 h-72 bg-gradient-to-r from-green-600/10 to-green-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-md">
          <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl shadow-green-500/20 rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-4 pt-8 px-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent mb-2">
                Mot de passe configuré !
              </CardTitle>
              <CardDescription className="text-gray-600 font-medium text-base">
                Bienvenue ! Redirection vers la page de connexion...
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-green-500/30 border-t-green-500 mx-auto mb-4"></div>
                <p className="text-sm text-gray-600 font-medium">Redirection en cours...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-8 -right-4 w-72 h-72 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl shadow-blue-500/20 rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 pt-8 px-8">
            {/* Logo */}
            <div className="flex justify-center mb-2">
              <img 
                src={logoImage} 
                alt="Groupe FINANSSOR" 
                className="h-20 w-auto object-contain"
                style={{ 
                  clipPath: 'inset(0 0 8% 0)',
                  transform: 'translateY(4px)' 
                }}
              />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent mb-2">
              Définir votre mot de passe
            </CardTitle>
            <CardDescription className="text-gray-600 font-medium tracking-wide text-base">
              Bienvenue ! Créez votre mot de passe sécurisé
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50/80 border border-red-200/80 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700 ml-1">
                  Nouveau mot de passe
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="pl-12 pr-14 h-14 bg-gray-50/80 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white transition-all duration-200 focus:ring-2 focus:ring-blue-100 text-base font-medium"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-r-xl transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700 ml-1">
                  Confirmer le mot de passe
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez votre mot de passe"
                    className="pl-12 pr-14 h-14 bg-gray-50/80 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white transition-all duration-200 focus:ring-2 focus:ring-blue-100 text-base font-medium"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-r-xl transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  style={{
                    background: 'linear-gradient(135deg, #4d86df 0%, #A5BDF1 100%)',
                    color: 'white',
                    border: 'none'
                  }}
                  className="w-full h-14 font-semibold text-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 active:scale-[0.98] hover:brightness-110 transform"
                  disabled={isLoading || !token}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/30 border-t-white mr-3"></div>
                      Configuration...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5 mr-3" />
                      Définir le mot de passe
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Security notice */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-500 font-medium bg-white/60 backdrop-blur-sm rounded-full px-6 py-2 inline-block shadow-sm">
                🔐 Lien sécurisé - Expire dans 15 minutes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}