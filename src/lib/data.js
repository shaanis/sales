
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";

/**
 * User-specific collection reference.
 * Example:
 * users/{uid}/expenses
 * users/{uid}/officeSubmissions
 */
function records(uid, type) {
  if (!uid) {
    throw new Error("User ID is required.");
  }

  if (!type || typeof type !== "string") {
    throw new Error("Collection type is required.");
  }

  return collection(db, "users", uid, type);
}

/**
 * List records sorted by date, newest first.
 * Records without a date are also supported.
 */
export async function listRecords(uid, type) {
  const collectionRef = records(uid, type);

  const snapshot = await getDocs(collectionRef);

  const result = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));

  return result.sort((a, b) => {
    const dateA = String(
      a.date || a.periodStart || a.createdAt?.toDate?.()?.toISOString() || ""
    );

    const dateB = String(
      b.date || b.periodStart || b.createdAt?.toDate?.()?.toISOString() || ""
    );

    return dateB.localeCompare(dateA);
  });
}

/**
 * Add a new record.
 */
export async function addRecord(uid, type, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Valid record data is required.");
  }

  const now = serverTimestamp();

  const payload = {
    ...data,
    ownerUid: uid,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(records(uid, type), payload);

  return {
    id: ref.id,
    ...data,
    ownerUid: uid,
  };
}

/**
 * Update an existing record.
 */
export async function updateRecord(uid, type, id, data) {
  if (!id) {
    throw new Error("Record ID is required.");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Valid update data is required.");
  }

  const recordRef = doc(db, "users", uid, type, id);

  return updateDoc(recordRef, {
    ...data,
    ownerUid: uid,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an existing record.
 */
export async function deleteRecord(uid, type, id) {
  if (!id) {
    throw new Error("Record ID is required.");
  }

  return deleteDoc(doc(db, "users", uid, type, id));
}
