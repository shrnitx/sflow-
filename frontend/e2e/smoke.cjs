const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");

const BASE_URL = process.env.STUDYFLOW_E2E_URL || "http://127.0.0.1:4173";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeSession() {
  const now = Math.floor(Date.now() / 1000);
  const token = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({
      sub: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "ci@example.com",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: "CI Student" },
      iat: now,
      exp: now + 3600,
    }),
    "ci-signature",
  ].join(".");

  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "ci-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "ci@example.com",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: "CI Student" },
      created_at: new Date().toISOString(),
    },
  };
}

function futureDate(daysAhead) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function compactIcsDate(dateKey) {
  return dateKey.replace(/-/g, "");
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // CI uses a dummy Supabase project. Stub database requests so UI flows are
  // exercised without contacting or modifying any real user's data.
  await page.route("https://example.supabase.co/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.startsWith("/rest/v1/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/0" },
        body: "[]",
      });
      return;
    }
    if (requestUrl.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeSession().user),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.addInitScript((session) => {
    localStorage.setItem("sb-example-auth-token", JSON.stringify(session));
    localStorage.setItem("studyflow.legacy-migration-reviewed.v1", "true");
  }, makeSession());

  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Hello, CI Student" }).waitFor({ timeout: 20000 });
    await page.getByRole("heading", { name: "Today's Classes" }).waitFor();
    await page.getByRole("heading", { name: "Exam alerts" }).waitFor();
    process.stdout.write("PASS: mocked auth session and Overview dashboard\n");

    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    const quickInput = page.getByRole("textbox", { name: "Describe a task" });
    await quickInput.fill("Biology assignment due Friday, high priority");
    await page.getByRole("button", { name: "Preview" }).click();
    await page.getByText("Assignment", { exact: true }).waitFor();
    await page.getByText("High", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByRole("heading", { name: "Assignment", exact: true }).waitFor();
    assert.equal(await quickInput.inputValue(), "");
    process.stdout.write("PASS: Quick Add preview, parsing and task creation\n");

    await page.getByRole("button", { name: "Exams", exact: true }).click();
    const examDate = futureDate(15);
    await page.locator("#title").fill("Final Genetics Exam");
    await page.locator("#subject").selectOption("Biology");
    await page.locator("#deadline").fill(examDate);
    await page.locator(".form-panel button[type='submit']").click();
    await page.getByRole("heading", { name: "Final Genetics Exam", exact: true }).waitFor();
    await page.locator("#planner-topics").fill("Cell biology\nEnzymes\nGenetics");
    await page.getByRole("button", { name: "Generate revision plan" }).click();
    await page.getByText(/Created \d+ revision session/).waitFor();
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByRole("heading", { name: /Revise for Final Genetics Exam/ }).waitFor();
    process.stdout.write("PASS: Exam creation and revision plan generation\n");

    await page.getByRole("button", { name: "Timetable", exact: true }).click();
    await page.locator("#timetable-subject").fill("Bioinformatics");
    await page.locator("#timetable-day").selectOption("1");
    await page.locator("#timetable-start").fill("09:15");
    await page.locator("#timetable-end").fill("10:10");
    await page.locator("#timetable-course-code").fill("BTF123");
    await page.locator("#timetable-instructor").fill("Dr Example");
    await page.locator("#timetable-room").fill("LT-23");
    await page.locator("#timetable-meeting-url").fill("https://example.com/meeting");
    await page.locator("#timetable-notes").fill("Bring lab notebook");
    await page.locator(".timetable-form button[type='submit']").click();
    await page.getByText(/BTF123.*Bioinformatics/).waitFor();
    await page.locator('button[title="View class details"]').click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Bioinformatics" }).waitFor();
    await dialog.getByText("Dr Example", { exact: true }).waitFor();
    await dialog.getByText("LT-23", { exact: true }).waitFor();
    await dialog.getByRole("link", { name: "Join online class" }).waitFor();
    await dialog.getByText("Bring lab notebook", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Close class details" }).click();
    process.stdout.write("PASS: timetable class creation and class profile details\n");

    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.locator("#title").fill("Prepare Bioinformatics notes");
    await page.locator("#subject").selectOption("Biology");
    await page.locator("#task-class-link").selectOption({ index: 1 });
    await page.locator("#deadline").fill(futureDate(3));
    await page.locator(".form-panel button[type='submit']").click();
    await page.getByRole("heading", { name: "Prepare Bioinformatics notes", exact: true }).waitFor();

    await page.getByRole("button", { name: "Timetable", exact: true }).click();
    await page.locator('button[title="View class details"]').click();
    const linkedDialog = page.getByRole("dialog");
    await linkedDialog.getByText("Prepare Bioinformatics notes", { exact: true }).waitFor();
    await linkedDialog.getByRole("button", { name: "Close class details" }).click();
    process.stdout.write("PASS: linking tasks to classes\n");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export calendar" }).click(),
    ]);
    const icsPath = await download.path();
    const exportedIcs = await fs.readFile(icsPath, "utf8");
    assert.match(exportedIcs, /SUMMARY:Bioinformatics/);
    assert.match(exportedIcs, /SUMMARY:Task: Prepare Bioinformatics notes/);
    process.stdout.write("PASS: calendar export downloads weekly classes and tasks\n");

    const importedDeadline = futureDate(40);
    const importedIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:ci-weekly-class",
      "DTSTART:20261201T110000",
      "DTEND:20261201T120000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
      "SUMMARY:Genome Analysis",
      "LOCATION:LAB-8",
      "DESCRIPTION:Course: BIO456\\nInstructor: Dr Import",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ci-task",
      "DTSTART;VALUE=DATE:" + compactIcsDate(importedDeadline),
      "DTEND;VALUE=DATE:" + compactIcsDate(futureDate(41)),
      "SUMMARY:Task: Submit imported report",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    await page.locator('input[aria-label="Import calendar file"]').setInputFiles({
      name: "studyflow-smoke.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from(importedIcs),
    });
    await page.getByText("Genome Analysis", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByRole("heading", { name: "Submit imported report", exact: true }).waitFor();
    process.stdout.write("PASS: calendar import creates recurring classes and dated tasks\n");

    await page.getByRole("button", { name: "Focus", exact: true }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.getByRole("button", { name: "Pause session" }).waitFor();
    await page.getByRole("button", { name: "Pause session" }).click();
    await page.getByRole("button", { name: "Resume session" }).waitFor();
    await page.getByRole("button", { name: "Reset timer" }).click();
    process.stdout.write("PASS: focus timer start, pause, resume and reset\n");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Enable quiet hours").check();
    await page.locator("#quiet-hours-start").fill("21:00");
    await page.locator("#quiet-hours-end").fill("07:00");
    await page.getByRole("button", { name: "Enable reminders" }).click();
    await page.getByText("Reminders enabled while StudyFlow is open.").waitFor();
    await page.getByRole("button", { name: /Install \/ add to home screen/ }).waitFor();
    await page.getByText("Internet connection available", { exact: true }).waitFor();
    process.stdout.write("PASS: reminder preferences, quiet hours and offline/install settings UI\n");

    assert.deepEqual(consoleErrors, [], "Browser reported uncaught page errors");
    process.stdout.write("PASS: no uncaught browser page errors\n");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
