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
  // On peut ajouter ici un mapping si les données de l'API ne correspondent pas exactement au type `Manager` du front.
  // Dans notre cas, elles correspondent, mais c'est une bonne pratique.
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

// Nouvelles fonctions utilisant les routes manager-space sécurisées
// Note: managerId n'est plus nécessaire car il est extrait du token JWT
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

// Fonction pour supprimer un immeuble d'un commercial du manager connecté
const deleteManagerImmeuble = async (immeubleId: string) => {
  const response = await axios.delete(`${API_BASE_URL}/manager-space/immeubles/${immeubleId}`);
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
  deleteManagerImmeuble,
};