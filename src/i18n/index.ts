import { useSyncExternalStore } from "react";
import { getLang, subscribeLang, type Lang } from "./core";

export * from "./core";

/** 언어가 바뀌면 다시 그려지게 하는 훅(App 최상단에서 한 번 쓰면 아래가 모두 다시 그려진다) */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}
