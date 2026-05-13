import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/src/store";

const STORAGE_KEY = "d4c-cart-selection";

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY}-${userId}`;
}

function loadSelectedIds(userId: number | undefined): number[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSelectedIds(userId: number | undefined, ids: number[]) {
  if (!userId) return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
}

export function useCartSelection(cartItemIds: number[]) {
  const { user } = useAuth();
  const userId = user?.id;

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const stored = loadSelectedIds(userId);
    // Filter out stale IDs that are no longer in the cart
    return stored.filter((id) => cartItemIds.includes(id));
  });

  // When cart items change, sync selection and persist
  useEffect(() => {
    if (cartItemIds.length === 0) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((prev) => {
      // Keep only IDs that still exist in cart
      let synced = prev.filter((id) => cartItemIds.includes(id));

      // If nothing was selected (or all were stale), select all items
      if (synced.length === 0) {
        synced = [...cartItemIds];
      }

      // If there are new items not in selection, add them (default to selected)
      const newItems = cartItemIds.filter((id) => !synced.includes(id));
      if (newItems.length > 0) {
        synced = [...synced, ...newItems];
      }

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

  return {
    selectedIds,
    setSelectedIds: (ids: number[]) => {
      setSelectedIds(ids);
      saveSelectedIds(userId, ids);
    },
    toggleItem,
    selectAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
  };
}
