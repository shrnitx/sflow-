import { exportStudyFlowCalendar, parseStudyFlowCalendar } from "./calendar";

describe("StudyFlow calendar import/export", () => {
  test("round-trips weekly class time, weekday, and metadata", () => {
    const content = exportStudyFlowCalendar({
      timetable: [{
        id: "class-1",
        subject: "Bioinformatics",
        courseCode: "BTF123",
        instructor: "Dr Example",
        room: "LT-23",
        day: 1,
        startTime: "09:15",
        endTime: "10:10",
        notes: "Bring notebook",
      }],
      tasks: [],
    });

    const parsed = parseStudyFlowCalendar(content);

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.timetable).toHaveLength(1);
    expect(parsed.timetable[0]).toMatchObject({
      subject: "Bioinformatics",
      day: 1,
      startTime: "09:15",
      endTime: "10:10",
      room: "LT-23",
    });
  });

  test("imports all-day exam events as dated exam records", () => {
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:exam-1",
      "DTSTART;VALUE=DATE:20261120",
      "DTEND;VALUE=DATE:20261121",
      "SUMMARY:Final Biology Exam",
      "DESCRIPTION:Chapters 1-4",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = parseStudyFlowCalendar(content);

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]).toMatchObject({
      type: "exam",
      title: "Final Biology Exam",
      deadline: "2026-11-20",
    });
  });
});
