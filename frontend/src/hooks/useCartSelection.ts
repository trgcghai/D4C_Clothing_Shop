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
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Silently fail — localStorage may be unavailable
  }
}

export function useCartSelection(cartItemIds: number[]) {
  const { user } = useAuth();
  const userId = user?.id;

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    // Load stored IDs directly — don't filter against cartItemIds yet
    // because cart may not be loaded on first render
    return loadSelectedIds(userId);
  });

  // When cart items change, sync selection and persist
  useEffect(() => {
    if (cartItemIds.length === 0) {
      // Don't clear selection when cart is empty/loading — preserve stored state
      return;
    }

    setSelectedIds((prev) => {
      // Keep only IDs that still exist in cart
      const synced = prev.filter((id) => cartItemIds.includes(id));

      // If nothing is selected (stored was empty or all items removed from cart), select all
      if (synced.length === 0) {
        const all = [...cartItemIds];
        saveSelectedIds(userId, all);
        return all;
      }

      // Preserve the filtered selection — don't auto-add new items
      // This respects deliberate deselections across navigation
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
