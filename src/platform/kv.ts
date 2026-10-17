// 키-값 저장소. 지금은 브라우저 localStorage(웹·아티팩트·웹뷰 앱 모두 지원)이고,
// 앱에서 다른 저장소(네이티브 Preferences·파일)를 쓰려면 setKv로 갈아 끼운다.
// 저장소는 사생활 보호 모드 등에서 막힐 수 있어 모든 호출을 감싸고, 실패해도 게임은 계속된다.

export interface Kv {
  get(key: string): string | null;
  /** 성공하면 true(용량 초과·차단이면 false) */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

const memory = new Map<string, string>();

/** localStorage를 못 쓰는 환경(테스트·차단된 브라우저)의 대용: 이번 페이지 동안만 남는다 */
export const memoryKv: Kv = {
  get: (k) => memory.get(k) ?? null,
  set: (k, v) => (memory.set(k, v), true),
  remove: (k) => void memory.delete(k),
};

export const localKv: Kv = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

let current: Kv = typeof localStorage === "undefined" ? memoryKv : localKv;

export function kv(): Kv {
  return current;
}

/** 저장소 갈아 끼우기(앱 포장·테스트) */
export function setKv(k: Kv): void {
  current = k;
}
