import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  plainToHtml,
  htmlToPlain,
  sanitizeHtml,
  markdownToHtml,
} from "../src/features/notes/content.ts";
import { renderExport } from "../src/features/notes/export.ts";

test("raw legacy text is escaped and round-trips Unicode and literal markup", () => {
  const text = '<script>alert("hello")</script> & 100%\nBalikan bukas 👋';
  assert.equal(htmlToPlain(plainToHtml(text)), text);
  assert.ok(!plainToHtml(text).includes("<script>"));
  assert.equal(htmlToPlain("<p>&#x1f44b; &#65; &#99999999;</p>"), "👋 A");
});
test("rich text sanitization retains writing formats but removes executable content and URLs", () => {
  const html = sanitizeHtml(
    '<h2 onclick="evil()">Meeting</h2><script>fetch("https://evil")</script><img src="x" onerror="evil()"><p style="text-align:center;background:url(x)"><b>Safe</b><u>word</u></p><iframe src="x">bad</iframe><a href="javascript:evil()">link</a>',
  );
  assert.equal(
    html,
    '<h2>Meeting</h2><p style="text-align:center"><b>Safe</b><u>word</u></p>link',
  );
  assert.equal(sanitizeHtml(html), html);
});
test("legacy generated Markdown becomes formatted content, while HTML is escaped", () => {
  const html = markdownToHtml(
    "## Decisions\n- **Bring paper**\n<script>evil()</script>",
  );
  assert.match(html, /<h2>Decisions<\/h2>/);
  assert.match(html, /<li><strong>Bring paper<\/strong><\/li>/);
  assert.ok(!html.includes("<script>"));
});

test("checklists retain their completion state in storage and plain text", () => {
  const html = sanitizeHtml(
    '<ul><li data-checked="false" onclick="bad()">Read</li><li data-checked="true">Write</li></ul>',
  );
  assert.equal(
    html,
    '<ul><li data-checked="false">Read</li><li data-checked="true">Write</li></ul>',
  );
  assert.equal(htmlToPlain(html), "[ ] Read\n[x] Write");
});
test("both export formats include raw and structured versions without active markup", () => {
  const note = {
    title: "<img src=x>",
    body: "Raw thought",
    raw_html: "<p>Raw thought</p>",
    structured_html: "<h2>Plan</h2><script>bad()</script>",
    structured_text: "Plan",
  };
  const html = renderExport([note], true),
    text = renderExport([note], false);
  assert.ok(html.includes(escapeHtml(note.title)));
  assert.ok(!html.includes("<script>"));
  assert.ok(
    html.includes("<h2>Raw</h2>") && html.includes("<h2>Structured</h2>"),
  );
  assert.match(text, /RAW\nRaw thought/);
  assert.match(text, /STRUCTURED\nPlan/);
});
