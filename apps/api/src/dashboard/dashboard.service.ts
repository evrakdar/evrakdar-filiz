import { withDocumentAccess, type DocumentViewer } from "../common/access";
import { daysFromToday, startOfToday } from "../common/dates";
import { Injectable } from "@nestjs/common";
import { mapDocument } from "../common/mappers";
import { ok } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";

const documentIncludes = {
  responsibleDepartment: true,
  responsibleUser: true,
  createdBy: true,
  folder: true
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(viewer?: DocumentViewer) {
    const [
      documentCount,
      folderCount,
      expiringDocumentCount
    ] = await Promise.all([
      this.prisma.document.count({ where: withDocumentAccess({ deletedAt: null }, viewer) }),
      this.prisma.folder.count(),
      this.prisma.document.count({
        where: withDocumentAccess(
          {
            deletedAt: null,
            validUntil: {
              gte: startOfToday(),
              lte: daysFromToday(30)
            }
          },
          viewer
        )
      })
    ]);

    return ok({
      totalDocuments: documentCount,
      totalFolders: folderCount,
      expiringDocuments: expiringDocumentCount
    });
  }

  async getRecentDocuments(viewer?: DocumentViewer) {
    const documents = await this.prisma.document.findMany({
      where: withDocumentAccess({ deletedAt: null }, viewer),
      include: documentIncludes,
      orderBy: [{ createdAt: "desc" }],
      take: 10
    });

    return ok(documents.map(mapDocument));
  }

  async getExpiringDocuments(viewer?: DocumentViewer) {
    const documents = await this.prisma.document.findMany({
      where: withDocumentAccess(
        {
          deletedAt: null,
          validUntil: {
            gte: startOfToday(),
            lte: daysFromToday(30)
          }
        },
        viewer
      ),
      include: documentIncludes,
      orderBy: [{ validUntil: "asc" }],
      take: 10
    });

    return ok(documents.map(mapDocument));
  }
}
