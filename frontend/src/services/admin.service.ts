import axios from 'axios';
import { API_BASE_URL } from '../config';

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
});

// Add token to requests
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface CreateCommercialWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipeId: string;
  managerId: string;
}

export interface CreateManagerWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

export interface CreateDirecteurWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

export const adminService = {
  /**
   * Create a new commercial with Keycloak integration
   */
  async createCommercial(data: CreateCommercialWithAuthDto) {
    const response = await adminApi.post('/commerciaux', data);
    return response.data;
  },

  /**
   * Create a new manager with Keycloak integration
   */
  async createManager(data: CreateManagerWithAuthDto) {
    const response = await adminApi.post('/managers', data);
    return response.data;
  },

  /**
   * Update a commercial
   */
  async updateCommercial(id: string, data: Partial<CreateCommercialWithAuthDto>) {
    const response = await adminApi.patch(`/commerciaux/${id}`, data);
    return response.data;
  },

  /**
   * Delete a commercial (removes from both Keycloak and database)
   */
  async deleteCommercial(id: string) {
    const response = await adminApi.delete(`/commerciaux/${id}`);
    return response.data;
  },

  /**
   * Delete a manager (removes from both Keycloak and database)
   */
  async deleteManager(id: string) {
    const response = await adminApi.delete(`/managers/${id}`);
    return response.data;
  },

  /**
   * Create a new directeur with Keycloak integration
   */
  async createDirecteur(data: CreateDirecteurWithAuthDto) {
    const response = await adminApi.post('/directeurs', data);
    return response.data;
  },

  /**
   * Delete a directeur (removes from both Keycloak and database)
   */
  async deleteDirecteur(id: string) {
    const response = await adminApi.delete(`/directeurs/${id}`);
    return response.data;
  },
};
