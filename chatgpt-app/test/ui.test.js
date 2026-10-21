import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function checkInlineScript(htmlPath, openingTag, extension) {
  const html = readFileSync(htmlPath, "utf8");
  const escapedTag = openingTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(escapedTag + "([\\s\\S]*?)</script>", "i"));
  assert.ok(match, "Expected an inline script in " + htmlPath);
  const directory = mkdtempSync(join(tmpdir(), "studyflow-script-check-"));
  const file = join(directory, "inline." + extension);
  try {
    writeFileSync(file, match[1], "utf8");
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return html;
}

test("interactive StudyFlow widget script parses", () => {
  const html = checkInlineScript("public/studyflow-widget.html", "<script>", "js");
  assert.match(html, /get_studyflow_dashboard/);
  assert.match(html, /create_study_task/);
  assert.match(html, /task-deadline/);
});

test("OAuth consent page script parses and explains access", () => {
  const html = checkInlineScript("../frontend/public/oauth/consent/index.html", '<script type="module">', "mjs");
  assert.match(html, /getAuthorizationDetails/);
  assert.match(html, /approveAuthorization/);
  assert.match(html, /denyAuthorization/);
  assert.match(html, /read your tasks and timetable/i);
});
