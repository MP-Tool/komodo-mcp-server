import { AsyncLocalStorage } from "node:async_hooks";

const komodoRequestSignal = new AsyncLocalStorage<AbortSignal | undefined>();

/** Use the caller's signal even in nested API calls that take no signal argument. */
export function getKomodoRequestSignal(): AbortSignal | undefined {
  return komodoRequestSignal.getStore();
}

export function runWithKomodoRequestSignal<T>(signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T> {
  return komodoRequestSignal.run(signal, run);
}
