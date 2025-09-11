import axios from 'axios';
import { API_BASE_URL } from '../config';
import { cookieUtils } from '../utils/cookies';

export const authApi = axios.create({
  baseURL: API_BASE_URL,
});

export interface LoginResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    localId?: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'manager' | 'commercial' | 'directeur' | 'backoffice';
  };
}

export interface SetupPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResendSetupResponse {
  success: boolean;
  message: string;
  setupLink?: string;
}

export const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await authApi.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Setup password with token
   */
  async setupPassword(token: string, password: string): Promise<SetupPasswordResponse> {
    const response = await authApi.post(`/auth/setup-password?token=${token}`, { password });
    return response.data;
  },

  /**
   * Request password reset link
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }>{
    const response = await authApi.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset password using token
   */
  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }>{
    const response = await authApi.post(`/auth/reset-password?token=${token}`, { password });
    return response.data;
  },

  /**
   * Resend password setup link
   */
  async resendSetup(email: string): Promise<ResendSetupResponse> {
    const response = await authApi.post('/auth/resend-setup', { email });
    return response.data;
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const refreshToken = cookieUtils.getCookie('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await authApi.post('/auth/refresh-token', { refresh_token: refreshToken });
    return response.data;
  },

  /**
   * Store token in localStorage
   */
  storeToken(token: string): void {
    localStorage.setItem('access_token', token);
  },

  /**
   * Store refresh token in cookies
   */
  storeRefreshToken(token: string): void {
    cookieUtils.setCookie('refresh_token', token, 30);
  },

  /**
   * Get token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  /**
   * Get refresh token from cookies
   */
  getRefreshToken(): string | null {
    return cookieUtils.getCookie('refresh_token');
  },

  /**
   * Remove tokens from localStorage and cookies
   */
  removeToken(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    cookieUtils.deleteCookie('refresh_token');
  },

  /**
   * Store user info
   */
  storeUser(user: any): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Get user info
   */
  getUser(): any | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  /**
   * Logout user
   */
  logout(): void {
    this.removeToken();
    window.location.href = '/login';
  }
};

// Add token to requests if available
authApi.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Simple response interceptor for authApi (global interceptor handles refresh)
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);
