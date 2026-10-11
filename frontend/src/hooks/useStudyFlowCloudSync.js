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
  const { data, error } = await supabase.from(table).select("record_id,data").eq("user_id", userId);
  if (error) throw error;
  return rowsToRecords(data);
}

async function writeRecords(table, userId, records) {
  const rows = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record.id === "string" && record.id.trim())
    .map((record) => ({ user_id: userId, record_id: record.id, data: record, updated_at: new Date().toISOString() }));

  const { data: existing, error: readError } = await supabase.from(table).select("record_id").eq("user_id", userId);
  if (readError) throw readError;

  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "user_id,record_id" });
    if (error) throw error;
  }

  const ids = new Set(rows.map((row) => row.record_id));
  const stale = (existing || []).map((row) => row.record_id).filter((id) => !ids.has(id));
  if (stale.length) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId).in("record_id", stale);
    if (error) throw error;
  }
}

export default function useStudyFlowCloudSync({ user, tasks, setTasks, timetable, setTimetable }) {
  const [status, setStatus] = useState("local");
  const [hydratedUserId, setHydratedUserId] = useState(null);
  const queue = useRef(Promise.resolve());
  const activeUserRef = useRef(null);

  useEffect(() => {
    let active = true;
    const userId = user?.id || null;
    activeUserRef.current = userId;
    setHydratedUserId(null);

    if (!userId) {
      setStatus("local");
      return () => { active = false; };
    }

    setStatus("syncing");
    const hydrate = async () => {
      const localTasks = loadTasks();
      const localTimetable = loadTimetable();
      const oldOwner = window.localStorage.getItem(OWNER_KEY);

      try {
        const [remoteTasks, remoteTimetable] = await Promise.all([
          readRecords("studyflow_tasks", userId),
          readRecords("studyflow_timetable", userId),
        ]);
        if (!active || activeUserRef.current !== userId) return;

        setTasks(remoteTasks.length ? remoteTasks : (!oldOwner || oldOwner === userId ? localTasks : []));
        setTimetable(remoteTimetable.length ? remoteTimetable : (!oldOwner || oldOwner === userId ? localTimetable : []));
        window.localStorage.setItem(OWNER_KEY, userId);
        setStatus("syncing");
      } catch (error) {
        console.error("StudyFlow cloud sync read failed:", error);
        if (!active || activeUserRef.current !== userId) return;
        setTasks(!oldOwner || oldOwner === userId ? localTasks : []);
        setTimetable(!oldOwner || oldOwner === userId ? localTimetable : []);
        if (!oldOwner || oldOwner === userId) window.localStorage.setItem(OWNER_KEY, userId);
        setStatus("error");
      } finally {
        if (active && activeUserRef.current === userId) setHydratedUserId(userId);
      }
    };

    hydrate();
    return () => { active = false; };
  }, [user?.id, setTasks, setTimetable]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || hydratedUserId !== userId) return undefined;

    const timeout = window.setTimeout(() => {
      const taskSnapshot = Array.isArray(tasks) ? tasks : [];
      const timetableSnapshot = Array.isArray(timetable) ? timetable : [];
      queue.current = queue.current.catch(() => undefined).then(async () => {
        if (activeUserRef.current !== userId) return;
        await Promise.all([
          writeRecords("studyflow_tasks", userId, taskSnapshot),
          writeRecords("studyflow_timetable", userId, timetableSnapshot),
        ]);
        if (activeUserRef.current === userId) setStatus("synced");
      }).catch((error) => {
        console.error("StudyFlow cloud sync write failed:", error);
        if (activeUserRef.current === userId) setStatus("error");
      });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [user?.id, hydratedUserId, tasks, timetable]);

  useEffect(() => {
    try {
      saveTasks(tasks);
      saveTimetable(timetable);
    } catch (error) {
      console.error("StudyFlow local backup failed:", error);
    }
  }, [tasks, timetable]);

  return { status, hydratedUserId, isReady: Boolean(user?.id && hydratedUserId === user.id) };
}
