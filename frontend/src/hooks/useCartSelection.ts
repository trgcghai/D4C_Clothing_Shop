import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/store";

const STORAGE_KEY = "d4c-cart-selection";

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY}-${userId}`;
}

// Returns null if nothing was ever stored, or the stored array (possibly empty)
function loadSelectedIds(userId: number | undefined): number[] | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveSelectedIds(userId: number | undefined, ids: number[]) {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Silently fail — localStorage may be unavailable
  }
}

export function useCartSelection(cartItemIds: number[]) {
  const { user } = useAuth();
  const userId = user?.id;
  const initializedRef = useRef(false);

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const stored = loadSelectedIds(userId);
    // null = never stored → will be initialized when cart loads
    // [] = explicitly deselected all → preserve
    // [ids] = some selection → preserve
    return stored ?? [];
  });

  // When cart items change, sync selection and persist
  useEffect(() => {
    if (cartItemIds.length === 0) {
      return;
    }

    if (!initializedRef.current) {
      // First time cart loads: if nothing was stored, default to select all
      const stored = loadSelectedIds(userId);
      if (stored === null) {
        // Never stored before → select all and persist
        setSelectedIds([...cartItemIds]);
        saveSelectedIds(userId, cartItemIds);
        initializedRef.current = true;
        return;
      }
      // Was stored before (possibly []) → filter stale IDs
      const synced = stored.filter((id) => cartItemIds.includes(id));
      // If synced is empty AND stored was empty, user explicitly deselected all → keep empty
      // If synced is empty but stored had items, those items are gone from cart → select all
      if (synced.length === 0 && stored.length > 0) {
        // All stored items are gone → select all fresh items
        setSelectedIds([...cartItemIds]);
        saveSelectedIds(userId, cartItemIds);
      } else {
        setSelectedIds(synced);
        saveSelectedIds(userId, synced);
      }
      initializedRef.current = true;
      return;
    }

    // Subsequent cart changes: only prune stale IDs, preserve deselections
    setSelectedIds((prev) => {
      const synced = prev.filter((id) => cartItemIds.includes(id));
      saveSelectedIds(userId, synced);
      return synced;
    });
  }, [cartItemIds, userId]);

  const toggleItem = useCallback(
    (itemId: number) => {
      setSelectedIds((prev) => {
        const next = prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];
        saveSelectedIds(userId, next);
        return next;
      });
    },
    [userId],
  );

  const selectAll = useCallback(() => {
    const all = [...cartItemIds];
    setSelectedIds(all);
    saveSelectedIds(userId, all);
  }, [cartItemIds, userId]);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
    saveSelectedIds(userId, []);
  }, [userId]);

  const isAllSelected = cartItemIds.length > 0 && selectedIds.length === cartItemIds.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < cartItemIds.length;

  const setSelectedIdsCallback = useCallback(
    (ids: number[] | ((prev: number[]) => number[])) => {
      const resolved = typeof ids === "function" ? ids(selectedIds) : ids;
      setSelectedIds(resolved);
      saveSelectedIds(userId, resolved);
    },
    [userId, selectedIds],
  );

  return {
    selectedIds,
    setSelectedIds: setSelectedIdsCallback,
    toggleItem,
    selectAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
  };
}
