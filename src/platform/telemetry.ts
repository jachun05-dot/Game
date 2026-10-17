import { BUILD_ID } from "./build";
import { HOST, claudeUse } from "./host";

// 플레이 기록 보내기. 보낼 곳(sink)을 여럿 둘 수 있고, 지금 있는 곳은 claude.ai 아티팩트 db 하나.
// 나중에 웹·앱용 수집 서버를 붙이려면 Sink를 하나 더 만들어 SINKS에 넣으면 된다(게임 쪽 코드는 그대로).
// 보내기는 언제나 조용히 실패한다: 기록이 빠질 뿐 게임에 영향 없음.

/** 기록 종류: life = 끝난 삶 하나 */
export type RecordKind = "life";

export interface Sink {
  name: string;
  /** 이 환경에서 쓸 수 있는지(빠르게, 네트워크 없이) */
  available(): boolean;
  /** 같은 kind·id는 같은 기록(다시 보내도 하나만 남아야 한다) */
  send(kind: RecordKind, id: string, body: Record<string, unknown>): Promise<void>;
}

/** db 경로 한 칸에 쓸 수 없는 글자는 _로 */
export function pathSafe(id: string): string {
  return id.replace(/[^A-Za-z0-9_\-.~:@+]/g, "_").slice(0, 200) || "_";
}

/**
 * 아티팩트 db: runs/<플레이어 id>(표시 문서) 아래 lives/<기록 id>.
 * 규칙(게시할 때 capabilities로): runs는 주인만 읽고 쓰기, runs/{self}는 Contributor 이상이 자기 것만.
 * 하위 기록만으로는 목록에 안 잡히므로 runs/<id>에도 마지막 기록 시각을 남긴다.
 */
export const artifactDbSink: Sink = {
  name: "artifact-db",
  available: () => claudeUse() !== null,
  async send(kind, id, body) {
    const use = claudeUse();
    if (!use) return;
    const [db, user] = await Promise.all([use("db"), use("user")]);
    if (!db || !user) return;
    const uid: string | null = await user.id();
    if (!uid) return;
    const coll = kind === "life" ? "lives" : kind;
    await db.collection(`runs/${uid}/${coll}`).doc(pathSafe(id)).set(body);
    await db.doc(`runs/${uid}`).set({ lastAt: body.at ?? new Date().toISOString(), lastId: id, build: BUILD_ID });
  },
};

const SINKS: Sink[] = [artifactDbSink];

/** 기록 하나를 쓸 수 있는 모든 곳에 보낸다. 본문에 빌드·환경 표시를 붙인다 */
export async function sendRecord(kind: RecordKind, id: string, body: Record<string, unknown>): Promise<void> {
  const stamped = { ...body, build: BUILD_ID, host: HOST };
  await Promise.all(
    SINKS.filter((s) => s.available()).map((s) =>
      s.send(kind, id, stamped).catch(() => {
        /* 권한 없음(보기 전용)·한도 초과 등: 기록만 빠진다 */
      }),
    ),
  );
}
