// Collect and de-duplicate real customer questions across sources.

import { classifyIntent } from "@/lib/intel/intent";
import { TOPIC_BY_ID, topicsIn } from "@/lib/intel/lexicon";
import { contentWords, jaccard } from "@/lib/intel/text";

export type QuestionSource = { text: string; source: string; weight?: number };
export type CustomerQuestion = {
  question: string;
  sources: string[];
  intent: string;
  topics: string[];
  frequency: "High" | "Medium" | "Low";
  score: number;
};

const QUESTION_LIKE = /^(how|what|where|when|which|who|why|is|are|can|do|does|should|would|will|any|anyone|looking for|recommend)\b|\?\s*$/i;

function cleanForumTitle(t: string) {
  return t.replace(/\s*[:|-]\s*r\/\w+.*$/i, "").replace(/\s*[-|]\s*(reddit|tripadvisor|quora).*$/i, "").trim();
}

export function collectQuestions(items: QuestionSource[], brandNames: string[] = []): CustomerQuestion[] {
  const merged: { text: string; words: string[]; sources: Set<string>; score: number }[] = [];
  for (const item of items) {
    const text = cleanForumTitle(item.text);
    if (!text || text.length < 8 || !QUESTION_LIKE.test(text)) continue;
    const w = contentWords(text);
    const hit = merged.find((m) => jaccard(m.words, w) >= 0.5);
    if (hit) {
      hit.sources.add(item.source);
      hit.score += item.weight ?? 1;
    } else {
      merged.push({ text: /\?$/.test(text) ? text : `${text}?`, words: w, sources: new Set([item.source]), score: item.weight ?? 1 });
    }
  }
  return merged
    .map((m) => {
      const topics = topicsIn(m.text);
      const intent = classifyIntent(m.text, brandNames).primary;
      const topic = topics[0] ? TOPIC_BY_ID[topics[0]].label : null;
      return {
        question: m.text,
        sources: [...m.sources],
        topics,
        intent: topic ? `${topic} · ${intent === "Informational" ? "planning" : intent.toLowerCase()}` : intent,
        frequency: (m.score >= 3 || m.sources.size >= 2 ? "High" : m.score >= 2 ? "Medium" : "Low") as CustomerQuestion["frequency"],
        score: m.score + m.sources.size,
      };
    })
    .sort((a, b) => b.score - a.score);
}
