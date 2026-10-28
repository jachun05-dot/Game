// 토스판(앱인토스) 연결 — main.tsx가 토스판일 때만 불러온다(웹판 번들에서는 내려받지 않는다). docs/APPS_IN_TOSS.md
// - 저장: 토스 저장소(Storage)에 사용자별로 둔다. 게임은 동기 kv를 쓰므로 시작할 때 다 읽어 두고, 쓰기는 모아서 보낸다
// - 사용자: User.getAnonymousKey의 hash로 저장 키를 나눈다(한 기기에 여러 토스 계정)
// - 뒤로가기: 안드로이드 백버튼을 "ddd:back" 이벤트로 넘긴다(App이 화면을 닫거나 종료 확인 창을 띄운다)
// - 안전 영역: SafeArea 값을 CSS 변수(--safe-top 등)로
import { SafeArea, Screen, Storage, User, graniteEvent } from "@apps-in-toss/web-framework";
import { setKv, type Kv } from "./kv";
import { setCloser } from "./exit";
import { KEYS } from "../save/storage";

/** 시작할 때 읽어 둘 키(저장·백업·언어) */
function knownKeys(): string[] {
  const base = [KEYS.run, KEYS.meta];
  const backups = base.flatMap((k) => [`${k}.broken`, `${k}.newer`, `${k}.bak-r0`]);
  return [...base, ...backups, "ddd-lang"];
}

/** 같은 키를 짧은 사이에 여러 번 쓰면 마지막 값만 보낸다(브릿지 과다 호출 방지) */
const WRITE_DELAY_MS = 400;

async function userPrefix(): Promise<string> {
  try {
    if (User.getAnonymousKey.isSupported()) {
      const r = await User.getAnonymousKey();
      if (r?.hash) return `u.${r.hash.slice(0, 24)}.`;
    }
  } catch {
    /* 오래된 토스 앱 등: 기기 단위로 저장 */
  }
  return "u.device.";
}

async function setupStorage(): Promise<void> {
  const prefix = await userPrefix();
  const mem = new Map<string, string>();
  await Promise.all(
    knownKeys().map(async (k) => {
      try {
        const v = await Storage.getItem(prefix + k);
        if (v !== null) mem.set(k, v);
      } catch {
        /* 읽기 실패: 없는 것으로 */
      }
    }),
  );
  const pending = new Map<string, string | null>();
  let timer: number | null = null;
  const flush = () => {
    timer = null;
    const items = [...pending];
    pending.clear();
    for (const [k, v] of items) {
      const p = v === null ? Storage.removeItem(prefix + k) : Storage.setItem(prefix + k, v);
      p.catch(() => {
        // 한 번만 다시 시도한다(실패가 이어져도 게임은 계속된다)
        window.setTimeout(() => void (v === null ? Storage.removeItem(prefix + k) : Storage.setItem(prefix + k, v)).catch(() => {}), 2000);
      });
    }
  };
  const queue = (k: string, v: string | null) => {
    pending.set(k, v);
    if (timer === null) timer = window.setTimeout(flush, WRITE_DELAY_MS);
  };
  // 미니앱이 가려지면(홈으로·닫기) 남은 쓰기를 바로 보낸다
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer !== null) {
      window.clearTimeout(timer);
      flush();
    }
  });
  const kv: Kv = {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => {
      mem.set(k, v);
      queue(k, v);
      return true;
    },
    remove: (k) => {
      mem.delete(k);
      queue(k, null);
    },
  };
  setKv(kv);
}

function setupSafeArea(): void {
  const apply = () => {
    try {
      const s = SafeArea.get();
      const root = document.documentElement.style;
      root.setProperty("--safe-top", `${s.top}px`);
      root.setProperty("--safe-bottom", `${s.bottom}px`);
      root.setProperty("--safe-left", `${s.left}px`);
      root.setProperty("--safe-right", `${s.right}px`);
    } catch {
      /* 브라우저(브릿지 없음): CSS env() 값을 쓴다 */
    }
  };
  apply();
  window.addEventListener("resize", apply);
}

function setupBack(): void {
  try {
    graniteEvent.addEventListener("backEvent", { onEvent: () => window.dispatchEvent(new Event("ddd:back")) });
  } catch {
    /* 브라우저 */
  }
}

/** 미니앱 닫기(종료 확인 창에서 "종료") */
export function closeApp(): void {
  void Screen.close().catch(() => {});
}

/** 토스판 시작 준비: 저장소를 먼저 읽어야 언어·저장을 불러올 수 있다 */
export async function setupToss(): Promise<void> {
  // 토스 앱 밖(일반 브라우저 미리보기)에서는 브릿지가 없다 — 아무것도 바꾸지 않고 웹 저장소로 돈다
  try {
    await Storage.getItem("ddd-probe");
  } catch {
    return;
  }
  setCloser(closeApp);
  setupSafeArea();
  setupBack();
  try {
    await setupStorage();
  } catch {
    /* 토스 저장소를 못 쓰면 브라우저 저장소 그대로 */
  }
}
