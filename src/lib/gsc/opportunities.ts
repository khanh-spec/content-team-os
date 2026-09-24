// Layer 2: turn Search Console queries into 3C content opportunities.
// Pure functions so they can run on the server or in tests.

import { normalizeName } from "@/lib/names";
import type { Project } from "@/lib/types";

export type GscRow = {
  query: string;
  page?: string | null;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
};

export type Pillar = "company" | "customers" | "competitors";

export type Opportunity = GscRow & {
  pillar: Pillar;
  signals: string[];
  tail: "short" | "long";
  score: number;
};

/** Parse a GSC "Queries" (or Queries + Pages) CSV export. */
export function parseGscCsv(csv: string): GscRow[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase().trim());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const qi = col("top queries", "query", "queries");
  const pi = col("page", "url", "landing");
  const ci = col("clicks");
  const ii = col("impressions");
  const ti = col("ctr");
  const po = col("position");
  if (qi < 0) throw new Error('CSV needs a "Query" / "Top queries" column');

  const num = (v: string | undefined) => {
    if (!v) return 0;
    const n = parseFloat(v.replace(/[%,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  return lines.slice(1).flatMap((line) => {
    const cells = splitCsv(line);
    const query = cells[qi]?.trim();
    if (!query) return [];
    const ctrRaw = ti >= 0 ? cells[ti] : undefined;
    return [
      {
        query,
        page: pi >= 0 && pi !== qi ? cells[pi]?.trim() || null : null,
        clicks: Math.round(num(cells[ci])),
        impressions: Math.round(num(cells[ii])),
        ctr: ctrRaw ? num(ctrRaw) / (ctrRaw.includes("%") ? 100 : 1) : null,
        position: po >= 0 ? num(cells[po]) : null,
      },
    ];
  });
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const QUESTION = /^(how|what|where|when|which|who|why|is|are|can|do|does|should|best|top)\b|\?$/;
const COMPARISON = /\b(vs|versus|or|alternative|alternatives|compare|comparison|like|similar)\b/;
const LOCAL = /\b(near|nearby|near me|close to|walking distance|around|from|to)\b/;

/** Expected CTR by position (rough industry curve) for gap scoring. */
function expectedCtr(pos: number) {
  const curve = [0.28, 0.16, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02];
  return pos <= 10 ? curve[Math.max(0, Math.round(pos) - 1)] : pos <= 20 ? 0.01 : 0.003;
}

export function classify(rows: GscRow[], project: Project): Opportunity[] {
  const brandTokens = [project.brand_name, ...project.brand_aliases].map(normalizeName).filter((t) => t.length >= 3);
  const competitorTokens = (project.competitors ?? []).flatMap((c) => [c.name, ...(c.aliases ?? [])]).map(normalizeName).filter((t) => t.length >= 3);

  return rows
    .map((r) => {
      const q = r.query.toLowerCase();
      const nq = normalizeName(r.query);
      const signals: string[] = [];
      let pillar: Pillar = "customers";

      if (competitorTokens.some((t) => nq.includes(t)) || COMPARISON.test(q)) {
        pillar = "competitors";
        signals.push(competitorTokens.some((t) => nq.includes(t)) ? "competitor name" : "comparison intent");
      } else if (brandTokens.some((t) => nq.includes(t))) {
        pillar = "company";
        signals.push("branded");
      }
      if (QUESTION.test(q)) signals.push("question");
      if (LOCAL.test(q)) signals.push("local modifier");

      const pos = r.position ?? 100;
      if (pos >= 4 && pos <= 20) signals.push("striking distance");
      const ctr = r.ctr ?? (r.impressions ? r.clicks / r.impressions : 0);
      if (r.impressions >= 50 && pos <= 10 && ctr < expectedCtr(pos) * 0.6) signals.push("low CTR for position");
      if (r.impressions >= 20 && pos > 20) signals.push("content gap (ranks beyond page 2)");

      const words = r.query.trim().split(/\s+/).length;
      const tail: Opportunity["tail"] = words >= 4 ? "long" : "short";

      // Potential extra clicks if the query reached the top-3 CTR.
      const potential = Math.max(0, r.impressions * (expectedCtr(Math.min(pos, 3)) - ctr));
      const score = Math.round(potential + (signals.includes("question") ? 5 : 0) + (pillar === "competitors" ? 5 : 0));

      return { ...r, pillar, signals, tail, score };
    })
    .sort((a, b) => b.score - a.score);
}
