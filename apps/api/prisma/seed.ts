import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { compareSync, hashSync } from "bcryptjs";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";

config({ quiet: true });
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for Prisma seed");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const isProduction = process.env.NODE_ENV === "production";
const seedDemoUsers = process.env.SEED_DEMO_USERS === "true";
const seedReset = process.env.SEED_RESET === "true";

if (isProduction && (seedDemoUsers || seedReset)) {
  throw new Error("SEED_DEMO_USERS and SEED_RESET are development-only and refuse to run with NODE_ENV=production.");
}

const DEFAULT_PASSWORD = "1234";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Starting accounts of a real installation. Their password must be changed.
const defaultAccounts = [
  { username: "admin", role: "ADMIN", firstName: "Sistem", lastName: "Yöneticisi", title: "Sistem Yöneticisi" },
  { username: "editor", role: "EDITOR", firstName: "Belge", lastName: "Düzenleyici", title: "Belge Düzenleyici" },
  { username: "user", role: "VIEWER", firstName: "Örnek", lastName: "Kullanıcı", title: "Kullanıcı" }
] as const;

// Same rule as apps/api/src/auth/install-mode.ts; the seed runs outside the API build.
function isLocalOnlyInstall() {
  if (!isProduction) {
    return true;
  }

  if (process.env.TRUST_PROXY?.trim()) {
    return false;
  }

  const bindHost = (process.env.API_BIND?.trim() ?? "").replace(/:\d+$/, "");
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (
    LOCAL_HOSTS.has(bindHost) &&
    origins.length > 0 &&
    origins.every((origin) => {
      try {
        return LOCAL_HOSTS.has(new URL(origin).hostname);
      } catch {
        return false;
      }
    })
  );
}

// Demo accounts exist only for local development and automated tests (SEED_DEMO_USERS=true).
const demoUsers = [
  { username: "admin", password: "admin123", role: "ADMIN", lastName: "Admin", title: "Sistem Yöneticisi" },
  { username: "editor", password: "editor123", role: "EDITOR", lastName: "Editor", title: "Doküman Düzenleyici" },
  { username: "viewer", password: "viewer123", role: "VIEWER", lastName: "Viewer", title: "Doküman Görüntüleyici" }
] as const;

type RoleName = (typeof demoUsers)[number]["role"];

type SeedDepartment = {
  code: string;
  name: string;
};

type FolderNode = {
  name: string;
  departmentCode: string;
  folders?: FolderNode[];
};

const seedDepartments: SeedDepartment[] = [
  { code: "KAL", name: "Kalite Birimi" },
  { code: "AKD", name: "Akademik Birimler" },
  { code: "IDR", name: "İdari İşler" },
  { code: "YON", name: "Yönetim" }
];

// Generic starter tree for a school or small institution. Only created when no folders exist yet.
const documentTree: FolderNode[] = [
  {
    name: "Akademik",
    departmentCode: "AKD",
    folders: [
      { name: "Erasmus+ Bilgi Paketleri", departmentCode: "AKD" },
      { name: "Ders Planları", departmentCode: "AKD" },
      { name: "Tanıtım Sunumları", departmentCode: "AKD" }
    ]
  },
  {
    name: "İdari",
    departmentCode: "IDR",
    folders: [
      { name: "Toplantı Tutanakları", departmentCode: "IDR" },
      { name: "Personel Dosyaları", departmentCode: "IDR" },
      { name: "Anket Raporları", departmentCode: "IDR" }
    ]
  },
  {
    name: "Kalite & Akreditasyon",
    departmentCode: "KAL",
    folders: [
      { name: "Kalite El Kitabı", departmentCode: "KAL" },
      { name: "Prosedürler", departmentCode: "KAL" },
      { name: "Talimatlar", departmentCode: "KAL" },
      { name: "Formlar", departmentCode: "KAL" },
      { name: "İç Tetkik Raporları", departmentCode: "KAL" },
      { name: "Akreditasyon Raporları", departmentCode: "KAL" }
    ]
  },
  {
    name: "Sistem & Yönetim",
    departmentCode: "YON",
    folders: [
      { name: "Yönetmelikler ve Yönergeler", departmentCode: "YON" },
      { name: "Kullanım Kılavuzları", departmentCode: "YON" }
    ]
  }
];

