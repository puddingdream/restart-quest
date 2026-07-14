import type { AppState } from "./types.js";
import { createInitialState } from "../features/quests/questFlow.js";

const storageKey = "restart-quest-state";

export function loadState(): AppState {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return createInitialState();
    return { ...createInitialState(), ...JSON.parse(rawValue) };
  } catch {
    return createInitialState();
  }
}

export function storeState(state: AppState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function clearState(): AppState {
  window.localStorage.removeItem(storageKey);
  return createInitialState();
}
