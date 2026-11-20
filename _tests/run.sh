#!/bin/bash
# ナカカラモ：全部のテストを、公開している index.html に対して実行する（クラウドの見回りでも、手元でも同じに動く）
# 使い方：bash _tests/run.sh [quick|full]   quick＝公開のたびと同じ（機能テストは4人）、full＝機能テストも8人全員
# 1つでも失敗したら、ここで止まって 1 を返す（公開しない）
set -e
T="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$T/.." && pwd)"
MODE="${1:-quick}"
# テスト用の道具（acorn）を入れる（入っていなければ）
[ -d "$T/tools/node_modules/acorn" ] || (cd "$T/tools" && npm install --silent --no-audit --no-fund >/dev/null 2>&1) || true
# 公開版には版の印（日時）が入っているので、テストのときは手元と同じ 'dev' に戻した写しで確かめる
F="${NK_FILE:-}"
if [ -z "$F" ]; then F="$(mktemp -d)/app.html"; sed "s/const APP_BUILD = '[0-9]*';/const APP_BUILD = 'dev';/" "$ROOT/index.html" > "$F"; fi
python3 -c "import re,sys;s=open(sys.argv[1],encoding='utf-8').read();m=re.findall(r'<script>([\s\S]*?)</script>',s);open('/tmp/nk_app_check.js','w').write(max(m,key=len))" "$F" && node --check /tmp/nk_app_check.js
for t in regress crawl persona safety audit gestures features; do node --check "$T/$t.js"; done
echo "== 再発防止テスト";     node "$T/regress.js" "$F"
echo "== 全部のボタン";       node "$T/crawl.js" "$F"
echo "== いろいろな人";       node "$T/persona.js" "$F"
echo "== 安全テスト";         node "$T/safety.js" "$F"
echo "== ていねいな点検";     node "$T/audit.js" "$F"
echo "== 指の動き";           node "$T/gestures.js" "$F"
if [ "$MODE" = full ]; then echo "== 全部の機能（8人）"; node "$T/features.js" "$F"
else echo "== 全部の機能（4人）"; SET=A,D,F,G node "$T/features.js" "$F"; fi
echo "ALL_TESTS_PASSED"
