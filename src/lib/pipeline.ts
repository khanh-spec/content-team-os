// Content pipeline stages shared by the dashboard, Content Studio and drafts.

export const PIPELINE = [
  { value: "planned", label: "Planned", tone: "gray" },
  { value: "processing", label: "In Progress", tone: "blue" },
  { value: "draft", label: "Draft", tone: "violet" },
  { value: "review", label: "Review", tone: "amber" },
  { value: "complete", label: "Complete", tone: "green" },
  { value: "published", label: "Published", tone: "teal" },
] as const;

export type PipelineStatus = (typeof PIPELINE)[number]["value"];
export type DraftStatus = PipelineStatus | "error";

/** Stages a person can move a draft to by hand ("processing" is set by the writer). */
export const MANUAL_STATUSES = ["planned", "draft", "review", "complete", "published"] as const;

export function stage(status: string) {
  return PIPELINE.find((p) => p.value === status) ?? { value: status, label: status === "error" ? "Error" : status, tone: status === "error" ? "red" : "gray" };
}

/** Anything not complete or published counts as in flight. */
export const IN_FLIGHT: string[] = ["planned", "processing", "draft", "review"];
