// Small text utilities shared by the rules engine. Pure functions, no I/O.

export function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

export const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its my near not of on or our so than that the their them there these they this to up us was we what when where which who why will with you your best top".split(
    " ",
  ),
);

export function words(s: string): string[] {
  return fold(s).match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

export function contentWords(s: string): string[] {
  return words(s).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " \n ")
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Split a multi-line profile field (facts, claims, audiences) into entries. */
export function lines(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\n|;/)
    .map((l) => l.replace(/^[\s\-•*✓✔❌✗x]+/i, "").trim())
    .filter((l) => l.length > 1);
}

export function jaccard(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-phrase, case-insensitive, diacritics-insensitive match. */
export function containsPhrase(text: string, phrase: string) {
  const p = fold(phrase).trim();
  if (!p) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(p)}([^a-z0-9]|$)`).test(fold(text));
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  }
}

// "an" is left out: it is also a word in Vietnamese place names (Hoi An, An Bang).
const SMALL = new Set("a and as at but by for in nor of on or per the to vs via with from".split(" "));

/** Headline case: small words stay lowercase unless first ("Where to Stay in Hoi An"). */
export function titleCase(s: string) {
  return s
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.replace(/^\p{L}/u, (c) => c.toUpperCase())))
    .join("");
}
