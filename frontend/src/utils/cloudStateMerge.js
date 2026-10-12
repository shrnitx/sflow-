const ABSENT = Symbol("absent");
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function clone(value) {
  if (value === ABSENT) return ABSENT;
  if (Array.isArray(value)) return value.map(clone);
  if (isObject(value)) return Object.keys(value).reduce((result, key) => { result[key] = clone(value[key]); return result; }, {});
  return value;
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) return Object.keys(value).sort().reduce((result, key) => { result[key] = stableValue(value[key]); return result; }, {});
  return value;
}
export function sameCloudState(left, right) {
  if (left === ABSENT || right === ABSENT) return left === right;
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}
function mergeNode(base, local, remote) {
  if (sameCloudState(local, base)) return clone(remote);
  if (sameCloudState(remote, base)) return clone(local);
  if (sameCloudState(local, remote)) return clone(local);
  if (local === ABSENT) {
    if (base === ABSENT || sameCloudState(remote, base)) return ABSENT;
    return clone(remote);
  }
  if (remote === ABSENT) {
    if (base === ABSENT || sameCloudState(local, base)) return ABSENT;
    return clone(local);
  }
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const byId = [base, local, remote].every((items) => items.every((item) => isObject(item) && typeof item.id === "string" && item.id.length > 0));
    if (!byId) return clone(local);
    const baseMap = new Map(base.map((item) => [item.id, item]));
    const localMap = new Map(local.map((item) => [item.id, item]));
    const remoteMap = new Map(remote.map((item) => [item.id, item]));
    const ids = [...local.map((item) => item.id), ...remote.map((item) => item.id).filter((id) => !localMap.has(id))];
    const merged = [];
    for (const id of ids) {
      const value = mergeNode(baseMap.has(id) ? baseMap.get(id) : ABSENT, localMap.has(id) ? localMap.get(id) : ABSENT, remoteMap.has(id) ? remoteMap.get(id) : ABSENT);
      if (value !== ABSENT) merged.push(value);
    }
    return merged;
  }
  if (isObject(base) && isObject(local) && isObject(remote)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    const merged = {};
    for (const key of keys) {
      const value = mergeNode(
        Object.prototype.hasOwnProperty.call(base, key) ? base[key] : ABSENT,
        Object.prototype.hasOwnProperty.call(local, key) ? local[key] : ABSENT,
        Object.prototype.hasOwnProperty.call(remote, key) ? remote[key] : ABSENT
      );
      if (value !== ABSENT) merged[key] = value;
    }
    return merged;
  }
  return clone(local);
}
export function mergeCloudState(base, local, remote) { return mergeNode(base, local, remote); }
