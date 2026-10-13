// 받침 유무로 조사를 고른다: josa("쥐", "이") → "쥐가", josa("고블린", "을") → "고블린을"
const PAIRS: Record<string, [string, string]> = {
  이: ["이", "가"],
  가: ["이", "가"],
  을: ["을", "를"],
  를: ["을", "를"],
  은: ["은", "는"],
  는: ["은", "는"],
  과: ["과", "와"],
  와: ["과", "와"],
};

export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return /[0-9lmnLMN]$/.test(ch) && !/[2459]$/.test(ch);
}

export function josa(word: string, p: keyof typeof PAIRS): string {
  const [withB, without] = PAIRS[p];
  return word + (hasBatchim(word) ? withB : without);
}
