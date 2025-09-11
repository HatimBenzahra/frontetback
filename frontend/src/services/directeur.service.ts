// frontend-shadcn/src/services/directeur.service.ts
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/directeurs`;

// Types pour les directeurs
export type Directeur = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  nbManagers: number;
  nbEquipes: number;
  nbCommerciaux: number;
  totalContratsSignes: number;
  classement: number;
  managers: {
    id: string;
    nom: string;
    prenom: string;
    equipes: {
      id: string;
      nom: string;
      commerciaux: {
        id: string;
        historiques: {
          nbContratsSignes: number;
        }[];
      }[];
    }[];
  }[];
};

// DTO pour la création/mise à jour
type CreateDirecteurPayload = {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
};

type UpdateDirecteurPayload = Partial<CreateDirecteurPayload>;

// Fonction pour récupérer tous les directeurs
const getDirecteurs = async (): Promise<Directeur[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

// Fonction pour récupérer les détails d'un directeur
const getDirecteurDetails = async (id: string): Promise<Directeur> => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

// Fonction pour créer un directeur
const createDirecteur = async (data: CreateDirecteurPayload): Promise<Directeur> => {
  const response = await axios.post(API_URL, data);
  return response.data;
};

// Fonction pour mettre à jour un directeur
const updateDirecteur = async (id: string, data: UpdateDirecteurPayload): Promise<Directeur> => {
  const response = await axios.patch(`${API_URL}/${id}`, data);
  return response.data;
};

// Fonction pour supprimer un directeur
const deleteDirecteur = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};

export const directeurService = {
  getDirecteurs,
  getDirecteurDetails,
  createDirecteur,
  updateDirecteur,
  deleteDirecteur,
};