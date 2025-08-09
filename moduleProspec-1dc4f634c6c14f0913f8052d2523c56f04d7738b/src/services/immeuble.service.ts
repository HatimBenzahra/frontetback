import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/admin/immeubles`;
const COMMERCIAL_API_URL = `${API_BASE_URL}/commercial`;

export interface ImmeubleFromApi {
  id: string;
  adresse: string;
  ville: string;
  codePostal: string;
  zone: { id: string; nom: string };
  prospectors: { id: string; prenom: string; nom: string }[];
  status: string;
  portes: { id: string; numeroPorte: string; statut: string; }[]; // Added statut to Porte
  historiques: any[];
  latitude: number;
  longitude: number;
  nbPortesTotal: number;
  hasElevator: boolean;
  digicode: string | null;
  createdAt: string;
  prospectingMode: 'SOLO' | 'DUO'; // Added prospectingMode
}

export interface ImmeubleDetailsFromApi extends ImmeubleFromApi {
  hasElevator: boolean;
  digicode: string | null;
  stats: {
    contratsSignes: number;
    rdvPris: number;
  };
  nbPortesTotal: number;
  nbEtages: number;
  nbPortesParEtage: number;
  prospectingMode: 'SOLO' | 'DUO';
  portes: { id: string; numeroPorte: string; statut: string; passage: number; commentaire: string; etage: number }[];
}

// Admin functions
const getImmeubles = async (): Promise<ImmeubleFromApi[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

/**
 * Paginated fetch for immeubles.
 * If backend supports pagination, it should return { items: ImmeubleFromApi[], total: number }.
 * Fallback: if it returns an array, we slice client-side (still returns total).
 */
const getImmeublesPaged = async (pageIndex: number, pageSize: number): Promise<{ items: ImmeubleFromApi[]; total: number }> => {
  try {
    const response = await axios.get(API_URL, { params: { page: pageIndex + 1, pageSize } });
    const data = response.data;
    if (Array.isArray(data)) {
      const total = data.length;
      const start = pageIndex * pageSize;
      const end = start + pageSize;
      return { items: data.slice(start, end), total };
    }
    if (data && Array.isArray(data.items) && typeof data.total === 'number') {
      return { items: data.items, total: data.total };
    }
    // Unknown shape: fallback to non-paginated
    const all = await getImmeubles();
    const total = all.length;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return { items: all.slice(start, end), total };
  } catch (e) {
    // Fallback on error
    const all = await getImmeubles();
    const total = all.length;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return { items: all.slice(start, end), total };
  }
};

const getImmeubleDetails = async (id: string): Promise<ImmeubleDetailsFromApi> => {
  const response = await axios.get(`${API_URL}/${id}/details`);
  return response.data;
};

const createImmeuble = async (immeubleData: any) => {
  const response = await axios.post(API_URL, immeubleData);
  return response.data;
};

const updateImmeuble = async (id: string, immeubleData: any) => {
  const response = await axios.patch(`${API_URL}/${id}`, immeubleData);
  return response.data;
};

const deleteImmeuble = async (id: string) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};

// Commercial functions
const createImmeubleForCommercial = async (immeubleData: any, commercialId: string) => {
  const response = await axios.post(`${COMMERCIAL_API_URL}/${commercialId}/immeubles`, immeubleData);
  return response.data;
};

const getImmeublesForCommercial = async (commercialId: string): Promise<ImmeubleFromApi[]> => {
  const response = await axios.get(`${COMMERCIAL_API_URL}/${commercialId}/immeubles`);
  return response.data;
};

const getImmeubleByIdForCommercial = async (id: string, commercialId: string): Promise<ImmeubleDetailsFromApi> => {
  const response = await axios.get(`${COMMERCIAL_API_URL}/${commercialId}/immeubles/${id}`);
  return response.data;
};

const updateImmeubleForCommercial = async (id: string, immeubleData: any, commercialId: string) => {
  const response = await axios.patch(`${COMMERCIAL_API_URL}/${commercialId}/immeubles/${id}`, immeubleData);
  return response.data;
};

const deleteImmeubleForCommercial = async (id: string, commercialId: string) => {
  const response = await axios.delete(`${COMMERCIAL_API_URL}/${commercialId}/immeubles/${id}`);
  return response.data;
};

export const immeubleService = {
  // Admin
  getImmeubles,
  getImmeublesPaged,
  getImmeubleDetails,
  createImmeuble,
  updateImmeuble,
  deleteImmeuble,
  // Commercial
  createImmeubleForCommercial,
  getImmeublesForCommercial,
  getImmeubleByIdForCommercial,
  updateImmeubleForCommercial,
  deleteImmeubleForCommercial,
};
