import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/prospection`;

interface StartProspectionDto {
  commercialId: string;
  immeubleId: string;
  mode: 'SOLO' | 'DUO';
  partnerId?: string;
}

interface HandleProspectionRequestDto {
  requestId: string;
  accept: boolean;
}

interface ProspectionRequest {
  id: string;
  immeubleId: string;
  requesterId: string;
  partnerId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REFUSED';
  createdAt: string;
}

const startProspection = async (dto: StartProspectionDto, signal?: AbortSignal) => {
  const response = await axios.post(`${API_URL}/start`, dto, { signal });
  return response.data;
};

const handleProspectionRequest = async (dto: HandleProspectionRequestDto) => {
  const response = await axios.post(`${API_URL}/handle-request`, dto);
  return response.data;
};

const getAllProspectionRequests = async (): Promise<ProspectionRequest[]> => {
  const response = await axios.get(`${API_URL}/requests`);
  return response.data;
};

interface PendingProspectionRequest extends ProspectionRequest {
  immeuble: { adresse: string; ville: string; codePostal: string };
  requester: { nom: string; prenom: string };
}

const getPendingRequestsForCommercial = async (commercialId: string): Promise<PendingProspectionRequest[]> => {
  const response = await axios.get(`${API_URL}/requests/pending/${commercialId}`);
  return response.data;
};

const getRequestStatus = async (requestId: string) => {
  const response = await axios.get(`${API_URL}/requests/status/${requestId}`);
  console.log(`Frontend getRequestStatus response data for ${requestId}:`, response.data);
  return response.data;
};

export const prospectionService = {
  startProspection,
  handleProspectionRequest,
  getAllProspectionRequests,
  getPendingRequestsForCommercial,
  getRequestStatus,
};