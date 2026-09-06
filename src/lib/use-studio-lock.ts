import { useSyncExternalStore } from "react";
import { isStudioLocked, subscribeStudioLock } from "./studio-lock";

const subscribeNever = () => () => {};

/** False during SSR / the first hydrate pass so we never auto-open the desk before storage is read. */
export function useClientReady() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

export function useStudioLock() {
  return useSyncExternalStore(subscribeStudioLock, isStudioLocked, () => false);
}
