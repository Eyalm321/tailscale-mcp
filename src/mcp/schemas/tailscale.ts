import { z } from "zod";

export const DeviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string().optional(),
  os: z.string().optional(),
  online: z.boolean().optional(),
  authorized: z.boolean().optional(),
  lastSeen: z.string().optional(),
  addresses: z.array(z.string()).default([]),
  advertisedRoutes: z.array(z.string()).default([]),
  enabledRoutes: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type DeviceSummary = z.infer<typeof DeviceSummarySchema>;

export const TailnetSummarySchema = z.object({
  name: z.string().optional(),
  organization: z.string().optional(),
  dns: z.unknown().optional(),
  magicDNS: z.boolean().optional(),
  fileSharing: z.boolean().optional(),
  networkLockEnabled: z.boolean().optional(),
  devices: z.array(DeviceSummarySchema).default([]),
});

export type TailnetSummary = z.infer<typeof TailnetSummarySchema>;

export function normalizeDevice(input: unknown): DeviceSummary {
  if (typeof input === "string") {
    return {
      id: input,
      name: input,
      hostname: input,
      addresses: [],
      advertisedRoutes: [],
      enabledRoutes: [],
      tags: [],
    };
  }

  const value = input && typeof input === "object" ? input : {};
  const record = value as Record<string, unknown>;

  return {
    id: String(record.id ?? record.ID ?? record.name ?? record.HostName ?? ""),
    name: String(record.name ?? record.HostName ?? record.hostname ?? ""),
    hostname:
      typeof record.hostname === "string"
        ? record.hostname
        : typeof record.HostName === "string"
          ? record.HostName
          : undefined,
    os:
      typeof record.os === "string"
        ? record.os
        : typeof record.OS === "string"
          ? record.OS
          : undefined,
    online:
      typeof record.online === "boolean"
        ? record.online
        : typeof record.Online === "boolean"
          ? record.Online
          : undefined,
    authorized:
      typeof record.authorized === "boolean" ? record.authorized : undefined,
    lastSeen:
      typeof record.lastSeen === "string"
        ? record.lastSeen
        : typeof record.LastSeen === "string"
          ? record.LastSeen
          : undefined,
    addresses: readStringArray(record.addresses ?? record.TailscaleIPs),
    advertisedRoutes: readStringArray(record.advertisedRoutes),
    enabledRoutes: readStringArray(record.enabledRoutes),
    tags: readStringArray(record.tags),
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
