import { z } from "zod";

const text = z.string().trim().max(20_000).nullish().transform((v) => v || null);

export const CompetitorSchema = z.object({
  name: z.string().trim().min(1),
  website: z.string().trim().optional(),
  aliases: z.array(z.string().trim()).optional(),
});

export const ProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand_name: z.string().trim().min(1).max(200),
  brand_aliases: z.array(z.string().trim()).default([]),
  website: text,
  industry: z.string().trim().default("Hospitality"),
  property_type: text,
  city: text,
  region: text,
  country: text,
  country_code: z.string().trim().max(2).nullish().transform((v) => v?.toLowerCase() || null),
  language: z.string().trim().default("en"),
  serp_location: text,
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  brand_summary: text,
  usps: text,
  brand_facts: text,
  tone_of_voice: text,
  words_to_use: text,
  words_to_avoid: text,
  target_customers: text,
  competitors: z.array(CompetitorSchema).default([]),
  notes: text,
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const FeedbackSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
  context: z.string().trim().max(5_000).nullish(),
  source: z.enum(["client", "internal", "editor"]).default("client"),
  kind: z.enum(["feedback", "rule", "fact_correction"]).default("feedback"),
  apply_as_rule: z.boolean().default(false),
  author_name: z.string().trim().max(200).nullish(),
  draft_id: z.string().uuid().nullish(),
});
