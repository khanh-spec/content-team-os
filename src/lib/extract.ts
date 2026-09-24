import "server-only";

import JSZip from "jszip";

/** Extract plain text from an uploaded brand file. */
export async function extractText(buffer: Buffer, filename: string, mime?: string | null): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf" || mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return clean(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return clean(result.value);
  }

  if (ext === "pptx") return clean(await pptxText(buffer));

  if (ext === "xlsx") return clean(await xlsxText(buffer));

  if (["md", "markdown", "txt", "csv", "json", "html", "htm"].includes(ext) || mime?.startsWith("text/")) {
    const text = buffer.toString("utf8");
    return clean(ext.startsWith("htm") ? text.replace(/<[^>]+>/g, " ") : text);
  }

  if (ext === "doc" || ext === "ppt") {
    throw new Error(`Legacy .${ext} files are not supported. Save as .${ext}x or PDF and re-upload.`);
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

async function pptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((f) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(f))
    .sort((a, b) => slideNo(a) - slideNo(b) || a.localeCompare(b));
  const parts: string[] = [];
  for (const f of slides) {
    const xml = await zip.files[f].async("string");
    const paragraphs = xml.split(/<\/a:p>/).map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1])).join(""),
    );
    const text = paragraphs.filter(Boolean).join("\n");
    if (text) parts.push(`${f.includes("notes") ? "Notes" : "Slide"} ${slideNo(f)}:\n${text}`);
  }
  return parts.join("\n\n");
}

async function xlsxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const shared = zip.files["xl/sharedStrings.xml"];
  if (!shared) return "";
  const xml = await shared.async("string");
  return [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decode(m[1])).join("\n");
}

const slideNo = (f: string) => Number(f.match(/(\d+)\.xml$/)?.[1] ?? 0);

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function clean(s: string) {
  return s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Split text into ~1,200 character chunks on paragraph boundaries. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (p.length > size) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < p.length; i += size - overlap) chunks.push(p.slice(i, i + size));
      continue;
    }
    if ((current + "\n\n" + p).length > size && current) {
      chunks.push(current);
      current = current.slice(-overlap) + "\n\n" + p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
