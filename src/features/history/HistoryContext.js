// Calculation history.
// Guest: stored on this device (historyStore). Signed in: Firestore (historyCloud), with an
// offline copy on the device. On sign-in, guest history is merged into the cloud and cleared.
//
// Item shape (same fields as the Firestore document, plus id):
//   { id, expr, result, angle, pinned, createdAt, updatedAt }
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/features/auth/AuthContext';
import { GUEST_KEY, clearHistory, loadHistory, saveHistory, userKey } from './historyStore';
import * as cloud from './historyCloud';

const HistoryContext = createContext(null);

function reducer(items, action) {
  switch (action.type) {
    case 'set':
      return action.items;
    case 'add':
      return items.concat([action.item]);
    case 'update':
      return items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it));
    case 'remove':
      return items.filter((it) => it.id !== action.id);
    case 'restore': {
      // Undo: put deleted items back in their place (they keep their ids and dates)
      const back = action.items.filter((r) => !items.some((it) => it.id === r.id));
      return items.concat(back).sort((a, b) => a.createdAt - b.createdAt);
    }
    case 'clear':
      return [];
    default:
      return items;
  }
}

export function newItem({ expr, result, angle, pinned = false }) {
  const now = Date.now();
  return { id: randomUUID(), expr, result, angle, pinned, createdAt: now, updatedAt: now };
}

const warn = (what) => (e) => console.warn(`History ${what} failed:`, e?.message ?? e);

export function HistoryProvider({ children }) {
  const { user, ready: authReady } = useAuth();
  const uid = user?.uid ?? null;
  const [items, dispatch] = useReducer(reducer, []);
  const [ready, setReady] = useState(false);
  const storeKey = useRef(null); // where `items` is saved on this device; null while loading

  // Load history for the current user (or guest), then follow the cloud when signed in.
  useEffect(() => {
    if (!authReady) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    const key = uid ? userKey(uid) : GUEST_KEY;
    storeKey.current = null;

    (async () => {
      const saved = await loadHistory(key);
      if (cancelled) return;
      dispatch({ type: 'set', items: saved });
      storeKey.current = key;
      setReady(true);
      if (!uid) return;

      // Ignore cache-only snapshots until the server has answered once, so an offline
      // start keeps showing the saved copy instead of an empty list.
      let heardFromServer = false;
      unsubscribe = cloud.subscribe(
        uid,
        (cloudItems, fromCache) => {
          if (!fromCache) heardFromServer = true;
          if (heardFromServer && !cancelled) dispatch({ type: 'set', items: cloudItems });
        },
        warn('sync'),
      );

      const guest = await loadHistory(GUEST_KEY);
      if (guest.length === 0) return;
      try {
        await cloud.mergeLocal(uid, guest);
        await clearHistory(GUEST_KEY);
      } catch (e) {
        warn('merge')(e); // guest history stays on the device; retried next sign-in or launch
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, authReady]);

  // Save every change on this device.
  useEffect(() => {
    if (storeKey.current) saveHistory(storeKey.current, items);
  }, [items]);

  const value = useMemo(() => {
    // Change local state immediately; when signed in, also write to Firestore.
    const add = (fields) => {
      const item = newItem(fields);
      dispatch({ type: 'add', item });
      if (uid) cloud.put(uid, item).catch(warn('save'));
      return item;
    };
    return {
      items, // oldest first
      ready,
      add,
      duplicate: (item) => add({ ...item, pinned: false }),
      togglePin: (id) => {
        const it = items.find((x) => x.id === id);
        if (!it) return;
        const patch = { pinned: !it.pinned, updatedAt: Date.now() };
        dispatch({ type: 'update', id, patch });
        if (uid) cloud.patch(uid, id, patch).catch(warn('pin'));
      },
      remove: (id) => {
        dispatch({ type: 'remove', id });
        if (uid) cloud.del(uid, id).catch(warn('delete'));
      },
      clear: () => {
        dispatch({ type: 'clear' });
        if (uid) cloud.clearAll(uid).catch(warn('clear'));
      },
      // Undo for remove / clear. Same ids, so the cloud copy is never duplicated.
      restore: (deleted) => {
        dispatch({ type: 'restore', items: deleted });
        if (uid) cloud.mergeLocal(uid, deleted).catch(warn('restore'));
      },
    };
  }, [items, ready, uid]);

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  return useContext(HistoryContext);
}
