// ナカカラモ：指の動きのテスト（本物のタッチで、途中で指を離した合図が来なかった・二本指・途中で別の所をさわった、などのあとに、画面が固まったり・ずれたままにならないか）
// 使い方：node hadatomo-cloud/tests/gestures.js [skinwise.html のパス]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
(async () => {
  const b = await chromium.launch(), bad = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort()); await p.goto(URL0); await p.waitForTimeout(1200);
  await p.evaluate(() => { window.isPremium = () => true; state.settings.onboarded = true; state.settings.permAsked2 = true; const d = todayStr();
    ['化粧水', '美容液', '乳液', 'クリーム', '日焼け止め', '洗顔'].forEach((c, i) => state.myProducts.push({ id: 'g' + i, demo: false, purchases: [], catalogId: null, name: 'テスト' + c + i, brand: 'テスト', category: c === '化粧水' ? '化粧水・トナー' : c === '美容液' ? '美容液・アンプル' : c, purposes: [], ingredients: '水、グリセリン', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -5), status: '使用中', endDate: '', memo: '', pao: 0, order: null }));
    state.skinLogs = [0, 1, 2, 3].map((i) => ({ id: 's' + i, date: addDays(d, -i), condition: 3, acneCount: i, acneTypes: [], usedProducts: [], memo: '', photo: '' })); state = normalize(JSON.parse(JSON.stringify(state))); save(); try { closeModal(true); } catch (e) {} });
  const cdp = await ctx.newCDPSession(p), T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const go = async (h) => { await p.evaluate((h) => { try { closeModal(true); } catch (e) {} document.querySelectorAll('.pm-ov,.au-ov').forEach((x) => x.remove()); const [a, q] = h.split('?'); if (a === '#/home') ui.homeTab = q || 'rec'; if (a === '#/my') ui.myKind = 'cos'; location.hash = a; render(); window.scrollTo(0, 0); }, h); await p.waitForTimeout(700); };
  const swipe = async (x1, y1, x2, y2, opt = {}) => { await T('touchStart', [{ x: x1, y: y1 }]); if (opt.hold) await p.waitForTimeout(opt.hold); const n = 14; for (let i = 1; i <= n; i++) { await T('touchMove', [{ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n }]); await p.waitForTimeout(16); } if (opt.end !== false) await T('touchEnd', []); };
  const tap = async (x, y) => { await T('touchStart', [{ x, y }]); await p.waitForTimeout(40); await T('touchEnd', []); };
  // 固まっていないか：ずれ・残った影・横スワイプ中の印・並べ替え中の印・暗い背景・押せない
  const stuck = () => p.evaluate(() => { const o = [];
    const tf = (s) => { const e = document.querySelector(s); return e && e.style.transform && !/^(none|translate3d\(0px, 0px, 0px\)|translateX\(0px\))$/.test(e.style.transform) ? e.style.transform : ''; };
    ['#page', '#main', '.home-pane:not(.hp-ghost)'].forEach((s) => { const v = tf(s); if (v && !(s === '.bottom-nav')) o.push(s + ' ' + v); });
    document.querySelectorAll('.mrow-in').forEach((e) => { if (e.style.transform && e.style.transform !== 'none' && e.style.transform !== 'translateX(0px)') o.push('行がずれたまま ' + e.style.transform); });
    if (window.__hSwipe) o.push('横スワイプ中のまま'); if (window.__ptrOn) o.push('引っぱり中のまま'); if (document.body.classList.contains('m-dragging')) o.push('並べ替え中のまま'); if (document.body.classList.contains('no-scroll') && !document.getElementById('modal-root').innerHTML) o.push('スクロールできないまま');
    if (document.querySelector('.hp-ghost')) o.push('切り替えの影（となりのタブ）が残る');
    return o; });
  const S = async (name, fn, home) => { await go(home); try { await fn(); } catch (e) { bad.push(name + '：テスト中のエラー ' + e.message); } await p.waitForTimeout(5000); /* 指を離した合図が来なくても、5秒以内に自分で元に戻ること */
    // 次の操作：ふつうにタップしたら反応するか
    let s1 = await stuck(); await tap(195, 700); await p.waitForTimeout(800); const s2 = await stuck();
    if (s2.length) bad.push(`${name}：そのあとも固まったまま（${s2.join('・')}）`); else if (s1.length) bad.push(`${name}：さわるまで固まったまま（${s1.join('・')}）`); };
  const note = [];
  for (const h of ['#/home', '#/my', '#/log', '#/routine']) {
    await S(`${h} 横スワイプで指を離した合図が来ない`, () => swipe(300, 450, 120, 455, { end: false }), h);
    await S(`${h} 横スワイプの途中で2本目の指`, async () => { await T('touchStart', [{ x: 300, y: 450 }]); await T('touchMove', [{ x: 250, y: 452 }]); await T('touchMove', [{ x: 200, y: 452 }, { x: 100, y: 300 }]); await T('touchEnd', []); }, h);
    await S(`${h} 横スワイプのあと、すぐ縦にスクロール`, async () => { await swipe(300, 450, 150, 452); await swipe(200, 600, 200, 300); }, h);
    await S(`${h} 引っぱって更新の途中で横`, async () => { await T('touchStart', [{ x: 200, y: 250 }]); for (let y = 260; y <= 420; y += 20) { await T('touchMove', [{ x: 200, y }]); await p.waitForTimeout(16); } for (let x = 200; x >= 60; x -= 20) { await T('touchMove', [{ x, y: 420 }]); await p.waitForTimeout(16); } await T('touchEnd', []); }, h);
  }
  await S('#/my 長押しで並べ替えて、指を離した合図が来ない', () => swipe(195, 260, 195, 420, { hold: 700, end: false }), '#/my');
  await S('#/my/g0 左はしからなぞって戻る途中で止める', () => swipe(8, 400, 200, 405, { end: false }), '#/my/g0');
  await S('#/account/me 左はしからなぞって戻る', () => swipe(8, 400, 300, 405), '#/account/me');
  await S('#/log 日付を横に送る（顔の所）', () => swipe(300, 330, 80, 335), '#/log');
  await S('#/home 3Dの顔を回して、合図が来ない', () => swipe(150, 330, 300, 330, { end: false }), '#/home');
  await b.close(); srv.close();
  if (errs.length) bad.push('エラー ' + [...new Set(errs)].slice(0, 3).join(' / '));
  note.forEach((m) => console.log('  （メモ）' + m));
  bad.forEach((m) => console.log('✗ ' + m)); console.log(bad.length ? `指の動きのテストで見つかった問題 ${bad.length}件` : '指の動きのテスト：問題なし'); process.exit(bad.length ? 1 : 0);
})();
