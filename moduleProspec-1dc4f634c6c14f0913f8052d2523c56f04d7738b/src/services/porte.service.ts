import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/portes`;

export type PorteFromAPI = {
  id: string;
  numeroPorte: string;
  etage: number;
  statut: string;
  passage: number;
  commentaire: string | null;
  dateRendezVous: string | null;
  immeubleId: string;
  assigneeId?: string | null;
  immeuble?: {
    id: string;
    adresse: string;
    ville: string;
  };
  assignee?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  } | null;
};

type CreatePortePayload = {
  numeroPorte: string;
  etage: number;
  statut: string;
  passage: number;
  commentaire?: string;
  dateRendezVous?: string;
  immeubleId: string;
};

type UpdatePortePayload = Partial<CreatePortePayload>;

const getPortes = async (): Promise<PorteFromAPI[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

const getPorteDetails = async (id: string): Promise<PorteFromAPI> => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

const createPorte = async (data: CreatePortePayload): Promise<PorteFromAPI> => {
  const response = await axios.post(API_URL, data);
  return response.data;
};

const updatePorte = async (id: string, data: UpdatePortePayload): Promise<PorteFromAPI> => {
  const response = await axios.patch(`${API_URL}/${id}`, data);
  return response.data;
};

const deletePorte = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};

const getRendezVousSemaine = async (commercialId: string): Promise<PorteFromAPI[]> => {
  const response = await axios.get(`${API_URL}/rendez-vous-semaine/${commercialId}`);
  return response.data;
};

const getAllRendezVousSemaine = async (): Promise<PorteFromAPI[]> => {
  const response = await axios.get(`${API_URL}/admin/rendez-vous-semaine`);
  return response.data;
};

export const porteService = {
  getPortes,
  getPorteDetails,
  createPorte,
  updatePorte,
  deletePorte,
  getRendezVousSemaine,
  getAllRendezVousSemaine,
};