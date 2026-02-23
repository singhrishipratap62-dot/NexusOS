import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, importJWK } from 'jose';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'nexusos-dev-secret-change-in-production'
);
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface JwtPayload {
  sub: string;       // userId
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async generateTokenPair(userId: string, tenantId: string, role: string) {
    const accessToken = await new SignJWT({ tenantId, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
      .sign(JWT_SECRET);

    const refreshToken = randomBytes(48).toString('hex');

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return payload as unknown as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async storeRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const tokenHash = this.hashToken(token);

    await this.prisma.refreshToken.create({
      data: { userId, token: tokenHash, expiresAt }
    });
  }

  async rotateRefreshToken(token: string) {
    const tokenHash = this.hashToken(token);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: { include: { memberships: true } } }
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const membership = stored.user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('No tenant membership found');
    }

    const tokens = await this.generateTokenPair(
      stored.userId,
      membership.tenantId,
      membership.role
    );
    await this.storeRefreshToken(stored.userId, tokens.refreshToken);

    return {
      user: { id: stored.user.id, email: stored.user.email, name: stored.user.name },
      tokens
    };
  }

  async revokeRefreshToken(token: string) {
    const tokenHash = this.hashToken(token);
    await this.prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
  }

  private hashToken(token: string): string {
    return createHmac('sha256', 'nexusos-refresh-key').update(token).digest('hex');
  }
}
