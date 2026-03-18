// Shared reactive store — thin wrapper over signal
import { signal, type Signal } from "./signal";

export type Store<T extends Record<string, unknown>> = {
  [K in keyof T]: Signal<T[K]>;
};

export function store<T extends Record<string, unknown>>(init: T): Store<T> {
  const s = {} as Store<T>;
  for (const k in init) s[k] = signal(init[k]) as Store<T>[typeof k];
  return s;
}
