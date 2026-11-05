import { escapeHtml, sanitizeHtml } from "./content.ts";
type ExportNote = {
  title: string;
  body: string;
  raw_html: string;
  structured_html: string;
  structured_text: string;
};
export function renderExport(notes: ExportNote[], html: boolean) {
  if (!html)
    return notes
      .map(
        (note) =>
          `${note.title}\n\nRAW\n${note.body}\n\nSTRUCTURED\n${note.structured_text || "(No structured version)"}\n`,
      )
      .join("\n────────────────────\n\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>SpiderNote export</title><style>body{max-width:800px;margin:40px auto;padding:20px;font:17px/1.6 system-ui;color:#252238}article{margin-bottom:60px}li[data-checked]{list-style:none}li[data-checked="false"]:before{content:"? "}li[data-checked="true"]:before{content:"? "}h1{border-bottom:1px solid #ddd}</style></head><body>${notes.map((note) => `<article><h1>${escapeHtml(note.title)}</h1><h2>Raw</h2>${sanitizeHtml(note.raw_html)}<h2>Structured</h2>${sanitizeHtml(note.structured_html) || "<p>No structured version</p>"}</article>`).join("")}</body></html>`;
}
