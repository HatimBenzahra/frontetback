import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtUtil {
  constructor(private configService: ConfigService) {}
  
  signSetup(userId: string): string {
    const secret = this.configService.get<string>('JWT_SETUP_SECRET');
    if (!secret) {
      throw new Error('JWT_SETUP_SECRET is not configured');
    }
    return jwt.sign(
      { sub: userId }, 
      secret, 
      { expiresIn: '15m' }
    );
  }
  
  verifySetup(token: string): string {
    try {
      const secret = this.configService.get<string>('JWT_SETUP_SECRET');
      if (!secret) {
        throw new Error('JWT_SETUP_SECRET is not configured');
      }
      const payload = jwt.verify(token, secret) as { sub: string };
      return payload.sub;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // ───────────────── Reset password tokens (distinct type) ─────────────────
  signReset(userId: string): string {
    const secret = this.configService.get<string>('JWT_SETUP_SECRET');
    if (!secret) {
      throw new Error('JWT_SETUP_SECRET is not configured');
    }
    return jwt.sign(
      { sub: userId, typ: 'reset' },
      secret,
      { expiresIn: '15m' }
    );
  }

  verifyReset(token: string): string {
    try {
      const secret = this.configService.get<string>('JWT_SETUP_SECRET');
      if (!secret) {
        throw new Error('JWT_SETUP_SECRET is not configured');
      }
      const payload = jwt.verify(token, secret) as { sub: string; typ?: string };
      if (payload.typ !== 'reset') {
        throw new Error('Invalid or expired token');
      }
      return payload.sub;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}
