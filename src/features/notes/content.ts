// A small, deliberately closed HTML vocabulary shared by storage, exports and AI.
export const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
export function plainToHtml(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}
export function sanitizeHtml(input: string) {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|template|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    .replace(
      /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi,
      (tag, raw: string, attrs: string) => {
        const name = raw.toLowerCase();
        if (
          !/^(p|div|br|h[1-4]|strong|b|em|i|u|s|strike|ul|ol|li|blockquote|span)$/.test(
            name,
          )
        )
          return "";
        if (tag.startsWith("</")) return name === "br" ? "" : `</${name}>`;
        const alignment = attrs
          .match(/text-align\s*:\s*(left|center|right)\b/i)?.[1]
          ?.toLowerCase();
        const decoration = attrs
          .match(
            /text-decoration(?:-line)?\s*:\s*(underline|line-through)\b/i,
          )?.[1]
          ?.toLowerCase();
        const style = [
          alignment && `text-align:${alignment}`,
          decoration && `text-decoration:${decoration}`,
        ]
          .filter(Boolean)
          .join(";");
        const checked =
          name === "li"
            ? attrs.match(/data-checked=["'](true|false)["']/i)?.[1]
            : undefined;
        return `<${name}${style ? ` style="${style}"` : ""}${checked ? ` data-checked="${checked}"` : ""}>`;
      },
    );
}
export function htmlToPlain(html: string) {
  return sanitizeHtml(html)
    .replace(/<li\b([^>]*)>/gi, (_, attrs: string) =>
      attrs.includes('data-checked="true"')
        ? "[x] "
        : attrs.includes('data-checked="false"')
          ? "[ ] "
          : "• ",
    )
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-4]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code: string) => {
      const point =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function markdownToHtml(text: string) {
  // Legacy model drafts only; raw user notes are always escaped as plain text.
  return sanitizeHtml(
    text
      .split(/\r?\n/)
      .map((line) => {
        const heading = line.match(/^(#{1,4})\s+(.*)/);
        const inline = (s: string) =>
          escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        if (heading)
          return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
        const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
        return bullet
          ? `<ul><li>${inline(bullet[1])}</li></ul>`
          : `<p>${inline(line) || "<br>"}</p>`;
      })
      .join(""),
  );
}
