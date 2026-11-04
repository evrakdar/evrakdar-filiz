export type DataSourceMode = "mock" | "api";

export function getDataSourceMode(): DataSourceMode {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" ? "mock" : "api";
}
