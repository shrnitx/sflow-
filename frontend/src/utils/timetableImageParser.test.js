import { extractSingleDayCards } from "./timetableImageParser";

function makeWord(text, x0, x1, centerY) {
  return {
    text,
    confidence: 95,
    bbox: {
      x0,
      x1,
      y0: centerY - 5,
      y1: centerY + 5,
    },
  };
}

function makePortalCardRows(includeCourseTitle) {
  const rows = [
    {
      y: 10,
      words: [
        makeWord("09:15", 100, 135, 10),
        makeWord("to", 140, 155, 10),
        makeWord("10:10", 160, 195, 10),
      ],
    },
  ];

  if (includeCourseTitle) {
    rows.push({
      y: 28,
      words: [
        makeWord("Cell", 100, 125, 28),
        makeWord("Biology", 130, 180, 28),
      ],
    });
  }

  rows.push(
    { y: includeCourseTitle ? 42 : 28, words: [makeWord("BTF123", 100, 150, includeCourseTitle ? 42 : 28)] },
    {
      y: includeCourseTitle ? 56 : 44,
      words: [
        makeWord("Dr", 100, 115, includeCourseTitle ? 56 : 44),
        makeWord("Richa", 120, 155, includeCourseTitle ? 56 : 44),
        makeWord("Tiwari[317113]", 160, 235, includeCourseTitle ? 56 : 44),
      ],
    },
    {
      y: includeCourseTitle ? 70 : 60,
      words: [makeWord("LT-23", 100, 145, includeCourseTitle ? 70 : 60)],
    }
  );

  return rows;
}

describe("single-day college portal timetable OCR parser", () => {
  test("extracts subject, course code, instructor, room, and times when title is present", () => {
    const result = extractSingleDayCards(makePortalCardRows(true));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      subject: "Cell Biology",
      courseCode: "BTF123",
      instructor: "Dr Richa Tiwari[317113]",
      room: "LT-23",
      startTime: "09:15",
      endTime: "10:10",
      day: null,
    });
  });

  test("keeps the course code as a usable subject when the portal has no course title", () => {
    const result = extractSingleDayCards(makePortalCardRows(false));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      subject: "BTF123",
      courseCode: "BTF123",
      instructor: "Dr Richa Tiwari[317113]",
      room: "LT-23",
      startTime: "09:15",
      endTime: "10:10",
      day: null,
    });
  });
});
