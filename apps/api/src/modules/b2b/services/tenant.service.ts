import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateTenantDto, TenantBrandingDto, TenantRole } from '@ai-interview/contracts';
import * as crypto from 'crypto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(creatorUserId: string, dto: CreateTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain || null,
        brandingConfig: dto.brandingConfig
          ? (dto.brandingConfig as any)
          : { primaryColor: '#059669', accentColor: '#10b981' },
        isActive: true,
      },
    });

    // Make creator TENANT_ADMIN
    await this.prisma.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId: creatorUserId,
        role: TenantRole.TENANT_ADMIN,
      },
    });

    return tenant;
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        members: { include: { user: { include: { profile: true } } } },
        cohorts: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant organization not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      brandingConfig: tenant.brandingConfig,
      isActive: tenant.isActive,
      memberCount: tenant.members.length,
      cohortCount: tenant.cohorts.length,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async updateBranding(tenantId: string, branding: TenantBrandingDto) {
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        brandingConfig: branding as any,
      },
    });

    return updated;
  }

  async createApiKey(tenantId: string, name: string) {
    const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.tenantApiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        isActive: true,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      apiKey: rawKey,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(tenantId: string) {
    const keys = await this.prisma.tenantApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(k => ({
      id: k.id,
      tenantId: k.tenantId,
      name: k.name,
      lastUsed: k.lastUsed,
      isActive: k.isActive,
      createdAt: k.createdAt,
    }));
  }
}
