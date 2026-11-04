import {
  currentUser,
  documents,
  favorites,
  frequentlyUsed,
  mainCategories
} from "@/lib/mock-data";
import type { DashboardData } from "./types";

export function getMockDashboardData(): DashboardData {
  return {
    source: "mock",
    currentUser,
    mainCategories,
    documents,
    favorites,
    frequentlyUsed
  };
}

export const mockSource = {
  getDashboardData: getMockDashboardData
};
