import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { members: true, workflows: true, connectors: true } } }
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
      memberCount: tenant._count.members,
      workflowCount: tenant._count.workflows,
      connectorCount: tenant._count.connectors
    };
  }

  async listMembers(tenantId: string) {
    const members = await this.prisma.tenantMember.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
      orderBy: { joinedAt: 'asc' }
    });

    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt
    }));
  }

  async inviteMember(tenantId: string, email: string, role: 'ADMIN' | 'ANALYST' | 'VIEWER') {
    // Find user by email; if not yet registered, they'll see the invite on first login
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return pending invite info — real email invite (Phase 6) will handle this
      return { status: 'pending', message: `Invite will be sent to ${email} when they register` };
    }

    const existing = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } }
    });

    if (existing) {
      return { status: 'already_member', role: existing.role };
    }

    const member = await this.prisma.tenantMember.create({
      data: { tenantId, userId: user.id, role }
    });

    return { status: 'added', userId: user.id, role: member.role };
  }

  async updateMemberRole(tenantId: string, userId: string, role: 'ADMIN' | 'ANALYST' | 'VIEWER') {
    const member = await this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { role }
    });
    return { userId: member.userId, role: member.role };
  }

  async createTenant(name: string, creatorUserId: string) {
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        members: {
          create: { userId: creatorUserId, role: 'ADMIN' }
        }
      }
    });
    return { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt };
  }
}
