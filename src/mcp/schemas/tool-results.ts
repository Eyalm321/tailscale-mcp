import { z } from "zod";
import { DeviceSummarySchema, TailnetSummarySchema } from "./tailscale.js";

export const DevicesOutputSchema = z.object({
  devices: z.array(DeviceSummarySchema),
});

export const MessageOutputSchema = z.object({
  message: z.string(),
});

export const NetworkStatusOutputSchema = z.object({
  status: z.unknown(),
});

export const TailnetOutputSchema = z.object({
  tailnet: TailnetSummarySchema,
});

export const DataOutputSchema = z.object({
  data: z.unknown(),
});
