// 시드 기반 난수(mulberry32). 상태를 숫자 하나로 GameState에 저장해서
// 같은 시드 + 같은 선택이면 항상 같은 결과가 나온다(공유·버그 재현용, DESIGN 14.6).

export interface RngState {
  s: number;
}

export function nextFloat(st: RngState): number {
  st.s = (st.s + 0x6d2b79f5) | 0;
  let t = st.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Rng {
  constructor(private st: RngState) {}

  float(): number {
    return nextFloat(this.st);
  }

  /** lo 이상 hi 이하 정수 */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  die(sides: number): number {
    return this.int(1, sides);
  }

  dice(count: number, sides: number): number {
    let t = 0;
    for (let i = 0; i < count; i++) t += this.die(sides);
    return t;
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.float() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  weighted<T>(items: readonly { item: T; w: number }[]): T {
    const total = items.reduce((a, b) => a + b.w, 0);
    let r = this.float() * total;
    for (const it of items) {
      r -= it.w;
      if (r < 0) return it.item;
    }
    return items[items.length - 1].item;
  }
}

export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
