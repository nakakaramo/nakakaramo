// ナカカラモ：全部の画面を開いて、ボタンを1つずつ押して回るテスト（エラーが出たら失敗）
// 使い方：node hadatomo-cloud/tests/crawl.js [skinwise.html のパス]
// サーバーには送らない（通信はすべて止めた状態で押す）。削除・ログアウト・支払いなど、取り消せないボタンは押さない。
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const ROUTES = ['#/home', '#/log', '#/my', '#/my/mx1', '#/combo', '#/combo/ok', '#/combo/ng', '#/combo/search', '#/ingredients', '#/routine', '#/mycare', '#/charts', '#/report',
  '#/account', '#/account/me', '#/settings', '#/plan', '#/scan', '#/care/diag', '#/care/guide', '#/terms', '#/privacy', '#/law', '#/visit'];
// 押さないボタン（取り消せない・外に送る・別の画面に飛ぶもの）
const SKIP_TEXT = /削除|消す|消去|ログアウト|リセット|初期化|解約|申し込|支払|購入|退会|共有|ダウンロード|書き出|読み込む|復元|送信|問い合わせ|ログイン|新規登録|カメラ|撮る|撮影|写真を選|通知を(オン|許可)|印刷/;
const SKIP_ACT = /delete|del-|remove|logout|reset|wipe|clear|checkout|portal|share|export|import|backup|restore|login|signup|auth|print|camera|photo|scan-|notify|push|support|contact|copy|download|open-url|ext/i;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; let where = '';
  p.on('pageerror', (e) => errs.push(`${where}：${String(e.message).split('\n')[0]}`));
  p.on('dialog', (d) => d.dismiss());
  await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort()); // 外への通信はすべて止める
  await p.goto(URL0); await p.waitForTimeout(1200);
  await p.evaluate(() => {
    window.isPremium = () => true; window.open = () => null; navigator.vibrate = () => true;
    const d = todayStr(); state.settings.onboarded = true;
    state.catalog.push({ id: 'cx1', isSample: false, verify: 'verified', name: 'テスト化粧水', brand: 'テスト', category: '化粧水', origin: 'その他', price: 1000, volume: '200ml', image: '', imageUrl: '', shopUrl: '', imgClean: false, purposes: ['保湿'], ingredients: '水、グリセリン、ナイアシンアミド', features: '', usage: '', caution: '', jan: '', source: '', checkedAt: d, offChecked: '', offUrl: '', offers: [] });
    state.myProducts.push({ id: 'mx1', demo: false, purchases: [], catalogId: 'cx1', name: 'テスト化粧水', brand: 'テスト', category: '化粧水', purposes: ['保湿'], ingredients: '水、グリセリン、ナイアシンアミド', timing: ['朝', '夜'], frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 6, order: null });
    state.skinLogs = [0, 1, 2, 4, 7, 10].map((i) => ({ id: 't' + i, date: addDays(d, -i), condition: 2 + (i % 4), acneCount: i % 3, tags: [], usedProducts: ['mx1'], note: 'メモ', photo: '' }));
    state = normalize(JSON.parse(JSON.stringify(state))); save();
  });
  const SNAP = await p.evaluate(() => JSON.stringify(state));
  let pressed = 0;
  for (const h of ROUTES) {
    where = h;
    const go = async () => { if (!(await p.evaluate(() => typeof normalize === 'function').catch(() => false))) { await p.goto(URL0); await p.waitForTimeout(800); await p.evaluate(() => { window.isPremium = () => true; window.open = () => null; }); } await p.evaluate(([h, snap]) => { try { closeModal(); } catch (e) {} document.querySelectorAll('.pm-ov,.au-ov,#prem-sheet,.ps-wrap').forEach((e) => e.remove()); state = normalize(JSON.parse(snap)); history.replaceState(null, '', h); render(); }, [h, SNAP]); await p.waitForTimeout(120); };
    await go();
    // この画面で押せるもの（同じ働きのものは1つだけ）
    const n = await p.evaluate(([st, sa]) => {
      const SKT = new RegExp(st), SKA = new RegExp(sa, 'i'), seen = new Set(), L = [];
      document.querySelectorAll('#main [data-action], #main button, #main [role=button], #main a[href^="#"], #main .tab, #main summary, .topbar button, .tabbar a').forEach((el) => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        const t = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), a = el.dataset.action || el.getAttribute('href') || '';
        if (SKT.test(t) || SKA.test(a) || el.closest('[data-crawl-skip]')) return;
        const k = a + '|' + (a ? '' : t); if (seen.has(k)) return; seen.add(k);
        el.setAttribute('data-crawl', String(L.length)); L.push(k);
      });
      return L.length;
    }, [SKIP_TEXT.source, SKIP_ACT.source]);
    for (let i = 0; i < Math.min(n, 40); i++) {
      await go();
      // 描き直すと印が消えるので、もう一度同じ順で印を付ける
      await p.evaluate(([st, sa, i]) => {
        document.querySelectorAll('[data-crawl-now]').forEach((e) => e.removeAttribute('data-crawl-now'));
        const SKT = new RegExp(st), SKA = new RegExp(sa, 'i'), seen = new Set(); let c = 0;
        document.querySelectorAll('#main [data-action], #main button, #main [role=button], #main a[href^="#"], #main .tab, #main summary, .topbar button, .tabbar a').forEach((el) => {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
          const t = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), a = el.dataset.action || el.getAttribute('href') || '';
          if (SKT.test(t) || SKA.test(a) || el.closest('[data-crawl-skip]')) return;
          const k = a + '|' + (a ? '' : t); if (seen.has(k)) return; seen.add(k);
          if (c++ === i) el.setAttribute('data-crawl-now', '1');
        });
      }, [SKIP_TEXT.source, SKIP_ACT.source, i]);
      const el = await p.$('[data-crawl-now]'); if (!el) continue;
      where = `${h} の「${(await el.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || e.dataset.action || '').trim().slice(0, 20)))}」`;
      try { await el.evaluate((e) => e.click()); pressed++; } catch (e) { /* 押せないものは飛ばす */ }
      await p.waitForTimeout(150);
      // 開いた窓の中のボタンも1段だけ押す（取り消せないものは押さない）
      const inner = await p.$$('#modal-root button:not([data-action*="del"]), .sheet button');
      for (const x of inner.slice(0, 6)) {
        const t = await x.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim()).catch(() => '');
        if (SKIP_TEXT.test(t) || /OK|はい|保存|追加|登録|決定|使う/.test(t)) continue;
        await x.evaluate((e) => e.isConnected && e.click()).catch(() => {}); await p.waitForTimeout(60);
      }
      where = h;
    }
  }
  await b.close(); srv.close();
  const uniq = [...new Set(errs)];
  console.log(`全${ROUTES.length}画面・${pressed}個のボタンを押しました`);
  uniq.forEach((e) => console.log('✗ ' + e));
  console.log(uniq.length ? `\nエラー ${uniq.length}件：公開を止めます` : '\nエラーなし');
  process.exit(uniq.length ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
