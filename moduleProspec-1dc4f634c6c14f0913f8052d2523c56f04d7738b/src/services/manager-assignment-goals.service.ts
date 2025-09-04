import axios from 'axios';
import { AssignmentType } from '@/types/enums';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/manager-space/assignment-goals`;

// Service pour les assignment goals dans l'espace manager
// Utilise uniquement les endpoints manager-space qui sont protégés par les guards

const getManagerAssignments = async (): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/assignments`);
  return response.data;
};

const getManagerAssignmentHistory = async (): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/history`);
  return response.data;
};

const getManagerZones = async (): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/zones`);
  return response.data;
};

const getManagerCommercials = async (): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/commercials`);
  return response.data;
};

const getManagerEquipes = async (): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/equipes`);
  return response.data;
};

const assignZoneToManager = async (
  zoneId: string,
  assigneeId: string,
  assigneeType: AssignmentType,
  startDate?: string,
  durationDays?: number,
  assignedByUserId?: string,
  assignedByUserName?: string
) => {
  const payload: any = { 
    zoneId, 
    assigneeId, 
    assignmentType: assigneeType 
  };
  if (startDate) payload.startDate = startDate;
  if (durationDays && durationDays > 0) payload.durationDays = durationDays;
  if (assignedByUserId) payload.assignedByUserId = assignedByUserId;
  if (assignedByUserName) payload.assignedByUserName = assignedByUserName;
  
  const response = await axios.post(`${API_URL}/assign-zone`, payload);
  return response.data;
};

const stopManagerAssignment = async (assignmentId: string): Promise<any> => {
  const response = await axios.patch(`${API_URL}/stop-assignment/${assignmentId}`);
  return response.data;
};

const getCurrentGlobalGoal = async () => {
  const response = await axios.get(`${API_URL}/global-goal/current`);
  return response.data;
};

// Fonctions spécifiques manager pour récupérer les commerciaux d'équipe
const getCommercialsForEquipe = async (equipeId: string): Promise<any[]> => {
  // On utilise le service manager pour récupérer les équipes avec leurs commerciaux
  const response = await axios.get(`${API_BASE_URL}/manager-space/equipes/${equipeId}`);
  return response.data.commerciaux || [];
};

export const managerAssignmentGoalsService = {
  getManagerAssignments,
  getManagerAssignmentHistory,
  getManagerZones,
  getManagerCommercials,
  getManagerEquipes,
  assignZoneToManager,
  stopManagerAssignment,
  getCurrentGlobalGoal,
  getCommercialsForEquipe,
};