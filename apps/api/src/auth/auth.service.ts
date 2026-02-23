import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name }
    });

    // Auto-create a personal tenant for the first user
    const tenant = await this.prisma.tenant.create({
      data: {
        name: name ? `${name}'s Workspace` : `${email}'s Workspace`,
        members: {
          create: { userId: user.id, role: 'ADMIN' }
        }
      }
    });

    const tokens = await this.jwtTokenService.generateTokenPair(user.id, tenant.id, 'ADMIN');
    await this.jwtTokenService.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: { id: user.id, email: user.email, name: user.name }, tenant, tokens };
  }

  async login(email: string, password: string, tenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Pick tenant: use provided tenantId if member, else pick first membership
    const membership = tenantId
      ? user.memberships.find((m) => m.tenantId === tenantId)
      : user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException('No tenant access');
    }

    const tokens = await this.jwtTokenService.generateTokenPair(
      user.id,
      membership.tenantId,
      membership.role
    );
    await this.jwtTokenService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenantId: membership.tenantId,
      role: membership.role,
      tokens
    };
  }

  async refresh(refreshToken: string) {
    return this.jwtTokenService.rotateRefreshToken(refreshToken);
  }

  async logout(refreshToken: string) {
    await this.jwtTokenService.revokeRefreshToken(refreshToken);
  }
}
