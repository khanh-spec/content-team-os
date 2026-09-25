// Extract named entities (landmarks, places, businesses) from SERP text.

import { sameBusiness } from "@/lib/names";
import { fold } from "@/lib/intel/text";

export type Entity = { name: string; type: "Landmark" | "Business" | "Place" | "Entity"; mentions: number };

const GENERIC = new Set(
  (
    "best top the a our your you we it this that these those what how where why when is are can do does which who hotel hotels resort resorts things guide review reviews updated prices price deals book booking tripadvisor google maps reddit expedia agoda booking.com trip.com hotels.com airbnb kayak travel stay stays visit visiting day days night nights week weekend new free official home page read more view see here also " +
    "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday " +
    "i if in on at of for from with and or but to by near places ultimate complete list tips people also ask room rooms suite suites family families couples luxury boutique cheap budget"
  ).split(" "),
);

// Words trimmed from the edges of a candidate ("Best Adelaide Oval" → "Adelaide Oval").
const EDGE = new Set(
  "best top the a our your you we it this that what what's whats how where why when is are can do does which who find latest new updated read more view see here also book booking deals prices price guide review reviews near things".split(" "),
);
const BUSINESS = /\b(hotel|hotels|resort|inn|suites|apartments|motel|hostel|lodge|restaurant|bar|cafe|spa|villas?)\b/;

const LANDMARK = /\b(market|oval|square|beach|bridge|temple|museum|park|street|road|airport|station|mall|island|river|bay|hill|hills|garden|gardens|pagoda|cathedral|church|palace|lake|mountain|falls|tower|gallery|zoo|stadium|harbour|harbor|pier|old town|quarter|village|night market|precinct|lane|mount|reserve|centre|center|wharf|terrace)\b/;

const CAP_SEQ = /\b([A-Z][\p{L}'’.-]+(?:\s+(?:of|the|de|du|la|le|by)\s+[A-Z][\p{L}'’.-]+|\s+[A-Z][\p{L}'’.-]+){0,4})/gu;

export function extractEntities(
  docs: string[],
  opts: { exclude?: string[]; excludeBusinesses?: string[]; businesses?: string[]; limit?: number } = {},
): Entity[] {
  const exclude = (opts.exclude ?? []).filter(Boolean);
  const excludeBiz = (opts.excludeBusinesses ?? []).filter(Boolean);
  const businesses = opts.businesses ?? [];
  const counts = new Map<string, { name: string; docs: number }>();

  for (const doc of docs) {
    const seen = new Set<string>();
    for (const m of doc.matchAll(CAP_SEQ)) {
      let name = m[1].replace(/[.’']+$/, "").trim();
      // Drop leading generic words ("Best Adelaide Oval" → "Adelaide Oval").
      const parts = name.split(/\s+/);
      while (parts.length && EDGE.has(fold(parts[0]).replace(/['’]/g, "'"))) parts.shift();
      while (parts.length && EDGE.has(fold(parts[parts.length - 1]))) parts.pop();
      name = parts.join(" ");
      if (name.length < 3 || GENERIC.has(fold(name)) || /^\d/.test(name) || /['’]s$/i.test(name) && name.split(" ").length === 1) continue;
      // A lone "Hotel"/"Resort" edge word is fine inside a name, not on its own.
      if (parts.length === 1 && BUSINESS.test(fold(name))) continue;
      if (exclude.some((e) => fold(e) === fold(name)) || excludeBiz.some((b) => sameBusiness(b, name))) continue;
      // Fragments of an excluded name ("Hoi" from "Hoi An") are not entities either.
      const nw = fold(name).split(/\s+/);
      if (exclude.some((e) => nw.every((w) => fold(e).split(/[\s,]+/).includes(w)))) continue;
      const key = fold(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const prev = counts.get(key);
      counts.set(key, { name: prev?.name ?? name, docs: (prev?.docs ?? 0) + 1 });
    }
  }

  const minDocs = docs.length >= 6 ? 2 : 1;
  // Drop partial names ("Bang Beach") when the fuller name ("An Bang Beach") is also present.
  const all = [...counts.values()];
  const partial = (c: { name: string }) =>
    all.some((o) => o !== c && o.name.length > c.name.length && ` ${fold(o.name)}`.endsWith(` ${fold(c.name)}`));
  return all
    .filter((c) => !partial(c))
    .filter((c) => c.docs >= minDocs && c.name.split(" ").length <= 5)
    .sort((a, b) => b.docs - a.docs || b.name.split(" ").length - a.name.split(" ").length)
    .slice(0, opts.limit ?? 15)
    .map((c) => ({
      name: c.name,
      mentions: c.docs,
      type: businesses.some((b) => sameBusiness(b, c.name)) || BUSINESS.test(fold(c.name)) ? "Business" : LANDMARK.test(fold(c.name)) ? "Landmark" : c.name.split(" ").length === 1 ? "Place" : "Entity",
    }));
}
