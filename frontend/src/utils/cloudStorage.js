import { supabase } from "../lib/supabaseClient";

const TABLES = {
  tasks: "studyflow_tasks",
  timetable: "studyflow_timetable",
  focusSessions: "studyflow_focus_sessions",
};

// Serialize writes per user/table so a slower older save cannot overtake a newer one.
const pendingWrites = new Map();
const confirmedSnapshots = new Map();

function snapshotKey(collection, userId) {
  return `${userId}:${tableFor(collection)}`;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function sameRecord(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

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

  const records = (data || [])
    .map((row) => {
      if (!row?.data || typeof row.data !== "object" || Array.isArray(row.data)) {
        return null;
      }

      // Use the primary-key value for identity rather than trusting payload JSON.
      return { ...row.data, id: row.record_id };
    })
    .filter((record) => validRecord(collection, record));
  confirmedSnapshots.set(snapshotKey(collection, userId), records);
  return records;
}

async function syncCollectionNow(collection, userId, records) {
  const table = tableFor(collection);
  const normalized = Array.isArray(records)
    ? records.filter((record) => validRecord(collection, record))
    : [];
  const queueKey = snapshotKey(collection, userId);
  const knownSnapshot = confirmedSnapshots.get(queueKey);

  // Read the latest cloud rows, but only write records changed since the last
  // cloud snapshot this browser actually loaded. Stale browsers must not rewrite
  // every row or delete records created/edited on another browser.
  const { data: existingRows, error: readError } = await supabase
    .from(table)
    .select("record_id, data")
    .eq("user_id", userId);
  if (readError) throw readError;

  const remote = new Map((existingRows || []).map((row) => [
    row.record_id,
    row?.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? { ...row.data, id: row.record_id }
      : null,
  ]));
  const baseRecords = knownSnapshot || [...remote.values()].filter(Boolean);
  const base = new Map(baseRecords.map((record) => [record.id, record]));
  const desired = new Map(normalized.map((record) => [record.id, record]));

  const changed = normalized.filter((record) =>
    !base.has(record.id) || !sameRecord(record, base.get(record.id))
  );
  if (changed.length > 0) {
    const rows = changed.map((record) => ({
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

  const obsoleteIds = [];
  for (const [recordId, baselineRecord] of base.entries()) {
    if (desired.has(recordId)) continue;
    const remoteRecord = remote.get(recordId);
    // Only delete if the cloud record is still the version this browser saw.
    // A concurrent remote edit wins rather than being erased by a stale client.
    if (remoteRecord && sameRecord(remoteRecord, baselineRecord)) obsoleteIds.push(recordId);
  }
  if (obsoleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("record_id", obsoleteIds);
    if (deleteError) throw deleteError;
  }

  // Remote-only records aren't considered deletions by this browser until a
  // reload/realtime refresh has made them part of its confirmed snapshot.
  confirmedSnapshots.set(queueKey, normalized);
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
