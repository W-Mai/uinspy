// Minimal reactive state utility
type Listener = () => void;

export function signal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();

  return {
    get val() { return value; },
    set val(v: T) {
      if (v === value) return;
      value = v;
      listeners.forEach((fn) => fn());
    },
    sub(fn: Listener) {
      listeners.add(fn);
      fn(); // Immediate call with current value
      return () => listeners.delete(fn);
    },
  };
}

export type Signal<T> = ReturnType<typeof signal<T>>;
