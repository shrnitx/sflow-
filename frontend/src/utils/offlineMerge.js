import { mergeCloudState } from "./cloudStateMerge";

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

export function areRecordsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  const normalize = (records) => records
    .map(stableValue)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

// Three-way merge against the last successful cloud snapshot:
// - local additions/edits/deletions win for records changed locally;
// - untouched records follow the remote state, including remote deletions;
// - records created remotely while offline are retained.
export function mergeOfflineCollection(cloudRecords, localRecords, baselineRecords) {
  const baseline = new Map(
    (Array.isArray(baselineRecords) ? baselineRecords : []).map((item) => [item.id, item])
  );
  const local = new Map(
    (Array.isArray(localRecords) ? localRecords : []).map((item) => [item.id, item])
  );
  const cloud = new Map(
    (Array.isArray(cloudRecords) ? cloudRecords : []).map((item) => [item.id, item])
  );
  const allIds = new Set([...baseline.keys(), ...local.keys(), ...cloud.keys()]);
  const merged = new Map();

  allIds.forEach((id) => {
    const hadBaseline = baseline.has(id);
    const hasLocal = local.has(id);
    const hasCloud = cloud.has(id);
    const baselineRecord = baseline.get(id);
    const localRecord = local.get(id);
    const cloudRecord = cloud.get(id);

    if (!hadBaseline) {
      if (hasLocal && hasCloud) {
        merged.set(id, mergeCloudState({}, localRecord, cloudRecord));
      } else if (hasLocal) {
        merged.set(id, localRecord);
      } else if (hasCloud) {
        merged.set(id, cloudRecord);
      }
      return;
    }

    if (!hasLocal) {
      if (!hasCloud) return;
      // A local deletion wins only when the cloud row has not changed since the
      // baseline. Preserve a remote edit rather than discarding newer work.
      if (!sameRecord(cloudRecord, baselineRecord)) merged.set(id, cloudRecord);
      return;
    }

    if (!hasCloud) {
      // A remote deletion wins for untouched rows, but an unsynced local edit
      // must remain recoverable until it can be written or reconciled.
      if (!sameRecord(localRecord, baselineRecord)) merged.set(id, localRecord);
      return;
    }

    // Merge independent field edits within the same record as well as additions
    // and deletions across the collection. Conflicting scalar edits favor local.
    merged.set(id, mergeCloudState(baselineRecord, localRecord, cloudRecord));
  });

  return [...merged.values()];
}
