// frontend-shadcn/src/services/manager.service.ts
import axios from 'axios';
import { API_BASE_URL } from '../config';
import type { Manager } from '@/types/types'; // On réutilise le type existant

const API_URL = `${API_BASE_URL}/managers`; // L'URL de notre back-end

// DTO pour la création/mise à jour, on peut les définir ici
type CreateManagerPayload = {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
};

type UpdateManagerPayload = Partial<CreateManagerPayload>;

// Fonction pour récupérer tous les managers
const getManagers = async (): Promise<Manager[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

// Fonction pour créer un manager
const createManager = async (data: CreateManagerPayload): Promise<Manager> => {
  const response = await axios.post(API_URL, data);
  return response.data;
};

// Fonction pour mettre à jour un manager
const updateManager = async (id: string, data: UpdateManagerPayload): Promise<Manager> => {
  const response = await axios.patch(`${API_URL}/${id}`, data);
  return response.data;
};
// AJOUT DES NOUVELLES FONCTIONS POUR L'ESPACE MANAGER
const getManagerDetails = async (id: string): Promise<any> => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

// on utilise carrement que la route manager-space/commerciaux
const getManagerCommerciaux = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/commerciaux`);
  return response.data;
};

const getManagerEquipes = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/equipes`);
  return response.data;
};

const getManagerZones = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/zones`);
  return response.data;
};

const getManagerCommercial = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/commerciaux/${commercialId}`);
  return response.data;
};

const getManagerEquipe = async (equipeId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/equipes/${equipeId}`);
  return response.data;
};

// Fonction pour récupérer les immeubles des commerciaux d'un manager connecté
const getManagerImmeubles = async (): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/immeubles`);
  return response.data;
};

// Fonction pour récupérer un immeuble spécifique du manager connecté
const getManagerImmeuble = async (immeubleId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/immeubles/${immeubleId}`);
  return response.data;
};

// Fonction pour supprimer un immeuble d'un commercial du manager connecté
const deleteManagerImmeuble = async (immeubleId: string) => {
  const response = await axios.delete(`${API_BASE_URL}/manager-space/immeubles/${immeubleId}`);
  return response.data;
};

// Fonction pour récupérer les transcriptions de tous les commerciaux du manager
const getManagerTranscriptions = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/commerciaux`);
  return response.data;
};

// Fonction pour récupérer les transcriptions d'un commercial spécifique
const getCommercialTranscriptions = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/transcriptions/commercial/${commercialId}`);
  return response.data;
};

// Fonction pour récupérer le suivi de prospection du manager
const getManagerSuivi = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/suivi`);
  return response.data;
};

// Fonctions pour les statistiques manager
const getManagerStatistics = async (query: any): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics`, { params: query });
  return response.data;
};

const getManagerDashboardStats = async (period?: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/dashboard`, { 
    params: period ? { period } : {} 
  });
  return response.data;
};

const getManagerPerformanceHistory = async (period?: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/performance-history`, { 
    params: period ? { period } : {} 
  });
  return response.data;
};

const getManagerCommercialsProgress = async (period?: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/commercials-progress`, { 
    params: period ? { period } : {} 
  });
  return response.data;
};

const getManagerCommercialStats = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/commercial/${commercialId}`);
  return response.data;
};

const getManagerCommercialHistory = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/commercial/${commercialId}/history`);
  return response.data;
};

const getManagerEquipeStats = async (equipeId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/equipe/${equipeId}`);
  return response.data;
};

const getManagerGlobalPerformanceChart = async (period?: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/global-performance-chart`, { 
    params: period ? { period } : {} 
  });
  return response.data;
};

const getManagerRepassageChart = async (period?: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/statistics/repassage-chart`, { 
    params: period ? { period } : {} 
  });
  return response.data;
};

// Fonctions pour les portes
const getManagerPortesForImmeuble = async (immeubleId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/portes/immeuble/${immeubleId}`);
  return response.data;
};

const getManagerPorte = async (porteId: string): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/manager-space/portes/${porteId}`);
  return response.data;
};

const createManagerPorte = async (porteData: any): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/manager-space/portes`, porteData);
  return response.data;
};

const updateManagerPorte = async (porteId: string, porteData: any): Promise<any> => {
  const response = await axios.patch(`${API_BASE_URL}/manager-space/portes/${porteId}`, porteData);
  return response.data;
};

const deleteManagerPorte = async (porteId: string): Promise<any> => {
  const response = await axios.delete(`${API_BASE_URL}/manager-space/portes/${porteId}`);
  return response.data;
};

// Fonction pour mettre à jour le nombre d'étages d'un immeuble
const updateManagerImmeubleNbEtages = async (immeubleId: string, newNbEtages: number): Promise<any> => {
  const response = await axios.patch(`${API_BASE_URL}/manager-space/immeubles/${immeubleId}/nb-etages`, {
    newNbEtages
  });
  return response.data;
};

// Fonction pour supprimer un manager
const deleteManager = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};

export const managerService = {
  getManagers,
  createManager,
  getManagerDetails,
  updateManager,
  deleteManager,
  // Nouvelles fonctions pour l'espace manager
  getManagerCommerciaux,
  getManagerEquipes,
  getManagerZones,
  getManagerCommercial,
  getManagerEquipe,
  getManagerImmeubles,
  getManagerImmeuble,
  deleteManagerImmeuble,
  updateManagerImmeubleNbEtages,
  // Fonctions pour les portes
  getManagerPortesForImmeuble,
  getManagerPorte,
  createManagerPorte,
  updateManagerPorte,
  deleteManagerPorte,
  // Fonctions pour transcriptions et suivi
  getManagerTranscriptions,
  getCommercialTranscriptions,
  getManagerSuivi,
  // Fonctions pour les statistiques manager
  getManagerStatistics,
  getManagerDashboardStats,
  getManagerPerformanceHistory,
  getManagerCommercialsProgress,
  getManagerCommercialStats,
  getManagerCommercialHistory,
  getManagerEquipeStats,
  getManagerGlobalPerformanceChart,
  getManagerRepassageChart,
};