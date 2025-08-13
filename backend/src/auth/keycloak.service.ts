import { Injectable, HttpException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private kc: AxiosInstance;
  
  constructor(private configService: ConfigService) {
    this.kc = axios.create({
      baseURL: `${this.cfg('KEYCLOAK_BASE_URL')}/admin/realms/${this.cfg('KEYCLOAK_REALM')}`,
    });
  }

  /* ───── Token admin (grant_type=client_credentials) ───── */
  private async getAdminToken(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.cfg('KEYCLOAK_CLIENT_ID'),
      client_secret: this.cfg('KEYCLOAK_CLIENT_SECRET'),
    });
    
    try {
      const { data } = await axios.post(
        `${this.cfg('KEYCLOAK_BASE_URL')}/realms/${this.cfg('KEYCLOAK_REALM')}/protocol/openid-connect/token`, 
        params, 
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      return data.access_token;
    } catch (error: any) {
      this.logger.error('Failed to get admin token', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      throw new HttpException(`Failed to authenticate with Keycloak: ${error.response?.data?.error || error.message}`, 500);
    }
  }
  
  private cfg(key: string): string { 
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing configuration: ${key}`);
    }
    return value;
  }
  
  private async hdr() { 
    return { Authorization: `Bearer ${await this.getAdminToken()}` }; 
  }

  /* ───── API publiques ───── */
  async createUser({ 
    email, 
    firstName, 
    lastName, 
    role 
  }: { 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: 'admin' | 'manager' | 'commercial'; 
  }): Promise<string> {
    try {
      const response = await this.kc.post('/users', {
        username: email,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: true,
      }, { headers: await this.hdr() });

      // Get the user ID from Location header
      const userId = response.headers.location?.split('/').pop();
      if (!userId) {
        throw new Error('Failed to get user ID from response');
      }

      await this.assignRole(userId, role);
      return userId;
    } catch (error) {
      this.logger.error(`Failed to create user ${email}`, error);
      throw new HttpException('Failed to create user in Keycloak', 500);
    }
  }

  async setPassword(userId: string, password: string): Promise<void> {
    try {
      await this.kc.put(
        `/users/${userId}/reset-password`, 
        { 
          type: 'password', 
          value: password, 
          temporary: false 
        }, 
        { headers: await this.hdr() }
      );
    } catch (error) {
      this.logger.error(`Failed to set password for user ${userId}`, error);
      throw new HttpException('Failed to set password', 500);
    }
  }

  async login(email: string, password: string) {
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.cfg('KEYCLOAK_CLIENT_ID'),
      client_secret: this.cfg('KEYCLOAK_CLIENT_SECRET'),
      username: email,
      password,
      scope: 'openid email profile roles',
    });
    
    try {
      const { data } = await axios.post(
        `${this.cfg('KEYCLOAK_BASE_URL')}/realms/${this.cfg('KEYCLOAK_REALM')}/protocol/openid-connect/token`, 
        params, 
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      return data;  
    } catch (error) {
      this.logger.error(`Login failed for ${email}`, error);
      throw new HttpException('Invalid credentials', 401);
    }
  }

  async getUserByEmail(email: string) {
    try {
      const { data } = await this.kc.get(`/users?email=${email}`, { headers: await this.hdr() });
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email}`, error);
      throw new HttpException('Failed to get user', 500);
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    try {
      const { data } = await this.kc.get(`/users/${userId}/role-mappings/realm`, { headers: await this.hdr() });
      return data.map((role: any) => role.name);
    } catch (error) {
      this.logger.error(`Failed to get roles for user ${userId}`, error);
      return [];
    }
  }

  async getUserGroups(userId: string): Promise<string[]> {
    try {
      const { data } = await this.kc.get(`/users/${userId}/groups`, { headers: await this.hdr() });
      // data is array of groups with fields like id, name, path
      return Array.isArray(data) ? data.map((g: any) => g?.name).filter(Boolean) : [];
    } catch (error) {
      this.logger.error(`Failed to get groups for user ${userId}`, error);
      return [];
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.kc.delete(`/users/${userId}`, { headers: await this.hdr() });
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}`, error);
      throw new HttpException('Failed to delete user', 500);
    }
  }

  /* ───── Helpers ───── */
  private async assignRole(userId: string, roleName: 'admin' | 'manager' | 'commercial'): Promise<void> {
    try {
      const { data: role } = await this.kc.get(`/roles/${roleName}`, { headers: await this.hdr() });
      if (!role) {
        this.logger.warn(`Role ${roleName} not found`);
        return;
      }
      await this.kc.post(`/users/${userId}/role-mappings/realm`, [role], { headers: await this.hdr() });
    } catch (error) {
      this.logger.error(`Failed to assign role ${roleName} to user ${userId}`, error);
      // Don't throw here as user creation should still succeed
    }
  }

  async ensureRolesExist(): Promise<void> {
    const roles = ['admin', 'manager', 'commercial'];
    
    for (const roleName of roles) {
      try {
        await this.kc.get(`/roles/${roleName}`, { headers: await this.hdr() });
      } catch (error) {
        if (error.response?.status === 404) {
          try {
            await this.kc.post('/roles', {
              name: roleName,
              description: `Role for ${roleName}s in the prospection system`
            }, { headers: await this.hdr() });
            this.logger.log(`Created role: ${roleName}`);
          } catch (createError) {
            this.logger.error(`Failed to create role ${roleName}`, createError);
          }
        }
      }
    }
  }
}