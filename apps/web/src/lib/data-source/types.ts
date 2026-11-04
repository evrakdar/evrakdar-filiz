import type {
  DocumentItem,
  MainCategory,
  SubCategory,
  UserProfile
} from "@/lib/mock-data";
import type { DataSourceMode } from "./config";

export type DashboardData = {
  source: DataSourceMode;
  currentUser: UserProfile;
  mainCategories: MainCategory[];
  documents: DocumentItem[];
  favorites: DocumentItem[];
  frequentlyUsed: string[];
};

export type FolderNavigationData = {
  subCategories: SubCategory[];
  documents: DocumentItem[];
  breadcrumb: FolderBreadcrumbItem[];
};

export type FolderBreadcrumbItem = {
  id: string;
  title: string;
  path?: string;
};

export type DashboardDataSource = {
  getDashboardData: () => DashboardData | Promise<DashboardData>;
};

export type { DocumentItem, MainCategory, SubCategory, UserProfile } from "@/lib/mock-data";
