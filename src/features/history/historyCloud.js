// History in Firestore: users/{uid}/history/{id}.
// The document id is the item's UUID, so writing the same item twice never duplicates it.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

const BATCH_LIMIT = 500; // Firestore max writes per batch

const historyCol = (uid) => collection(db, 'users', uid, 'history');
const historyDoc = (uid, id) => doc(db, 'users', uid, 'history', id);

// Fields stored in Firestore (must match firestore.rules).
function toDoc({ expr, result, angle, pinned, createdAt, updatedAt }) {
  return { expr, result, angle, pinned, createdAt, updatedAt };
}

// Calls onItems(items, fromCache) with the full history (oldest first) on every change.
// fromCache is true when Firestore has not heard from the server yet. Returns unsubscribe.
export function subscribe(uid, onItems, onError) {
  return onSnapshot(
    query(historyCol(uid), orderBy('createdAt')),
    (snap) => onItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })), snap.metadata.fromCache),
    onError,
  );
}

export const put = (uid, item) => setDoc(historyDoc(uid, item.id), toDoc(item));
export const patch = (uid, id, fields) => updateDoc(historyDoc(uid, id), fields);
export const del = (uid, id) => deleteDoc(historyDoc(uid, id));

async function batchEach(items, apply) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    items.slice(i, i + BATCH_LIMIT).forEach((it) => apply(batch, it));
    await batch.commit();
  }
}

// Copies guest history into the user's cloud history. Safe to run more than once.
export function mergeLocal(uid, items) {
  return batchEach(items, (batch, it) => batch.set(historyDoc(uid, it.id), toDoc(it)));
}

export async function clearAll(uid) {
  const snap = await getDocs(historyCol(uid));
  await batchEach(snap.docs, (batch, d) => batch.delete(d.ref));
}
