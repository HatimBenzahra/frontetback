// frontend-shadcn/src/services/statistics.service.ts
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/statistics`;

// Définition des types pour les filtres (alignés avec le backend/Prisma)
export type PeriodType = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type StatEntityType = 'COMMERCIAL' | 'EQUIPE' | 'MANAGER';

export interface StatisticsQuery {
  period: PeriodType;
  entityType?: StatEntityType;
  entityId?: string;
}

// Le service pour récupérer les statistiques
const getStatistics = async (query: StatisticsQuery) => {
  // On utilise `params` pour qu'axios formate correctement les query params dans l'URL
  const response = await axios.get(API_URL, { params: query });
  return response.data;
};

const getStatsForCommercial = async (commercialId: string) => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}`);
  return response.data;
};

const getCommercialHistory = async (commercialId: string) => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}/history`);
  return response.data;
};

const getStatsForManager = async (managerId: string) => {
  const response = await axios.get(`${API_URL}/manager/${managerId}`);
  return response.data;
};

const getManagerPerformanceHistory = async (managerId: string) => {
  const response = await axios.get(`${API_URL}/manager/${managerId}/history`);
  return response.data;
};

const triggerHistoryUpdate = async (commercialId: string, immeubleId: string) => {
  try {
    await axios.post(`${API_URL}/commercial/trigger-history-update`, { commercialId, immeubleId });
  } catch (error) {
    console.error('Failed to trigger history update:', error);
    // Optionally, you can decide how to handle the error, e.g., by re-throwing it or returning a specific value.
    throw error;
  }
};

export const statisticsService = {
  getStatistics,
  getStatsForCommercial,
  getCommercialHistory,
  getStatsForManager,
  getManagerPerformanceHistory,
  triggerHistoryUpdate,
};