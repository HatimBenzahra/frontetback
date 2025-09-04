import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/manager-space/zones`;

export interface ManagerZoneFromApi {
  id: string;
  nom: string;
  couleur: string;
  latitude: number;
  longitude: number;
  rayonMetres: number;
  createdAt: string;
  managerId?: string;
  equipeId?: string;
  commerciaux?: Array<{
    commercial: {
      id: string;
      nom: string;
      prenom: string;
      email: string;
      equipe?: {
        id: string;
        nom: string;
      };
    };
  }>;
  immeubles?: Array<{
    id: string;
    adresse: string;
    latitude: number;
    longitude: number;
    status: string;
  }>;
  equipe?: {
    id: string;
    nom: string;
  };
}

export interface ManagerZoneDetailsFromApi extends ManagerZoneFromApi {
  stats: {
    nbImmeubles: number;
    totalContratsSignes: number;
    totalRdvPris: number;
  };
}

const getManagerZones = async (): Promise<ManagerZoneFromApi[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

const getManagerZoneDetails = async (id: string): Promise<ManagerZoneDetailsFromApi> => {
  const response = await axios.get(`${API_URL}/${id}/details`);
  return response.data;
};

const createManagerZone = async (zoneData: any) => {
  const response = await axios.post(API_URL, zoneData);
  return response.data;
};

const updateManagerZone = async (id: string, zoneData: any) => {
  const response = await axios.patch(`${API_URL}/${id}`, zoneData);
  return response.data;
};

const deleteManagerZone = async (id: string) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};

const assignCommercialToZone = async (zoneId: string, commercialId: string, assignedBy?: string) => {
  const response = await axios.post(`${API_URL}/${zoneId}/assign-commercial`, {
    commercialId,
    assignedBy
  });
  return response.data;
};

const unassignCommercialFromZone = async (zoneId: string, commercialId: string) => {
  const response = await axios.post(`${API_URL}/${zoneId}/unassign-commercial`, {
    commercialId
  });
  return response.data;
};

const getManagerZonesStatistics = async () => {
  const response = await axios.get(`${API_URL}/statistics/all`);
  return response.data;
};

export const managerZoneService = {
  getManagerZones,
  getManagerZoneDetails,
  createManagerZone,
  updateManagerZone,
  deleteManagerZone,
  assignCommercialToZone,
  unassignCommercialFromZone,
  getManagerZonesStatistics,
};
