import type {
  Department,
  Document,
  Folder,
  User
} from "@prisma/client";

type DepartmentLike = Pick<Department, "id" | "name" | "code" | "createdAt" | "updatedAt">;

type UserLike = Pick<User, "id" | "firstName" | "lastName" | "title" | "email">;

type FolderLike = Pick<Folder, "id" | "name" | "parentId" | "path" | "level" | "createdAt" | "updatedAt"> & {
  responsibleDepartment?: DepartmentLike | null;
  createdBy?: UserLike | null;
};

type DocumentLike = Pick<
  Document,
  | "id"
  | "folderId"
  | "name"
  | "originalFileName"
  | "mimeType"
  | "sizeBytes"
  | "documentType"
  | "validUntil"
  | "revisionNo"
  | "accessLevel"
  | "tags"
  | "storageBucket"
  | "storageKey"
  | "createdAt"
  | "updatedAt"
> & {
  responsibleDepartment?: DepartmentLike | null;
  responsibleUser?: UserLike | null;
  createdBy?: UserLike | null;
  folder?: Pick<Folder, "id" | "name" | "path"> | null;
};

export function mapDepartment(department: DepartmentLike) {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt
  };
}

export function mapUser(user: UserLike | null | undefined) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    email: user.email
  };
}

export function mapFolder(folder: FolderLike) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    path: folder.path,
    level: folder.level,
    responsibleDepartment: folder.responsibleDepartment
      ? mapDepartment(folder.responsibleDepartment)
      : null,
    createdBy: mapUser(folder.createdBy),
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
  };
}

export function mapDocument(document: DocumentLike) {
  return {
    id: document.id,
    folderId: document.folderId,
    name: document.name,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes.toString(),
    documentType: document.documentType,
    validUntil: document.validUntil,
    revisionNo: document.revisionNo,
    accessLevel: document.accessLevel,
    tags: document.tags,
    storageBucket: document.storageBucket,
    storageKey: document.storageKey,
    responsibleDepartment: document.responsibleDepartment
      ? mapDepartment(document.responsibleDepartment)
      : null,
    responsibleUser: mapUser(document.responsibleUser),
    createdBy: mapUser(document.createdBy),
    folder: document.folder
      ? {
          id: document.folder.id,
          name: document.folder.name,
          path: document.folder.path
        }
      : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}
