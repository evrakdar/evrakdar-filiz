import { getDataSourceMode } from "./config";
import { getApiDashboardData } from "./api-source";
import { getMockDashboardData } from "./mock-source";
import type { DashboardData, DashboardDataSource } from "./types";

export function getInitialDashboardData(): DashboardData {
  return getMockDashboardData();
}

export function getDashboardDataSource(): DashboardDataSource {
  return getDataSourceMode() === "api"
    ? { getDashboardData: getApiDashboardData }
    : { getDashboardData: getMockDashboardData };
}

export async function loadDashboardData(): Promise<DashboardData> {
  return getDashboardDataSource().getDashboardData();
}

