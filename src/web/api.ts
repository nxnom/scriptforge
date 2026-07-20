import { Spoosh, type StripPrefix } from "@spoosh/core";
import type { HonoToSpoosh } from "@spoosh/hono";
import { cachePlugin } from "@spoosh/plugin-cache";
import { deduplicationPlugin } from "@spoosh/plugin-deduplication";
import { invalidationPlugin } from "@spoosh/plugin-invalidation";
import { optimisticPlugin } from "@spoosh/plugin-optimistic";
import { create } from "@spoosh/react";
import type { ApiRoutes } from "../server/app";

type FullApiSchema = HonoToSpoosh<ApiRoutes>;
type ApiSchema = StripPrefix<FullApiSchema, "api">;

const spoosh = new Spoosh<ApiSchema, Error>("/api").use([
  cachePlugin({ staleTime: 30_000 }),
  deduplicationPlugin({ read: "in-flight" }),
  invalidationPlugin({ autoInvalidate: true }),
  optimisticPlugin(),
]);

export const { useRead, useWrite, invalidate, clearCache } = create(spoosh);
