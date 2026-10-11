import { useEffect, useRef, useState } from "react";
import { loadTasks, saveTasks, loadTimetable, saveTimetable } from "../utils/storage";
import { supabase } from "../lib/supabaseClient";

const OWNER_KEY = "studyflow.cloud-owner.v1";

function rowsToRecords(rows) {
  return (rows || [])
    .filter((row) => row && row.data && typeof row.data === "object" && !Array.isArray(row.data))
    .map((row) => ({ ...row.data, id: row.data.id || row.record_id }))
    .filter((record) => typeof record.id === "string" && record.id.length > 0);
}

async function readRecords(table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select("record_id,data")
    .eq("user_id", userId);

  if (error) throw error;
  return rowsToRecords(data);
}

async function writeRecords(table, userId, records) {
  const safeRecords = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record.id === "string" && record.id.trim())
    .map((record) => ({
      user_id: userId,
      record_id: record.id,
      data: record,
      updated_at: new Date().toISOString(),
    }));

  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select("record_id")
    .eq("user_id", userId);

  if (existingError) throw existingError;

  if (safeRecords.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(safeRecords, { onConflict: "user_id,record_id" });
    if (error) throw error;
  }

  const liveIds = new Set(safeRecords.map((record) => record.record_id));
  const staleIds = (existingRows || [])
    .map((row) => row.record_id)
    .filter((recordId) => !liveIds.has(recordId));

  if (staleIds.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("record_id", staleIds);
    if (error) throw error;
  }
}

export default function useStudyFlowCloudSync({
  user,
  tasks,
  setTasks,
  timetable,
  setTimetable,
}) {
  const [status, setStatus] = useState("local");
  const [hydratedUserId, setHydratedUserId] = useState(null);
  const writeQueue = useRef(Promise.resolve());
  const currentUserRef = useRef(null);

  useEffect(() => {
    let active = true;
    const userId = user?.id || null;
    currentUserRef.current = userId;
    setHydratedUserId(null);

    if (!userId) {
      setStatus("local");
      return () => {
        active = false;
      };
    }

    setStatus("syncing");

    const hydrate = async () => {
      const legacyTasks = loadTasks();
      const legacyTimetable = loadTimetable();
      const previousOwner = window.localStorage.getItem(OWNER_KEY);

      try {
        const [remoteTasks, remoteTimetable] = await Promise.all([
          readRecords("studyflow_tasks", userId),
          readRecords("studyflow_timetable", userId),
        ]);

        if (!active || currentUserRef.current !== userId) return;

        if (remoteTasks.length > 0) {
          setTasks(remoteTasks);
        } else if (!previousOwner || previousOwner === userId) {
          setTasks(legacyTasks);
        } else {
          setTasks([]);
        }

        if (remoteTimetable.length > 0) {
          setTimetable(remoteTimetable);
        } else if (!previousOwner || previousOwner === userId) {
          setTimetable(legacyTimetable);
        } else {
          setTimetable([]);
        }

        window.localStorage.setItem(OWNER_KEY, userId);
        setStatus("syncing");
      } catch (error) {
        console.error("StudyFlow cloud sync read failed:", error);
        if (!active || currentUserRef.current !== userId) return;

        // Only load this browser's legacy data for its first owner. Never expose
        // one signed-in account's local records to a different account.
        if (!previousOwner || previousOwner === userId) {
          setTasks(legacyTasks);
          setTimetable(legacyTimetable);
          window.localStorage.setItem(OWNER_KEY, userId);
        } else {
          setTasks([]);
          setTimetable([]);
        }
        setStatus("error");
      } finally {
        if (active && currentUserRef.current === userId) {
          setHydratedUserId(userId);
        }
      }
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [user?.id, setTasks, setTimetable]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || hydratedUserId !== userId) return undefined;

    const timer = window.setTimeout(() => {
      const snapshotTasks = Array.isArray(tasks) ? tasks : [];
      const snapshotTimetable = Array.isArray(timetable) ? timetable : [];

      writeQueue.current = writeQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (currentUserRef.current !== userId) return;
          await Promise.all([
            writeRecords("studyflow_tasks", userId, snapshotTasks),
            writeRecords("studyflow_timetable", userId, snapshotTimetable),
          ]);

          if (currentUserRef.current === userId) {
            setStatus("synced");
          }
        })
        .catch((error) => {
          console.error("StudyFlow cloud sync write failed:", error);
          if (currentUserRef.current === userId) setStatus("error");
        });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [user?.id, hydratedUserId, tasks, timetable]);

  // Preserve fast local recovery even when cloud sync is unavailable.
  useEffect(() => {
    try {
      saveTasks(tasks);
      saveTimetable(timetable);
    } catch (error) {
      console.error("StudyFlow local backup failed:", error);
    }
  }, [tasks, timetable]);

  return {
    status,
    hydratedUserId,
    isReady: Boolean(user?.id && hydratedUserId === user.id),
  };
}
