import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import logoImage from '@/assets/logo.png';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check for success message from setup password
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError('Veuillez saisir votre email et mot de passe');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      
      // Store tokens
      authService.storeToken(response.access_token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      
      // Store user info
      authService.storeUser(response.user);

      // Update auth context
      login({
        id: response.user.id,
        name: `${response.user.firstName} ${response.user.lastName}`,
        email: response.user.email,
        role: response.user.role, // Now using the real role from backend
      });

      // Redirect to dashboard
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('Email ou mot de passe incorrect');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Erreur de connexion. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
              CRM Prospection
            </CardTitle>
            <CardDescription className="text-gray-600 font-medium tracking-wide text-lg">
              Connectez-vous à votre espace
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 space-y-5">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50/80 border border-red-200/80 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700 ml-1">
                  Adresse e-mail
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    className="pl-12 h-14 bg-gray-50/80 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white transition-all duration-200 focus:ring-2 focus:ring-blue-100 text-base font-medium"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700 ml-1">
                  Mot de passe
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
                    placeholder="Saisissez votre mot de passe"
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

              <div className="pt-2">
                <Button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #4d86df 0%, #A5BDF1 100%)',
                    color: 'white',
                    border: 'none'
                  }}
                  className="w-full h-14 font-semibold text-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 active:scale-[0.98] hover:brightness-110 transform"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/30 border-t-white mr-3"></div>
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-3" />
                      Se connecter
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="text-center pt-4 pb-2">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 text-base font-medium hover:underline underline-offset-4 transition-all duration-200 px-4 py-2 rounded-lg hover:bg-blue-50"
                onClick={() => navigate('/forgot-password')}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Security notice */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center text-sm text-gray-500 font-medium bg-white/60 backdrop-blur-sm rounded-full px-6 py-3 shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Connexion sécurisée - Vos données sont protégées
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
