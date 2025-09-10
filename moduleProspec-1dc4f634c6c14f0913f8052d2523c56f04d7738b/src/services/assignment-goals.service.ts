import axios from 'axios';
import { AssignmentType } from '@/types/enums';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/assignment-goals`;

const getAssignedZonesForCommercial = async (commercialId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}/zones`);
  return response.data;
};

const getAssignedZonesForEquipe = async (equipeId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/equipe/${equipeId}/zones`);
  return response.data;
};

// On inclut les autres fonctions pour que le service soit complet
const assignZone = async (
  zoneId: string,
  assigneeId: string,
  assigneeType: AssignmentType,
  startDate?: string,
  durationDays?: number,
  assignedByUserId?: string,
  assignedByUserName?: string
) => {
  const payload: any = { zoneId, assigneeId, assignmentType: assigneeType };
  if (startDate) payload.startDate = startDate;
  if (durationDays && durationDays > 0) payload.durationDays = durationDays;
  if (assignedByUserId) payload.assignedByUserId = assignedByUserId;
  if (assignedByUserName) payload.assignedByUserName = assignedByUserName;
  const response = await axios.post(`${API_URL}/assign-zone`, payload);
  return response.data;
};

const setMonthlyGoal = async (commercialId: string, goal: number, month: number, year: number) => {
  const payload = { commercialId, goal, month, year };
  const response = await axios.post(`${API_URL}/set-monthly-goal`, payload);
  return response.data;
};

const setGlobalGoal = async (
  goal: number,
  startDate?: string,
  durationMonths?: number,
) => {
  const payload: any = { goal };
  if (startDate) payload.startDate = startDate;
  if (durationMonths && durationMonths > 0) payload.durationMonths = durationMonths;
  const response = await axios.post(`${API_URL}/set-global-goal`, payload);
  return response.data;
};

const getCurrentGlobalGoal = async () => {
  const response = await axios.get(`${API_URL}/global-goal/current`);
  return response.data;
};

const getAssignmentHistory = async (zoneId?: string): Promise<any[]> => {
  const url = zoneId ? `${API_URL}/history?zoneId=${zoneId}` : `${API_URL}/history`;
  const response = await axios.get(url);
  return response.data;
};

const getCommercialsInZone = async (zoneId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/zone/${zoneId}/commercials`);
  return response.data;
};

const getCommercialsForManager = async (managerId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/manager/${managerId}/commercials`);
  return response.data;
};

const getCommercialsForEquipe = async (equipeId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/equipe/${equipeId}/commercials`);
  return response.data;
};

const getCommercialAssignmentSummary = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}/summary`);
  return response.data;
};

const getActiveZoneForCommercial = async (commercialId: string): Promise<any> => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}/active-zone`);
  return response.data;
};

const getAllAssignmentsWithStatus = async (): Promise<any> => {
  const response = await axios.get(`${API_URL}/admin/assignments-status`);
  return response.data;
};

const stopAssignment = async (assignmentId: string): Promise<any> => {
  const response = await axios.patch(`${API_URL}/stop-assignment/${assignmentId}`);
  return response.data;
};

// Nouvelle fonction pour transférer automatiquement les assignations expirées vers l'historique
const transferExpiredAssignmentsToHistory = async (): Promise<any> => {
  const response = await axios.post(`${API_URL}/transfer-expired-to-history`);
  return response.data;
};

// Fonction pour nettoyer automatiquement les assignations expirées (appelée périodiquement)
const cleanupExpiredAssignments = async (): Promise<any> => {
  const response = await axios.post(`${API_URL}/cleanup-expired`);
  return response.data;
};

export const assignmentGoalsService = {
  getAssignedZonesForCommercial,
  getAssignedZonesForEquipe,
  assignZone,
  setMonthlyGoal,
  setGlobalGoal,
  getCurrentGlobalGoal,
  getAssignmentHistory,
  getCommercialsInZone,
  getCommercialsForManager,
  getCommercialsForEquipe,
  getCommercialAssignmentSummary,
  getActiveZoneForCommercial,
  getAllAssignmentsWithStatus,
  stopAssignment,
  transferExpiredAssignmentsToHistory,
  cleanupExpiredAssignments,
};