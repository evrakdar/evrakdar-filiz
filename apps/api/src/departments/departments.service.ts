import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuditRequestContext } from "../audit/audit.types";
import { mapDepartment } from "../common/mappers";
import { ok } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";
import type { DepartmentInputDto } from "./departments.controller";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async findAll() {
    const departments = await this.prisma.department.findMany({
      orderBy: [{ name: "asc" }]
    });

    return ok(departments.map(mapDepartment));
  }

  async create(body: DepartmentInputDto, auditContext?: AuditRequestContext) {
    const name = parseName(body.name);

    await this.ensureNameAvailable(name);

    const department = await this.prisma.department.create({
      data: { name, code: await this.buildUniqueCode(name) }
    });

    this.log(department.id, department.name, "Department created", auditContext);

    return ok(mapDepartment(department));
  }

  async rename(id: string, body: DepartmentInputDto, auditContext?: AuditRequestContext) {
    const name = parseName(body.name);

    await this.getExisting(id);
    await this.ensureNameAvailable(name, id);

    const department = await this.prisma.department.update({
      where: { id },
      data: { name }
    });

    this.log(department.id, department.name, "Department renamed", auditContext);

    return ok(mapDepartment(department));
  }

  async remove(id: string, auditContext?: AuditRequestContext) {
    const department = await this.getExisting(id);
    const [users, documents, folders] = await Promise.all([
      this.prisma.user.count({ where: { departmentId: id } }),
      this.prisma.document.count({ where: { responsibleDepartmentId: id } }),
      this.prisma.folder.count({ where: { responsibleDepartmentId: id } })
    ]);

    if (users + documents + folders > 0) {
      throw new ConflictException(
        `Bu birim kullanımda: ${users} kullanıcı, ${documents} belge, ${folders} klasör. Önce bunları başka bir birime aktarın.`
      );
    }

    await this.prisma.department.delete({ where: { id } });
    this.log(department.id, department.name, "Department deleted", auditContext);

    return ok({ id, deleted: true });
  }

  private async getExisting(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });

    if (!department) {
      throw new NotFoundException("Birim bulunamadı.");
    }

    return department;
  }

  private async ensureNameAvailable(name: string, currentId?: string) {
    const conflict = await this.prisma.department.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(currentId ? { id: { not: currentId } } : {})
      },
      select: { id: true }
    });

    if (conflict) {
      throw new ConflictException("Bu adla bir birim zaten var.");
    }
  }

  private async buildUniqueCode(name: string) {
    const base = toCode(name);

    for (let index = 1; index < 1000; index += 1) {
      const code = index === 1 ? base : `${base}${index}`;
      const taken = await this.prisma.department.findUnique({ where: { code }, select: { id: true } });

      if (!taken) {
        return code;
      }
    }

    throw new ConflictException("Birim kodu üretilemedi.");
  }

  private log(id: string, name: string, description: string, auditContext?: AuditRequestContext) {
    this.auditService.logAsync({
      action: "DEPARTMENT_CHANGE",
      entityType: "DEPARTMENT",
      entityId: id,
      entityName: name,
      description,
      context: auditContext
    });
  }
}

function parseName(value: string | undefined) {
  const name = value?.trim();

  if (!name || name.length < 2) {
    throw new BadRequestException("Birim adı en az 2 karakter olmalı.");
  }

  if (name.length > 100) {
    throw new BadRequestException("Birim adı en fazla 100 karakter olabilir.");
  }

  return name;
}

function toCode(name: string) {
  const code = name
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  return code || "BIRIM";
}
