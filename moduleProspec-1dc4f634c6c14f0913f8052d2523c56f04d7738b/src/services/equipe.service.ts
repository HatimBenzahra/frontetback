// frontend-shadcn/src/services/equipe.service.ts
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/equipes`;

import type { Commercial } from '@/types/types';

export interface EquipeFromApi {
  id: string;
  nom: string;
  managerId: string;
  commerciaux: Commercial[]; // Ajouté pour inclure les commerciaux
}

export interface EquipeDetailsFromApi {
    id: string;
    nom: string;
    manager: string;
    stats: {
        contratsSignes: number;
        rdvPris: number;
        refus: number;
        immeublesProspectes: number;
        portesProspectees: number;
        perfMoyenne: number;
        classementGeneral: number | string;
        nbCommerciaux: number;
    };
    perfHistory: { name: string; perf: number }[];
    commerciaux: {
        id: string;
        nom: string;
        prenom: string;
        email: string;
        classement: number;
    }[];
}

const getEquipes = async (): Promise<EquipeFromApi[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

const getEquipeDetails = async (id: string): Promise<EquipeDetailsFromApi> => {
    const response = await axios.get(`${API_URL}/${id}/details`);
    return response.data;
};

const createEquipe = async (equipeData: { nom: string; managerId: string }) => {
  const response = await axios.post(API_URL, equipeData);
  return response.data;
};

const updateEquipe = async (id: string, equipeData: { nom: string; managerId: string }) => {
  const response = await axios.patch(`${API_URL}/${id}`, equipeData);
  return response.data;
};

const deleteEquipe = async (id: string) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};

export const equipeService = {
  getEquipes,
  getEquipeDetails,
  createEquipe,
  updateEquipe,
  deleteEquipe,
};