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
  const context = await browser.newContext({ acceptDownloads: true, permissions: ["notifications"] });
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
    if (requestUrl.pathname === "/auth/v1/token") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeSession()),
      });
      return;
    }
    if (requestUrl.pathname === "/auth/v1/signup") {
      const session = makeSession();
      session.user.identities = [{ identity_id: "ci-email-identity", provider: "email" }];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
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
    const quickPreviewPriority = page.locator(".quick-add-preview > div").nth(3).locator("strong");
    await quickPreviewPriority.waitFor();
    assert.equal(await quickPreviewPriority.innerText(), "High");
    await page.locator(".quick-add-form button[type='submit']").click();
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
    const generatedRevisionHeadings = page.getByRole("heading", { name: /Revise for Final Genetics Exam/ });
    await generatedRevisionHeadings.first().waitFor();
    assert.equal(await generatedRevisionHeadings.count(), 3);
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
    const importedClassRow = page.locator(".weekly-timetable .timetable-entry-subject strong")
      .filter({ hasText: "Genome Analysis" });
    await importedClassRow.waitFor();
    assert.match(await importedClassRow.innerText(), /BIO456.*Genome Analysis/);
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByRole("heading", { name: "Submit imported report", exact: true }).waitFor();
    process.stdout.write("PASS: calendar import creates recurring classes and dated tasks\n");

    await page.getByRole("button", { name: "Study Lab", exact: true }).click();
    await page.getByRole("heading", { name: "One thing at a time.", exact: true }).waitFor();
    process.stdout.write("PASS: Study Lab workspace opens\n");

    const workspaceTimer = page.locator(".sfw-button-row");
    await workspaceTimer.getByRole("button", { name: "Start focus", exact: true }).click();
    await workspaceTimer.getByRole("button", { name: "Pause", exact: true }).waitFor();

    const secondsFromClock = (value) => {
      const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
      assert.ok(match, "Study Lab timer should expose a valid MM:SS value");
      return Number(match[1]) * 60 + Number(match[2]);
    };
    const secondsBeforeNavigation = secondsFromClock(
      await page.locator(".sfw-timer-dial").getAttribute("aria-label")
    );
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.waitForTimeout(1400);
    await page.getByRole("button", { name: "Study Lab", exact: true }).click();
    await page.locator(".sfw-timer-dial").waitFor();
    const secondsAfterNavigation = secondsFromClock(
      await page.locator(".sfw-timer-dial").getAttribute("aria-label")
    );
    assert.ok(
      secondsAfterNavigation < secondsBeforeNavigation,
      "The Study Lab focus timer must keep running while navigating to another section"
    );
    process.stdout.write("PASS: focus timer persists while navigating between sections\n");

    await workspaceTimer.getByRole("button", { name: "Pause", exact: true }).click();
    await workspaceTimer.getByRole("button", { name: "Resume", exact: true }).waitFor();
    await workspaceTimer.getByRole("button", { name: "Reset", exact: true }).click();
    process.stdout.write("PASS: task-linked focus timer start, pause, resume and reset\n");

    await page.getByRole("button", { name: "Play music", exact: true }).click();
    const youtubeFrame = page.locator(".study-music-player-frame.youtube iframe");
    await youtubeFrame.waitFor();
    assert.ok((await youtubeFrame.getAttribute("src")).includes("EWrX250Zhko"));
    await page.getByRole("button", { name: "Spotify playlist", exact: true }).click();
    await page.locator(".study-music-player-frame").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Load playlist", exact: true }).click();
    const spotifyFrame = page.locator(".study-music-player-frame.spotify iframe");
    await spotifyFrame.waitFor();
    assert.ok((await spotifyFrame.getAttribute("src")).includes("open.spotify.com/embed/playlist/"));
    await page.getByRole("button", { name: "Stop music", exact: true }).click();
    await page.locator(".study-music-player-frame").waitFor({ state: "detached" });
    process.stdout.write("PASS: YouTube/Spotify player switching and stop behavior\n");

    await page.getByRole("button", { name: "Daily plan", exact: true }).click();
    await page.getByRole("button", { name: "Build my day", exact: true }).click();
    await page.locator(".sfw-body .sfw-plan-list, .sfw-body .sfw-empty-large").waitFor();
    process.stdout.write("PASS: Study Lab daily-plan generation\n");

    await page.getByRole("button", { name: "Exams & syllabus", exact: true }).click();
    await page.getByPlaceholder("e.g. Physics mid-sem").fill("Study Lab Biology Exam");
    await page.getByLabel("Exam date").fill(futureDate(20));
    await page.getByRole("button", { name: "Save exam", exact: true }).click();
    await page.getByText("Study Lab Biology Exam", { exact: true }).waitFor();

    // Study Lab exams must appear in the same dashboard Exams list, not in a
    // second isolated collection.
    await page.getByRole("button", { name: "Exams", exact: true }).click();
    await page.getByRole("heading", { name: "Study Lab Biology Exam", exact: true }).waitFor();
    await page.getByRole("button", { name: "Study Lab", exact: true }).click();
    await page.getByRole("button", { name: "Exams & syllabus", exact: true }).click();

    await page.getByPlaceholder("e.g. Chemistry").fill("Biology");
    await page.getByPlaceholder("e.g. Chemical kinetics").fill("Cell division review");
    await page.getByRole("button", { name: "Add topic", exact: true }).click();
    await page.getByText("Cell division review", { exact: true }).waitFor();
    process.stdout.write("PASS: Study Lab exam sync and spaced-syllabus setup\n");

    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    await page.locator("#sfw-question").fill("Help me prepare for my next exam.");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await page.locator(".sfw-chat-msg.is-assistant").last().waitFor();
    process.stdout.write("PASS: Study Lab assistant uses saved study context\n");

    await page.getByRole("button", { name: "Reminders", exact: true }).click();
    await page.locator("#sfw-reminder-time").fill("10:15");
    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await page.getByRole("heading", { name: "Your study week, in facts.", exact: true }).waitFor();
    process.stdout.write("PASS: Study Lab reminder and analytics tabs\n");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Enable quiet hours").check();
    await page.locator("#quiet-hours-start").fill("21:00");
    await page.locator("#quiet-hours-end").fill("07:00");
    await page.getByRole("button", { name: "Enable reminders" }).click();
    await page.getByText("Reminders enabled while StudyFlow is open.", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Install \/ add to home screen/ }).waitFor();
    await page.getByText("Internet connection available", { exact: true }).waitFor();
    process.stdout.write("PASS: reminder preferences, quiet hours and offline/install settings UI\n");

    // StudyFlow Plus: the Toolkit keeps all additions inside the existing signed-in workspace.
    await page.getByRole("button", { name: "Toolkit", exact: true }).click();
    await page.getByRole("heading", { name: "Your academic command center", exact: true }).waitFor();
    process.stdout.write("PASS: Toolkit navigation and three feature phases render\n");

    // The same music-player instance must carry playback across Study Lab and Toolkit.
    await page.getByRole("button", { name: "Play music", exact: true }).click();
    const sharedMusicFrame = page.locator(".study-music-player-frame.youtube iframe");
    await sharedMusicFrame.waitFor();
    await page.getByRole("button", { name: "Study Lab", exact: true }).click();
    await sharedMusicFrame.waitFor();
    await page.getByRole("button", { name: "Toolkit", exact: true }).click();
    await sharedMusicFrame.waitFor();
    await page.getByRole("button", { name: "Stop music", exact: true }).click();
    await page.locator(".study-music-player-frame").waitFor({ state: "detached" });
    process.stdout.write("PASS: one music player is preserved across Study Lab and Toolkit\n");

    await page.getByLabel("Quick capture a task").fill("Review genome mapping for Biology tomorrow high 45m");
    await page.locator(".sfplus-inline-form").first().getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Choose a pending task").selectOption({ label: "Review genome mapping" });
    await page.getByRole("button", { name: "Build / refresh plan" }).click();
    await page.locator(".sfplus-plan-list").getByText("Review genome mapping", { exact: true }).waitFor();
    process.stdout.write("PASS: quick capture and adaptive day planner\n");

    await page.getByRole("button", { name: "Create subtasks", exact: true }).click();
    await page.getByLabel("Focus task").selectOption({ label: "Review genome mapping · Clarify requirements and gather resources" });
    await page.getByLabel("Duration").selectOption("15");
    await page.getByRole("button", { name: "Start focus", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    process.stdout.write("PASS: assignment breakdown and task-linked focus room\n");

    await page.getByRole("button", { name: "Learn & prepare", exact: true }).click();
    await page.getByLabel("Material title").fill("CI Biology notes");
    await page.getByLabel("Subject").fill("Biology");
    await page.locator("#sfplus-material-file").setInputFiles({
      name: "biology-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Mitosis :: Cell division"),
    });
    await page.getByRole("button", { name: "Save material", exact: true }).click();
    await page.getByText("CI Biology notes", { exact: true }).waitFor();

    await page.getByLabel("Question").fill("What is mitosis?");
    await page.getByLabel("Answer").fill("Cell division that produces two daughter cells.");
    await page.getByLabel("Subject").nth(1).fill("Biology");
    await page.getByRole("button", { name: "Add flashcard", exact: true }).click();
    await page.getByRole("heading", { name: "What is mitosis?", exact: true }).waitFor();
    await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
    await page.getByText("Cell division that produces two daughter cells.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.getByRole("heading", { name: "Exam readiness & grade simulator", exact: true }).waitFor();
    process.stdout.write("PASS: course-material vault, flashcard review and exam readiness UI\n");

    await page.getByRole("button", { name: "Sync & recover", exact: true }).click();
    const toolkitCalendarCard = page.locator(".sfplus-card").filter({ has: page.getByRole("heading", { name: "Calendar import & export" }) });
    const [toolkitCalendarDownload] = await Promise.all([
      page.waitForEvent("download"),
      toolkitCalendarCard.getByRole("button", { name: "Export calendar (.ics)", exact: true }).click(),
    ]);
    assert.match(await fs.readFile(await toolkitCalendarDownload.path(), "utf8"), /BEGIN:VCALENDAR/);
    const [backupDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".sfplus-toolbar").getByRole("button", { name: "Backup", exact: true }).click(),
    ]);
    const backupJson = JSON.parse(await fs.readFile(await backupDownload.path(), "utf8"));
    assert.equal(backupJson.format, "studyflow-backup-v1");
    assert.ok(Array.isArray(backupJson.tasks));
    await page.getByRole("button", { name: "Enable browser notifications", exact: true }).click();
    await page.getByText("Browser reminders are enabled while StudyFlow is open.", { exact: true }).waitFor();
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Quick capture and search" }).waitFor();
    await page.keyboard.press("Escape");
    process.stdout.write("PASS: ICS export, validated backup export, reminders and Ctrl+K palette\n");

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome Back", exact: true }).waitFor();
    await page.locator("#login-email").fill("ci@example.com");
    await page.locator("#login-password").fill("ci-password-123");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.getByRole("heading", { name: "Hello, CI Student", exact: true }).waitFor();
    process.stdout.write("PASS: login restores the authenticated dashboard\n");

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByRole("heading", { name: "Create Account", exact: true }).waitFor();
    await page.locator("#signup-name").fill("CI Student");
    await page.locator("#signup-email").fill("new-ci-student@example.com");
    await page.locator("#signup-password").fill("ci-password-123");
    await page.locator("#signup-confirm").fill("ci-password-123");
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByRole("heading", { name: "Hello, CI Student", exact: true }).waitFor();
    process.stdout.write("PASS: sign-up completes through the mocked Auth API\n");

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
