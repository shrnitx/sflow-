import { areRecordsEqual, mergeOfflineCollection } from "./offlineMerge";

describe("offline collection reconciliation", () => {
  test("keeps local edits and deletions while retaining remote-only records", () => {
    const baseline = [
      { id: "one", title: "Old title", completed: false },
      { id: "two", title: "Delete me", completed: false },
    ];
    const local = [
      { id: "one", title: "Edited offline", completed: false },
      { id: "three", title: "Created offline", completed: false },
    ];
    const cloud = [
      { id: "one", title: "Edited on another device", completed: false },
      { id: "two", title: "Delete me", completed: false },
      { id: "four", title: "Created remotely", completed: false },
    ];

    const result = mergeOfflineCollection(cloud, local, baseline);

    expect(result).toEqual([
      { id: "one", title: "Edited offline", completed: false },
      { id: "three", title: "Created offline", completed: false },
      { id: "four", title: "Created remotely", completed: false },
    ]);
  });

  test("does not resurrect remotely deleted untouched records", () => {
    const baseline = [
      { id: "one", title: "Keep", completed: false },
      { id: "two", title: "Deleted on another device", completed: false },
    ];
    const local = [
      { id: "one", title: "Keep", completed: false },
      { id: "two", title: "Deleted on another device", completed: false },
      { id: "three", title: "Added offline", completed: false },
    ];
    const cloud = [{ id: "one", title: "Keep", completed: false }];

    expect(mergeOfflineCollection(cloud, local, baseline)).toEqual([
      { id: "one", title: "Keep", completed: false },
      { id: "three", title: "Added offline", completed: false },
    ]);
  });

  test("recognizes equivalent records independent of object key order", () => {
    expect(areRecordsEqual(
      [{ id: "a", title: "Task", metadata: { room: "LT-23", faculty: "Dr X" } }],
      [{ metadata: { faculty: "Dr X", room: "LT-23" }, title: "Task", id: "a" }]
    )).toBe(true);
  });

  test("recognizes a local deletion as a change from the baseline", () => {
    const baseline = [{ id: "a", title: "Task" }];
    const merged = mergeOfflineCollection(baseline, [], baseline);
    expect(merged).toEqual([]);
  });
});
