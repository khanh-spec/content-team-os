import JSZip from "jszip";
import { extractText, chunkText } from "../src/lib/extract";
import { parseGscCsv, classify } from "../src/lib/gsc/opportunities";
import { sameBusiness, normalizeName } from "../src/lib/names";
import { aggregate } from "../src/lib/research/visibility";
import type { Project } from "../src/lib/types";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

async function docx() {
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Anio has 42 rooms.</w:t></w:r></w:p><w:p><w:r><w:t>Rooftop pool open 7am–8pm.</w:t></w:r></w:p></w:body></w:document>`);
  return z.generateAsync({ type: "nodebuffer" });
}
async function pptx() {
  const z = new JSZip();
  z.file("ppt/slides/slide2.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide two &amp; more</a:t></a:r></a:p></p:sld>`);
  z.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Brand </a:t></a:r><a:r><a:t>Guidelines</a:t></a:r></a:p><a:p><a:r><a:t>Tone: warm</a:t></a:r></a:p></p:sld>`);
  z.file("ppt/slides/slide10.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide ten</a:t></a:r></a:p></p:sld>`);
  return z.generateAsync({ type: "nodebuffer" });
}
function pdf() {
  const stream = "BT /F1 18 Tf 72 720 Td (Anio Boutique Hotel fact sheet 42 rooms) Tj ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

(async () => {
  const d = await extractText(await docx(), "facts.docx");
  assert(d.includes("42 rooms") && d.includes("Rooftop pool"), `docx → ${JSON.stringify(d)}`);
  const p = await extractText(await pptx(), "deck.pptx");
  assert(p.indexOf("Brand Guidelines") < p.indexOf("Slide two & more") && p.indexOf("Slide two") < p.indexOf("Slide ten"), `pptx order → ${JSON.stringify(p)}`);
  const f = await extractText(pdf(), "facts.pdf", "application/pdf");
  assert(f.includes("42 rooms"), `pdf → ${JSON.stringify(f)}`);
  const m = await extractText(Buffer.from("# Title\n\n\n\nBody"), "a.md");
  assert(m === "# Title\n\nBody", "md cleaned");
  try { await extractText(Buffer.from("x"), "old.doc"); assert(false, "doc should throw"); } catch (e) { assert(/Legacy/.test((e as Error).message), "legacy doc rejected"); }

  const chunks = chunkText(Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(40)).join("\n\n"));
  assert(chunks.length > 3 && chunks.every((c) => c.length <= 1400), `chunking (${chunks.length} chunks)`);

  assert(sameBusiness("Anio Boutique Hotel Hoi An", "Anio Boutique Hotel Hoi An") , "same name");
  assert(sameBusiness("Little Hoi An . A Boutique Hotel & Spa", "Little Hoi An Boutique Hotel"), "variant names match");
  assert(!sameBusiness("Hoi An", "Little Hoi An Boutique Hotel"), "city name alone doesn't match a hotel");
  assert(normalizeName("Khách sạn Đà Nẵng") === "khach san da nang", "diacritics stripped");

  const project = { brand_name: "Anio Boutique Hotel Hoi An", brand_aliases: ["Anio Hotel"], competitors: [{ name: "Little Hoi An Boutique Hotel" }, { name: "Allegro Hoi An" }], website: "https://aniohotel.com", city: "Hoi An" } as unknown as Project;

  const csv = `Top queries,Clicks,Impressions,CTR,Position\n"anio hotel hoi an",120,900,13.3%,1.2\nwhere to stay in hoi an with kids,4,800,0.5%,9.4\nlittle hoi an vs anio,1,60,1.67%,4.1\n"best boutique hotel, hoi an",2,1500,0.13%,14\n`;
  const rows = parseGscCsv(csv);
  assert(rows.length === 4 && rows[3].query === "best boutique hotel, hoi an" && Math.abs((rows[0].ctr ?? 0) - 0.133) < 1e-6, "GSC CSV parsed (quoted comma, % CTR)");
  const opp = classify(rows, project);
  const byQ = Object.fromEntries(opp.map((o) => [o.query, o]));
  assert(byQ["anio hotel hoi an"].pillar === "company", "branded → company");
  assert(byQ["little hoi an vs anio"].pillar === "competitors", "competitor/vs → competitors");
  assert(byQ["where to stay in hoi an with kids"].pillar === "customers" && byQ["where to stay in hoi an with kids"].signals.includes("question") && byQ["where to stay in hoi an with kids"].tail === "long", "question long-tail → customers");
  assert(byQ["best boutique hotel, hoi an"].signals.includes("striking distance"), "striking distance flagged");

  const plan = { prompts: [{ prompt: "p0", angle: "seed" }, { prompt: "p1", angle: "couples" }], iterations: 2 };
  const baseline = { maps: [{ position: 1, title: "Allegro Hoi An . Little Luxury Hotel & Spa" }, { position: 2, title: "Anio Boutique Hotel Hoi An" }, { position: 3, title: "Some Villa" }], localPack: [{ position: 1, title: "Anio Boutique Hotel Hoi An" }], errors: [] };
  const mk = (pi: number, it: number, names: string[], cites: string[] = []) => ({ prompt_index: pi, iteration: it, prompt: `p${pi}`, answer: "x", error: null,
    mentions: names.map((n, i) => ({ name: n, canonical: n, position: i + 1, sentiment: "positive" as const, context: "" })),
    citations: cites.map((u) => ({ url: u, title: "", domain: new URL(u).hostname.replace(/^www\./, "") })) });
  const samples = [
    mk(0, 0, ["Little Hoi An Boutique Hotel", "Anio Hotel", "Anio Boutique Hotel Hoi An"], ["https://www.tripadvisor.com/x", "https://aniohotel.com/rooms"]),
    mk(0, 1, ["Little Hoi An Boutique Hotel", "La Siesta"]),
    mk(1, 0, ["Anio Boutique Hotel Hoi An", "La Siesta"], ["https://www.booking.com/y"]),
    { prompt_index: 1, iteration: 1, prompt: "p1", answer: null, mentions: null, citations: null, error: "boom" },
  ];
  const s = aggregate(project, plan, baseline as never, samples as never);
  const get = (n: string) => s.businesses.find((b) => b.name === n)!;
  assert(s.successful_samples === 3 && s.total_samples === 4, "failed samples excluded");
  assert(get("Anio Boutique Hotel Hoi An").ai_samples === 2 && Math.abs(s.brand!.ai_mention_rate - 2 / 3) < 1e-9, `brand counted once per answer across aliases (${s.brand?.ai_mention_rate})`);
  assert(s.brand!.gap === "both" && s.brand!.maps_rank === 2 && s.brand!.local_pack_rank === 1, "brand maps/local pack joined");
  assert(get("Little Hoi An Boutique Hotel").role === "competitor" && get("Little Hoi An Boutique Hotel").gap === "ai_only", "competitor ai_only");
  assert(get("Allegro Hoi An").gap === "serp_only", `serp-only competitor (${JSON.stringify(s.businesses.map((b) => b.name))})`);
  assert(s.citation_domains.find((d) => d.domain === "aniohotel.com")?.kind === "brand site" && s.citation_domains.find((d) => d.domain === "booking.com")?.kind === "OTA", "citation domains classified");
  assert(s.per_prompt[0].brand_rate === 0.5 && s.per_prompt[1].brand_rate === 1, "per-prompt brand rate");
})();
