import { z } from "zod";

export const EmptyInputSchema = z.object({});

export const RiskyMutationOutputSchema = z.object({
  message: z.string(),
});
