import { supabase } from "../lib/supabaseClient";

const TABLES = {
  tasks: "studyflow_tasks",
  timetable: "studyflow_timetable",
  focusSessions: "studyflow_focus_sessions",
};

// Serialize writes per user/table so a slower older save cannot overtake a newer one.
const pendingWrites = new Map();

function tableFor(collection) {
  const table = TABLES[collection];
  if (!table) throw new Error(`Unknown StudyFlow collection: ${collection}`);
  return table;
}

function validRecord(collection, record) {
  if (!record || typeof record !== "object" || typeof record.id !== "string") {
    return false;
  }

  if (collection === "tasks") {
    return typeof record.title === "string";
  }

  if (collection === "focusSessions") {
    return (
      typeof record.startedAt === "string" &&
      Number.isFinite(Number(record.durationMinutes)) &&
      Number(record.durationMinutes) > 0
    );
  }

  return (
    typeof record.subject === "string" &&
    Number.isInteger(record.day) &&
    record.day >= 0 &&
    record.day <= 6 &&
    typeof record.startTime === "string" &&
    typeof record.endTime === "string"
  );
}

export async function loadUserCollection(collection, userId) {
  const table = tableFor(collection);
  const { data, error } = await supabase
    .from(table)
    .select("record_id, data")
    .eq("user_id", userId);

  if (error) throw error;

  return (data || [])
    .map((row) => {
      if (!row?.data || typeof row.data !== "object" || Array.isArray(row.data)) {
        return null;
      }

      // Use the primary-key value for identity rather than trusting payload JSON.
      return { ...row.data, id: row.record_id };
    })
    .filter((record) => validRecord(collection, record));
}

async function syncCollectionNow(collection, userId, records) {
  const table = tableFor(collection);
  const normalized = Array.isArray(records)
    ? records.filter((record) => validRecord(collection, record))
    : [];
  const desiredIds = new Set(normalized.map((record) => record.id));

  const { data: existingRows, error: readError } = await supabase
    .from(table)
    .select("record_id")
    .eq("user_id", userId);

  if (readError) throw readError;

  // Upsert desired records first. If this fails, do not delete existing cloud data.
  if (normalized.length > 0) {
    const rows = normalized.map((record) => ({
      user_id: userId,
      record_id: record.id,
      data: record,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from(table)
      .upsert(rows, { onConflict: "user_id,record_id" });

    if (upsertError) throw upsertError;
  }

  const obsoleteIds = (existingRows || [])
    .map((row) => row.record_id)
    .filter((recordId) => !desiredIds.has(recordId));

  // Delete only records owned by this user, and only after upserts succeeded.
  if (obsoleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("record_id", obsoleteIds);

    if (deleteError) throw deleteError;
  }
}

export function syncUserCollection(collection, userId, records) {
  const table = tableFor(collection);
  const queueKey = `${userId}:${table}`;
  const previous = pendingWrites.get(queueKey) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => syncCollectionNow(collection, userId, records));

  pendingWrites.set(queueKey, next);
  next.finally(() => {
    if (pendingWrites.get(queueKey) === next) {
      pendingWrites.delete(queueKey);
    }
  }).catch(() => undefined);

  return next;
}

async function upsertCollectionNow(collection, userId, records) {
  const table = tableFor(collection);
  const normalized = Array.isArray(records)
    ? records.filter((record) => validRecord(collection, record))
    : [];
  if (!normalized.length) return;

  const rows = normalized.map((record) => ({
    user_id: userId,
    record_id: record.id,
    data: record,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "user_id,record_id" });
  if (error) throw error;
}

// Upsert-only recovery is used when cloud loading previously failed. It does
// not delete remote records based on an incomplete local snapshot.
export function upsertUserCollection(collection, userId, records) {
  const table = tableFor(collection);
  const queueKey = `${userId}:${table}`;
  const previous = pendingWrites.get(queueKey) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => upsertCollectionNow(collection, userId, records));

  pendingWrites.set(queueKey, next);
  next.finally(() => {
    if (pendingWrites.get(queueKey) === next) {
      pendingWrites.delete(queueKey);
    }
  }).catch(() => undefined);

  return next;
}