async function main() {
  const departments = await seedDepartmentData();
  const roles = await seedRoles();

  if (seedReset) {
    console.warn("[seed] SEED_RESET=true: deleting all folders, documents, favorites, approvals and audit logs.");
    await cleanDocumentData();
  }

  const adminUser = seedDemoUsers
    ? await seedDemoAccounts(departments.YON.id, roles)
    : process.env.SEED_ADMIN_PASSWORD?.trim()
      ? await seedInitialAdmin(departments.YON.id, roles.ADMIN.id)
      : await seedDefaultAccounts(departments.YON.id, roles);

  if ((await prisma.folder.count()) === 0) {
    for (const node of documentTree) {
      await seedFolderNode(node, null, "", 0, departments, adminUser.id);
    }
  }
}

async function cleanDocumentData() {
  await prisma.$transaction([
    prisma.favorite.deleteMany(),
    prisma.recentView.deleteMany(),
    prisma.approvalRequest.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.document.deleteMany(),
    prisma.folder.deleteMany()
  ]);
}

async function seedDepartmentData() {
  const entries = await Promise.all(
    seedDepartments.map((department) =>
      prisma.department.upsert({
        where: { code: department.code },
        update: {},
        create: department
      })
    )
  );

  return Object.fromEntries(entries.map((department) => [department.code, department])) as Record<
    string,
    (typeof entries)[number]
  >;
}

async function seedRoles() {
  const [adminRole, editorRole, viewerRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "ADMIN" },
      update: { description: "Sistem yöneticisi" },
      create: { name: "ADMIN", description: "Sistem yöneticisi" }
    }),
    prisma.role.upsert({
      where: { name: "EDITOR" },
      update: { description: "Doküman oluşturur ve günceller" },
      create: { name: "EDITOR", description: "Doküman oluşturur ve günceller" }
    }),
    prisma.role.upsert({
      where: { name: "VIEWER" },
      update: { description: "Dokümanları görüntüler" },
      create: { name: "VIEWER", description: "Dokümanları görüntüler" }
    })
  ]);

  return { ADMIN: adminRole, EDITOR: editorRole, VIEWER: viewerRole } satisfies Record<RoleName, { id: string }>;
}

/**
 * Creates the starting accounts on an empty system and never recreates them afterwards.
 * Once the system is open to the network, any account still on the public password gets a random one.
 */
async function seedDefaultAccounts(departmentId: string, roles: Record<RoleName, { id: string }>) {
  const localOnly = isLocalOnlyInstall();

  if ((await prisma.user.count()) === 0) {
    for (const account of defaultAccounts) {
      const user = await prisma.user.create({
        data: {
          username: account.username,
          passwordHash: hashSync(DEFAULT_PASSWORD, 10),
          mustChangePassword: true,
          firstName: account.firstName,
          lastName: account.lastName,
          title: account.title,
          email: `${account.username}@example.com`,
          departmentId,
          isActive: true
        }
      });
      await ensureRole(user.id, roles[account.role].id);
    }

    if (localOnly) {
      console.log("");
      console.log("==============================================================");
      console.log(" Baslangic hesaplari hazir. Sifrelerini ilk giriste degistirin.");
      for (const account of defaultAccounts) {
        console.log(`   ${account.username.padEnd(8)} sifre: ${DEFAULT_PASSWORD}`);
      }
      console.log("==============================================================");
      console.log("");
    }
  }

  if (!localOnly) {
    await replacePublicPasswords();
  }

  const admin = await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { roleId: roles.ADMIN.id } } },
    orderBy: { createdAt: "asc" }
  });

  if (!admin) {
    throw new Error("No active administrator found.");
  }

  return admin;
}

