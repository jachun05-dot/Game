import { useSyncExternalStore } from "react";

// 미니앱 닫기와 종료 확인 창 상태(토스판에서만 닫기가 있다). 웹판에서는 closer가 null — 확인 창을 띄우지 않는다
let closer: (() => void) | null = null;
let asking = false;
const listeners = new Set<() => void>();

export function setCloser(f: () => void): void {
  closer = f;
}

export function getCloser(): (() => void) | null {
  return closer;
}

export function exitAsking(): boolean {
  return asking;
}

export function setExitAsk(v: boolean): void {
  asking = v;
  listeners.forEach((f) => f());
}

export function useExitAsk(): boolean {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => void listeners.delete(f)),
    () => asking,
    () => asking,
  );
}
