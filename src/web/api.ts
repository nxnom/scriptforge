import { Spoosh, type StripPrefix } from "@spoosh/core";
import type { HonoToSpoosh } from "@spoosh/hono";
import { cachePlugin } from "@spoosh/plugin-cache";
import { deduplicationPlugin } from "@spoosh/plugin-deduplication";
import { gcPlugin } from "@spoosh/plugin-gc";
import { invalidationPlugin } from "@spoosh/plugin-invalidation";
import { refetchPlugin } from "@spoosh/plugin-refetch";
import { retryPlugin } from "@spoosh/plugin-retry";
import { create } from "@spoosh/react";
import type { ApiRoutes } from "../server/app";

type FullApiSchema = HonoToSpoosh<ApiRoutes>;
type ApiSchema = StripPrefix<FullApiSchema, "api">;

const spoosh = new Spoosh<ApiSchema, Error>("/api").use([
  cachePlugin({ staleTime: 30_000 }),
  deduplicationPlugin({ read: "in-flight" }),
  invalidationPlugin({ autoInvalidate: true }),
  retryPlugin({ retries: 2, retryDelay: 500 }),
  refetchPlugin({ refetchOnFocus: true, refetchOnReconnect: true }),
  gcPlugin({ maxAge: 5 * 60_000, maxEntries: 100, interval: 60_000 }),
]);

export const { useRead, useWrite, invalidate, clearCache } = create(spoosh);