async function replacePublicPasswords() {
  const pending = await prisma.user.findMany({ where: { mustChangePassword: true, isActive: true } });
  const replaced: Array<{ username: string; password: string }> = [];

  for (const user of pending) {
    if (!compareSync(DEFAULT_PASSWORD, user.passwordHash)) {
      continue;
    }

    // The ending meets the password rule whatever the random part happens to contain.
    const password = `${randomBytes(12).toString("base64url")}Aa1!`;

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashSync(password, 10) }
    });
    replaced.push({ username: user.username, password });
  }

  if (replaced.length > 0) {
    console.log("");
    console.log("==============================================================");
    console.log(" Sistem aga acik: hazir sifreler kapatildi, yenileri asagida.");
    console.log(" Bu sifreler bir daha gosterilmez. Ilk giriste degistirilmesi istenir.");
    for (const item of replaced) {
      console.log(`   ${item.username.padEnd(12)} sifre: ${item.password}`);
    }
    console.log("==============================================================");
    console.log("");
  }
}

/** Creates one administrator from SEED_ADMIN_PASSWORD; an existing account is left untouched. */
async function seedInitialAdmin(departmentId: string, adminRoleId: string) {
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`[seed] Admin user "${username}" already exists; password left unchanged.`);
    await ensureRole(existing.id, adminRoleId);
    return existing;
  }

  const password = process.env.SEED_ADMIN_PASSWORD?.trim() ?? "";

  if (password.length < 12 || !/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/\p{Nd}/u.test(password) || !/[^\p{L}\p{N}\s]/u.test(password)) {
    throw new Error("SEED_ADMIN_PASSWORD: en az 12 karakter, bir buyuk harf, bir kucuk harf, bir rakam ve bir sembol olmali.");
  }

  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash: hashSync(password, 12),
      firstName: process.env.SEED_ADMIN_FIRST_NAME?.trim() || "Sistem",
      lastName: process.env.SEED_ADMIN_LAST_NAME?.trim() || "Yöneticisi",
      title: "Sistem Yöneticisi",
      email: process.env.SEED_ADMIN_EMAIL?.trim() || `${username}@example.com`,
      departmentId,
      isActive: true
    }
  });
  await ensureRole(admin.id, adminRoleId);
  console.log(`[seed] Admin user "${username}" created from SEED_ADMIN_PASSWORD.`);

  return admin;
}

async function seedDemoAccounts(departmentId: string, roles: Record<RoleName, { id: string }>) {
  console.warn("[seed] SEED_DEMO_USERS=true: creating demo accounts with public passwords. Development only.");
  let adminUser: { id: string } | null = null;

  for (const demo of demoUsers) {
    const data = {
      passwordHash: hashSync(demo.password, 10),
      firstName: "Demo",
      lastName: demo.lastName,
      title: demo.title,
      email: `${demo.username}@example.com`,
      departmentId,
      isActive: true
    };
    const user = await prisma.user.upsert({
      where: { username: demo.username },
      update: data,
      create: { username: demo.username, ...data }
    });
    const roleId = roles[demo.role].id;

    await ensureRole(user.id, roleId);
    await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: { not: roleId } } });

    if (demo.role === "ADMIN") {
      adminUser = user;
    }
  }

  if (!adminUser) {
    throw new Error("Demo admin could not be created");
  }

  return adminUser;
}

async function ensureRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId }
  });
}

async function seedFolderNode(
  node: FolderNode,
  parentId: string | null,
  parentPath: string,
  level: number,
  departments: Record<string, { id: string }>,
  createdById: string
) {
  const departmentId = departments[node.departmentCode]?.id ?? departments.YON.id;
  const path = joinPath(parentPath, node.name);
  const folder = await prisma.folder.create({
    data: {
      name: node.name,
      parentId,
      path,
      level,
      responsibleDepartmentId: departmentId,
      createdById
    }
  });

  for (const child of node.folders ?? []) {
    await seedFolderNode(child, folder.id, path, level + 1, departments, createdById);
  }

  return folder;
}

function joinPath(parentPath: string, name: string) {
  return `${parentPath}/${slugify(name)}`;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
