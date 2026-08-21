import type { ObjectId } from "mongodb";

export function serialize<T extends { _id: ObjectId }>(doc: T) {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}
