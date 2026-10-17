#!/usr/bin/env bash
# GitHub Pages 배포: dist/를 gh-pages 브랜치 worktree에 그대로 올리고 푸시한다.
# 실행: npm run build && scripts/release/pages.sh [worktree 경로, 기본 ../ghp]
# worktree가 없으면 만든다(git worktree add <경로> gh-pages).
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
wt="${1:-$root/../ghp}"
[ -f "$root/dist/index.html" ] || { echo "dist/index.html이 없습니다. 먼저 npm run build" >&2; exit 1; }
if [ ! -d "$wt/.git" ] && [ ! -f "$wt/.git" ]; then
  git -C "$root" fetch -q origin gh-pages
  git -C "$root" worktree add "$wt" gh-pages
fi
build="$(sed -n 's/.*"id": "\(.*\)".*/\1/p' "$root/dist/version.json")"
cd "$wt"
git pull -q --ff-only origin gh-pages || true
git rm -q -r --cached . >/dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$root/dist/." .
touch .nojekyll
git add -A
if git diff --cached --quiet; then
  echo "바뀐 것 없음($build)"
  exit 0
fi
git commit -q -m "deploy: $build"
for i in 0 2 4 8 16; do
  sleep "$i"
  git push -q origin gh-pages && { echo "GitHub Pages 배포: $build"; exit 0; }
done
echo "푸시 실패" >&2
exit 1
