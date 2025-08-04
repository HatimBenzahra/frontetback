import { Card, CardContent } from '@/components/ui-admin/card';
import { Users, Headphones } from 'lucide-react';
import type { SuiviStatsProps } from '@/types/types';

export const SuiviStats = ({ commercials, audioStreaming }: SuiviStatsProps) => {
  const onlineCommercials = commercials.filter(c => c.isOnline);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{commercials.length}</p>
              <p className="text-sm text-gray-600">Total commerciaux</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <div className="w-5 h-5 bg-green-500 rounded-full" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{onlineCommercials.length}</p>
              <p className="text-sm text-gray-600">Connectés</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Headphones className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {audioStreaming.isListening ? '1' : '0'}
              </p>
              <p className="text-sm text-gray-600">Écoute active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 