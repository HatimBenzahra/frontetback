import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface DirecteurCommercial {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipe?: {
    id: string;
    nom: string;
    manager: {
      id: string;
      nom: string;
      prenom: string;
    };
  };
  historiques: any[];
  zones: any[];
}

export interface DirecteurManager {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipes: {
    id: string;
    nom: string;
    commerciaux: DirecteurCommercial[];
  }[];
}

export interface DirecteurEquipe {
  id: string;
  nom: string;
  manager: {
    id: string;
    nom: string;
    prenom: string;
  };
  commerciaux: DirecteurCommercial[];
  stats?: {
    contratsSignes: number;
    rdvPris: number;
    refus: number;
    immeublesProspectes: number;
    portesProspectees: number;
    classementGeneral?: number;
  };
}

export interface DirecteurStats {
  totalManagers: number;
  totalEquipes: number;
  totalCommerciaux: number;
  totalImmeubles: number;
  totalZones: number;
  totalProspections: number;
  totalContrats: number;
  totalRdv: number;
  tauxConversion: number;
}

export interface CommercialStats {
  totalContracts: number;
  totalRdv: number;
  totalPortes: number;
  totalRefus: number;
  totalAbsents: number;
  totalProspections: number;
  conversionRate: number;
}

export interface ManagerStats {
  totalContracts: number;
  totalRdv: number;
  totalCommerciaux: number;
  totalEquipes: number;
  totalPortes: number;
  totalProspections: number;
  conversionRate: number;
}

export interface EquipeStats {
  totalContracts: number;
  totalRdv: number;
  totalCommerciaux: number;
  totalPortes: number;
  totalProspections: number;
  conversionRate: number;
}

export interface PerformanceHistory {
  week: any[];
  month: any[];
  year: any[];
}

class DirecteurSpaceService {
  // Commerciaux
  async getCommerciaux(): Promise<DirecteurCommercial[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/commerciaux`);
    return response.data;
  }

  async getCommercial(id: string): Promise<DirecteurCommercial> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/commerciaux/${id}`);
    return response.data;
  }

  async getCommercialHistoriques(id: string): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/commerciaux/${id}/historiques`);
    return response.data;
  }

  async getCommercialTranscriptions(id: string): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/commerciaux/${id}/transcriptions`);
    return response.data;
  }

  async getCommercialStats(id: string): Promise<CommercialStats> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/commerciaux/${id}/stats`);
    return response.data;
  }

  // Managers
  async getManagers(): Promise<DirecteurManager[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers`);
    return response.data;
  }

  async getManager(id: string): Promise<DirecteurManager> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers/${id}`);
    return response.data;
  }

  async getManagerEquipes(id: string): Promise<DirecteurEquipe[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers/${id}/equipes`);
    return response.data;
  }

  async getManagerCommerciaux(id: string): Promise<DirecteurCommercial[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers/${id}/commerciaux`);
    return response.data;
  }

  async getManagerStats(id: string): Promise<ManagerStats> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers/${id}/stats`);
    return response.data;
  }

  async getManagerPerformanceHistory(id: string): Promise<PerformanceHistory> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/managers/${id}/performance-history`);
    return response.data;
  }

  // Équipes
  async getEquipes(): Promise<DirecteurEquipe[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/equipes`);
    return response.data;
  }

  async getEquipe(id: string): Promise<DirecteurEquipe> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/equipes/${id}`);
    return response.data;
  }

  async getEquipeCommerciaux(id: string): Promise<DirecteurCommercial[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/equipes/${id}/commerciaux`);
    return response.data;
  }

  async getEquipeStats(id: string): Promise<EquipeStats> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/equipes/${id}/stats`);
    return response.data;
  }

  async getEquipePerformanceHistory(id: string): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/equipes/${id}/performance-history`);
    return response.data;
  }

  async addCommercialToEquipe(equipeId: string, commercialId: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/directeur-space/equipes/${equipeId}/commerciaux/${commercialId}`);
    return response.data;
  }

  async removeCommercialFromEquipe(equipeId: string, commercialId: string): Promise<any> {
    const response = await axios.delete(`${API_BASE_URL}/directeur-space/equipes/${equipeId}/commerciaux/${commercialId}`);
    return response.data;
  }

  // Statistiques
  async getGlobalStats(): Promise<DirecteurStats> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/global`);
    return response.data;
  }

  // Nouvelle méthode pour les stats du dashboard
  async getDashboardStats(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/global`);
    return response.data;
  }

  async getManagersStats(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/managers`);
    return response.data;
  }

  async getEquipesStats(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/equipes`);
    return response.data;
  }

  async getCommerciauxStats(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/commerciaux`);
    return response.data;   
  }

  async getPerformanceHistory(): Promise<PerformanceHistory> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/performance-history`);
    return response.data;
  }

  async getRepassageChart(period: string = 'week'): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/repassage-chart`, { 
      params: { period } 
    });
    return response.data;
  }

  // Objectifs globaux
  async getCurrentGlobalGoal(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/global-goal`);
    return response.data;
  }

  async setGlobalGoal(goal: number, startDate?: Date, durationMonths?: number): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/directeur-space/global-goal`, {
      goal,
      startDate,
      durationMonths
    });
    return response.data;
  }

  // Assignations
  async getAssignmentHistory(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/assignments/history`);
    return response.data;
  }

  // Version optimisée pour le dashboard avec limite
  async getAssignmentHistoryOptimized(limit?: number): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/assignments/history`, {
      params: limit ? { limit } : {}
    });
    return response.data;
  }

  async getAssignmentsWithStatus(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/assignments/status`);
    return response.data;
  }

  // Zones
  async getZones(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/zones`);
    return response.data;
  }

  async getZone(zoneId: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/zones/${zoneId}`);
    return response.data;
  }

  async getZonesStatistics(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/statistics/zones`);
    return response.data;
  }

  // Immeubles
  async getImmeubles(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/immeubles`);
    return response.data;
  }

  async getImmeuble(immeubleId: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/immeubles/${immeubleId}`);
    return response.data;
  }

  // Transcriptions
  async getTranscriptions(options: {
    commercialId?: string;
    buildingId?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/directeur-space/transcriptions`, {
      params: options
    });
    return response.data;
  }
}

export const directeurSpaceService = new DirecteurSpaceService();
