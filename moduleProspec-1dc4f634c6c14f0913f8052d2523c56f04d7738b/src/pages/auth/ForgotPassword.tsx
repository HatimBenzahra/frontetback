import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';

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
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Mot de passe oublié</CardTitle>
          <CardDescription>Recevez un lien pour réinitialiser votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@exemple.com"
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full bg-green-600 text-white hover:bg-green-700" disabled={isLoading}>
              {isLoading ? 'Envoi...' : 'Envoyer le lien'}
            </Button>

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Retour à la connexion
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;

