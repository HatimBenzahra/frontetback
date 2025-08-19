import axios from 'axios';
import { AssignmentType } from '@/types/enums';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/assignment-goals`;

const getAssignedZonesForCommercial = async (commercialId: string): Promise<any[]> => {
  const response = await axios.get(`${API_URL}/commercial/${commercialId}/zones`);
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

export const assignmentGoalsService = {
  getAssignedZonesForCommercial,
  assignZone,
  setMonthlyGoal,
  setGlobalGoal,
  getCurrentGlobalGoal,
  getAssignmentHistory,
};