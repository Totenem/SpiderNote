import { useSyncExternalStore } from "react";
export type AiStatus = {
  busy: boolean;
  phase: string;
  progress: number;
  noteId?: string;
  error?: string;
};
let snapshot: AiStatus = { busy: false, phase: "Ready", progress: 0 };
const listeners = new Set<() => void>();
let cancel: (() => void) | undefined;
export const getAiStatus = () => snapshot;
export function setAiStatus(next: AiStatus) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
export function acquireAiTask(
  phase: string,
  abort: () => void,
  noteId?: string,
) {
  if (snapshot.busy)
    throw Error(
      "Another AI task or model download is running. Finish or cancel it first.",
    );
  cancel = abort;
  setAiStatus({ busy: true, phase, progress: 0, noteId });
}
export function finishAiTask(error?: string) {
  cancel = undefined;
  setAiStatus({
    busy: false,
    phase: error ? "Stopped" : "Ready",
    progress: 0,
    error,
  });
}
export function cancelAiTask() {
  cancel?.();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useAiStatus = () =>
  useSyncExternalStore(subscribe, getAiStatus, getAiStatus);
