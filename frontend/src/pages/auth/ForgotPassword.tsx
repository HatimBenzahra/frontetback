import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import logoImage from '@/assets/logo.png';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!email) {
      setError('Veuillez saisir votre email');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.forgotPassword(email);
      setMessage(res.message || 'Si un compte existe, un email a été envoyé.');
    } catch (err: any) {
      // Toujours message générique
      setMessage('Si un compte existe, un email a été envoyé.');
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
              Mot de passe oublié
            </CardTitle>
            <CardDescription className="text-gray-600 font-medium tracking-wide text-base">
              Recevez un lien pour réinitialiser votre mot de passe
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 space-y-6">
            {message && (
              <div className="bg-green-50/80 border border-green-200/80 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 backdrop-blur-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                <span className="font-medium">{message}</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50/80 border border-red-200/80 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 backdrop-blur-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
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

              <div className="pt-2 space-y-3">
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
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-3" />
                      Envoyer le lien
                    </>
                  )}
                </Button>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-12 font-medium text-base rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security notice */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 font-medium bg-white/60 backdrop-blur-sm rounded-full px-6 py-3 inline-block shadow-sm">
            🔐 Réinitialisation sécurisée - Vérifiez votre boîte mail
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

