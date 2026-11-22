// ナカカラモ：再発防止テスト（Keiichiroが「直して」と言ったバグが、もう一度起きていないかを確かめる）
// 使い方：node hadatomo-cloud/tests/regress.js [skinwise.html のパス]
// 公開する前に必ず実行する（deploy.sh から自動で実行される）。1つでも失敗したら公開しない。
// バグを直したら、ここに確かめる項目を1つ足す。
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const results = [];
// 手元だけにあるファイル（サーバーの関数・公開の手順など）。クラウドの見回りには無いので、そのときは、それを読む確かめだけ飛ばす
const HC = process.env.NK_HC || '/home/claude/hadatomo-cloud';
let HC_MISS = 0, SKIPPED = [];
{ const rf = fs.readFileSync; fs.readFileSync = function (f, ...a) { if (typeof f === 'string' && f.startsWith(HC) && !fs.existsSync(f)) { if (!HC_MISS) queueMicrotask(() => { HC_MISS = 0; }); HC_MISS++; return ''; } /* 同じまとまりの確かめ（続けて書いてあるもの）を全部飛ばす */ return rf.call(fs, f, ...a); }; }
const check = (name, ok, info = '') => { if (HC_MISS) { SKIPPED.push(name); return; } results.push({ name, ok: !!ok, info }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); // カメラの確認のため、にせのカメラを使う
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.context().grantPermissions(['camera']).catch(() => {});
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); if (process.env.PE) console.log('PE', String(e.stack).split('\n').slice(0, 3).join(' | ')); });
  p.on('console', (m) => { if (/^  /.test(m.text())) console.log(m.text()); }); // 確認の中で出したメモを表示する
  await p.goto(URL0); await p.waitForTimeout(1200);
  await p.evaluate(() => { state.settings.onboarded = true; const d = todayStr(); state.skinLogs = [0, 1, 3].map((i) => ({ id: 't' + i, date: addDays(d, -i), condition: 3 + (i % 2), acneCount: i, tags: [], usedProducts: [], note: '', photo: '' })); state = normalize(JSON.parse(JSON.stringify(state))); document.getElementById('modal-root').innerHTML = ''; }); // テスト用の肌の記録
  const ev = (f, ...a) => p.evaluate(f, ...a).catch((e) => { console.log('  （確認中にエラー：' + String(e.message).split('\n')[0] + '）'); return false; }); // 確認の途中でエラーになったら「失敗」にする

  // 2026-11-15 成分の画面：「併用注意」の見出しの下に「併用可能（OK）」の組み合わせが入っていた
  check('成分の画面で、併用注意の中に併用OKが入っていない', await ev(() => ING_MASTER.every((e) => {
    const d = document.createElement('div'); d.innerHTML = ingMasterDetail(e);
    return [...d.querySelectorAll('.card')].every((c) => { const h = (c.querySelector('h2') || {}).textContent || '';
      if (/注意/.test(h)) return !c.querySelector('.cc-card.lv1'); if (/OK|可能/.test(h)) return !c.querySelector('.cc-card.lv2,.cc-card.lv3'); return true; });
  })));
  check('併用OKの組み合わせに「注意する理由」と書いていない', await ev(() => { const r = COMBO_DB.find((x) => x.lv === 1); return !r || !comboCardHtml(r).includes('注意する理由'); }));
  // 2026-11-15 成分の組み合わせ：「併用OK → 併用注意」の順
  check('成分の組み合わせの一覧は「併用OK → 併用注意」の順', await ev(() => { state.myProducts = []; location.hash = '#/combo'; render(); const t = document.body.innerHTML; return t.indexOf('#/combo/ok') > -1 && t.indexOf('#/combo/ok') < t.indexOf('#/combo/ng'); }));
  // 2026-11-15 日焼け止めの注意に、使っていない成分（AHAなど）を書いていた
  check('日焼け止めの注意に、入っていない成分を書かない', await ev(() => { const n = uvLackNote([{ p: { name: 'x' }, step: 'cream', ings: [{ ja: 'レチノール', tags: ['otcretinoid'] }] }]); return n && !/AHA/.test(n.t + n.why); }));
  // 2026-11-15 今日のポイント：同じ話題（保湿など）が2回出ていた
  check('今日のポイントで同じ話題が2回出ない', await ev(() => { const h = mycareMiniHtml(); const L = [...h.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '')); const n = L.filter((t) => /保湿/.test(t)).length; return n <= 1; }));
  // 2026-11-15 アカウント削除の確認ボタンは「削除する」
  check('アカウント削除の確認ボタンは「削除する」', fs.readFileSync(FILE, 'utf8').includes("{ok:'削除する', title:'アカウントの削除'}"));
  // 2026-11-15 記録のタブ：肌写真のタブ・振り返りの欄はなくした
  check('記録のタブに「肌写真」がない・「振り返り」を出さない', await ev(() => { ui.logTab = 'recent'; location.hash = '#/log'; render(); const t = document.getElementById('main').innerText; return !/肌写真/.test(t) && !/振り返り/.test(t); }));
  // 2026-11-15 3D⇄写真は、押すたびに切り替わる
  check('3D⇄写真のスイッチは押すたびに切り替わる', await ev(() => { ui.ldView = '3d'; actions['ld-view'](); const a = ui.ldView; actions['ld-view'](); return a === 'photo' && ui.ldView === '3d'; }));
  // 2026-11-15 表示名の編集は、右から出るページ（下から出るシートではない）
  check('表示名の編集は専用のページで開く', await ev(() => { location.hash = '#/account/me/name'; render(); return !!document.getElementById('pf-name1'); }));
  // 2026-11-15 プレミアムの料金：月600円・年6,000円
  check('予備の料金表示が月600円・年6,000円', /\|\| 600, \(acct\.price && acct\.price\.year && acct\.price\.year\.amount\) \|\| 6000/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-15 同期：どちらのデータを使うか聞かずに、記録を1つずつ合わせる
  check('同期で両方の記録を自動で合わせる（消した記録は戻らない）', await ev(() => {
    const L = (id, d, c) => ({ id, date: d, condition: c, acneCount: 0, usedProducts: [], tags: [], note: '' }), now = Date.now();
    const loc = { savedAt: now, skinLogs: [L('a', '2026-11-01', 5), L('e', '2026-11-05', 4)], recT: { 'skinLogs|a': now }, recDel: { 'skinLogs|c': now } };
    const rem = { savedAt: now - 9, skinLogs: [L('a', '2026-11-01', 1), L('c', '2026-11-03', 3), L('d', '2026-11-04', 2)], recT: { 'skinLogs|a': now - 9, 'skinLogs|c': now - 99 }, recDel: {} };
    const m = syncMerge(loc, rem); const ids = m.skinLogs.map((x) => x.id + x.condition).sort().join(','); return ids === 'a5,d2,e4'; }));
  // 2026-11-15 3D⇄写真・週間/月間/年間を押してもiPhoneでバイブが鳴らなかった（指で押せる見えないスイッチを重ねる）
  check('3D⇄写真と期間の切り替えに、バイブ用のスイッチが重なっている', await ev(() => { ui.logTab = 'list'; location.hash = '#/log'; render(); const a = !!document.querySelector('.ld-vsw input[type="checkbox"][switch]'); ui.logTab = 'recent'; render(); const b = document.querySelector('.sc-tab[data-action] input[type="checkbox"][switch]'); return a && !!b; }));
  check('スイッチを押すと切り替わる（3D⇄写真）', await ev(() => { ui.logTab = 'list'; render(); ui.ldView = '3d'; render(); const i = document.querySelector('.ld-vsw .hap-in'); i.click(); return ui.ldView === 'photo'; }));
  // 2026-11-15 記録の上のタブ（2つ）が均等に並んでいなかった
  check('記録の上のタブ2つが均等に並ぶ', await ev(async () => { ui.logTab = 'list'; location.hash = '#/log'; render(); await new Promise((r) => setTimeout(r, 700)); /* 画面の切り替えの動きが終わってから測る */ const L = [...document.querySelectorAll('.log-tabs .ht')].map((x) => x.getBoundingClientRect()); const W = window.innerWidth; return L.length === 2 && Math.abs((L[0].left + L[1].right) / 2 - W / 2) < 6 && Math.abs(L[0].width - L[1].width) < 2; }));
  // 2026-11-15 写真に切り替えたとき、3Dの顔の首が下にはみ出して見えていた
  check('写真のとき3Dの顔（首）を出さない', await ev(() => { ui.ldView = 'photo'; render(); const c = document.getElementById('face3d-log'); return !c || getComputedStyle(c).visibility === 'hidden'; }));
  // 2026-11-16 肌の変化のタブの中に、また「肌の変化」と見出しを出していた
  check('肌の変化のカードに「肌の変化」の見出しを出さない', await ev(() => { ui.logTab = 'recent'; location.hash = '#/log'; render(); const c = document.querySelector('.sc-card'); return !!c && !/肌の変化/.test((c.querySelector('h2') || {}).textContent || ''); }));
  // 2026-11-16 肌の記録の「使ったアイテム」の欄はなくした（記録済みの分は消さない）
  check('肌の記録に「使ったアイテム」の欄を出さない', await ev(() => { openLogForm(); const t = document.getElementById('modal-root').innerText; closeModal(); return !/使ったアイテム/.test(t); }));
  // 2026-11-16 おすすめ商品を開いて戻ると、ランキングを探し直して商品が消えていた（一度調べたランキングを覚えておく）
  check('成分・洗顔料のランキングを覚えておき、開き直しても探し直さない', await ev(async () => {
    let n = 0; const ff = window.findFetch; window.findFetch = async (o) => { n++; return [{ name: 'アミノ酸 洗顔フォーム テスト', price: 1000, url: 'https://item.rakuten.co.jp/x/1', site: 'rakuten', reviews: 10 }]; };
    try { await openIngSheet('洗顔｜アミノ酸系'); await new Promise((r) => setTimeout(r, 300)); const n1 = n; closeModal(); await openIngSheet('洗顔｜アミノ酸系'); await new Promise((r) => setTimeout(r, 300)); const skel = !!document.querySelector('#ing-pop .skel'); closeModal(); return n1 > 0 && n === n1 && !skel; }
    finally { window.findFetch = ff; } }));
  // 2026-11-16 朝・夜のケアに時短版と切り替えボタンをつけた
  check('朝・夜のケアに「通常｜時短」の切り替えがあり、時短では化粧水・美容液を省く（説明の文は出さない）', await ev(() => { const ip = window.isPremium; window.isPremium = () => true; ui.rtTab = 'pm'; location.hash = '#/routine'; rtSettings().mode = 'normal'; render(); const sw = !!document.querySelector('.rt-qsw [data-action="rt-quick"]'); actions['rt-quick']('quick'); const t = document.getElementById('main').innerText; const ok = sw && !/を省いています|時短：|だけにしています/.test(t) && !document.querySelector('.rt-qnote') && !document.querySelector('.cm-list').innerText.match(/^\s*化粧水/m); actions['rt-quick']('normal'); window.isPremium = ip; return ok; })); // ケア管理はプレミアムの機能なので、確認の間だけプレミアムにする
  // 2026-11-16 通常⇄時短のボタンが見づらかった → 2026-11-20 3D⇄写真と同じ見た目に（白いつまみ。外側との色の差で見分けられる）
  check('通常⇄時短は、選んでいるほうが外側と違う色のつまみ', await ev(() => { const ip = window.isPremium; window.isPremium = () => true; location.hash = '#/routine'; render(); const ind = document.querySelector('.rt-qsw .sc-ind'), box = document.querySelector('.rt-qsw'); const bg = ind && getComputedStyle(ind).backgroundColor, bx = box && getComputedStyle(box).backgroundColor; window.isPremium = ip; return !!bg && bg !== bx; }));
  // 2026-11-16 戻るボタンは画面の中の丸いボタンではなく、上の見出しの前に「＜」を付けて、見出しごと押すと戻る
  check('戻るは上の見出しの「＜」にまとめ、画面の中の丸い戻るボタンを出さない', await ev(async () => {
    location.hash = '#/account'; await new Promise((r) => setTimeout(r, 300)); location.hash = '#/account/me'; await new Promise((r) => setTimeout(r, 400));
    const h = document.querySelector('.topbar .top-title'), bk = document.querySelector('#main .back');
    const ok1 = !!h && h.classList.contains('tt-back') && !!document.querySelector('.topbar .tt-bk .tt-chev') && (!bk || getComputedStyle(bk).display === 'none');
    h.click(); await new Promise((r) => setTimeout(r, 500)); const ok2 = location.hash === '#/account';
    const h2 = document.querySelector('.topbar .top-title'); const ok3 = (!h2 || !h2.classList.contains('tt-back')) && !document.querySelector('.topbar .tt-bk'); // いちばん上の画面には「＜」を付けない
    return ok1 && ok2 && ok3; }));
  // 2026-11-16 見出しの前の「＜」は、見出しの文字より少し薄い色
  check('見出しの前の「＜」は見出しより薄い色', await ev(async () => { location.hash = '#/account/me'; await new Promise((r) => setTimeout(r, 400)); const h = document.querySelector('.topbar .top-title'), c = document.querySelector('.topbar .tt-bk .tt-chev'); return !!c && getComputedStyle(c).backgroundColor !== getComputedStyle(h).color; }));
  // 2026-11-16 上の見出しは全部真ん中。「＜」は左はしのまま
  check('上の見出しは真ん中、「＜」は左はし', await ev(async () => { for (const hs of ['#/account/me', '#/log']) { location.hash = hs; await new Promise((r) => setTimeout(r, 400)); const h = document.querySelector('.topbar .top-title'); if (!h) return false; const tb = document.querySelector('.topbar').getBoundingClientRect(), r = h.getBoundingClientRect(); const cx = (r.left + r.right) / 2; if (Math.abs(cx - (tb.left + tb.right) / 2) > 3) return false; const k = document.querySelector('.topbar .tt-bk'); if (hs === '#/account/me' && (!k || k.getBoundingClientRect().left > 30)) return false; } return true; }));
  // 2026-11-16 戻るボタンでループする（A→B→A→B…と履歴が積み重なり、戻ると行ったり来たりする）のを防ぐ
  check('行ったり来たりしても、戻るでループしない', await ev(async () => {
    const go = async (h) => { location.hash = h; await new Promise((r) => setTimeout(r, 450)); };
    const back = async () => { goBack('#/home'); await new Promise((r) => setTimeout(r, 450)); };
    await go('#/my'); await go('#/combo'); await go('#/combo/ok'); await go('#/combo'); await go('#/combo/ok'); await go('#/combo'); // 2つの画面を行ったり来たり
    const seen = [location.hash]; await back(); seen.push(location.hash); await back(); seen.push(location.hash);
    const ok = seen.join(',') === '#/combo,#/my,#/my' || seen.join(',') === '#/combo,#/my,#/home'; if (!ok) console.log('  戻った順：' + seen.join(' → ')); return ok; }));
  // 2026-11-16 「控えたい成分」の見出しは「控えたい」に（アプリのどこにも「控えたい成分」と出さない）
  check('画面に「控えたい成分」と出さない（「控えたい」にする）', await ev(async () => { const ip = window.isPremium; window.isPremium = () => true; const T = [];
    for (const h of ['#/routine', '#/home', '#/combo']) { location.hash = h; await new Promise((r) => setTimeout(r, 350)); T.push(document.getElementById('main').innerText); }
    window.isPremium = () => false; location.hash = '#/routine'; await new Promise((r) => setTimeout(r, 350)); T.push(document.getElementById('main').innerText); window.isPremium = ip;
    return T.every((x) => !/控えたい成分/.test(x)) && T[0].includes('控えたい'); }));
  // 2026-11-16 「＜」を押すと下に動いて指から外れ、何回押しても戻れなかった（押している間も位置が変わらず、1回で戻れること）
  {
    await ev(async () => { location.hash = '#/account'; await new Promise((r) => setTimeout(r, 300)); location.hash = '#/account/s/display'; await new Promise((r) => setTimeout(r, 450)); document.querySelectorAll('.pm-ov,.au-ov,#prem-sheet,.ps-wrap').forEach((e) => e.remove()); }); // 初回の案内・前の確認で開いたプレミアムの案内は、テストでは閉じる
    const k = await p.$('.topbar .tt-bk'); const r0 = k && await k.boundingBox();
    let ok = false;
    if (r0) { await p.mouse.move(r0.x + r0.width / 2, r0.y + r0.height / 2); await p.mouse.down(); await p.waitForTimeout(80); const r1 = await k.boundingBox(); await p.mouse.up(); await p.waitForTimeout(500);
      ok = Math.abs(r1.y - r0.y) < 1 && Math.abs(r1.x - r0.x) < 1 && (await p.evaluate(() => location.hash)) === '#/account'; }
    check('「＜」は押しても位置が動かず、1回押すと戻れる', ok);
  }
  // 2026-11-16 上の見出しの文字は「まだ化粧品が登録されていません」と同じ大きさ（どの画面でも）
  check('上の見出しの文字は、空のときの見出しと同じ大きさ', await ev(async () => { const d = document.createElement('div'); d.innerHTML = emptyBox('bottle', 'テスト', 'テスト'); document.getElementById('main').appendChild(d); const e = getComputedStyle(d.querySelector('.empty h3')).fontSize; d.remove();
    for (const h of ['#/my', '#/account/me', '#/log']) { location.hash = h; await new Promise((r) => setTimeout(r, 350)); const t = document.querySelector('.topbar .top-title'); if (!t || getComputedStyle(t).fontSize !== e) return false; } return true; }));
  // 2026-11-16 安全対策：サーバーの関数で、だれでも呼べる・上限を超えて使える穴をふさいだまま
  { const F = (n) => fs.readFileSync(path.join(HC, 'supabase/functions', n, 'index.ts'), 'utf8');
    const v = F('vision'), pu = F('push'), pr = F('prices');
    check('AIの回数は先に取ってから使う（同時に送られても上限を超えない）', /reserveQuota\(user\.id, kind\)/.test(v) && /reserveQuota\(user\.id, 'reg'\)/.test(v) && !/let u = await usedToday\(user\.id\);/.test(v));
    check('お知らせの定期実行は合言葉がないと動かない', /action === 'cron'\) \{[\s\S]{0,300}body\.secret[\s\S]{0,120}403/.test(pu));
    check('ログインなしの商品画像AIに回数の上限がある・日焼け止めの問い合わせは10個まで', /imgCalls\.length >= \d+/.test(pr) && /body\.names\.slice\(0, 10\)/.test(pr)); }
  // 2026-11-16 同じ端末での作り直し対策・商品の栄養検索の上限（画面には出さない）
  { const F = (n) => fs.readFileSync(path.join(HC, 'supabase/functions', n, 'index.ts'), 'utf8'), b = F('billing'), v = F('vision'), html = fs.readFileSync(FILE, 'utf8');
    check('別のアカウントが使った端末では、お試しが終わり・紹介コードも使えない', /action === 'device'/.test(b) && /trial_until: new Date\(\)\.toISOString\(\)/.test(b) && /deviceOwner\(body\.device, user\.id\)\) !== user\.id/.test(b));
    check('アプリは端末IDを送る（お試しの確認・紹介コード）', /callBilling\('ref_redeem', \{code, device:deviceId\(\)\}\)/.test(html) && /deviceCheck\(\)/.test(html) && /端末ID/.test(html));
    check('商品の栄養検索（official）は1日60回まで', /info: 60/.test(v) && /reserveQuota\(user\.id, 'info'\)/.test(v)); }
  check('端末IDは同じ端末で変わらない・ログアウトで消えない', await ev(() => { const a = deviceId(); return /^[0-9a-f-]{36}$/.test(a) && deviceId() === a && !LOGOUT_KEYS().includes('nk_devid'); }));
  // 2026-11-16 安全対策：商品名・メモなどに書かれたHTMLが動かない（どの画面でも）
  check('商品名やメモにHTMLを入れても動かない', await ev(async () => {
    const X = (t) => `${t}"><img src=x onerror="window.__xss=1">'`, d = todayStr(), keep = JSON.stringify(state);
    state.catalog.push({ id: 'cx1', isSample: false, verify: 'verified', name: X('a'), brand: X('b'), category: '化粧水', origin: 'その他', price: 1, volume: '', image: '', imageUrl: '', shopUrl: 'javascript:alert(1)', imgClean: false, purposes: [X('c')], ingredients: 'ナイアシンアミド、' + X('d'), features: X('e'), usage: X('f'), caution: X('g'), jan: '', source: X('h'), checkedAt: d, offChecked: '', offUrl: '', offers: [] });
    state.myProducts.push({ id: 'mx1', demo: false, purchases: [], catalogId: 'cx1', name: X('i'), brand: X('j'), category: '化粧水', purposes: [X('k')], ingredients: 'ナイアシンアミド、' + X('l'), timing: ['朝', '夜'], frequency: '毎日', startDate: d, status: '使用中', endDate: '', memo: X('m'), pao: 6, order: null });
    state.skinLogs[0].note = X('n'); state.skinLogs[0].tags = [X('o')];
    let js = false;
    for (const h of ['#/home', '#/log', '#/my', '#/my/mx1', '#/combo', '#/routine', '#/mycare', '#/ingredients']) { location.hash = h; render(); await new Promise((r) => setTimeout(r, 120)); if ([...document.querySelectorAll('a[href]')].some((a) => /^\s*javascript:/i.test(a.getAttribute('href')))) js = true; }
    await new Promise((r) => setTimeout(r, 300)); state = normalize(JSON.parse(keep)); return !window.__xss && !js;
  }));
  // 2026-11-16 上の「<」の戻るボタンも、見出しの文字と同じ大きさ（押せる範囲は48pxのまま）
  check('上の「<」の戻るボタンは見出しの文字と同じ大きさ', await ev(async () => { location.hash = '#/account'; await new Promise((r) => setTimeout(r, 300)); location.hash = '#/account/me'; await new Promise((r) => setTimeout(r, 400));
    const c = document.querySelector('.topbar .tt-chev'), b = document.querySelector('.topbar .tt-bk'), t = document.querySelector('.topbar .top-title'); if (!c || !b || !t) return false;
    const fs = parseFloat(getComputedStyle(t).fontSize), h = c.getBoundingClientRect().height * 14 / 24; const tb = document.querySelector('.topbar').getBoundingClientRect().height, thin = /stroke-width='1\.4'/.test(getComputedStyle(c).webkitMaskImage || getComputedStyle(c).maskImage || '');
    return Math.abs(h - fs) < 1 && thin && b.getBoundingClientRect().height >= 44 && tb <= 50; })); // 2026-11-16 「<」は細く・文字と同じ高さ。上の帯は低く（カメラのすぐ下に見出し）
  // 2026-11-16 古いiPhone・ブラウザ（:has() が使えない）で、切り替えの動くしるしがエラーになっていた
  check(':has() が使えないブラウザでも、切り替えの動きでエラーが出ない', await ev(async () => {
    const q = Document.prototype.querySelectorAll, c = Element.prototype.closest, bad = (x) => { if (/:has\(/.test(String(x))) throw new SyntaxError('not a valid selector'); };
    Document.prototype.querySelectorAll = function (x) { bad(x); return q.call(this, x); }; Element.prototype.closest = function (x) { bad(x); return c.call(this, x); };
    try { const d = document.createElement('div'); d.innerHTML = '<div class="chips" id="swt"><span class="hap-keep"><button class="tab active">a</button></span><button class="tab">b</button></div><div class="chips" id="swn"><span class="chip">x</span></div>'; document.getElementById('main').appendChild(d);
      swAnimAll(); d.querySelector('.tab:not(.active)').click(); await new Promise((r) => setTimeout(r, 50)); const L = swGroupsAll(); d.remove(); return L.some((g) => g.id === 'swt') && !L.some((g) => g.id === 'swn'); }
    finally { Document.prototype.querySelectorAll = q; Element.prototype.closest = c; }
  }));
  // 2026-11-16 お知らせの宛先は本物のお知らせサービスだけ・商品検索は同じ接続元から1分120回まで・公開前に全部のボタンを押して回る
  { const F = (n) => fs.readFileSync(path.join(HC, 'supabase/functions', n, 'index.ts'), 'utf8');
    check('お知らせの宛先は、Apple・Google・Mozilla・Microsoftだけ', /push\\\.apple\\\.com\|fcm\\\.googleapis/.test(F('push')));
    check('商品検索は、同じ接続元から1分に120回まで', /ipCalls/.test(F('prices')) && /L\.length >= 120/.test(F('prices')));
    check('公開の前に、全部のボタンを押して回るテストを実行する', /tests\/crawl\.js/.test(fs.readFileSync(path.join(HC, 'deploy.sh'), 'utf8'))); }
  // 2026-11-16 皮脂は緑の下線にしない／おすすめケアの「記録する」・記録の「最初の記録をつける」はバイブ／成分ではない言葉（ノンコメドジェニックなど）も人気ランキングを出す
  check('「皮脂」は緑の下線（説明のリンク）にしない', await ev(() => !/data-term="皮脂"/.test(ingLinkHtml('皮脂が多いと、角質ケアが必要'))));
  check('おすすめケアの「記録する」・最初の記録をつけるはバイブが鳴る', await ev(async () => {
    const keep = JSON.stringify(state); window.isPremium = () => true; ui.homeTab = 'care'; location.hash = '#/home'; render(); for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 120)); hapticizeTargets(); }
    const a = [...document.querySelectorAll('.ct2-rec')], okA = a.length > 0 && a.every((x) => !!x.closest('.hap-keep'));
    state.skinLogs = []; ui.logTab = 'list'; location.hash = '#/log'; render(); for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 120)); hapticizeTargets(); }
    const f = document.querySelector('[data-action="new-log"]'), okF = !!f && !!f.closest('.hap-keep'); state = normalize(JSON.parse(keep)); return okA && okF; }));
  check('説明に成分が出ない言葉（ノンコメドジェニック・弱酸性・ダブル洗顔）は、人気ランキングを出す', await ev(async () => {
    const ok = Object.keys(TERM_INFO).filter((k) => !TERM_INFO[k][2].some((x) => ingEntryOf(x) || ING_LINK_EXTRA[x])).every((k) => k === 'パッチテスト' || TERM_RANK[k]);
    openTermSheet('ノンコメドジェニック'); await new Promise((r) => setTimeout(r, 200)); const t = document.getElementById('modal-root').innerText.replace(/\u200b/g, ''); closeModal(); return ok && /人気ランキング/.test(t) && /どういう意味/.test(t); }));
  // 2026-11-16 すべての「保存」ボタンでバイブが鳴る（iPhoneは見えないスイッチを重ねたボタンだけ鳴る）
  check('すべての「保存」ボタンにバイブ（見えないスイッチ）が付いている', await ev(async () => {
    window.isPremium = () => true; const bad = []; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const look = (where) => { [...document.querySelectorAll('button, a.btn, [role="button"]')].forEach((x) => { const t = (x.textContent || '').trim(); if (t.length <= 24 && /保存/.test(t) && !HAP_SKIP.test(t) && x.offsetParent && !x.disabled && !x.closest('.hap-keep,.hap-wrap')) bad.push(where + '：' + t); }); };
    for (const h of ['#/home', '#/log', '#/my', '#/account', '#/account/me', '#/account/me/name', '#/settings', '#/routine', '#/mycare']) { location.hash = h; await wait(250); look(h); }
    for (const [n, f] of [['目標', () => openLifeGoal()], ['ショートカット', () => openShortcutEdit()], ['睡眠', () => openLifeForm(null, 'sleep')], ['食事', () => openLifeForm(null, 'meal')], ['プロフィール', () => openProfile()]]) { try { closeModal(); } catch (e) {} try { f(); } catch (e) { continue; } await wait(500); look(n); }
    try { closeModal(); } catch (e) {} if (bad.length) console.log('  （バイブなし：' + bad.join('・') + '）'); return !bad.length; }));
  // 2026-11-16 ケア管理：朝⇄夜を横にスライドしたとき、共通の「通常⇄時短」まで一緒に動いていた
  // どの画面でも：タブ（横スライド）で変わらない切り替えボタンは、動く中身（.home-pane）の外に置く
  check('横にスライドしたとき、タブ共通の切り替えボタンは動かない（どの画面でも）', await ev(async () => {
    window.isPremium = () => true; const bad = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ctl = () => [...document.querySelectorAll('.home-pane [role="radiogroup"], .home-pane .sc-tabs, .home-pane [role="tablist"], .home-pane .rt-qsw')].filter((x) => !x.closest('.card, .modal')).map((x) => x.getAttribute('aria-label') || x.className);
    const P = [['#/routine', [{ k: 'am' }, { k: 'pm' }], (k) => { ui.rtTab = k; }], ['#/log', [{ k: 'list' }, { k: 'recent' }], (k) => { ui.logTab = k; }], ['#/my', [{ k: 'cos' }, { k: 'rx' }], (k) => { ui.myKind = k; }], ['#/home', HOME_TABS, (k) => { ui.homeTab = k; }]];
    for (const [h, T, set] of P) { const seen = {}; for (const t of T) { set(t.k); location.hash = h; render(); await wait(150); ctl().forEach((n) => { seen[n] = (seen[n] || 0) + 1; }); }
      Object.entries(seen).forEach(([n, c]) => { if (c === T.length && T.length > 1) bad.push(h + '：' + n); }); }
    if (bad.length) console.log('  （スライドで一緒に動く共通ボタン：' + bad.join('・') + '）'); return !bad.length && !document.querySelector('.home-pane .rt-qsw'); }));
  // 2026-11-16 睡眠・運動の記録に「アプリ版では、スマホのヘルスケアから…」の説明を出さない
  check('睡眠・運動の記録に「アプリ版では…」を出さない', await ev(async () => { const r = []; for (const k of ['sleep', 'exercise']) { try { closeModal(); } catch (e) {} openLifeForm(null, k); await new Promise((x) => setTimeout(x, 300)); r.push(/アプリ版では/.test(document.getElementById('modal-root').innerText.replace(/\u200b/g, ''))); } try { closeModal(); } catch (e) {} return r.every((x) => !x); }));
  // 2026-11-16 プレミアムの機能は「プレミアム」の文字ではなく、南京錠のマークで薄く表示（どこでも）
  check('プレミアムの機能は、文字ではなく南京錠のマーク・薄い表示', !/class="(prem-sub|badge-premium)"|chip beige">プレミアム</.test(fs.readFileSync(FILE, 'utf8')) && await ev(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const keep = window.isPremium; window.isPremium = () => false; let ok = true;
    try { closeModal(); } catch (e) {} openLifeForm(null, 'meal'); await wait(500); const L = [...document.querySelectorAll('#modal-root .mpt-locked')]; // 顔の写真は無料になったので、食事の写真の「選ぶ」「撮る」で確かめる
    ok = ok && L.length > 0 && L.every((x) => x.querySelector('.prem-lock') && !/プレミアム/.test(x.innerText) && getComputedStyle(x).backgroundColor !== getComputedStyle(document.querySelector('.btn-primary') || x).backgroundColor);
    try { closeModal(); } catch (e) {} window.isPremium = keep; return ok; }));
  // 2026-11-16 記録のシートを開いたまま上下になぞると、うしろのページが動いていた（入力欄の上・スクロールの端）
  check('シートを開いている間、入力欄の上やスクロールの端でなぞっても、うしろのページは動かない', await ev(async () => {
    try { closeModal(); } catch (e) {} openLifeForm(null, 'sleep'); await new Promise((r) => setTimeout(r, 500));
    const inp = [...document.querySelectorAll('#modal-root input')].find((x) => x.offsetParent), body = document.querySelector('#modal-root .modal-body') || inp;
    const t = (el, y0, y1, x = 100) => { let stopped = false; document.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [{ clientX: 100, clientY: y0 }] }));
      lockTouchGuard({ target: el, touches: [{ clientX: x, clientY: y1 }], cancelable: true, preventDefault: () => { stopped = true; } }); return stopped; };
    const r = [t(inp, 300, 380), t(inp, 380, 300), t(body, 300, 380), t(inp, 300, 302, 100) && true, !t(inp, 300, 300, 160)];
    try { closeModal(); } catch (e) {} if (!(r[0] && r[1] && r[2] && r[4])) console.log('  （' + JSON.stringify(r) + ' locked:' + lockedY + '）'); return r[0] && r[1] && r[2] && r[4]; }));
  // 2026-11-16 肌の変化：数字の箱の文字が窮屈・はみ出していた、見出しの説明が2行になっていた（週間・月間・年間）
  check('肌の変化：文字がはみ出さず、見出しは1行・「記録なし」を出さない', await ev(async () => {
    const keep = window.isPremium; window.isPremium = () => true; const bad = [];
    for (const r of ['week', 'month', 'year']) { ui.scRange = r; ui.logTab = 'recent'; location.hash = '#/log'; render(); await new Promise((x) => setTimeout(x, 250));
      document.querySelectorAll('.sc-grid span, .sc-grid small, .sc-grid b').forEach((e) => { if (e.scrollWidth > e.clientWidth + 1) bad.push(r + '：' + e.textContent.trim()); });
      document.querySelectorAll('.sc-card .sc-ch-h').forEach((h) => { if (h.getBoundingClientRect().height > 30) bad.push(r + '：見出しが2行'); });
      if (/記録なし/.test(document.querySelector('.sc-card').innerText)) bad.push(r + '：記録なし'); }
    window.isPremium = keep; ui.scRange = 'week'; if (bad.length) console.log('  （' + bad.join('・') + '）'); return !bad.length; }));
  // 2026-11-16 おすすめケアの「記録する」が右に寄っていなかった（バイブのために包んだ箱で寄せ方が外れた）／今日のポイントの見出しは「›」だけ
  check('「記録する」は右はし・今日のポイントの見出しは説明なしで「›」だけ', await ev(async () => {
    window.isPremium = () => true; ui.homeTab = 'care'; location.hash = '#/home'; render(); for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 120)); hapticizeTargets(); }
    const H = [...document.querySelectorAll('.ct2-sh')].filter((h) => h.querySelector('.ct2-rec')), ok1 = H.length > 0 && H.every((h) => Math.abs(h.getBoundingClientRect().right - h.querySelector('.ct2-rec').getBoundingClientRect().right) < 3);
    const m = document.querySelector('.pc-mini-h'); const ok2 = !m || (!m.querySelector('small') && !!m.querySelector('.pc-mini-chev'));
    return ok1 && ok2; }));
  // どの画面でも：バイブのためにボタンを包んでも、ボタンの位置は変わらない
  check('バイブのためにボタンを包んでも、位置がずれない', await ev(() => {
    const host = document.createElement('div'); host.style.cssText = 'display:flex;width:300px'; host.innerHTML = '<span>見出し</span><button class="btn" style="margin-left:auto">記録する</button>'; document.getElementById('main').appendChild(host);
    const b = host.querySelector('button'), x0 = b.getBoundingClientRect().left; hapticizeKeep(b); const x1 = b.getBoundingClientRect().left; host.remove(); return Math.abs(x1 - x0) < 3; }));
  // 今日のポイントで、話題の重なりを外したあとに文が途中で切れない（例：「化粧水のあと」）
  check('今日のポイントの文が途中で切れない', await ev(() => { const h = mycareMiniHtml(); const L = [...h.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()); const ok = L.every((t) => !/(のあと|のまえ|ときは|なら|たら|ので|て|に|を|が|は|と)$/.test(t)); if (!ok) console.log('  ' + L.join(' | ')); return ok; }));
  // 2026-11-16 記録の顔写真：撮るときの枠の顔が3Dの顔とちょうど重なる大きさ・位置に切り取る（写真の大きさがちがっても毎回同じ）
  // 2026-11-19 写真はいつも同じ大きさの縦長の枠（角丸）。撮った写真も選んだ写真も枠いっぱい（すき間なし）、顔は全部入る
  check('顔写真は毎回同じ大きさの角丸の枠に、すき間なく・顔が全部入るように切り取る', await ev(async () => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#c96'; x.fillRect(0, 0, w, h); return c.toDataURL('image/jpeg', 0.6); };
    const keep = JSON.stringify(state), d = todayStr(), out = [];
    for (const [w, h, fb] of [[600, 800, null], [900, 700, {x:0.3, y:0.2, w:0.4, h:0.5}], [400, 400, {x:0.25, y:0.25, w:0.5, h:0.5}], [1200, 900, null]]) {
      state.skinLogs = [{ id: 'fp' + w, date: d, condition: 3, acneCount: 0, tags: [], usedProducts: [], note: '', photo: mk(w, h), faceBox: fb }]; state = normalize(JSON.parse(JSON.stringify(state)));
      ui.logTab = 'list'; ui.ldView = 'photo'; location.hash = '#/log'; render(); await new Promise((r) => setTimeout(r, 400));
      const i = document.querySelector('.ld-photo img'), fr = document.querySelector('.ld-photo'); if (!i || !fr) { out.push(null); continue; }
      const f = fb || GUIDE_FACE, ir = i.getBoundingClientRect(), r = fr.getBoundingClientRect();
      out.push({ W: Math.round(r.width), H: Math.round(r.height), rad: parseFloat(getComputedStyle(fr).borderTopLeftRadius), cover: ir.left <= r.left + 0.5 && ir.top <= r.top + 0.5 && ir.right >= r.right - 0.5 && ir.bottom >= r.bottom - 0.5,
        face: ir.top + f.y * ir.height >= r.top - 1 && ir.top + (f.y + f.h) * ir.height <= r.bottom + 1 });
    }
    state = normalize(JSON.parse(keep)); ui.ldView = '3d';
    return out.every((o) => o && o.cover && o.face && o.rad >= 8 && o.W === out[0].W && o.H === out[0].H && o.H > o.W); }));
  check('写真の読み取り（AI）が顔の位置を返し、記録に保存する', /box: \{ type: 'ARRAY'/.test(fs.readFileSync(path.join(HC, 'supabase/functions/vision/index.ts'), 'utf8')) && /faceBox:pendingPhoto \? pendingFace/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-16 顔の写真から肌の状態をAIで判定して記録に入れるのはやめた（写真は日付ごとに残して見比べるだけ）。説明の文も合わせる
  check('顔の写真をAIで判定しない・「自動で記録」と書かない', (() => { const h = fs.readFileSync(FILE, 'utf8'); return !/callVision\('skin'/.test(h) && !/肌を自動|顔を撮って自動で記録|毎日の肌を自動記録|今日の肌を自動で入れ/.test(h); })());
  // 2026-11-16 記録一覧：日付の下の「睡眠」を出さない。3D⇄写真とカレンダーのボタンは、肌の調子（「普通」など）と同じ高さの両はし。カレンダーも枠で囲む
  check('記録一覧：上の行に切り替え・日付・カレンダー、矢印は写真の左右のはしの真ん中、生活の下にメモ', await ev(async () => {
    const keep = JSON.stringify(state), d = todayStr();
    state.skinLogs = [0, 2, 4].map((i) => ({ id: 'q' + i, date: addDays(d, -i), condition: 3, acneCount: 0, tags: [], usedProducts: [], note: '', memo: i === 2 ? 'テストのメモ' : '', photo: '' })); state = normalize(JSON.parse(JSON.stringify(state)));
    ui.logTab = 'list'; ui.logDay = addDays(d, -2); ui.ldView = 'photo'; location.hash = '#/log'; render(); await new Promise((r) => setTimeout(r, 400));
    const R = (e) => e.getBoundingClientRect(), v = document.querySelector('.ld-vsw'), c = document.getElementById('ld-calbtn'), dt = document.getElementById('ld-date'), st = document.getElementById('ld-stage'), ph = document.querySelector('.ld-photo'), pv = document.getElementById('ld-prev'), nx = document.getElementById('ld-next'), c1 = document.getElementById('ld-calbtn');
    const mid = (e) => R(e).top + R(e).height / 2, ok1 = [v, c, dt].every((e) => e && R(e).bottom <= R(st).top + 1) && Math.abs(mid(v) - mid(dt)) < 4 && Math.abs(mid(c) - mid(dt)) < 4 && !/睡眠/.test(document.getElementById('ld-info').innerText);
    const cd = document.querySelector('#ld-info .t-cond'), ok2 = !!cd && Math.abs(mid(pv) - mid(cd)) < 3 && Math.abs(mid(nx) - mid(cd)) < 3 && R(pv).right <= R(ph).left + 2 && R(nx).left >= R(ph).right - 2; // 2026-11-19 ＜＞は肌の調子と同じ高さ
    const secs = [...document.querySelectorAll('#ld-detail .ld-sec-h')].map((h) => h.textContent), ok3 = secs.indexOf('メモ') === secs.indexOf('生活') + 1 && /テストのメモ/.test(document.getElementById('ld-detail').innerText);
    state = normalize(JSON.parse(keep)); ui.ldView = '3d'; ui.logDay = null; if (!(ok1 && ok2 && ok3)) console.log('  （' + [ok1, ok2, ok3] + '）'); return ok1 && ok2 && ok3; }));
  // 2026-11-16 3Dの顔は、どの画面でも開いたときに自動で回さない
  check('3Dの顔は開いたときに自動で回さない（どの画面でも）', /auto:false, \/\* 3Dの顔は、開いたときに自動で回さない/.test(fs.readFileSync(FILE, 'utf8')) && !/auto:opts\.auto !== false/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-16 写真に切り替えたまま前の日・次の日・カレンダー・別の画面から戻っても、3Dに戻らない
  check('写真に切り替えたまま日を変えても・画面を移っても、写真のまま', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr();
    state.skinLogs = [0, 1, 3].map((i) => ({ id: 'v' + i, date: addDays(d, -i), condition: 3, acneCount: 0, tags: [], usedProducts: [], note: '', photo: '' })); state = normalize(JSON.parse(JSON.stringify(state)));
    ui.logTab = 'list'; ui.ldView = '3d'; location.hash = '#/log'; render(); await w(300);
    const on = () => document.getElementById('ld-stage').classList.contains('ld-ph-on') && document.querySelector('.ld-vsw').classList.contains('is-ph');
    const r = []; actions['ld-view'](); await w(100); r.push(on()); actions['log-day-step'](-1); await w(200); r.push(on()); logDaySet(addDays(d, -3)); await w(200); r.push(on());
    location.hash = '#/home'; await w(250); location.hash = '#/log'; await w(350); r.push(on());
    state = normalize(JSON.parse(keep)); ui.ldView = '3d'; return r.every(Boolean); }));
  // 2026-11-16 3D⇄写真の切り替えで、ボタンの大きさが変わっていた（「ph」という名前が写真の一覧の箱のスタイルとぶつかっていた）
  check('3D⇄写真を切り替えても、ボタンの大きさが変わらない・幅はちょうど良く', await ev(async () => {
    ui.logTab = 'list'; ui.ldView = '3d'; location.hash = '#/log'; render(); await new Promise((r) => setTimeout(r, 300));
    const v = () => document.querySelector('.ld-vsw').getBoundingClientRect(), a = v(); actions['ld-view'](); await new Promise((r) => setTimeout(r, 300)); const b = v(); actions['ld-view'](); await new Promise((r) => setTimeout(r, 100));
    return Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5 && a.width <= 76; }));
  // 2026-11-16 アイコンを緑の葉の蝶（白い背景）に変えた。アイコンを変えたらサービスワーカーの番号も上げる（古いアイコンが残らないように）
  check('アプリのアイコンは蝶のアイコン（白い背景）・アイコンの読み直しの番号つき', (() => { const R = path.join(__dirname, '..'), h = fs.readFileSync(FILE, 'utf8');
    const png = (f) => fs.readFileSync(path.join(R, f)); const ok = ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'].every((f) => fs.existsSync(path.join(R, f)) && png(f).length > 2000);
    const m = JSON.parse(fs.readFileSync(path.join(R, 'manifest.json'), 'utf8')), mk = m.icons.find((i) => i.purpose === 'maskable');
    return ok && mk && mk.src === 'icon-512-maskable.png' && /apple-touch-icon\.png\?v=\d+/.test(h) && /skinwise-v(\d+)/.test(fs.readFileSync(path.join(R, 'sw.js'), 'utf8')) && Number(fs.readFileSync(path.join(R, 'sw.js'), 'utf8').match(/skinwise-v(\d+)/)[1]) >= 9; })());
  // 2026-11-16 顔の写真は無料（撮る・選ぶ・ガイド付き）。カレンダーのボタンはバイブが鳴って、押すとカレンダーが開く
  check('顔の写真は無料で使える・カレンダーのボタンはバイブ付きで開く', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepP = window.isPremium; window.isPremium = () => false;
    try { closeModal(true); } catch (e) {} actions['new-log'](); await w(500); const face = document.querySelector('#modal-root .face-ai');
    const free = !!face && !face.querySelector('.mpt-locked,.prem-lock') && !!face.querySelector('[data-faceai-cam]') && !!face.querySelector('#f_faceai2'); try { closeModal(true); } catch (e) {} await w(300);
    ui.logTab = 'list'; location.hash = '#/log'; render(); for (let i = 0; i < 6; i++) { await w(100); hapticizeTargets(); }
    const c = document.getElementById('ld-calbtn'), wrap = c && c.closest('.hap-keep,.hap-wrap'), sw = wrap && wrap.querySelector('input[switch]'); if (sw) sw.click(); await w(500);
    const opened = /肌の調子カレンダー/.test(document.getElementById('modal-root').textContent.replace(/\u200b/g, '')); try { closeModal(true); } catch (e) {}
    window.isPremium = keepP; return free && !!sw && opened && !/'顔写真で、肌の変化を見比べ'/.test(document.documentElement.innerHTML); }));
  // 2026-11-16 横にスライドして「肌の変化」をのぞいたとき、グラフがあとから出てきて動いて見えた・ボタンの位置がずれた → のぞいている間も描いておく
  check('スライドでのぞいている間も、グラフとボタンを本物と同じに描く', /el\.innerHTML = d\.fn\(/.test(fs.readFileSync(FILE, 'utf8')) && /ldAlignBtns\(g\)/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-16 アカウント（すべて）・ホーム・記録一覧のボタンは押しても沈まない（ほかの画面は今までどおり）
  check('アカウント・ホーム・記録一覧では、ボタンが沈まない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), at = () => document.documentElement.hasAttribute('data-nosink'), r = [];
    for (const [h, t, want] of [['#/account', null, true], ['#/account/me', null, true], ['#/home', null, true], ['#/log', 'list', true], ['#/log', 'recent', false], ['#/my', null, false], ['#/routine', null, false]]) { if (t) ui.logTab = t; location.hash = h; render(); await w(150); r.push(at() === want); }
    const css = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules].map((x) => x.cssText); } catch (e) { return []; } }).join(' ');
    return r.every(Boolean) && /data-nosink[^{]*:active[^{]*\{[^}]*transform: none !important/.test(css); }));
  // 2026-11-17 プレミアムの案内：鍵のカードにはプレミアムの主な機能を出す。申し込みの窓は料金と新規登録・ログインだけ。下から出る窓には、中身が長いときスクロールバーを出す
  check('鍵のカードに主な機能・申し込みの窓は料金とボタンだけ・長い窓にはスクロールバー', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = window.isPremium; window.isPremium = () => false;
    const lock = careLockHtml('おすすめケア'), okLock = PREM_FEATS.every((f) => lock.includes(esc(f)));
    const keepU = acct.user; acct.user = null; openPremiumSheet('テスト'); await w(300); const ps = document.getElementById('prem-sheet');
    const vis = (sel) => [...ps.querySelectorAll(sel)].filter((e) => e.offsetParent).length;
    const okPs = !!ps && vis('.pl-c') >= 1 && vis('[data-psauth]') === 2 && !vis('.pf') && !vis('.ps-note'); ps && ps.remove(); acct.user = keepU;
    try { closeModal(true); } catch (e) {} actions['new-log'](); await w(600); const b = document.querySelector('#modal-root .modal-body'), bar = document.querySelector('#modal-root .msb');
    const okBar = !!bar && (b.scrollHeight > b.clientHeight + 2 ? bar.classList.contains('on') : !bar.classList.contains('on')); try { closeModal(true); } catch (e) {}
    window.isPremium = keep; return okLock && okPs && okBar; }));
  // 2026-11-19 アイコン：Myアイテム=shopping-bag・アカウント=user-round・運動=person-standing・食事=utensils（どこでも同じ）
  check('アイコン：Myアイテム・アカウント・運動・食事', await ev(() => ICONS.shoppingBag.includes('M16 10a4 4 0 0 1-8 0') && ICONS.user === '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>' && ICONS.run.includes('m9 20 3-6 3 6') && ICONS.meal.includes('c0 1.1.9 2 2 2h3Zm0 0v7') && NAV.find((n) => n.r === 'my').icon === 'shoppingBag' && !/ic:'bottle', l:'Myアイテム'/.test(document.documentElement.innerHTML)));
  // 2026-11-19 カレンダーは＜＞で月を変えても高さが変わらない（どの月も6段）
  check('カレンダーは＜＞で月を変えても動かない（6段でそろえる）', await ev(() => { const keep = ui.calYM, n = []; for (const ym of ['2026-02', '2026-03', '2026-08', '2026-11']) { ui.calYM = ym; const h = skinCalHtml(true); n.push((h.match(/class="sc-d /g) || []).length + (h.match(/sc-pad/g) || []).length + (h.match(/<span><\/span>/g) || []).length); } ui.calYM = keep; return n.every((x) => x === 42); }));
  // 2026-11-19 窓のスクロールバーは、さわっていない時は消す（さわる・スクロールすると出る）
  check('窓のスクロールバーは、さわっていない時は見えない', await ev(async () => {
    try { closeModal(true); } catch (e) {} actions['new-log'](); await new Promise((r) => setTimeout(r, 600)); const bar = document.querySelector('#modal-root .msb'), b = document.querySelector('#modal-root .modal-body');
    if (!bar || !(b.scrollHeight > b.clientHeight + 2)) { try { closeModal(true); } catch (e) {} return !!bar; }
    const idle = getComputedStyle(bar).opacity === '0'; b.dispatchEvent(new Event('touchstart')); await new Promise((r) => setTimeout(r, 300)); const on = Number(getComputedStyle(bar).opacity) > 0.2; try { closeModal(true); } catch (e) {} return idle && on; }));
  // 2026-11-19 「顔を押して記録」の説明に、ニキビの種類（白・黒・赤・黄ニキビ）を書く
  check('顔を押して記録の説明に、ニキビの種類を書く', /ニキビ選択＝白ニキビ・黒ニキビ・赤ニキビ・黄ニキビなどの種類/.test(fs.readFileSync(FILE, 'utf8')) && !/ニキビ選択＝ニキビ、/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-19 アカウントのアイコン（自分の写真）が丸からはみ出さない
  check('アカウントのアイコンが丸からはみ出さない', await ev(() => { const css = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules].map((x) => x.cssText); } catch (e) { return []; } }).join(' '); return /\.av img \{[^}]*border-radius: 50%/.test(css) && /\.av \{[^}]*isolation: isolate/.test(css); }));
  // 2026-11-19 お問い合わせに「ご意見・ご感想」を送るところ（種類3つ・1000文字まで・Supabaseのfeedbackに送る）
  check('ご意見・ご感想を送れる', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = window.fetch; let sent = null;
    window.fetch = async (u, o) => { if (String(u).includes('/rest/v1/feedback')) { sent = {u: String(u), o}; return new Response('', {status: 201}); } return keep(u, o); };
    openFeedback(); await w(100); const el = document.getElementById('fb-sheet'), kinds = el ? [...el.querySelectorAll('input[name="fbk"]')].map((i) => i.value).join(',') : '';
    el.querySelector('#fb-in').value = 'テスト'; el.querySelector('[data-fb="send"]').click(); await w(300); window.fetch = keep;
    const b = sent && JSON.parse(sent.o.body);
    return kinds === 'ご意見,感想,不具合' && el.querySelector('#fb-in').maxLength === 1000 && !!b && b.body === 'テスト' && b.kind === 'ご意見' && sent.o.method === 'POST'; }));
  // 2026-11-19 ケア管理に、ニキビの種類ごとの塗り薬（成分名だけ。処方薬の商品名は出さない）
  check('ケア管理：ニキビの種類ごとの塗り薬は、そのニキビがあるときだけ・同じ成分は1回だけ', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepL = JSON.stringify(state.skinLogs), keepC = state.settings.concernKeys, d = todayStr(), r = []; state.settings.concernKeys = ['acne'];
    state.skinLogs = []; state = normalize(JSON.parse(JSON.stringify(state))); ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(200); r.push(!document.querySelector('#main .at-drugs'));
    state.skinLogs = [{id: 'at1', date: d, condition: 2, acneCount: 3, acneTypes: ['赤ニキビ', '白ニキビ'], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
    for (const sl of ['am', 'pm']) { ui.rtTab = sl; render(); await w(200); const c = document.querySelector('#main .at-drugs'), ks = c ? [...c.querySelectorAll('[data-acnedrug]')].map((b) => b.dataset.acnedrug) : [];
      r.push(!!c && /赤ニキビ/.test(c.textContent) && /白ニキビ/.test(c.textContent) && !/黄ニキビ|しこり|ニキビ跡/.test(c.textContent) && ks.length && new Set(ks).size === ks.length && !RX_DRUGS.some((x) => c.textContent.includes(x[1]))); }
    state.skinLogs = JSON.parse(keepL); state.settings.concernKeys = keepC; state = normalize(JSON.parse(JSON.stringify(state))); render(); return r.every(Boolean); }));
  // 2026-11-19 Myアイテム：ニキビの塗り薬の使用目的に、ニキビの種類を書く／睡眠の記録は、就寝が上・起床が下
  check('ニキビの薬の使用目的にニキビの種類・就寝が上で起床が下', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state.myProducts);
    state.myProducts.push({id: 'acu', demo: false, purchases: [], catalogId: '', name: 'エピデュオゲル', brand: '処方薬', category: '皮膚科の塗り薬', purposes: ['ニキビ'], ingredients: 'アダパレン、過酸化ベンゾイル', timing: '夜', frequency: '毎日', startDate: todayStr(), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
    location.hash = '#/my/acu'; render(); await w(150); const dd = [...document.querySelectorAll('#main dt')].find((x) => x.textContent === '効果'), u = dd ? dd.nextElementSibling.textContent.replace(/\u200b/g, '') : '';
    state.myProducts = JSON.parse(keep); render();
    try { closeModal(true); } catch (e) {} openLifeForm(null, 'sleep', todayStr()); await w(300); const b = document.getElementById('f_bed'), wk = document.getElementById('f_wake');
    const ok2 = !!b && !!wk && b.getBoundingClientRect().top < wk.getBoundingClientRect().top - 10; try { closeModal(true); } catch (e) {}
    return /ニキビ（白ニキビ・黒ニキビ・赤ニキビ・黄ニキビ）/.test(u) && ok2; }));
  // 2026-11-19 塗り薬の成分は、どの塗り薬でも緑の下線（押すと成分の説明）。Myアイテムの詳細・薬の説明の両方
  check('塗り薬の成分は、どの薬でも全部リンクになる', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state.myProducts), bad = [];
    for (const d of RX_DRUGS.filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i)) {
      state.myProducts.push({id: 'rxt', demo: false, purchases: [], catalogId: '', name: d[1], brand: '処方薬', category: '皮膚科の塗り薬', purposes: [], ingredients: d[2], timing: '朝・夜', frequency: '毎日', startDate: todayStr(), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
      location.hash = '#/my/rxt'; render(); await w(80);
      const dd = [...document.querySelectorAll('#main dt')].find((x) => /成分/.test(x.textContent)), links = dd ? dd.nextElementSibling.querySelectorAll('.care-link').length : 0, n = d[2].split(/[、,，・]/).filter(Boolean).length;
      const info = rxInfoHtml(state.myProducts.find((p) => p.id === 'rxt'));
      if (links !== n || !/data-rxing|care-link/.test(info)) bad.push(d[1]);
      state.myProducts = state.myProducts.filter((p) => p.id !== 'rxt'); }
    state.myProducts = JSON.parse(keep);
    openRxIngSheet('ベタメタゾン吉草酸エステル'); await w(100); const t = document.querySelector('#modal-root') ? document.querySelector('#modal-root').textContent : ''; try { closeModal(true); } catch (e) {}
    return !bad.length && /皮膚科で処方される成分です/.test(t) && !/リンデロン/.test(t); }, null), '');
  // 2026-11-19 下に引っぱって更新：新しい版が出ていれば、読み込み直してアプリを新しくする
  check('下に引っぱって更新で、新しい版があれば読み込み直す', await ev(async () => {
    const keep = window.fetch; let n = 0; window.fetch = async (u, o) => { if (/index\.html\?v=/.test(String(u))) { n++; return new Response(n === 1 ? "const APP_BUILD = '20991231000000';" : "const APP_BUILD = 'dev';", {status: 200}); } return keep(u, o); };
    const a = await appNewerBuild(), b = await appNewerBuild(); window.fetch = keep;
    return a === true && b === false && /appNewerBuild\(\)\)[\s\S]{0,120}location\.reload\(\)/.test(String(ptrRefresh)); }));
  check('公開のときに版の印（APP_BUILD）を入れる', /const APP_BUILD = 'dev';/.test(fs.readFileSync(FILE, 'utf8')) && /sed "s\/const APP_BUILD = 'dev';/.test(fs.readFileSync(path.join(HC, 'deploy.sh'), 'utf8')));
  // 2026-11-19 ケア管理では、登録した物は主な成分で出す（処方薬の商品名は出さない）／その日の肌の状態から使う物を選ぶ（毎日使わない物は日が浅ければ休む）
  check('ケア管理：薬は成分名で出す・今日の肌から使う物を選ぶ', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepP = JSON.stringify(state.myProducts), keepL = JSON.stringify(state.skinLogs), d = todayStr();
    const mk = (id, name, cat, ing, o) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null}, o || {});
    state.myProducts = [mk('ra', 'ディフェリンゲル0.1%', '皮膚科の塗り薬', 'アダパレン', {timing: '夜'}), mk('rb', 'ヒルドイドローション0.3%', '皮膚科の塗り薬', 'ヘパリン類似物質'), mk('rc', 'テスト化粧水', '化粧水・トナー', '水、グリセリン、ナイアシンアミド'), mk('rf', 'テストマスク', '美容液・アンプル', 'ナイアシンアミド、パンテノール', {frequency: '週1回', timing: '夜'})];
    state.skinLogs = [0, 1, 2].map((i) => ({id: 'rl' + i, date: addDays(d, -i), condition: 2, acneCount: 2, acneTypes: ['赤ニキビ'], usedProducts: i === 1 ? ['rf'] : [], note: '', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state))); ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(300);
    const main = document.getElementById('main'), txt = main.textContent, top = main.querySelector('.rt-today'), steps = [...main.querySelectorAll('.cm-step')].map((e) => e.textContent).join(' ');
    const ok = !top && /アダパレン/.test(steps) && /ヘパリン類似物質/.test(steps) && !/ディフェリン|ヒルドイド/.test(txt.replace(/\u200b/g, '')) && /週1回の物で、1日前に使ったため/.test(steps.replace(/\u200b/g, ''));
    state.myProducts = JSON.parse(keepP); state.skinLogs = JSON.parse(keepL); state = normalize(JSON.parse(JSON.stringify(state))); render();
    return ok; }));
  // 2026-11-19 ケア管理：薬の成分は美容液に出さず「ニキビの種類ごとの塗り薬」へ（市販薬・処方は開いてから）／お休みの物をおすすめに出さない／商品は成分名で／同じ控えたいを2回出さない
  check('ケア管理：薬は塗り薬の所だけ・お休みと重ならない・商品名を出さない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepP = JSON.stringify(state.myProducts), keepL = JSON.stringify(state.skinLogs), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, brand, cat, ing, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand, category: cat, purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('ua', 'エピデュオゲル', '処方薬', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル', '夜'), mk('ub', 'Anua アヌア アゼライン酸15インテンスカーミング セラム', 'Anua', '美容液・アンプル', '', '朝・夜'), mk('uc', 'Anua アヌア 0.3 リニューイング セラム', 'Anua', '美容液・アンプル', 'レチノール、ナイアシンアミド', '朝・夜'), mk('ue', 'テスト乳液', 'テスト', '乳液', '', '朝・夜')];
    state.skinLogs = [0, 1, 2].map((i) => ({id: 'ul' + i, date: addDays(d, -i), condition: 2, acneCount: 4, acneTypes: ['赤ニキビ'], redness: 4, dryness: 3, oil: 1, usedProducts: [], memo: '', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state))); const bad = [];
    for (const sl of ['am', 'pm']) { ui.rtTab = sl; location.hash = '#/routine'; render(); await w(400);
      const main = document.getElementById('main'), steps = [...main.querySelectorAll('.cm-step')], txt = main.textContent.replace(/​/g, '');
      if (steps.some((e) => e.querySelector('[data-acnedrug]'))) bad.push(sl + '：手順に薬の成分');
      if (main.querySelector('.cm-dtag')) bad.push(sl + '：市販薬・処方の印');
      { const mm = txt.match(/.{0,40}(エピデュオ|Anua|アヌア|リニューイング|テスト乳液).{0,20}/); if (mm) bad.push(sl + '：商品名「' + mm[0] + '」'); }
      const restN = [...rtPlan(sl).rested.keys()].map((id) => prodIngLabel(state.myProducts.find((p) => p.id === id)));
      const shown = steps.flatMap((e) => [...e.querySelectorAll('.cm-c.own:not([data-avoidown])')].map((c) => c.textContent.replace(/[›​]/g, '').trim()));
      if (restN.some((n) => shown.includes(n))) bad.push(sl + '：お休みの物がおすすめにも');
      if (/アダパレン/.test(restN.join())) bad.push(sl + '：処方薬をお休み');
      steps.forEach((e) => { const L = [...e.querySelectorAll('.cm-ing small.b + div .cm-c')].map((c) => c.textContent.replace(/[›​]/g, '').trim()); if (new Set(L).size !== L.length) bad.push(sl + '：控えたいが2回'); });
      if (/おすすめ成分/.test(txt)) bad.push(sl + '：おすすめ成分の見出し'); }
    let ct = ''; try { ct = JSON.stringify(careTodayData().items); } catch (e) { ct = ''; }
    if (/エピデュオ|アダパレン/.test(ct)) bad.push('おすすめケアで処方薬をお休み');
    openAcneDrugSheet('ibp'); await w(150); const otc = document.querySelector('#modal-root') ? document.querySelector('#modal-root').textContent : ''; try { closeModal(true); } catch (e) {}
    if (!/市販薬の成分です/.test(otc)) bad.push('市販薬の印が開いた中にない');
    state.myProducts = JSON.parse(keepP); state.skinLogs = JSON.parse(keepL); state = normalize(JSON.parse(JSON.stringify(state))); window.isPremium = keepPrem; render();
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-19 「おすすめ成分」→「おすすめ」・言葉の説明の「主な成分」→「おすすめ」（アプリの中ぜんぶ）
  check('見出しは「おすすめ」「控えたい」にそろえる', (() => { const src = fs.readFileSync(FILE, 'utf8'); return !/'おすすめ成分'|>おすすめ成分<|<b>主な成分<\/b>|<b>控えたい成分<\/b>|>控えたい成分</.test(src); })());
  // 2026-11-19 お問い合わせは、なんでも答える（空の答えを返さない・あいまいな文は意味を考えて答える）
  check('AIサポートは、なんでも答える指示になっている', (() => { const v = fs.readFileSync(path.join(HC, '貼り付け用', '5_関数_vision.txt'), 'utf8'); return /必ず answer を書く/.test(v) && /解約できたかの確かめ方/.test(v) && !/書いてあることだけを根拠にする/.test(v); })());
  // 2026-11-19 ボタンが沈まない画面では、ボタンの位置を transform で決めない（押したときに transform が消えて、ボタンが動いてしまうため）
  check('沈まない画面のボタンは、押しても動かない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepL = JSON.stringify(state.skinLogs), d = todayStr(), bad = [];
    state.skinLogs = [0, 1, 2].map((i) => ({id: 'nl' + i, date: addDays(d, -i), condition: 3, acneCount: 1, usedProducts: [], memo: '', photo: ''})); state = normalize(JSON.parse(JSON.stringify(state)));
    for (const [h, t] of [['#/home'], ['#/account'], ['#/account/me'], ['#/log', 'list']]) { if (t) ui.logTab = t; location.hash = h; render(); await w(300);
      [...document.querySelectorAll('#main :is(button,a,[role=button],[data-action],label)')].forEach((e) => { if (e.getBoundingClientRect().width && getComputedStyle(e).transform !== 'none') bad.push(h + ' ' + (e.id || e.className)); }); }
    state.skinLogs = JSON.parse(keepL); state = normalize(JSON.parse(JSON.stringify(state))); render();
    if (bad.length) console.log('  ' + bad.slice(0, 5).join(' / ')); return !bad.length; }));
  // 2026-11-19 記録一覧の顔写真：押すと大きく出て、写真の外（余白）を押すと戻る
  check('顔写真を押すと大きく出て、余白を押すと戻る', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    openPhotoView('data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'テスト'); await w(80); const v = document.querySelector('.ph-view'); const ok1 = !!v && !!v.querySelector('img');
    v.querySelector('img').click(); await w(250); const ok2 = !!document.querySelector('.ph-view'); v.click(); await w(250);
    return ok1 && ok2 && !document.querySelector('.ph-view') && typeof document.onclick !== 'undefined'; }));
  // 2026-11-19 商品の写真は、枠いっぱいに出す（小さく端に寄らない）。どの窓・一覧でも
  check('商品の写真は枠いっぱい', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepP = JSON.stringify(state.myProducts), d = todayStr();
    state.myProducts.push({id: 'th1', demo: false, purchases: [], catalogId: null, name: 'テスト美容液', brand: 'テスト', category: '美容液・アンプル', purposes: [], ingredients: '', timing: '朝・夜', frequency: '毎日', startDate: d, status: '使用中', endDate: '', memo: '', pao: 6, order: null, image: ''});
    const c = {id: 'thc', isSample: false, name: 'テスト美容液', category: '美容液・アンプル', imageUrl: 'https://example.com/a.jpg'}; state.catalog.push(c); state.myProducts[state.myProducts.length - 1].catalogId = 'thc';
    openOwnedSheet('テスト', ['th1']); await w(150); const t = document.querySelector('#modal-root .own-th .thumb'), x = t && t.querySelector('.xim');
    const ok = !!x && Math.abs(x.getBoundingClientRect().width - t.getBoundingClientRect().width) < 2 && Math.abs(x.getBoundingClientRect().left - t.getBoundingClientRect().left) < 2;
    try { closeModal(true); } catch (e) {} state.myProducts = JSON.parse(keepP); state.catalog = state.catalog.filter((z) => z.id !== 'thc'); return ok; }));
  // 2026-11-19 下のバーで画面を切り替えても、画面が飛ばない（ブラウザに位置を戻させない・いちばん上から出す）
  check('下のバーで切り替えても画面が飛ばない', await ev(() => history.scrollRestoration === 'manual') && /!\(Date\.now\(\) - NAV_SRC\.bar < 1500\)/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-19 どの画面でも、中身が上の見出し（バー）の下にもぐらない（アカウントのアイコンがはみ出していた）
  check('どの画面も、中身が上の見出しにもぐらない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), bad = [];
    for (const h of ['#/home', '#/log', '#/my', '#/routine', '#/account', '#/account/me', '#/settings', '#/plan', '#/ingredients', '#/combo', '#/charts', '#/report', '#/terms', '#/privacy', '#/law', '#/care/diag', '#/care/guide']) {
      location.hash = h; await w(300); window.scrollTo(0, 0); await w(60); const m = document.getElementById('main'), top = m.getBoundingClientRect().top;
      const el = [...m.querySelectorAll('*')].find((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.position !== 'fixed' && r.top < top - 1; });
      if (el) bad.push(h + ' ' + el.className); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-19 成分辞典の成分のページ：上の印（根拠・区分）と同じ内容をくり返さない・処方薬の商品名を出さない
  check('成分のページは重なる内容を出さない', await ev(async () => { const e = ING_MASTER.find((x) => /過酸化ベンゾイル/.test(x.ja)); if (!e) return false; const h = ingMasterDetail(e);
    return !/<b>科学的根拠<\/b>|<b>区分<\/b>|<b>期待できる効果<\/b>|ベピオ/.test(h); }));
  // 2026-11-19 化粧品・塗り薬の成分は、解説のない物も含めて全部リンク（緑の下線）
  check('化粧品の成分は全部リンクになる', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state.myProducts);
    state.myProducts.push({id: 'ingt', demo: false, purchases: [], catalogId: '', name: 'テスト化粧水', brand: 'テスト', category: '化粧水・トナー', purposes: [], ingredients: '水、グリセリン、ナイアシンアミド、テストエキス', timing: '朝・夜', frequency: '毎日', startDate: todayStr(), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    location.hash = '#/my/ingt'; render(); await w(150); const dd = [...document.querySelectorAll('#main dt')].find((x) => /成分/.test(x.textContent)), n = dd ? dd.nextElementSibling.querySelectorAll('.care-link').length : 0;
    state.myProducts = JSON.parse(keep); return n === 4; }));
  // 2026-11-19 記録一覧：日付を変えても、日付・肌の調子の文字が動かない（ふわっと出る動きをしない）
  check('記録一覧で日付を変えても文字が動かない', !/classList\.add\('ld-flash'\)/.test(fs.readFileSync(FILE, 'utf8')));
  // 2026-11-19 どのページでも、同じ物（手順・カード・ボタン・行）を2回出さない（同じ成分の薬を2つ登録していても1つにまとめる）
  check('どのページでも同じ物を2回出さない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, brand, cat, ing, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand, category: cat, purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('d1', 'アクアチムクリーム1%', '処方薬', '皮膚科の塗り薬', 'ナジフロキサシン', '朝・夜'), mk('d2', 'アクアチムローション1%', '処方薬', '皮膚科の塗り薬', 'ナジフロキサシン', '朝・夜'), mk('d3', 'エピデュオゲル', '処方薬', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル', '夜'),
      mk('d4', 'テスト化粧水A', 'テスト', '化粧水・トナー', '水、グリセリン、ナイアシンアミド', '朝・夜'), mk('d5', 'テスト化粧水B', 'テスト', '化粧水・トナー', '水、グリセリン、ナイアシンアミド', '朝・夜'), mk('d6', 'テスト美容液', 'テスト', '美容液・アンプル', 'ビタミンC誘導体', '朝・夜'), mk('d7', 'テスト乳液', 'テスト', '乳液', 'スクワラン', '朝・夜')];
    state.skinLogs = [0, 1, 2, 3, 5].map((i) => ({id: 'dl' + i, date: addDays(d, -i), condition: 2 + i % 3, acneCount: 3, acneTypes: ['赤ニキビ', '白ニキビ'], redness: 3, dryness: 3, oil: 2, usedProducts: ['d4', 'd1'], memo: 'メモ', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state)));
    const norm = (t) => t.replace(/[​\s›]/g, ''), bad = [];
    const scan = (where) => document.querySelectorAll('#main *').forEach((par) => { const kids = [...par.children].filter((e) => e.getBoundingClientRect().height > 0); if (kids.length < 2) return; const seen = new Set();
      kids.forEach((k) => { if (!/(cm-step|card|pop-item|ls-row|mrow|cm-c|chip|at-row|ing-b|rt-dl|cm-today|ld-sec|tip|pa-row|pc-ln)/.test(k.className + '') && !/^(LI|P)$/.test(k.tagName)) return;
        const c = k.cloneNode(true); c.querySelectorAll('.cm-n,.cm-hd button').forEach((x) => x.remove()); const t = norm(c.textContent); if (t.length < 2) return; if (seen.has(t)) bad.push(where + '：' + t.slice(0, 40)); seen.add(t); }); });
    for (const [h, f] of [['#/home', () => { ui.homeTab = 'today'; }], ['#/home', () => { ui.homeTab = 'care'; }], ['#/log', () => { ui.logTab = 'list'; }], ['#/log', () => { ui.logTab = 'recent'; }], ['#/my'], ['#/my/d1'], ['#/my/d4'], ['#/routine', () => { ui.rtTab = 'am'; }], ['#/routine', () => { ui.rtTab = 'pm'; }], ['#/mycare'], ['#/charts'], ['#/report'], ['#/ingredients'], ['#/combo'], ['#/account'], ['#/plan']]) {
      if (f) f(); location.hash = h; render(); await w(300); scan(h); }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + [...new Set(bad)].slice(0, 5).join(' / ')); return !bad.length; }));
  // 2026-11-19 人気ランキングは、スキンケアの商品だけ（メイク・髪・体・食品・道具などは入れない）
  check('人気ランキングはスキンケアの商品だけ', await ev(() => {
    const ok = ['ナイアシンアミド 美容液 30ml', '化粧水 ハトムギ 500ml', 'ニキビ 治療薬 第2類医薬品 クリーム', '日焼け止め SPF50 ジェル', '顔・からだ用 保湿クリーム', 'セラミド 乳液', 'クレンジングバーム'];
    const ng = ['ビタミンC サプリ 60粒', 'ヘアオイル ナイアシンアミド', 'ボディクリーム 300g', 'リップティント', 'クッションファンデ SPF50', 'まつげ美容液', 'ハンドクリーム', '美顔器 EMS', 'シャンプー', 'ナイアシンアミド 粉末'];
    return ok.every((n) => shopSingle({name: n})) && ng.every((n) => !shopSingle({name: n})); }));
  // 2026-11-19 ケア管理の薬の使い方は、添付文書どおり（ウォッシュゲルは洗顔のあとに塗って5〜10分後に流す・ステロイド入りの抗菌薬はステロイドとして・エピデュオは妊娠中使えない・ボンアルファは1日2回）
  check('ケア管理の薬の使い方が添付文書どおり', await ev(async () => {
    const P = (name, ing) => rxPlanOf({p: {name, ingredients: ing, timing: '朝・夜'}, rk: ''});
    const vg = P('リンデロンVG軟膏0.12%', 'ベタメタゾン吉草酸エステル・ゲンタマイシン硫酸塩'), ep = P('エピデュオゲル', 'アダパレン・過酸化ベンゾイル'), wg = P('ベピオウォッシュゲル5%', '過酸化ベンゾイル');
    const ok1 = !!vg.steroid && /5〜10分/.test(wg.how) && /洗顔のあと/.test(wg.per) && ep.note.some((n) => /妊娠/.test(n)) && /1日2回/.test(P('ボンアルファ軟膏2μg/g', 'タカルシトール').per) && /1日1回/.test(P('ボンアルファハイ軟膏20μg/g', 'タカルシトール').per);
    const keepP = JSON.stringify(state.myProducts), keepPrem = window.isPremium; window.isPremium = () => true;
    state.myProducts = [{id: 'wg1', demo: false, purchases: [], catalogId: '', name: 'ベピオウォッシュゲル5%', brand: '処方薬', category: '皮膚科の塗り薬', purposes: [], ingredients: '過酸化ベンゾイル', timing: '夜', frequency: '毎日', startDate: todayStr(), status: '使用中', endDate: '', memo: '', pao: 0, order: null}];
    state = normalize(JSON.parse(JSON.stringify(state))); const st = rtPlan('pm').steps.map((x) => x.k), iw = st.indexOf('wash'), ir = st.findIndex((k) => k.startsWith('rx:'));
    state.myProducts = JSON.parse(keepP); window.isPremium = keepPrem;
    return ok1 && iw >= 0 && ir > iw && !/顔全体で人さし指の先から第一関節くらいの量/.test(document.documentElement.innerHTML + [...document.scripts].map((x) => x.textContent).join('')); }));
  // 2026-11-19 となりのタブをのぞく画面（横にスワイプ中）は id を消すので、画面の中の見た目を id（#〜）で決めない（記録一覧の＜＞が移動していた）
  check('タブの中の見た目は id で決めない（スワイプ中もずれない）', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), ids = new Set(), bad = [], keepL = JSON.stringify(state.skinLogs), d = todayStr();
    [...document.styleSheets].forEach((ss) => { try { [...ss.cssRules].forEach((r) => (r.selectorText || '').replace(/#([a-zA-Z][\w-]*)/g, (m, id) => ids.add(id))); } catch (e) {} });
    state.skinLogs = [1, 2].map((i) => ({id: 'gl' + i, date: addDays(d, -i), condition: 3, acneCount: 1, usedProducts: [], memo: '', photo: ''})); state = normalize(JSON.parse(JSON.stringify(state)));
    for (const [h, f] of [['#/home', () => { ui.homeTab = 'today'; }], ['#/home', () => { ui.homeTab = 'care'; }], ['#/log', () => { ui.logTab = 'list'; }], ['#/log', () => { ui.logTab = 'recent'; }], ['#/my'], ['#/routine']]) {
      if (f) f(); location.hash = h; render(); await w(250); document.querySelectorAll('.home-pane [id]').forEach((e) => { if (ids.has(e.id)) bad.push(h + ' #' + e.id); }); }
    state.skinLogs = JSON.parse(keepL); state = normalize(JSON.parse(JSON.stringify(state))); render(); if (bad.length) console.log('  ' + [...new Set(bad)].join(' / ')); return !bad.length; }));
  // 2026-11-19 ニキビの塗り薬のカード：今使っている成分は出さない・皮膚科の薬を使っている人には市販薬を出さない／保湿剤（ヘパリン類似物質）を化粧品と併用注意にしない／控えたいを重ねない
  check('ケア管理：使っている成分を重ねて出さない・保湿剤を併用注意にしない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, cat, ing, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('e1', 'エピデュオゲル', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル', '夜'), mk('e2', 'アクアチムクリーム1%', '皮膚科の塗り薬', 'ナジフロキサシン', '朝・夜')];
    state.skinLogs = [{id: 'el1', date: d, condition: 3, acneCount: 2, acneTypes: ['赤ニキビ', '白ニキビ'], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
    ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(300);
    const ks = [...document.querySelectorAll('#main .at-drugs [data-acnedrug]')].map((b) => b.dataset.acnedrug), ok1 = !ks.some((k) => ['ada', 'bpo', 'adabpo', 'clbpo', 'abx', 'ibp', 'sulf'].includes(k));
    const av = [...document.querySelectorAll('#main .cm-step .cm-ing small.b + div .cm-c')].map((c) => c.textContent.replace(/[›​]/g, '').trim()), ok2 = !(av.includes('レチノール') && av.some((t) => /レチノールとピーリングの併用/.test(t)));
    state.myProducts = [mk('h1', 'ヒルドイドローション0.3%', '皮膚科の塗り薬', 'ヘパリン類似物質', '朝・夜'), mk('h2', 'テストピーリング', '美容液・アンプル', 'グリコール酸', '夜')]; state = normalize(JSON.parse(JSON.stringify(state)));
    let txt = ''; try { txt = JSON.stringify(rtPlan('pm').steps.map((z) => [z.today, (z.avoidOwn || []).map((a) => a.c && a.c.who && a.c.who.name)])); } catch (e) { txt = 'err'; }
    const ok3 = !/ヘパリン類似物質の塗り薬と併用注意|ヘパリン類似物質の塗り薬/.test(txt);
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (!(ok1 && ok2 && ok3)) console.log('  ' + [ok1, ok2, ok3, ks]); return ok1 && ok2 && ok3; }));
  // 2026-11-19 アイコンの変更：ライブラリから選択・写真を撮る・現在の写真を削除・キャンセル → 丸い枠で合わせて「選択」
  check('アイコンの変更（選ぶ・撮る・削除・丸い枠で合わせる）', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = state.settings.avatar; state.settings.avatar = {t: 'emoji', v: AVATAR_EMOJI[0], c: AVATAR_COLORS[0]};
    openAvatarMenu(); await w(100); const m = document.getElementById('av-menu'), t = m ? m.textContent : '';
    const ok1 = /ライブラリから選択/.test(t) && /写真を撮る/.test(t) && /現在の写真を削除/.test(t) && /キャンセル/.test(t) && !!m.querySelector('input[capture]');
    m.querySelector('[data-avm="close"].avm-cancel').click(); await w(300);
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300);
    openAvatarCrop(c.toDataURL('image/png')); await w(400); const cr = document.querySelector('.av-crop'), ok2 = !!cr && !!cr.querySelector('.avc-ring');
    cr.querySelector('[data-avc="ok"]').click(); await w(200); const ok3 = state.settings.avatar && state.settings.avatar.t === 'img' && /^data:image\/jpeg/.test(state.settings.avatar.v) && !document.querySelector('.av-crop');
    state.settings.avatar = keep; save(); render(); return ok1 && ok2 && ok3 && !document.getElementById('av-menu'); }));
  // 2026-11-19 ケア管理：登録した物を全部使おうとしない。今日の肌に一番いい成分を決めて、それが入った物だけ使う（合わない物はお休みと理由）
  check('ケア管理：肌に合う物だけ使う（登録した物を全部は使わない）', await ev(async () => {
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, cat, ing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('f1', 'テストうるおい美容液', '美容液・アンプル', '水、セラミドNP、ヒアルロン酸Na'), mk('f2', 'テスト美白美容液', '美容液・アンプル', '水、トラネキサム酸'), mk('f3', 'テストアゼライン酸 美容液', '美容液・アンプル', '')];
    state.settings.diag = null; state.settings.concernKeys = ['dry']; state.skinLogs = [0, 1, 2].map((i) => ({id: 'fl' + i, date: addDays(d, -i), condition: 3, acneCount: 0, acneTypes: [], redness: 0, dryness: 4, oil: 0, usedProducts: [], memo: '', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state)));
    let ok = false, info = ''; try { const P = rtPlan('pm'), sv = P.steps.find((z) => z.k === 'serum'), ids = sv ? sv.prods.map((x) => x.p.id) : [];
      ok = ids.includes('f1') && !ids.includes('f2') && P.rested.has('f2'); info = ids.join(','); } catch (e) { info = e.message; }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (!ok) console.log('  ' + info); return ok; }));
  // 2026-11-19 ケア管理：登録してあるだけで提案しない。ニキビの悩み・記録がない人には、ニキビの薬を手順に入れず（理由を出す）、その薬に合わせて化粧品を休ませない。悩み（しわ・シミ）に合う成分を出す
  check('ケア管理：肌の悩みで決める（処方のニキビの薬は外さず、化粧品を合わせる）', await ev(async () => {
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, cat, ing, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('g1', 'エピデュオゲル', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル', '夜'), mk('g2', 'アクアチムクリーム1%', '皮膚科の塗り薬', 'ナジフロキサシン', '朝・夜'), mk('g3', 'テストアゼライン酸 美容液', '美容液・アンプル', '', '朝・夜'), mk('g4', 'テストレチノール 美容液', '美容液・アンプル', 'レチノール', '夜')];
    state.settings.diag = null; state.settings.concernKeys = ['aging', 'spot']; state.skinLogs = [0, 1, 2].map((i) => ({id: 'gl' + i, date: addDays(d, -i), condition: 3, acneCount: 0, acneTypes: [], redness: 0, dryness: 1, oil: 1, usedProducts: [], memo: '', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state))); let ok = false, info = '';
    try { const am = rtPlan('am'), pm = rtPlan('pm'), all = am.steps.concat(pm.steps), txt = JSON.stringify(all.map((z) => [z.today, z.good, z.avoid])) + JSON.stringify(am.tips.concat(pm.tips));
      const rxIn = all.some((z) => z.k.startsWith('rx:')), svP = pm.steps.find((z) => z.k === 'serum'), svA = am.steps.find((z) => z.k === 'serum');
      /* 2026-11-20 Keiichiroの指示で変更：処方の塗り薬は記録で外さない（アダパレン・過酸化ベンゾイルは再発予防に続ける薬・抗菌薬は期間を医師に）。レチノールの美容液は薬と重なるので休む */
      ok = rxIn && /再発を防ぐために続ける/.test(txt) && /使う期間は医師が決めます/.test(txt) && !/手順に入れていません/.test(txt)
        && !svP.prods.some((x) => x.p.id === 'g4') && svA.good.some((g) => /ビタミンC誘導体|トラネキサム酸/.test(g)) && !svA.prods.some((x) => x.p.id === 'g3');
      info = [rxIn, svP.prods.map((x) => x.p.id), svA.prods.map((x) => x.p.id), svA.good].join(' | '); } catch (e) { info = e.message; }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (!ok) console.log('  ' + info); return ok; }));
  // 2026-11-19 押せる名前（緑の下線）が続くときは「・」で区切る（「レチノールアゼライン酸」のようにくっつかない）。どの画面でも
  check('押せる名前が続くときは区切る（くっつかない）', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(), bad = []; window.isPremium = () => true;
    const mk = (id, name, cat, ing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    state.myProducts = [mk('j1', 'テストレチノール 美容液', '美容液・アンプル', 'レチノール'), mk('j2', 'テストアゼライン酸 美容液', '美容液・アンプル', ''), mk('j3', 'テストグリコール酸 美容液', '美容液・アンプル', 'グリコール酸')];
    state.skinLogs = [0, 1, 2].map((i) => ({id: 'jl' + i, date: addDays(d, -i), condition: 2, acneCount: 3, acneTypes: ['赤ニキビ'], redness: 4, dryness: 3, oil: 1, usedProducts: [], memo: '', photo: ''})); state = normalize(JSON.parse(JSON.stringify(state)));
    const adj = (root, where) => root.querySelectorAll('.care-link').forEach((a) => { const p = a.previousSibling; if (p && p.nodeType === 1 && p.classList.contains('care-link')) bad.push(where + '：' + p.textContent + a.textContent); });
    for (const [h, f] of [['#/routine', () => { ui.rtTab = 'am'; }], ['#/routine', () => { ui.rtTab = 'pm'; }], ['#/home', () => { ui.homeTab = 'care'; }], ['#/my/j1'], ['#/my/j4'], ['#/ingredients']]) { if (f) f(); location.hash = h; render(); await w(250); adj(document.getElementById('main'), h); }
    const hh = sepLinks('<button type="button" class="care-link">A</button><button type="button" class="care-link">B</button>');
    const raw = rtPaneHtml('am') + rtPaneHtml('pm'), seen2 = /<\/button>・<button type="button" class="care-link"/.test(sepLinks(raw)); // 2つ続けてお休みする日（赤み・肌あれの日）を作って、区切られているか
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad.slice(0, 3).join(' / '));
    return !bad.length && /A<\/button>・<button/.test(hh) && seen2; }));
  // 2026-11-19 ニキビの悩み・記録がない人には、ニキビの塗り薬のカード・ニキビの注意を出さない（ニキビ跡の記録だけのときも）
  check('ニキビの悩みがない人にはニキビのカードを出さない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    state.settings.diag = null; state.settings.concernKeys = ['aging', 'spot']; state.skinLogs = [0, 1].map((i) => ({id: 'kl' + i, date: addDays(d, -i), condition: 3, acneCount: 0, acneTypes: ['ニキビ跡'], usedProducts: [], memo: '', photo: ''})); state = normalize(JSON.parse(JSON.stringify(state)));
    const r = []; for (const sl of ['am', 'pm']) { ui.rtTab = sl; location.hash = '#/routine'; render(); await w(200); r.push(!document.querySelector('#main .at-drugs') && !/ニキビは触らない/.test(document.getElementById('main').textContent)); }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); return r.every(Boolean); }));
  // 2026-11-19 睡眠・運動に「昨日と同じ」（押すとその日に同じ記録）。運動の「この日は運動しなかった」はなし（記録がなければ、していない）
  check('睡眠・運動の「昨日と同じ」・運動は記録がなければ未記録', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr();
    state.skinLogs = [{id: 'll0', date: d, condition: 3, acneCount: 0, usedProducts: [], memo: '', photo: ''}];
    const y = blankLife(addDays(d, -1)); y.bed = '23:30'; y.wake = '07:00'; y.exercise = [{type: EX_TYPES[0], minutes: 30}]; y.exRecorded = true; state.lifeLogs = [y]; state = normalize(JSON.parse(JSON.stringify(state)));
    ui.logTab = 'list'; ui.logDay = d; location.hash = '#/log'; render(); await w(300);
    const ok1 = !document.querySelector('#main .ls-same') && /運動\s*未記録/.test(document.getElementById('main').textContent.replace(/​/g, '')); // 記録一覧の行には出さない（窓を開いてから）
    for (const part of ['sleep', 'exercise']) { openLifeForm(null, part, d); await w(200); const b = document.querySelector(`#modal-root [data-lsame$="|${part}"]`); if (b) b.click(); await w(400); }
    const t = getLife(d), ok2 = !!t && t.bed === '23:30' && t.wake === '07:00' && t.exercise.length === 1 && t.exercise[0].minutes === 30;
    openLifeForm(null, 'exercise', addDays(d, -2)); await w(200); const ok3 = !/この日は運動しなかった/.test(document.getElementById('modal-root').textContent); try { closeModal(true); } catch (e) {}
    state = normalize(JSON.parse(keep)); ui.logDay = null; render(); if (!(ok1 && ok2 && ok3)) console.log('  ' + [ok1, ok2, ok3]); return ok1 && ok2 && ok3; }));
  // 2026-11-19 ニキビの種類ごとの塗り薬：ニキビを悩みにしているか、最近の記録にニキビがあるときだけ出す（ニキビ跡だけの記録・悩みでない人には出さない）
  check('ニキビの塗り薬のカードは、悩みか記録にニキビがあるときだけ', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const go = async (ck, types, n) => { state.settings.concernKeys = ck; state.skinLogs = [0, 1].map((i) => ({id: 'ml' + i, date: addDays(d, -i), condition: 3, acneCount: n, acneTypes: types, usedProducts: [], memo: '', photo: ''})); state = normalize(JSON.parse(JSON.stringify(state)));
      ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(200); return !!document.querySelector('#main .at-drugs'); };
    const a = await go(['aging', 'spot'], ['赤ニキビ'], 2), b = await go(['aging', 'spot'], ['ニキビ跡'], 0), c = await go(['acne'], ['白ニキビ'], 1);
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); return a && !b && c; }));
  // 2026-11-19 ①スクロールバーを細く ②睡眠は就寝時間・起床時間・睡眠時間・昨日と同じだけ、運動は運動種目・時間・歩数・昨日と同じだけ
  check('スクロールバーが細い・睡眠と運動の窓が簡潔', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr();
    const y = blankLife(addDays(d, -1)); y.bed = '23:00'; y.wake = '07:00'; y.exercise = [{type: EX_TYPES[0], minutes: 20}]; state.lifeLogs = [y]; state = normalize(JSON.parse(JSON.stringify(state)));
    const css = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules].map((r) => r.cssText); } catch (e) { return []; } }).join(' '), m = css.match(/\.msb\s*\{[^}]*width:\s*([\d.]+)px/), ok0 = !!m && Number(m[1]) <= 3;
    const labs = async (part) => { openLifeForm(null, part, d); await w(200); const root = document.querySelector('#modal-root [data-part="' + part + '"]'); const L = [...root.querySelectorAll('.lf-row > span:first-child')].map((x) => x.textContent); const same = !!root.querySelector('[data-lsame]'); const hint = /分かる項目だけ|今朝起きたとき/.test(document.getElementById('modal-root').textContent); try { closeModal(true); } catch (e) {} return [L.join(','), same, hint]; };
    const sl = await labs('sleep'), ex = await labs('exercise');
    state = normalize(JSON.parse(keep)); render();
    const ok = ok0 && sl[0] === '就寝時間,起床時間,睡眠時間' && sl[1] && !sl[2] && ex[0] === '運動種目,時間,歩数' && ex[1] && !ex[2]; if (!ok) console.log('  ' + JSON.stringify([ok0, sl, ex])); return ok; }));
  // 2026-11-19 ④提案は「〜しましょう」
  check('提案は「〜しましょう」の言い方', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepPrem = window.isPremium; window.isPremium = () => true;
    const u = letsTone('毎朝欠かさず塗ります。肌が弱くなりやすいです。成分が入っています。今日はお休みします（理由）。') === '毎朝欠かさず塗りましょう。肌が弱くなりやすいです。成分が入っています。今日はお休みしましょう（理由）。';
    ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(300); const hw = [...document.querySelectorAll('#main .cm-how')].map((e) => e.textContent).join(' ');
    window.isPremium = keepPrem; render(); return u && !/(塗り|なじませ|重ね|広げ|のばし)ます。/.test(hw) && /ましょう。/.test(hw); }));
  // 2026-11-19 ⑤シミ・くすみ・しわ・たるみ・毛穴は緑の下線、押すと「おすすめ」だけ
  check('肌の悩みの言葉は下線・押すとおすすめだけ', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)); const h = ingLinkHtml(esc('シミ・くすみ・しわ・たるみ・毛穴が気になる')), n = (h.match(/data-term=/g) || []).length;
    openTermSheet('しわ'); await w(120); const t = document.getElementById('modal-root').textContent; try { closeModal(true); } catch (e) {}
    return n === 5 && /おすすめ/.test(t) && /レチノール/.test(t) && !/どういう意味/.test(t); }));
  // 2026-11-19 ⑥成分辞典の上のカードは、効果・はたらき・注意と刺激・使用頻度だけ
  check('成分辞典の上のカードは4つだけ', await ev(() => { const e = ING_MASTER.find((x) => x.k === 'azelaic') || ING_MASTER[0], d = document.createElement('div'); d.innerHTML = ingMasterDetail(e);
    const L = [...d.querySelector('.card').querySelectorAll('.rt-dl > b')].map((b) => b.textContent); return L.join(',') === '効果,はたらき,注意と刺激,使用頻度'; }));
  // 2026-11-19 ⑦使用タイミングと使用頻度を1つに（使用頻度　朝・夜（毎日））／⑧使用目的→効果（アプリの中ぜんぶ）
  check('使用頻度は「朝・夜（毎日）」・使用目的は効果に', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state.myProducts);
    state.myProducts.push({id: 'uf1', demo: false, purchases: [], catalogId: '', name: 'テスト化粧水', brand: 'テスト', category: '化粧水・トナー', purposes: ['保湿'], ingredients: '水、グリセリン', timing: '朝・夜', frequency: '毎日', startDate: todayStr(), status: '使用中', endDate: '', memo: '', pao: 6, order: null});
    location.hash = '#/my/uf1'; render(); await w(150); const dts = [...document.querySelectorAll('#main dt')].map((x) => x.textContent), dd = [...document.querySelectorAll('#main dt')].find((x) => x.textContent === '使用頻度');
    const ok = !dts.includes('使用タイミング') && !!dd && /朝・夜（毎日）/.test(dd.nextElementSibling.textContent.replace(/\u200b/g, '')) && dts.includes('効果') && !/使用目的/.test(document.documentElement.innerHTML + [...document.scripts].map((x) => x.textContent).join(''));
    openMyField('uf1', 'use'); await w(150); const t = document.getElementById('modal-root').textContent; try { closeModal(true); } catch (e) {}
    state.myProducts = JSON.parse(keep); render(); return ok && /使う時間/.test(t) && /回数/.test(t); }));
  // 2026-11-19 ⑨肌に合わなかった：見やすく（質問ごとに区切る）・記録した商品と、同じ成分の商品はケアの提案で使わない
  check('肌に合わなかった：見やすい・提案で使わない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, cat, ing, ng) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 6, order: null}, ng ? {ng: {date: d, sym: ['赤み'], note: '', when: '', level: '', where: [], newOther: false}} : {});
    state.myProducts = [mk('q1', 'テストA美容液', '美容液・アンプル', '水、グリコール酸', true), mk('q2', 'テストB美容液', '美容液・アンプル', '水、グリコール酸、ナイアシンアミド'), mk('q3', 'テストC美容液', '美容液・アンプル', '水、セラミドNP')];
    state.settings.concernKeys = ['dry', 'rough']; state = normalize(JSON.parse(JSON.stringify(state)));
    openNgForm('q2'); await w(150); const n = document.querySelectorAll('#modal-root .ngf-q').length; try { closeModal(true); } catch (e) {}
    let okDays = true; const keepAD = altDay; /* 2026-11-20 交互に使う日（A日・B日）のどちらでも、理由が残ること（日付が変わったら失敗した） */
    for (const dd of ['A', 'B']) { window.altDay = () => dd; let ids = [], rs = null; try { RD_SIG = null; const P = rtPlan('pm'); ids = P.steps.flatMap((z) => z.prods.map((x) => x.p.id)); rs = P.rested; } catch (e) { ids = ['err']; }
      const T = rtPlan('pm').steps.map((z) => z.today.map((t) => t.t).join('／')).join('／');
      if (ids.includes('q1') || ids.includes('q2') || !rs || !/肌に合わなかった/.test(String(rs.get('q2') || '')) || /グリコール酸：夜に使い/.test(T)) { okDays = false; console.log('  ' + dd + '日 ' + JSON.stringify([ids, rs && [...rs.entries()], T.slice(0, 200)])); } }
    window.altDay = keepAD; RD_SIG = null;
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render();
    const ids = [], rs = new Map([['q2', '肌に合わなかった']]);
    const ok = okDays && n >= 6 && !ids.includes('q1') && !ids.includes('q2') && rs && /肌に合わなかった/.test(String(rs.get('q2') || '')); if (!ok) console.log('  ' + JSON.stringify([n, ids, rs && [...rs.entries()]])); return ok; }));
  // 2026-11-19 ⑩AIサポート：プレミアムでなくても使える。よくある質問は、通信せずにすぐ答える
  check('AIサポートは無料でも使える・よくある質問はすぐ答える', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepPrem = window.isPremium; window.isPremium = () => false;
    const qs = ['解約したい', '解約できたか確かめたい', 'ログインできない', '確認メールが届かない', 'パスワードを忘れた', '機種変更したい', '料金はいくら？', 'PayPayで払える？', '返金してほしい', 'アプリとして使いたい', '通知を受け取りたい', 'アカウントを削除したい', '表示がおかしい', '化粧品の登録方法'];
    const miss = qs.filter((q) => !supportFaq(q)); const ref = supportFaq('返金してほしい'), can = supportFaq('解約したい');
    openSupport(); await w(300); const ov = document.querySelector('.sp-ov'), ok2 = !!ov && !!ov.querySelector('#sp-in') && !/プランなら、サポートにすぐ質問できます/.test(ov.textContent);
    ov.querySelector('#sp-in').value = '解約したい'; ov.querySelector('[data-sp="send"]').click(); await w(150); const ok3 = /契約内容の確認・解約・カード変更/.test(ov.textContent);
    ov.querySelector('[data-sp="close"]').click(); await w(200); window.isPremium = keepPrem; supportLog.length = 0;
    if (miss.length) console.log('  ' + miss.join(' / ')); return !miss.length && ref.handoff && !can.handoff && ok2 && ok3; }));
  // 2026-11-19 カードのいちばん上の項目に上の線を引かない／「昨日と同じ」は窮屈にしない／食事だけの窓は、上の文章と「MEAL 食事」を出さない（睡眠・運動も）
  check('カードの上の線なし・昨日と同じに余白・記録の窓に余計な見出しなし', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr();
    const e = ING_MASTER.find((x) => x.k === 'azelaic') || ING_MASTER[0]; location.hash = '#/ingredients/' + e.k; render(); await w(200);
    const first = document.querySelector('#main .card .rt-dl'), ok1 = !!first && getComputedStyle(first).borderTopWidth === '0px';
    const y = blankLife(addDays(d, -1)); y.bed = '23:00'; y.wake = '07:00'; state.lifeLogs = [y]; state = normalize(JSON.parse(JSON.stringify(state)));
    const bad = [];
    for (const part of ['sleep', 'exercise', 'meal']) { openLifeForm(null, part, d); await w(200); const t = document.getElementById('modal-root').textContent; if (/分かる項目だけ|MEAL|SLEEP|EXERCISE/.test(t)) bad.push(part);
      const b = document.querySelector(`#modal-root [data-part="${part}"] .lf-same`); if (b) { const cs = getComputedStyle(b); const rows = document.querySelector(`#modal-root [data-part="${part}"] .lf-rows`).getBoundingClientRect(), br = b.getBoundingClientRect(), ft = document.querySelector('#modal-root .modal-foot, #modal-root .modal-footer').getBoundingClientRect(), up = br.top - rows.bottom, down = ft.top - br.bottom; void cs;
        if (up < 12 || Math.abs(up - down) > 2 || br.height < 48) bad.push(part + ' same ' + Math.round(up) + '/' + Math.round(down)); } /* 上の枠との間と、下の区切り線との間を同じに */ try { closeModal(true); } catch (er) {} await w(150); }
    state = normalize(JSON.parse(keep)); render(); if (!ok1 || bad.length) console.log('  ' + [ok1, bad]); return ok1 && !bad.length; }));
  // 2026-11-19 ニキビの塗り薬が何種類もあるとき：記録したニキビの種類に合う物を選び、成分が重なる物はのぞく（どのニキビに塗るかも出す）。「昨日と同じ」は昨日の記録があるときだけ
  check('ニキビの塗り薬は全部入れる・どのニキビに塗るか・重なる成分は医師に確認・前の記録があるときだけ「昨日・前回と同じ」', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, ing, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: '皮膚科の塗り薬', purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
    state.myProducts = [mk('r1', 'エピデュオゲル', 'アダパレン・過酸化ベンゾイル', '夜'), mk('r2', 'ディフェリンゲル0.1%', 'アダパレン', '夜'), mk('r3', 'ベピオゲル2.5%', '過酸化ベンゾイル', '夜'), mk('r4', 'アクアチムクリーム1%', 'ナジフロキサシン', '朝・夜')];
    state.settings.concernKeys = ['acne']; state.skinLogs = [{id: 'rl1', date: d, condition: 3, acneCount: 3, acneTypes: ['赤ニキビ', '黄ニキビ（膿あり）'], usedProducts: [], memo: '', photo: ''}];
    const y2 = blankLife(addDays(d, -2)); y2.bed = '23:00'; y2.wake = '07:00'; state.lifeLogs = [y2]; state = normalize(JSON.parse(JSON.stringify(state)));
    let ok1 = false, info = ''; try { const P = rtPlan('pm'), rx = P.steps.filter((z) => z.k.startsWith('rx:')), ids = rx.flatMap((z) => z.prods.map((x) => x.p.id)); /* 2026-11-21 塗り薬は1つのカードにまとめる */
      /* 2026-11-20 処方の塗り薬は、医師の指示どおり全部手順に入れる（外さない）。同じ成分が重なる薬には「重ねて塗るかは医師・薬剤師に」と出す */
      const tx = (id) => (rx.find((z) => z.prods[0].p.id === id) || {today: []}).today.map((t) => t.t).join(' ');
      const st = P.steps.find((z) => z.k === 'rx:drug'), stx = st ? st.today.map((t) => t.t).join(' ') : '';
      ok1 = ids.length === 4 && ['r1', 'r2', 'r3', 'r4'].every((i) => ids.includes(i) && !P.rested.has(i)) && (stx.match(/同じ成分（/g) || []).length === 1 && /医師か薬剤師に確認/.test(stx) && !!st.drugs.find((x) => x.l === 'ナジフロキサシン' && x.where === '赤ニキビ・黄ニキビ' && !x.dup) && st.drugs.filter((x) => x.dup).length === 3; info = ids.join(','); } catch (e) { info = e.message; }
    openLifeForm(null, 'sleep', d); await w(200); const sb = document.querySelector('#modal-root [data-lsame]'); const ok2a = !!sb && /前回（.+）と同じ/.test(sb.textContent); try { closeModal(true); } catch (e) {} await w(150); /* 昨日の記録がなくても、前の記録があれば「前回と同じ」を出す（2026-11-19 ボタンが消えていた） */
    state.lifeLogs = []; openLifeForm(null, 'sleep', d); await w(200); const ok2 = ok2a && !document.querySelector('#modal-root [data-lsame]'); try { closeModal(true); } catch (e) {}
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (!(ok1 && ok2)) console.log('  ' + [ok1, ok2, info]); return ok1 && ok2; }));
  // 2026-11-19 表記をそろえる：画面に「併用チェック」「成分組み合わせ」を出さない（「成分の組み合わせ」にそろえる）・ケアの提案は「〜しましょう」
  check('表記がそろっている（成分の組み合わせ・〜しましょう）', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium; window.isPremium = () => true; const bad = [];
    for (const h of ['#/home', '#/my', '#/combo', '#/routine', '#/mycare', '#/ingredients', '#/account']) { location.hash = h; await w(250);
      const t = document.body.innerText; if (/併用チェック|成分組み合わせ/.test(t)) bad.push(h + ' 名前'); if (/医師に相談します。/.test(t)) bad.push(h + ' します'); if (/(回復|悪化|改善|変化|増加|減少|乾燥|発生|影響|低下|上昇|吸収|反応)しましょう/.test(t)) bad.push(h + ' 肌が〜しましょう'); }
    if (letsTone('肌は寝ている間に回復します。') !== '肌は寝ている間に回復します。') bad.push('letsTone 回復');
    ui.homeTab = 'care'; location.hash = '#/home'; render(); await w(400); if (/(回復|悪化|改善|変化|増加|減少|乾燥|発生|影響|低下|上昇|吸収|反応)しましょう/.test(document.body.innerText)) bad.push('おすすめケア 肌が〜しましょう');
    window.isPremium = keepPrem; state = normalize(JSON.parse(keep)); render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 塗り薬の成分（成分辞典にない物も）は、どの文の中でも緑の下線にする（ナジフロキサシンが下線なしだった）
  check('塗り薬の成分は文の中でも全部緑の下線', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const mk = (id, name, ing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: '皮膚科の塗り薬', purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
    state.myProducts = [mk('r1', 'エピデュオゲル', 'アダパレン・過酸化ベンゾイル'), mk('r2', 'ディフェリンゲル0.1%', 'アダパレン'), mk('r4', 'アクアチムクリーム1%', 'ナジフロキサシン'), mk('r5', 'アクアチム軟膏1%', 'ナジフロキサシン'), mk('r6', 'ヒルドイドソフト軟膏0.3%', 'ヘパリン類似物質'), mk('r7', 'プロトピック軟膏0.1%', 'タクロリムス')];
    state.settings.concernKeys = ['acne']; state.skinLogs = [{id: 'rl1', date: d, condition: 3, acneCount: 3, acneTypes: ['白ニキビ'], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
    const bad = []; const names = [...rxIngNames()];
    for (const h of ['#/routine', '#/mycare']) { location.hash = h; render(); await w(300);
      const tw = document.createTreeWalker(document.getElementById('main'), NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) { if (n.parentElement.closest('button, a, h1, h2, h3, .rt-dl dt, [data-rxing], [data-ingsheet]')) continue; const t = n.textContent; names.forEach((x) => { if (x.length >= 3 && t.includes(x)) bad.push(h + ' ' + x + ' 「' + t.slice(0, 60) + '」' + n.parentElement.className); }); } }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + [...new Set(bad)]); return !bad.length; }));
  // 2026-11-19 ①食事：下に「おすすめの食べ物」があるときは、見出しに同じ食べ物を書かない ②同じような内容（紫外線の話）は1つにまとめる ③商品の写真はどの枠でも枠いっぱい ④ホームの肌のケアの成分は、ケア管理と同じ
  check('おすすめケア：見出しと食べ物が重ならない・同じ話は1つ・写真は枠いっぱい・ケア管理と同じ成分', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    state.settings.concernKeys = ['acne', 'spot', 'aging']; state.lifeLogs = []; state.skinLogs = [{id: 'cl1', date: d, condition: 3, acneCount: 2, acneTypes: ['赤ニキビ'], usedProducts: [], memo: '', photo: '', otherConcerns: ['くすみ']}]; state = normalize(JSON.parse(JSON.stringify(state)));
    ui.homeTab = 'care'; location.hash = '#/home'; render(); await w(500);
    document.querySelectorAll('#main .ct2-c').forEach((c) => { const foods = [...c.querySelectorAll('.adv-box.good .adv-c')].map((b) => b.textContent.replace('›', '').trim()); c.querySelectorAll('.ct2-i > b').forEach((t) => foods.forEach((f) => { if (f.length >= 2 && t.textContent.includes(f)) bad.push('見出し ' + f); })); });
    for (const sl of ['am', 'pm']) rtPlan(sl).steps.forEach((st) => { const by = {}; st.today.forEach((x) => { if (/紫外線/.test(x.t)) by[x.src] = (by[x.src] || 0) + 1; }); Object.entries(by).forEach(([k, n]) => { if (n > 1) bad.push(sl + ' ' + st.k + ' 紫外線×' + n); }); });
    const careG = new Set(); ['am', 'pm'].forEach((sl) => rtPlan(sl).steps.forEach((st) => st.good.forEach((v) => careG.add(normIng(chipText(v)))))); careG.add(normIng('日焼け止め'));
    const skin = [...document.querySelectorAll('#main .ct2-c')].find((c) => /肌のケア/.test(c.textContent));
    if (skin) skin.querySelectorAll('.adv-box.good .adv-c').forEach((b) => { const t = b.textContent.replace('›', '').trim(); if (!careG.has(normIng(t))) bad.push('ケア管理にない ' + t); });
    const box = document.createElement('div'); box.innerHTML = `<button class="pop-item ir"><span class="pop-img ir-img own-th"><div class="thumb">${extImgHtml('https://example.com/a.jpg', '')}</div></span></button><div class="mrow"><div class="thumb">${extImgHtml('https://example.com/a.jpg', '')}</div></div>`; document.body.appendChild(box);
    box.querySelectorAll('.xim').forEach((x) => { const f = x.closest('.thumb').getBoundingClientRect(), r = x.getBoundingClientRect(); if (Math.abs(f.width - r.width) > 1 || Math.abs(f.height - r.height) > 1) bad.push('写真 ' + Math.round(r.width) + '/' + Math.round(f.width)); }); box.remove();
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 ①入力の枠と下の区切り線をくっつけない ②AIの分析は記録・日付・天気が変わったときだけ（開き直しでは使わない） ③おすすめケアの太字を減らす ④見出しと同じようなチップは出さない
  check('入力画面の余白・AIは記録が変わったときだけ・太字を減らす', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, keepCV = callVision, d = todayStr(); const bad = [];
    for (const part of ['sleep', 'exercise', 'meal']) { state.lifeLogs = []; openLifeForm(null, part, d); await w(250); const f = document.querySelector('#modal-root form'), ft = document.querySelector('#modal-root .modal-foot');
      const kids = [...f.querySelectorAll('[data-part] > *')].filter((e) => e.offsetHeight); const last = kids[kids.length - 1]; const g = ft.getBoundingClientRect().top - last.getBoundingClientRect().bottom; if (g < 14) bad.push(part + ' 余白' + Math.round(g)); try { closeModal(true); } catch (e) {} await w(150); }
    state = normalize(JSON.parse(keep));
    let n = 0; window.isPremium = () => true; callVision = async () => { n++; return {result: {points: [{area: 'スキンケア', title: 't', good: [], avoid: []}]}}; };
    localStorage.removeItem(ADVICE_KEY); state.weather[d] = {hum: 60, uv: 2, tmin: 10, tmax: 18}; await runAdvice(false); const n1 = n; render(); await runAdvice(false); state.weather[d] = {hum: 61, uv: 2, tmin: 10, tmax: 18}; await runAdvice(false); const n2 = n; /* 開き直し・少しの予報の変化では使わない */
    { const c0 = adviceCache(); c0.at = 0; localStorage.setItem(ADVICE_KEY, JSON.stringify(c0)); } state.weather[d] = {hum: 30, uv: 9, tmin: 1, tmax: 5}; await runAdvice(false); const nW = n; /* 天気が変わったら使う */
    const c = adviceCache(); c.at = 0; localStorage.setItem(ADVICE_KEY, JSON.stringify(c)); state.skinLogs.push({id: 'ai1', date: d, condition: 2, acneCount: 1, usedProducts: [], memo: '', photo: ''}); state = normalize(JSON.parse(JSON.stringify(state))); await runAdvice(false); const n3 = n;
    if (!(n1 === 1 && n2 === 1 && nW === 2 && n3 === 3)) bad.push('AI回数 ' + [n1, n2, nW, n3]);
    callVision = keepCV; localStorage.removeItem(ADVICE_KEY);
    ui.homeTab = 'care'; location.hash = '#/home'; render(); await w(400);
    const fw = (sel) => { const e = document.querySelector(sel); return e ? +getComputedStyle(e).fontWeight : 0; };
    if (fw('#main .adv-c') > 500) bad.push('チップが太字'); if (fw('#main .ct2-lead') > 400) bad.push('ひとことが太字'); if (fw('#main .adv1-t') > 400) bad.push('小見出しが太字');
    const bg = (t) => { const x = String(t).replace(/[、。・\s「」（）()0-9.]/g, ''), o = new Set(); for (let i = 0; i < x.length - 1; i++) o.add(x.slice(i, i + 2)); return o; };
    document.querySelectorAll('#main .ct2-c').forEach((cd) => { const ts = [...cd.querySelectorAll('.ct2-i > b')].map((b) => bg(b.textContent)); cd.querySelectorAll('.adv-box.good .adv-c').forEach((b) => { const A = bg(b.textContent.replace('›', '')); ts.forEach((B) => { let k = 0; A.forEach((y) => { if (B.has(y)) k++; }); if (k / Math.max(1, Math.min(A.size, B.size)) >= 0.5) bad.push('見出しと似たチップ ' + b.textContent); }); }); });
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 いろいろな肌質・悩みでケア管理を確かめる：登録した物を黙って消さない・脂性肌に重いクリームをすすめない・角質ケアの成分は1か所だけ・敏感肌に刺激の強い物を使わない・薬と重なる物を同じ時間に使わない
  check('いろいろな肌質・悩みで、ケアの提案が正しい', await ev(async () => {
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    const PER = [
      {n: '乾燥敏感', a: {tight: 'yes', oilDay: 'little', sens: 'yes', red: 'often'}, ck: ['dry', 'sensitive', 'redness'], pr: [['化粧水', '化粧水・トナー', '水、グリセリン、エタノール、香料'], ['レチノール美容液', '美容液・アンプル', '水、レチノール', '夜'], ['AHA化粧水', '化粧水・トナー', '水、グリコール酸', '夜'], ['乳液', '乳液', '水、セラミドNP']], lg: {redness: 3, dryness: 4}},
      {n: '脂性ニキビ', a: {tight: 'no', oilDay: 'much', tz: 'bothOily', acne: 'often', pore: 'yes'}, ck: ['acne', 'oily', 'pore'], pr: [['BHA化粧水', '化粧水・トナー', '水、サリチル酸'], ['美容液', '美容液・アンプル', '水、ナイアシンアミド'], ['クリーム', 'クリーム', 'ワセリン、ミネラルオイル']], lg: {acneCount: 4, acneTypes: ['赤ニキビ'], oil: 4}},
      {n: 'シミしわ', a: {tight: 'no', oilDay: 'normal'}, ck: ['spot', 'aging'], pr: [['ビタミンC美容液', '美容液・アンプル', '水、アスコルビン酸'], ['レチノール美容液', '美容液・アンプル', '水、レチノール', '夜'], ['化粧水', '化粧水・トナー', '水、グリセリン'], ['日焼け止め', '日焼け止め', '酸化亜鉛', '朝']], lg: {}},
      {n: 'ニキビ処方', a: {oilDay: 'tzone', acne: 'often'}, ck: ['acne'], pr: [['ディフェリンゲル0.1%', '皮膚科の塗り薬', 'アダパレン', '夜'], ['AHA化粧水', '化粧水・トナー', '水、グリコール酸', '夜'], ['化粧水', '化粧水・トナー', '水、グリセリン'], ['レチノール美容液', '美容液・アンプル', '水、レチノール', '夜']], lg: {acneCount: 3, acneTypes: ['白ニキビ']}},
      {n: 'くま', a: {oilDay: 'normal'}, ck: ['darkcircle', 'puffy'], pr: [['化粧水', '化粧水・トナー', '水、グリセリン'], ['アイクリーム', 'その他', '水、カフェイン', '夜']], lg: {}}];
    const EX = /サリチル酸|BHA|AHA|グリコール酸|乳酸|ピーリング/;
    for (const per of PER) { let i = 0;
      state.myProducts = per.pr.map(([name, cat, ing, tm]) => ({id: 'q' + (i++), demo: false, purchases: [], catalogId: null, name, brand: cat === '皮膚科の塗り薬' ? '処方薬' : 'テスト', category: cat, purposes: [], ingredients: ing, timing: tm || '朝・夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}));
      state.skinLogs = [0, 2, 4].map((k) => Object.assign({id: 'pl' + k, date: addDays(d, -k), condition: 3, acneCount: 0, usedProducts: [], memo: '', photo: ''}, per.lg)); state.lifeLogs = [];
      state.settings.diag = {a: per.a, r: diagCompute(per.a, per.ck)}; state.settings.concernKeys = per.ck; state.weather[d] = {hum: 45, uv: 4, tmin: 8, tmax: 16}; state = normalize(JSON.parse(JSON.stringify(state)));
      for (const dd of ['A', 'B']) for (const sl of ['am', 'pm']) { const keepAD = altDay; window.altDay = () => dd; const P = rtPlan(sl); window.altDay = keepAD; const used = P.steps.flatMap((z) => z.prods.map((x) => x.p)), txt = P.steps.map((z) => z.today.map((t) => t.t).join(' ')).join(' '); /* 交互に使う日のどちらでも */
        // 登録した物は、使う・お休み（理由つき）・控える のどれかに必ず出る
        state.myProducts.filter((p) => (sl === 'am' ? /朝/ : /夜/).test(p.timing)).forEach((p) => { const shown = used.some((q) => q.id === p.id) || P.rested.has(p.id) || P.steps.some((z) => (z.avoidOwn || []).some((a) => a.p.id === p.id)) || txt.includes(prodIngLabel(p)); if (!shown) bad.push(per.n + ' ' + sl + ' 黙って消えた ' + p.name); });
        if (per.n === '脂性ニキビ' && P.steps.some((z) => /クリーム/.test(z.name) || z.today.some((t) => /クリームを少し重ね|クリームでふた/.test(t.t)))) bad.push(per.n + ' ' + sl + ' 重いクリーム');
        const ownEx = used.some((p) => p.category !== '皮膚科の塗り薬' && EX.test(p.ingredients + p.name)), nEx = P.steps.reduce((a, z) => a + (z.good || []).filter((g) => EX.test(chipText(g))).length, 0);
        if (nEx > (ownEx ? 0 : 1)) bad.push(per.n + ' ' + sl + ' 角質ケア' + nEx);
        if (per.n === '乾燥敏感' && used.some((p) => /レチノール|グリコール酸/.test(p.ingredients))) bad.push(per.n + ' ' + sl + ' 刺激の強い物を使う');
        if (per.n === 'ニキビ処方' && sl === 'pm' && used.some((p) => p.category !== '皮膚科の塗り薬' && /レチノール|グリコール酸/.test(p.ingredients))) bad.push(per.n + ' 薬と重なる物');
        if (per.n === 'ニキビ処方' && sl === 'pm' && !used.some((p) => p.name === '化粧水')) bad.push(per.n + ' 使える化粧水を休ませた');
        if (per.n === 'シミしわ' && sl === 'pm' && !used.some((p) => /レチノール/.test(p.ingredients))) bad.push(per.n + ' 夜にレチノールを使わない');
        if (per.n === 'くま' && !P.steps.some((z) => z.k === 'eye')) bad.push(per.n + ' 目元ケアがない'); }
      if (per.n === '脂性ニキビ' && !/ニキビ/.test(careTodayData().lead.split('。')[1] || '')) bad.push(per.n + ' ひとことがニキビでない'); }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 妊娠中・授乳中：レチノールなどをすすめない・使わない（妊娠中はアダパレンの薬も手順に入れず、医師に相談）。男性は対象外。敏感肌にメントールの物を使わない
  check('妊娠中・授乳中はレチノールなどを使わない・敏感肌にメントールを使わない', await ev(async () => {
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    const run = (g, a, ck, pr) => { let i = 0; state.settings.gender = g; state.myProducts = pr.map(([name, cat, ing, tm]) => ({id: 'g' + (i++), demo: false, purchases: [], catalogId: null, name, brand: cat === '皮膚科の塗り薬' ? '処方薬' : 'テスト', category: cat, purposes: [], ingredients: ing, timing: tm || '朝・夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}));
      state.skinLogs = [{id: 'gl', date: d, condition: 3, acneCount: 2, acneTypes: ['白ニキビ'], usedProducts: [], memo: '', photo: ''}]; state.lifeLogs = []; state.settings.diag = {a, r: diagCompute(a, ck)}; state.settings.concernKeys = ck; state = normalize(JSON.parse(JSON.stringify(state)));
      return ['am', 'pm'].map((sl) => rtPlan(sl)); };
    const PR = [['ディフェリンゲル0.1%', '皮膚科の塗り薬', 'アダパレン', '夜'], ['レチノール美容液', '美容液・アンプル', '水、レチノール', '夜'], ['化粧水', '化粧水・トナー', '水、グリセリン']];
    for (const [g, pg] of [['女性', 'preg'], ['', 'nursing'], ['男性', 'preg']]) { const on = g !== '男性', Ps = run(g, {oilDay: 'normal', acne: 'often', preg: pg}, ['acne', 'aging'], on ? PR : PR.slice(1)); /* 男性はアダパレンなし（薬と重なって休むのは正しいため） */
      const used = Ps.flatMap((P) => P.steps.flatMap((z) => z.prods.map((x) => x.p.name))), goods = Ps.flatMap((P) => P.steps.flatMap((z) => z.good.map(chipText))), notes = Ps.flatMap((P) => P.steps.flatMap((z) => z.today.map((t) => t.t)));
      if (on && used.includes('レチノール美容液')) bad.push(g + pg + ' レチノールを使う'); if (on && goods.some((w) => /レチノ/.test(w))) bad.push(g + pg + ' レチノールをすすめる'); if (on && notes.some((t) => /レチノール：光で/.test(t))) bad.push(g + pg + ' 休む物の使い方');
      if (pg === 'preg' && on && used.includes('ディフェリンゲル0.1%')) bad.push('妊娠中にアダパレン'); if (pg === 'preg' && on && !Ps[1].tips.some((t) => /妊娠中は使えない/.test(t))) bad.push('妊娠中の薬の説明なし');
      if (!on && !used.includes('レチノール美容液')) bad.push('男性なのにレチノールを休む'); }
    { const Ps = run('', {sens: 'yes', red: 'often'}, ['sensitive', 'redness'], [['化粧水', '化粧水・トナー', '水、グリセリン、メントール']]); if (Ps.some((P) => P.steps.some((z) => z.prods.some((x) => /メントール/.test(x.p.ingredients))))) bad.push('敏感肌にメントール'); }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render();
    { const w = (ms) => new Promise((r) => setTimeout(r, ms)); const keepS = JSON.stringify(state.settings); state.settings.gender = '女性'; openSetupWizard('first'); await w(300); const pc = document.getElementById('sw-s-preg');
      if (!pc || pc.hidden) bad.push('診断に妊娠の質問がない'); else { document.querySelector('#sw-s-gender [data-v="男性"]').click(); await w(100); if (!pc.hidden) bad.push('男性にも妊娠の質問'); document.querySelector('#sw-s-gender [data-v="女性"]').click(); await w(100);
        pc.querySelector('[data-v="nursing"]').click(); await w(100); document.querySelector('#sw-s-skin [data-v="yes"]') && 0; ['tight', 'oilDay', 'acne'].forEach((k) => { const o = document.querySelector('#sw-s-skin [data-sw="' + k + '"]'); if (o) o.click(); }); document.querySelector('#modal-root [data-action="setup-finish"]').click(); await w(400);
        if (((state.settings.diag || {}).a || {}).preg !== 'nursing') bad.push('妊娠の答えが保存されない ' + JSON.stringify((state.settings.diag || {}).a)); }
      try { closeModal(true); } catch (e) {} state.settings = Object.assign(state.settings, JSON.parse(keepS)); }
    if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 ケアは「肌質診断＋今日の肌の記録」で決める（古い記録で決めつけない）。睡眠・食事・運動は今日の記録だけで判断し、記録がない物は記録をお願いするだけ（憶測しない）
  check('今日の記録でケアを決める・生活は記録がないと決めつけない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    const setUp = (a, ck, logs, life) => { state.myProducts = []; state.skinLogs = logs.map(([k, o], i) => Object.assign({id: 'dl' + i, date: addDays(d, -k), condition: 3, acneCount: 0, usedProducts: [], memo: '', photo: ''}, o));
      state.lifeLogs = []; if (life) { const l = blankLife(d); if (life.bed) { l.bed = life.bed; l.wake = life.wake; } l.foods = (life.foods || []).map((f) => Object.assign({qty: 1}, f)); if (life.ex) l.exercise = [{type: EX_TYPES[0], minutes: life.ex}]; state.lifeLogs = [l]; }
      state.settings.diag = {a, r: diagCompute(a, ck)}; state.settings.concernKeys = ck; state.weather[d] = {hum: 55, uv: 4, tmin: 12, tmax: 20}; state = normalize(JSON.parse(JSON.stringify(state))); return careTodayData(); };
    const sens = {sens: 'yes', red: 'often'};
    if (setUp(sens, ['sensitive'], [[1, {redness: 4}], [0, {redness: 0}]]).calm) bad.push('昨日の赤みで今日を決めた');
    if (!setUp(sens, ['sensitive'], [[2, {redness: 4}]]).calm) bad.push('2日前の記録を使わない');
    if (setUp(sens, ['sensitive'], [[5, {redness: 4}]]).calm) bad.push('5日前の記録で決めた');
    if (['am', 'pm'].some((sl) => rtPlan(sl).steps.some((z) => z.good.some((g) => /アゼライン酸|レチノール|AHA|サリチル/.test(chipText(g)))))) bad.push('敏感肌に刺激の強い成分');
    { const D = setUp({oilDay: 'normal', acne: 'often'}, ['acne'], [[0, {acneCount: 2, acneTypes: ['赤ニキビ']}]], null); const life = D.items.filter((x) => x.when === '生活');
      if (life.some((x) => !/を記録する$/.test(x.title))) bad.push('記録なしで生活を決めつけ ' + life.map((x) => x.title)); if (!/ニキビ/.test(D.lead)) bad.push('今日のニキビがひとことにない');
      ui.homeTab = 'care'; location.hash = '#/home'; render(); await w(300); document.querySelectorAll('#main .ct2-c').forEach((c) => { if (/運動|睡眠/.test(c.querySelector('.ct2-sh').textContent) && c.querySelector('.adv-box')) bad.push('記録なしでチップ ' + c.querySelector('.ct2-sh').textContent); }); }
    { const D = setUp({oilDay: 'normal', acne: 'often'}, ['acne'], [[0, {acneCount: 1}]], {bed: '02:00', wake: '07:00', foods: [{meal: 'breakfast', name: '食パン'}, {meal: 'lunch', name: 'ラーメン'}, {meal: 'snack', name: 'チョコレート'}], ex: 30}); const T = D.items.map((x) => x.title + ' ' + x.why).join(' / ');
      if (!/昨夜の睡眠は5時間/.test(T)) bad.push('昨夜の睡眠を見ていない'); if (!/チョコレート/.test(T)) bad.push('今日の間食を見ていない'); if (/たんぱく質は0g/.test(T)) bad.push('栄養の数字がないのに量を決めつけ'); if (!/今日は30分運動/.test(T)) bad.push('今日の運動を見ていない');
      ui.homeTab = 'care'; render(); await w(300); const ex = [...document.querySelectorAll('#main .ct2-c')].find((c) => /運動/.test(c.querySelector('.ct2-sh').textContent)); if (ex) { const alts = new Set(LIFE_AVOID.flatMap((r) => r[4] || []).concat(Object.values(LIFE_ALT_DEF))); /* 2026-11-20 気をつけることの「代わりにこうする」は出してよい */ ex.querySelectorAll('.adv-box.good .adv-c').forEach((b) => { const v = b.textContent.replace('›', '').trim(); if (!alts.has(v)) bad.push('運動した日に運動のおすすめ ' + v); }); } }
    { const D = setUp({oilDay: 'normal'}, [], [[0, {}]], {foods: [{meal: 'breakfast', name: '納豆ごはん', kcal: 400, p: 15}]}); if (D.items.some((x) => /今の食事を続ける/.test(x.title))) bad.push('1回分で食事を判断'); }
    setUp({tight: 'yes', oilDay: 'little'}, ['dry'], [[0, {oil: 4, dryness: 0}]]); if (rtPlan('pm').steps.some((z) => /クリーム/.test(z.name))) bad.push('今日テカっているのにクリーム');
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 AIのおすすめをルールで確かめる（控えたい物・妊娠中に控えたい食べ物はおすすめにしない）。成分がわからない物は「合わない」と決めつけない。分析ページの食事は、食事の記録があるときだけ
  check('AIのおすすめを確かめる・成分不明の物を決めつけない・分析の食事は記録があるときだけ', await ev(async () => {
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    const txt = (h) => h.replace(/<[^>]+>/g, ' ');
    if (/菓子パン|ジュース|ラーメン/.test(txt(advChips({area: '食事', good: ['納豆', '菓子パン', 'オレンジジュース', 'ラーメン'], avoid: ['揚げ物']})).split('控えたいもの')[0])) bad.push('控えたい食べ物をおすすめ');
    if (/寝る前のスマホ/.test(txt(advChips({area: '睡眠', good: ['寝る前のスマホ', '同じ時刻に起きる'], avoid: ['夜のカフェイン']})).split('控えたいこと')[0])) bad.push('控えたい行動をおすすめ');
    state.settings.diag = {a: {preg: 'preg', oilDay: 'normal'}, r: diagCompute({preg: 'preg'}, [])}; state.settings.gender = '女性';
    if (/まぐろ|レバー/.test(txt(advChips({area: '食事', good: ['まぐろ', 'レバー', '卵'], avoid: ['菓子パン']})))) bad.push('妊娠中にまぐろ・レバー');
    state.settings.diag = {a: {oilDay: 'normal'}, r: diagCompute({oilDay: 'normal'}, ['acne'])}; state.settings.concernKeys = ['acne'];
    state.myProducts = [{id: 'u1', demo: false, purchases: [], catalogId: null, name: 'ふしぎな美容液', brand: 'テスト', category: '美容液・アンプル', purposes: [], ingredients: '', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 0, order: null}];
    state.skinLogs = [{id: 'u2', date: d, condition: 3, acneCount: 2, usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
    const P = rtPlan('pm'); if (P.rested.has('u1') && /合う成分が入っていない/.test(P.rested.get('u1'))) bad.push('成分不明を合わないと決めつけ'); if (!P.steps.some((z) => z.today.some((t) => /成分が登録されていない/.test(t.t)))) bad.push('成分不明の説明なし');
    state.lifeLogs = []; location.hash = '#/mycare'; render(); await new Promise((r) => setTimeout(r, 300)); if ([...document.querySelectorAll('#main .pc-blk small')].some((e) => e.textContent === '食事')) bad.push('食事の記録なしで食事のアドバイス');
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 献立のAIを、開くたびに作り直さない（サーバーが返さない storeNote を条件にしていて、毎回AIを使い1日の上限まで使っていた）
  check('献立のAIは、記録・時間帯が同じなら作り直さない', await ev(async () => {
    const keepCV = callVision, keepPrem = window.isPremium; window.isPremium = () => true; let n = 0;
    callVision = async () => { n++; return {result: {meals: [{meal: '昼', when: '今日', plans: [{label: '和食', dishes: [{name: '焼き魚', role: '主菜'}]}]}], note: ''}}; };
    localStorage.removeItem(MENU_KEY); await runMenu(false); await runMenu(false); await runMenu(false); const ok = n === 1;
    callVision = keepCV; window.isPremium = keepPrem; localStorage.removeItem(MENU_KEY); if (!ok) console.log('  AI回数 ' + n); return ok; }));
  // 2026-11-19 食べ物の写真の読み取り：撮った時刻で食事を決める・結果を出す・チェックした物を栄養つきで保存・数字がない物は追加できない・読み取れない／通信エラーのときは案内を出す
  for (const [k, res] of [['ok', {items: [{kind: 'dish', name: '親子丼', amount: '1杯', basis: '推定', kcal: 680, p: 28, f: 18, c: 95, salt: 3.2, veg: 40}, {kind: 'product', name: '午後の紅茶 ミルクティー', basis: '表示', kcal: 185, p: 5, f: 3.5, c: 33.5, salt: 0.2, veg: 0}, {kind: 'dish', name: 'みそ汁', basis: '確認できません', kcal: null}]}], ['empty', {items: [], note: '食べ物が写っていません'}], ['error', null]]) {
    await ev(([res]) => { window.__keepCV = window.__keepCV || callVision; window.__keepPrem = window.__keepPrem || window.isPremium; window.isPremium = () => true; callVision = async () => { if (!res) throw new Error('通信できませんでした。'); return {result: JSON.parse(JSON.stringify(res))}; }; state.lifeLogs = []; actions['life-part']('meal'); }, [res]);
    await p.waitForTimeout(400); const inp = await p.$('#modal-root input[data-mphoto="auto"]'); let info = 'no input', ok = false;
    if (inp) { await inp.setInputFiles(__dirname + '/food_test.jpg'); await p.waitForTimeout(1200);
      const r = await ev(() => { const n = document.querySelector('#modal-root [data-pinfo] .notice'), c = document.querySelector('#modal-root input[name="meal-slot"]:checked'); return {t: n ? n.innerText : '', slot: c ? c.value : '', dis: [...document.querySelectorAll('#modal-root [data-aipick]')].map((x) => x.disabled), lunchPhoto: !!document.querySelector('#modal-root .meal-block[data-meal="lunch"] img')}; });
      if (k === 'ok') { const add = await p.$('#modal-root [data-aiadd]'); if (add) { await add.click(); await p.waitForTimeout(200); await ev(() => document.getElementById('life-form').requestSubmit()); await p.waitForTimeout(400); }
        const f = await ev(() => { const l = getLife(todayStr()); return l ? l.foods.map((x) => [x.meal, x.name, x.kcal, x.p, x.salt, x.basis]) : []; });
        ok = /親子丼/.test(r.t) && /午後の紅茶/.test(r.t) && /確認できません/.test(r.t) && f.length === 2 && f.every((x) => x[0] === 'lunch' && x[2] > 0) && !f.some((x) => x[1] === 'みそ汁'); info = JSON.stringify([r, f]); }
      else if (k === 'empty') { ok = /読み.?取れませんでした/.test(r.t.replace(/\u200b/g, '')) && /写っていません/.test(r.t); info = r.t; }
      else { ok = /通信できませんでした/.test(r.t) && !!(await p.$('#modal-root [data-premium]:not([disabled])')); info = r.t; } }
    await ev(() => { try { closeModal(true); } catch (e) {} callVision = window.__keepCV; window.isPremium = window.__keepPrem; });
    check(`食べ物の写真の読み取り（${k}）`, ok, info); }
  // 2026-11-19 サーバー（vision）の食事の読み取り：白いご飯・果物の塩分0で見直しをしない（時間がかかっていた）・形の指定なしの答え（配列など）も読める・店名を決めつけた説明を出さない
  { const V = require('fs').readFileSync(require('path').join(HC, '貼り付け用/5_関数_vision.txt'), 'utf8'); let ok = true, info = '';
    try { const fx = new Function(V.match(/const mealNeedsFix = \(x\) => \{[\s\S]*?\n\};/)[0].replace('const mealNeedsFix =', 'return') )();
      const rice = fx({kind: 'dish', name: '白ご飯', kcal: 252, p: 3.8, f: 0.5, c: 55.7, salt: 0}), don = fx({kind: 'dish', name: '親子丼', kcal: 680, p: 28, f: 18, c: 95, salt: 0});
      if (rice || !don) { ok = false; info += ' 見直しの条件'; }
      if (!/Array\.isArray\(r\) \? r : Array\.isArray\(r\.items\)/.test(V)) { ok = false; info += ' 配列の答え'; }
      if (!/想定\|仮定/.test(V) || !/チェーン店の物に見えても "dish"/.test(V)) { ok = false; info += ' 店名の決めつけ'; }
      if (!/NO_MEDIA/.test(V) || !/mode === 'meal' \? 20000/.test(V)) { ok = false; info += ' モデルの設定'; }
    } catch (e) { ok = false; info = String(e); }
    check('サーバーの食事の読み取り：見直し・答えの形・決めつけ', ok, info); }
  // 2026-11-20 通常⇄時短は、3D⇄写真と同じ見た目（白いつまみ・文字はどちらも同じ色・太さ）。グラデーションにはしない。高さは細め
  check('通常⇄時短・3D⇄写真：同じ見た目・文字の色と太さが同じ', await ev(async () => { const keepP = window.isPremium; window.isPremium = () => true; const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), cs = (e) => (({color, fontWeight, backgroundColor, backgroundImage}) => ({color, fontWeight, backgroundColor, backgroundImage}))(getComputedStyle(e));
    rtSettings().mode = 'normal'; location.hash = '#/routine'; render(); await w(300);
    const hh = document.querySelector('.rt-qsw').getBoundingClientRect().height; if (hh > 40 || hh < 32) bad.push('高さ ' + hh);
    const snap = () => ({box: cs(document.querySelector('.rt-qsw')), ind: cs(document.querySelector('.rt-qsw .sc-ind')), tabs: [...document.querySelectorAll('.rt-qsw .sc-tab')].map(cs)});
    const A = snap(); document.querySelector('.rt-qsw [data-id="quick"]').click(); await w(500); const B = snap();
    ui.logTab = 'list'; location.hash = '#/log'; render(); await w(300); const v = document.querySelector('.ld-vsw');
    if (v) { const sp = [...v.querySelectorAll('span')].map(cs), pill = getComputedStyle(v, '::before').backgroundColor;
      if (sp[0].color !== sp[1].color || sp[0].fontWeight !== sp[1].fontWeight) bad.push('3D⇄写真の文字がそろっていない');
      for (const S of [A, B]) { if (S.tabs.some((t) => t.color !== sp[0].color || t.fontWeight !== sp[0].fontWeight)) bad.push('通常⇄時短の文字が3D⇄写真と違う ' + JSON.stringify(S.tabs.map((t) => t.color + ' ' + t.fontWeight)));
        if (S.ind.backgroundColor !== pill || S.ind.backgroundImage !== 'none') bad.push('つまみの色が違う ' + S.ind.backgroundColor + ' / ' + pill); /* 2026-11-20 時短の黄色は戻した（どちらも白いつまみ） */
        if (S.box.backgroundColor !== cs(v).backgroundColor) bad.push('外側の色が違う'); } } else bad.push('3D⇄写真がない');
    window.isPremium = keepP; rtSettings().mode = 'normal'; if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 ①3D⇄写真：iPhoneで1回押すと2回切り替わる（行って戻る）ことがあった ②「合わなかった記録」が枠からはみ出ない ③時短のときだけつまみが黄色 ④運動の記録：入力欄の位置がそろう・「昨日と同じ」は小さく
  check('3D⇄写真が1回で1回だけ切り替わる・合わなかった記録のボタンがはみ出ない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepP = window.isPremium, d = todayStr(); window.isPremium = () => true;
    state.skinLogs = [{id: 'vw1', date: d, condition: 3, acneCount: 1, acneTypes: [], usedProducts: [], memo: '', photo: ''}]; state.lifeLogs = [{id: 'y1', date: addDays(d, -1), exercise: [{type: 'ウォーキング', minutes: 20}]}]; state = normalize(JSON.parse(JSON.stringify(state)));
    ui.logTab = 'list'; ui.ldView = '3d'; location.hash = '#/log'; render(); await w(300);
    const v = document.querySelector('.ld-vsw'); v.click(); v.click(); await w(50); if (ui.ldView !== 'photo') bad.push('2回押されたことになった'); await w(450); v.click(); await w(50); if (ui.ldView !== '3d') bad.push('間をあけて押すと戻る'); await w(450);
    const sw = document.querySelector('.ld-vsw .hap-in'); if (sw) { sw.click(); await w(30); v.click(); await w(30); if (ui.ldView !== 'photo') bad.push('スイッチと下のボタンの両方で2回'); } ui.ldView = '3d';
    /* ② 狭い画面でもはみ出さない */
    state.myProducts = [{id: 'ngp', name: 'テスト化粧水', brand: 'テスト', category: '化粧水', status: '使用中', startDate: d, purposes: [], ingredients: '', ng: {date: d, sym: ['赤み']}}]; state = normalize(JSON.parse(JSON.stringify(state)));
    location.hash = '#/my/ngp'; render(); await w(300);
    document.querySelectorAll('.my-acts .btn, .page-actions .btn').forEach((b) => { if (b.scrollWidth > b.clientWidth + 1) bad.push('はみ出し ' + b.textContent.trim()); const r = b.getBoundingClientRect(), pr = b.closest('.card').getBoundingClientRect(); if (r.right > pr.right + 0.5) bad.push('枠の外 ' + b.textContent.trim()); });
    if (!document.querySelector('[data-action="ng-open"]')) bad.push('合わなかった記録のボタンがない');
    /* ③④ 時短の黄色・運動の記録の画面の変更は、2026-11-20 に元に戻した */
    closeModal(true); state = normalize(JSON.parse(keep)); window.isPremium = keepP; render();
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 3D⇄写真の白いつまみが、iPhoneで下にずれていた：つまみと文字の行がぴったり重なり、上下の余白が同じ（文字の大きさが変わっても高さは数字で決まっている）
  check('3D⇄写真のつまみが上下にずれない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr();
    state.skinLogs = [{id: 'pv1', date: d, condition: 3, acneCount: 1, acneTypes: [], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
    ui.logTab = 'list'; location.hash = '#/log'; render(); await w(300);
    for (const fs of ['', '13px']) { const v = document.querySelector('.ld-vsw'); v.style.fontSize = fs; v.querySelectorAll('span').forEach((x) => { x.style.fontSize = fs; x.style.lineHeight = fs ? '1.9' : ''; }); await w(30);
      const cs = getComputedStyle(v), bc = getComputedStyle(v, '::before'), bt = parseFloat(cs.borderTopWidth), H = v.getBoundingClientRect().height, top = parseFloat(bc.top), h = parseFloat(bc.height), under = H - 2 * bt - top - h;
      if (Math.abs(top - under) > 0.5) bad.push((fs || '普通') + ' 上' + top + ' 下' + under.toFixed(1));
      v.querySelectorAll('span').forEach((x) => { const r = x.getBoundingClientRect(), b = v.getBoundingClientRect(); if (Math.abs((r.top - b.top - bt) - top) > 0.5 || Math.abs(r.height - h) > 0.5) bad.push('文字の行とつまみがずれている'); });
      v.style.fontSize = ''; v.querySelectorAll('span').forEach((x) => { x.style.fontSize = ''; x.style.lineHeight = ''; }); }
    state = normalize(JSON.parse(keep)); render(); if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 ①料理名のヒントは、検索の欄に見えないように、押したときだけ出す ②日焼け止めのSPF・PAは、商品名に書いていなくても調べて、どこでも出す（Myアイテム・詳細・検索・商品ページ・ケア管理）
  check('料理名のヒントは押したときだけ・日焼け止めのSPF・PAをどこでも調べて出す', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepP = window.isPremium, keepF = window.fetch, d = todayStr(); window.isPremium = () => true;
    location.hash = '#/home'; render(); await w(100); actions['life-part']('meal'); await w(400);
    const h = document.getElementById('meal-hint'), hb = document.querySelector('[data-mhint]');
    if (!h || !hb) bad.push('ヒントがない'); else { if (h.getBoundingClientRect().height > 0) bad.push('ヒントの欄がはじめから出ている'); if (hb.getBoundingClientRect().height > 30) bad.push('ヒントのボタンが大きい'); hb.click(); await w(50); if (!(h.getBoundingClientRect().height > 0)) bad.push('押しても出ない'); }
    closeModal(true); await w(100);
    const asked = []; UV_KNOWN.clear(); try { localStorage.removeItem('nk_uv_v1'); } catch (e) {}
    window.fetch = async (u, o) => { if (/functions\/v1\/prices/.test(String(u)) && /uvinfo/.test((o || {}).body || '')) { const b = JSON.parse(o.body), uv = {}; b.names.forEach((x) => { asked.push(x.name); uv[x.name] = /アネッサ/.test(x.name) ? 'SPF50+・PA++++' : /ナゾ/.test(x.name) ? '' : 'SPF30・PA+++'; }); return new Response(JSON.stringify({uv})); } return keepF(u, o); };
    state.myProducts = [{id: 'sun1', name: 'パーフェクトUV スキンケアミルク', brand: 'アネッサ', category: '日焼け止め', status: '使用中', startDate: d, purposes: [], ingredients: ''}, {id: 'sun2', name: 'ナゾの日焼け止め', brand: '', category: '日焼け止め', status: '使用中', startDate: d, purposes: [], ingredients: ''}, {id: 'sun3', name: 'UVミルク SPF50+ PA++++', brand: 'テスト', category: '日焼け止め', status: '使用中', startDate: d, purposes: [], ingredients: ''}];
    state = normalize(JSON.parse(JSON.stringify(state))); ui.myKind = 'cos'; location.hash = '#/my'; render(); await w(900);
    const chips = [...document.querySelectorAll('.uv-chip')].map((c) => c.textContent);
    if (!chips.includes('SPF50+・PA++++')) bad.push('調べた値が一覧に出ない ' + chips.join('/') + ' 聞いた:' + asked.length + ' ' + (location.hash) + ' ' + ((document.querySelector('#main') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 160));
    if (chips.some((c) => /調べ中/.test(c))) bad.push('調べ中のまま');
    if (asked.some((n) => /UVミルク SPF50\+ PA\+\+\+\+/.test(n))) bad.push('名前に書いてある物まで調べた');
    if (!/アネッサ/.test(localStorage.getItem('nk_uv_v1') || '')) bad.push('端末に覚えていない');
    location.hash = '#/my/sun1'; render(); await w(700); { const tx = ((document.querySelector('#main') || {}).textContent || '') + ((document.querySelector('#modal-root') || {}).textContent || ''); if (!/SPF・PA[\s\S]*SPF50\+・PA\+\+\+\+/.test(tx.replace(/\u200b/g, ''))) bad.push('詳細にSPF・PAがない ' + location.hash + ' ' + tx.replace(/\s+/g, ' ').slice(0, 200)); } try { closeModal(true); } catch (e) {} await w(200);
    const n0 = asked.length; ui.myKind = 'cos'; location.hash = '#/my'; render(); await w(600); if (asked.length !== n0 && asked.slice(n0).some((n) => /アネッサ/.test(n))) bad.push('覚えた物をもう一度調べた');
    ui.shopItem = {name: 'アネッサ パーフェクトUV スキンケアミルク 60mL', price: 3000, site: '楽天市場', url: 'https://example.com'}; location.hash = '#/shop'; render(); await w(600); if (!/SPF50\+・PA\+\+\+\+/.test(document.querySelector('#main').textContent.replace(/\u200b/g, ''))) bad.push('商品ページにSPF・PAがない');
    window.fetch = keepF; try { closeModal(true); } catch (e) {} state = normalize(JSON.parse(keep)); window.isPremium = keepP; location.hash = '#/home'; render(); await w(300);
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 いろいろな人になりきって見つけた不具合（tests/persona.js でも毎回確かめる）
  check('種類の書き方・食べ物の検索・ダークの色・肌の傾き', await ev(async () => { const bad = [];
    [['化粧水', 'x', '化粧水・トナー'], ['美容液', 'x', '美容液・アンプル'], ['UV', 'x', '日焼け止め'], ['', '薬用 化粧水', '化粧水・トナー'], ['その他', 'クリーム', 'その他'], ['乳液', 'x', '乳液'], ['へんな種類', 'なにか', 'その他']].forEach(([c, n, want]) => { const g = catFix(c, n); if (g !== want) bad.push(`種類 ${c}/${n}→${g}`); });
    const n0 = normalize({myProducts: [{id: 'q1', name: '敏感肌用 化粧水', category: '化粧水', startDate: todayStr(), status: '使用中'}]}); if (n0.myProducts[0].category !== '化粧水・トナー') bad.push('normalize で化粧水がその他になる');
    for (const f of ['唐揚げ', 'からあげ', 'カップラーメン', 'とんかつ', '鮭の塩焼き', '味噌汁', 'ポテサラ']) if (!FOOD_DB.some((x) => (x.n + ' ' + (x.a || '')).includes(f))) bad.push('食べ物がない ' + f);
    if (!/--green-l:/.test([...document.styleSheets].map((x) => { try { return [...x.cssRules].map((r) => r.cssText).join(''); } catch (e) { return ''; } }).join(''))) bad.push('--green-l が定義されていない');
    if (COND_FG[2] === '#fff') bad.push('オレンジの上が白い文字');
    const keepD = state.settings.diag; state.settings.diag = {a: {acne: 'rare', oilDay: 'tzone'}, r: {main: 'combo', priority: ['aging']}}; const keepC = state.settings.concernKeys; state.settings.concernKeys = ['aging'];
    try { if (skinLean(null).acne) bad.push('ニキビがほとんどできない混合肌を「ニキビ向け」にした'); } catch (e) { bad.push('skinLean ' + e); }
    state.settings.diag = keepD; state.settings.concernKeys = keepC;
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 ①塗り薬の検索の下の説明は出さない ②塗り薬の検索に、美容家電などの関係ない商品を出さない・よく処方される塗り薬を入れる ③化粧品を追加：検索がいちばん上・検索の中にカメラ・ブランド名と商品名の両方で探せる ④追加のボタンは押しても沈まない ⑤食事のおすすめは記録がなくても出る
  check('塗り薬・化粧品の追加画面と、食事のおすすめ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keepF = findFetch, keepP = window.isPremium, keep = JSON.stringify(state);
    openRxSheet(); await w(200); const rb = document.querySelector('#modal-root .modal-body'); if (/最初から入っています/.test(rb.textContent)) bad.push('塗り薬の説明が残っている');
    for (const n of ['リンデロンDPクリーム0.064%', 'クレナフィン爪外用液10%', 'ラミシール液1%', 'ハイドロキノンクリーム（院内製剤）', 'アラセナAクリーム3%']) if (!RX_DRUGS.some((d) => d[1] === n)) bad.push('塗り薬がない ' + n);
    findFetch = async () => [{name: 'パナソニック 光美容器 スムースエピ ES-WG0B', site: 'Yahoo!', price: 119889, url: 'https://e.com/1'}, {name: 'リファエピ ゴー クール 美肌ケア用アタッチメント', site: 'Yahoo!', price: 5500, url: 'https://e.com/2'}, {name: '【第2類医薬品】エピ軟膏 20g', site: '楽天', price: 900, url: 'https://e.com/3'}];
    const rq = document.getElementById('rx-q'); rq.value = 'エピ'; rq.dispatchEvent(new Event('input', {bubbles: true})); await w(900);
    const nm = [...document.querySelectorAll('#find-list .net-item b')].map((b) => b.textContent);
    if (nm.some((t) => /美容器|アタッチメント/.test(t))) bad.push('塗り薬の検索に美容家電が出る ' + nm.join('/')); if (!nm.some((t) => /軟膏/.test(t))) bad.push('市販の塗り薬が出ない');
    closeModal(true); await w(200);
    window.isPremium = () => true; openAddSheet('my'); await w(300);
    const mb = document.querySelector('#modal-root .modal-body'), q = document.getElementById('pop-q'), cam = mb && mb.querySelector('.find-cam-b');
    if (!q || !cam || !q.closest('.find-bar').contains(cam)) bad.push('検索の中にカメラのボタンがない');
    if (mb && [...mb.children].findIndex((c) => c.contains(q)) !== 0) bad.push('検索がいちばん上にない');
    if (mb && mb.querySelector('.add-opt')) bad.push('自分で入力・カメラの大きなボタンが残っている');
    if (q && cam) { const a = q.getBoundingClientRect(), b = cam.getBoundingClientRect(); if (b.right > a.right || b.left < a.left || b.top < a.top - 1 || b.bottom > a.bottom + 1) bad.push('カメラのボタンが検索の外'); }
    POPULAR = {updatedAt: '', items: [{name: 'アヌア 美容液 レチノール0.3ナイアシンリニューイングセラム 30ml 韓国コスメ 正規品', site: 'Yahoo', price: 3100, url: 'https://e.com/r2'}, {name: 'アヌア ドクダミ77 スージングトナー 250ml', brand: 'ANUA', url: 'https://e.com/a', price: 2000, rank: 1}, {name: 'キュレル 潤浸保湿 化粧水 III', url: 'https://e.com/b', price: 1800, rank: 2}]}; popPaint();
    findFetch = async (b) => [{name: 'アヌア ドクダミ77 スージングトナー 250ml', site: '楽天', price: 2000, url: 'https://e.com/a'}, {name: 'ドクダミ 化粧水 別ブランド', site: '楽天', price: 900, url: 'https://e.com/c'}];
    q.value = 'アヌア トナー'; q.dispatchEvent(new Event('input', {bubbles: true})); await w(900);
    const got = [...document.querySelectorAll('#pop-list .net-item b')].map((b) => b.textContent); if (!got.some((t) => /アヌア/.test(t)) || got.some((t) => /別ブランド/.test(t))) bad.push('ブランド名＋商品名で探せない ' + got.join('/'));
    closeModal(true); findFetch = keepF; findState = null; await w(200);
    /* ④ */ ui.myKind = 'cos'; location.hash = '#/my'; render(); await w(300); const ab = document.querySelector('.my-adds .btn'); if (ab) { const css = [...document.styleSheets].map((x) => { try { return [...x.cssRules].map((r) => r.cssText).join(''); } catch (e) { return ''; } }).join(''); if (!/\.my-adds \.btn:active[^}]*transform: none/.test(css)) bad.push('追加のボタンが押すと沈む'); } else bad.push('追加のボタンがない');
    /* ⑤ */ state.lifeLogs = []; state.skinLogs = [{id: 'm1', date: todayStr(), condition: 3, acneCount: 2, usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state))); ui.homeTab = 'care'; location.hash = '#/home'; render(); await w(400);
    const mc = [...document.querySelectorAll('#main .ct2-c')].find((c) => /食事/.test((c.querySelector('.ct2-sh') || {}).textContent || '')); if (!mc || !mc.querySelector('.adv-box.good [data-food]')) bad.push('食事の記録がないとき、おすすめの食べ物が出ない');
    state = normalize(JSON.parse(keep)); window.isPremium = keepP; render();
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 押すと縮む動き（transform）で、位置を transform で決めているボタンがずれていた（化粧品の追加のカメラ）。ボタンの位置を transform で決めない。ボタンを押した指の小さなずれで、画面が引っぱって更新のように沈まない
  check('ボタンの位置を transform で決めない・押しても画面が沈まない', await ev(async () => { const bad = new Set(), w = (ms) => new Promise((r) => setTimeout(r, ms)), keepP = window.isPremium; window.isPremium = () => true;
    const scan = (where) => document.querySelectorAll('button, a.btn, [role="button"], .btn').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width) return; const t = getComputedStyle(e).transform; if (!t || t === 'none') return; const m = new DOMMatrix(t); if (Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5) bad.add(where + ' ' + (e.className || e.tagName) + ' ' + t); });
    for (const h of ['#/home', '#/log', '#/my', '#/routine', '#/account', '#/ingredients', '#/combo']) { location.hash = h; render(); await w(250); scan(h); }
    openAddSheet('my'); await w(300); scan('化粧品を追加'); closeModal(true); await w(200); openRxSheet(); await w(200); scan('塗り薬を追加'); closeModal(true); await w(200);
    /* 指が少し動いただけ（10px）のタップでは、画面が下に動かない。大きく引っぱったときは動く */
    location.hash = '#/my'; render(); await w(300); window.scrollTo(0, 0);
    const tb = document.querySelector('.my-adds .btn'), pg = document.getElementById('page'), r = tb.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const T = (type, yy) => { const t = new Touch({identifier: 1, target: tb, clientX: x, clientY: yy}); tb.dispatchEvent(new TouchEvent(type, {touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true})); };
    T('touchstart', y); T('touchmove', y + 10); const sank = pg.style.transform; T('touchend', y + 10); await w(500);
    if (sank) bad.add('ボタンを押したときの小さな指のずれで画面が沈む ' + sank);
    T('touchstart', y); T('touchmove', y + 40); T('touchmove', y + 60); const pulled = pg.style.transform; T('touchend', y + 60); await w(600);
    if (!pulled) bad.add('大きく引っぱっても動かない');
    window.isPremium = keepP; if (bad.size) console.log('  ' + [...bad].slice(0, 6).join(' / ')); return !bad.size; }));
  // 2026-11-20 使っている人の画面で、エラーにならない表示のおかしさ（undefined・NaN・横へのはみ出し）を見つけて運営に知らせる（書いた文字は送らない）
  check('表示のおかしさを見つけて知らせる（書いた文字は送らない）', await ev(async () => { const got = [], keep = window.logError; window.logError = (m, src) => got.push(m + ' ' + src);
    location.hash = '#/home'; render(); await new Promise((r) => setTimeout(r, 200)); UI_CHK_SEEN.clear(); uiSelfCheck(); const n0 = got.length;
    const p = document.createElement('p'); p.className = 'test-x'; p.textContent = '合計 undefined 円（ひみつのメモ）'; document.getElementById('main').appendChild(p); uiSelfCheck();
    const d = document.createElement('div'); d.style.width = '2000px'; d.style.height = '1px'; d.className = 'test-wide'; document.getElementById('main').appendChild(d); uiSelfCheck();
    await new Promise((r) => setTimeout(r, 2800)); /* 2026-11-21 はみ出しは、2.5秒たってもまだはみ出しているときだけ知らせる */
    p.remove(); d.remove(); window.logError = keep;
    const ok = n0 === 0 && got.some((m) => /undefined/.test(m) && /test-x/.test(m)) && !got.some((m) => /ひみつ/.test(m)) && got.some((m) => /はみ出し/.test(m));
    if (!ok) console.log('  ' + JSON.stringify(got)); return ok; }));
  // 2026-11-20 「化粧品を追加」「塗り薬を追加」は、本当に指で押したとき（重ねたスイッチが押される）も縮まない・色が変わらない
  { const res = [];
    for (const kind of ['cos', 'rx']) {
      await ev((k) => { try { closeModal(true); } catch (e) {} ui.myKind = k; location.hash = '#/my'; render(); }, kind); await p.waitForTimeout(400);
      const el = await p.$('.my-adds .btn'); const bx = el && await el.boundingBox(); if (!bx) { res.push(kind + ' ボタンがない'); continue; }
      const before = await ev(() => { const b = document.querySelector('.my-adds .btn'); return getComputedStyle(b).backgroundColor; });
      await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.waitForTimeout(150);
      const st = await ev(() => { const b = document.querySelector('.my-adds .btn'); const o = []; for (let x = b; x && x !== document.body; x = x.parentElement) { const t = getComputedStyle(x).transform; if (t && t !== 'none') o.push((x.className || x.tagName) + ' ' + t); } return {tr: o, bg: getComputedStyle(b).backgroundColor}; });
      await p.mouse.up(); await p.waitForTimeout(400); await ev(() => { try { closeModal(true); } catch (e) {} const ps = document.getElementById('prem-sheet'); if (ps) ps.remove(); });
      if (st.tr.length) res.push(kind + ' 押すと縮む ' + st.tr.join(' / ')); if (st.bg !== before) res.push(kind + ' 押すと色が変わる');
    }
    if (res.length) console.log('  ' + res.join(' / ')); check('追加のボタンは指で押しても沈まない', !res.length); }
  // 2026-11-20 検索のカメラのボタンも、押すと震える（見えないスイッチが中にあり、押すとカメラの登録が開く）。位置はずれない
  check('検索のカメラのボタンも震える', await ev(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepA = actions['add-camera'], keepP = window.isPremium; let n = 0; actions['add-camera'] = () => { n++; }; window.isPremium = () => true;
    openAddSheet('my'); await w(300); const b = document.querySelector('.find-cam-b'), sw = b && b.querySelector('.hap-in'), lb = b && b.querySelector('.hap-ov');
    let ok = !!(b && sw && lb); if (ok) { const r1 = b.getBoundingClientRect(), r2 = lb.getBoundingClientRect(); ok = Math.abs(r1.width - r2.width) < 1 && Math.abs(r1.top - r2.top) < 1; sw.click(); await w(50); ok = ok && n === 1 && hapticAt > Date.now() - 2000; }
    actions['add-camera'] = keepA; window.isPremium = keepP; closeModal(true); await w(200); if (!ok) console.log('  ' + JSON.stringify({b: !!b, sw: !!sw, n})); return ok; }));
  // 2026-11-20 カメラで登録：画面いっぱいのカメラ（写真・撮る・バーコード）。塗り薬もカメラで探せて、写真の文字からいちばん近い塗り薬を出す
  check('画面いっぱいのカメラ・塗り薬もカメラで正確に探す', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keepV = callVision, keepF = findFetch, keepP = window.isPremium; window.isPremium = () => true;
    /* 写真の文字から塗り薬を当てる */
    const T = [['ヒルドイド ソフト軟膏 0.3%', 'ヒルドイドソフト軟膏0.3%'], ['ヘパリン類似物質クリーム0.3%「日医工」', 'ヘパリン類似物質クリーム0.3%'], ['デルモベート クリーム 0.05%', 'デルモベートクリーム0.05%'], ['アンテベートローション0.05%', 'アンテベートローション0.05%'], ['ディフェリンゲル 0.1% アダパレン', 'ディフェリンゲル0.1%'], ['ベピオ ゲル 2.5%', 'ベピオゲル2.5%']];
    T.forEach(([t, want]) => { const M = rxMatch(t); if (!M[0] || M[0].d[1] !== want) bad.push(`「${t}」→${M[0] ? M[0].d[1] : 'なし'}`); });
    if (rxMatch('キュレル 化粧水').length) bad.push('化粧品を塗り薬とまちがえる');
    /* 化粧品：画面いっぱいのカメラ → 撮る → 探す */
    openCamLive('my'); await w(1500); const ov = document.querySelector('.cl-ov'), v = ov && ov.querySelector('video');
    if (!ov) bad.push('カメラが開かない'); else { if (!(v.videoWidth > 0)) bad.push('カメラの映像が出ない'); ['[data-cl="back"]', '[data-cl="help"]', '#cl-lib', '[data-cl="shot"]', '[data-cl="bar"]'].forEach((q) => { if (!ov.querySelector(q)) bad.push('ボタンがない ' + q); });
      ov.querySelector('[data-cl="bar"]').click(); await w(100); if (!ov.classList.contains('bar') || ov.querySelector('.cl-frame').hidden) bad.push('バーコードの枠が出ない'); ov.querySelector('[data-cl="bar"]').click(); await w(100);
      callVision = async () => ({result: {brand: 'キュレル', name: '潤浸保湿 化粧水 III'}}); findFetch = async () => [{name: 'キュレル 潤浸保湿 化粧水 III とてもしっとり 150ml', site: '楽天', price: 2000, url: 'https://e.com/1'}];
      ov.querySelector('[data-cl="shot"]').click(); await w(2500);
      if (document.querySelector('.cl-ov')) bad.push('撮ってもカメラが閉じない'); if (!/キュレル/.test((document.getElementById('find-list') || {}).textContent || '')) bad.push('撮った写真から商品が出ない'); }
    closeModal(true); await w(300);
    /* 塗り薬：検索の中のカメラ → 撮る → 一覧の塗り薬から当てる */
    openRxSheet(); await w(200); const rb = document.querySelector('#modal-root .find-cam-b[data-action="rx-camera"]'); if (!rb) bad.push('塗り薬の検索にカメラがない');
    closeModal(true); await w(250); openCamLive('rx'); await w(1500);
    callVision = async () => ({result: {brand: 'マルホ', name: 'ヒルドイドソフト軟膏0.3%', ingredients: 'ヘパリン類似物質'}});
    const sb = document.querySelector('.cl-ov [data-cl="shot"]'); if (sb) { sb.click(); await w(2500); const L = document.getElementById('rxcam-list'); const first = L && L.querySelector('.rx-item'); if (!first || first.dataset.rx !== 'ヒルドイドソフト軟膏0.3%' || !first.classList.contains('rx-sure')) bad.push('塗り薬の写真から正しい薬が出ない ' + (first ? first.dataset.rx : '')); } else bad.push('塗り薬のカメラが開かない');
    try { clStop(); } catch (e) {} closeModal(true); callVision = keepV; findFetch = keepF; window.isPremium = keepP; findState = null; await w(300);
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 バーコードの読み取り：ピントが少し甘い・小さい・斜め・影がある写真でも読める。でたらめな模様は読まない。カメラの結果の画面に「選ぶ・撮る」は出さない
  check('バーコードが少しぼやけていても読める・結果の画面に選ぶ撮るがない', await ev(async () => { const bad = [];
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'], G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'], R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'], P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const cd = (d) => { let a = 0; for (let i = 0; i < 12; i++) a += Number(d[i]) * (i % 2 ? 3 : 1); return String((10 - a % 10) % 10); };
    const draw = (d12, {mod = 3, blur = 0, rot = 0, scale = 1, bgW = 0, contrast = 1} = {}) => { const code = d12 + cd(d12), f = Number(code[0]); let b = '101'; for (let i = 0; i < 6; i++) b += (P[f][i] === 'L' ? L : G)[code[i + 1]]; b += '01010'; for (let i = 7; i < 13; i++) b += R[code[i]]; b += '101';
      const w0 = b.length * mod + 20 * mod, h0 = 140, c0 = document.createElement('canvas'); c0.width = w0; c0.height = h0; const x0 = c0.getContext('2d'); x0.fillStyle = '#fff'; x0.fillRect(0, 0, w0, h0); x0.fillStyle = `rgb(${Math.round(255 * (1 - contrast))},${Math.round(255 * (1 - contrast))},${Math.round(255 * (1 - contrast))})`; for (let i = 0; i < b.length; i++) if (b[i] === '1') x0.fillRect(10 * mod + i * mod, 10, mod, 120);
      const W = bgW || Math.round(w0 * 1.3), H = bgW ? Math.round(bgW * 0.56) : Math.round(h0 * 1.6), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#8a8f96'; x.fillRect(0, 0, W, H); x.filter = blur ? `blur(${blur}px)` : 'none';
      x.translate(W / 2, H / 2); x.rotate(rot * Math.PI / 180); const sw = bgW ? bgW * scale : w0, sh = h0 * sw / w0; x.drawImage(c0, -sw / 2, -sh / 2, sw, sh); return [code, c]; };
    const C = [['ふつう', {}], ['小さい', {mod: 2}], ['ぼやけ', {blur: 1.5}], ['斜め8度', {rot: 8}], ['うすい', {contrast: 0.45}], ['写真の中（幅35%）', {bgW: 1600, scale: 0.35, blur: 1}], ['写真の中（幅22%）', {bgW: 1600, scale: 0.22}]];
    for (const [n, o] of C) { const [code, c] = draw('490123456789', o); const r = eanDecodeImage(c); if (r !== code) bad.push(`${n}：${r || '読めない'}`); }
    const nz = document.createElement('canvas'); nz.width = 900; nz.height = 500; const nx = nz.getContext('2d'); for (let i = 0; i < 4000; i++) { nx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; nx.fillRect(Math.random() * 900, Math.random() * 500, 2 + Math.random() * 8, 2 + Math.random() * 60); } if (eanDecodeImage(nz)) bad.push('でたらめな模様を読んだ');
    openCamSheet('my'); await new Promise((r) => setTimeout(r, 200)); const mb = document.querySelector('#modal-root .modal-body'); if (/選ぶ|^撮る/.test([...mb.querySelectorAll('label, button')].map((e) => e.textContent.trim()).join('|')) && mb.querySelector('input[type=file]')) bad.push('結果の画面に選ぶ・撮るが残っている'); closeModal(true); findState = null;
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 Myアイテムの3つ目に「飲み薬」（飲み薬・サプリ）。塗り薬と同じ使い方（一覧・検索・カメラ・入力）で、飲んでいる物を軸にケアを提案する
  check('飲み薬・サプリの欄（登録・検索・カメラ・ケアの提案）', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepF = findFetch, keepV = callVision, keepP = window.isPremium;
    try {
      state.myProducts = []; ui.myKind = 'cos'; location.hash = '#/my'; render(); await w(150);
      const tabs = [...document.querySelectorAll('.my-tabs .ht')].map((b) => b.dataset.id + ':' + b.querySelector('span').textContent); if (tabs.join() !== 'cos:化粧品,rx:塗り薬,oral:飲み薬') bad.push('タブ ' + tabs.join());
      actions['my-kind']('oral'); await w(300); const ob = document.querySelector('[data-action="oral-sheet"]'); if (!ob) bad.push('飲み薬を追加のボタンがない'); else if (!ob.closest('.hap-keep,.hap-wrap')) bad.push('飲み薬を追加のボタンにバイブがない');
      const tb = document.querySelector('.my-tabs'); if (tb && tb.scrollWidth > tb.clientWidth + 2) bad.push('タブがはみ出る');
      openRxSheet(true); await w(100); const oi = [...document.querySelectorAll('#rx-list .rx-item')].map((b) => b.dataset.rx); if (!oi.includes('トランサミン（トラネキサム酸）') || !oi.includes('ビタミンCのサプリメント') || oi.some((n) => /軟膏|ゲル|クリーム/.test(n))) bad.push('飲み薬の一覧がおかしい');
      if (!document.querySelector('[data-action="oral-camera"]')) bad.push('飲み薬の検索にカメラがない'); closeModal(true); await w(250);
      openRxSheet(); await w(100); const ri = [...document.querySelectorAll('#rx-list .rx-item')].map((b) => b.dataset.rx); if (ri.some((n) => isOralName(n))) bad.push('塗り薬の一覧に飲み薬が出る'); closeModal(true); await w(250);
      rxPick('トランサミン（トラネキサム酸）'); await w(300); const tp = state.myProducts.find((x) => x.name === 'トランサミン（トラネキサム酸）');
      if (!tp || tp.category !== ORAL_CAT) bad.push('飲み薬の種類 ' + (tp && tp.category)); location.hash = '#/my'; ui.myKind = 'oral'; render(); await w(150);
      if (!document.querySelector('.mrow b') || !/トランサミン/.test(document.querySelector('.mrow b').textContent)) bad.push('飲み薬の欄に出ない'); ui.myKind = 'cos'; render(); await w(100); if (document.querySelector('.mrow')) bad.push('化粧品の欄に飲み薬が出る');
      /* ケアの提案：飲み薬は手順に入れず、飲み薬に合わせて日焼け止めの理由を出す（商品名は出さない） */
      const am = rtPlan('am'); if (am.steps.some((st) => st.prods.some((x) => x.p.category === ORAL_CAT))) bad.push('飲み薬が塗る手順に入る');
      const sun = am.steps.find((st) => st.k === 'sunscreen'); if (!sun || !sun.today.some((t) => t && /トラネキサム酸/.test(t.t))) bad.push('シミの飲み薬に合わせた日焼け止めの理由がない');
      if (!am.tips.some((t) => /飲んでいる物（トラネキサム酸）/.test(t))) bad.push('飲んでいる物に合わせた説明がない'); if (JSON.stringify([am.tips, am.steps.map((st) => st.today)]).includes('トランサミン')) bad.push('処方薬の商品名がアドバイスに出る');
      rxPick('ビブラマイシン（ドキシサイクリン）'); await w(300); const am2 = rtPlan('am'); const s2 = am2.steps.find((st) => st.k === 'sunscreen'); if (!s2 || !s2.today.some((t) => t && /ドキシサイクリン.*日焼けしやすく/.test(t.t))) bad.push('日焼けしやすくなる薬の注意がない');
      rxPick('イソトレチノイン（内服）'); await w(300); const pm = rtPlan('pm'); const se = pm.steps.find((st) => st.k === 'serum');
      if (se && se.good.some((g) => /レチノール|AHA/.test(g))) bad.push('イソトレチノインなのにレチノール・ピーリングをすすめる'); if (!pm.steps.some((st) => st.k === 'moist' && st.today.some((t) => t && /イソトレチノイン/.test(t.t)))) bad.push('イソトレチノインの保湿の説明がない');
      /* サプリのビタミンCは、塗るビタミンCとして扱わない */
      rxPick('ビタミンCのサプリメント'); await w(300); const vc = state.myProducts.find((x) => x.name === 'ビタミンCのサプリメント'); if (!vc || vc.category !== ORAL_CAT || vc.timing !== '朝' || vc.brand !== 'サプリ') bad.push('サプリの登録 ' + JSON.stringify(vc && [vc.category, vc.timing, vc.brand])); if (vc && prodInfo(vc).ings.some((e) => !e.oral)) bad.push('サプリの成分を塗る成分として扱う');
      /* 前の版で塗り薬に入れた飲み薬は、飲み薬へ */
      const old = JSON.parse(keep); old.myProducts = [{ id: 'mig1', name: 'ミノマイシン（ミノサイクリン）', brand: '処方薬', category: '皮膚科の塗り薬', ingredients: 'ミノサイクリン', timing: '朝・夜', frequency: '毎日', startDate: todayStr(), status: '使用中', purchases: [] }]; const n0 = normalize(old); if (n0.myProducts[0].category !== ORAL_CAT) bad.push('前の版の飲み薬が塗り薬のまま');
      /* 市販の飲み薬・サプリの検索：飲む物だけ・ジャンルを決めずに探す */
      await w(400); closeModal(true); await w(300); /* 登録のあとに出る「組み合わせ」の画面を閉じる */
      const asked = []; findFetch = async (b) => { asked.push(b.mode); return [{ name: 'ビタミンC 美容液 30ml', site: '楽天', price: 2000, url: 'https://e.com/s' }, { name: 'ビタミンC サプリメント 60粒 30日分', site: '楽天', price: 900, url: 'https://e.com/v' }]; };
      openRxSheet(true); await w(80); const q = document.getElementById('rx-q'); q.value = 'ビタミンC'; q.dispatchEvent(new Event('input')); await w(900);
      const shopN = [...document.querySelectorAll('#find-list .net-item b')].map((b) => b.textContent); if (shopN.length !== 1 || !/サプリ/.test(shopN[0])) bad.push('市販の検索 ' + shopN.join('/')); if (!asked.length || asked.some((m) => m !== 'otc')) bad.push('検索のしかた ' + asked.join());
      const fp = document.querySelector('#find-list [data-action="find-pick"]'); if (fp) fp.click(); await w(500); const sp = state.myProducts.find((x) => /60粒/.test(x.name)); if (!sp || sp.category !== ORAL_CAT) bad.push('市販のサプリを選んでも飲み薬にならない ' + (sp && sp.category)); closeModal(true); await w(250);
      /* カメラ：撮った飲み薬だけ出す */
      window.isPremium = () => true; callVision = async () => ({ result: { name: 'トランサミン錠250mg', ingredients: 'トラネキサム酸' } }); openRxCamSheet(true); const c = document.createElement('canvas'); c.width = 200; c.height = 200; const f = await new Promise((res) => c.toBlob((b) => res(new File([b], 'o.jpg', { type: 'image/jpeg' })), 'image/jpeg'));
      await rxCamGot(f); await w(100); const L = [...document.querySelectorAll('#rxcam-list .rx-item')].map((b) => b.dataset.rx); if (L.join() !== 'トランサミン（トラネキサム酸）') bad.push('カメラで撮った飲み薬 ' + L.join('/')); closeModal(true); await w(250);
    } finally { findFetch = keepF; callVision = keepV; window.isPremium = keepP; findState = null; state = normalize(JSON.parse(keep)); ui.myKind = 'cos'; location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 薬は勝手にやめさせない：ニキビの記録がなくても処方の塗り薬は手順に入れ、アダパレン・過酸化ベンゾイルは「再発予防に続ける薬」と出す。抗菌薬は長く使っていたら「期間は医師に」
  check('処方の塗り薬・飲み薬を記録で外さない（薬ごとの説明）', await ev(async () => { const bad = [], keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    try { const mk = (id, name, ing, cat, ago) => ({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: cat, purposes: [], ingredients: ing, timing: cat === ORAL_CAT ? '朝・夜' : '夜', frequency: '毎日', startDate: addDays(d, -ago), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
      state.myProducts = [mk('a1', 'ディフェリンゲル0.1%', 'アダパレン', '皮膚科の塗り薬', 200), mk('a2', 'ダラシンTゲル1%', 'クリンダマイシン', '皮膚科の塗り薬', 120), mk('a3', 'ミノマイシン（ミノサイクリン）', 'ミノサイクリン', ORAL_CAT, 100)];
      state.settings.concernKeys = []; state.skinLogs = [{id: 'z1', date: d, condition: 4, acneCount: 0, acneTypes: [], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
      const P = rtPlan('pm'), ids = P.steps.filter((z) => z.k.startsWith('rx:')).flatMap((z) => z.prods.map((x) => x.p.id));
      if (!ids.includes('a1') || !ids.includes('a2')) bad.push('ニキビの記録がないと塗り薬が外れる ' + ids.join(','));
      if (JSON.stringify(P.tips).match(/手順に入れていません|やめ(ま|て)/)) bad.push('やめる・外すと読める説明');
      if (!P.tips.some((t) => /アダパレン.*再発を防ぐために続ける/.test(t))) bad.push('アダパレンの再発予防の説明がない');
      const a2 = P.steps.find((z) => z.prods.some((x) => x.p.id === 'a2')); if (!a2 || !a2.today.some((t) => /使う期間は医師が決めます/.test(t.t))) bad.push('抗菌薬の塗り薬の期間の説明がない');
      if (!P.tips.some((t) => /抗菌薬の飲み薬（ミノサイクリン）.*飲む期間は医師が決めます/.test(t))) bad.push('抗菌薬の飲み薬の期間の説明がない');
      if (JSON.stringify([P.tips, P.steps.map((z) => z.today)]).match(/ディフェリン|ダラシン|ミノマイシン/)) bad.push('処方薬の商品名が説明に出る');
    } finally { state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 安全な方法：妊娠中は、添付文書で禁忌の塗り薬（アダパレンなど）を手順に入れず「使う前に医師に相談」と出す。禁忌でない薬は外さない。妊娠中に注意が必要な飲み薬は「医師・薬剤師に伝える」と出す（やめるとは言わない）
  check('妊娠中：禁忌の塗り薬は手順に入れず医師に相談・ほかの薬は外さない', await ev(async () => { const bad = [], keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    try { const mk = (id, name, ing, cat) => ({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: cat, purposes: [], ingredients: ing, timing: '夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
      state.myProducts = [mk('p1', 'エピデュオゲル', 'アダパレン・過酸化ベンゾイル', '皮膚科の塗り薬'), mk('p2', 'ベピオゲル2.5%', '過酸化ベンゾイル', '皮膚科の塗り薬'), mk('p3', 'イソトレチノイン（内服）', 'イソトレチノイン', ORAL_CAT)];
      state.settings.gender = '女性'; state.settings.diag = Object.assign({}, state.settings.diag || {}, {a: Object.assign({}, (state.settings.diag || {}).a || {}, {preg: 'preg'})}); state.skinLogs = [{id: 'q1', date: d, condition: 4, acneCount: 0, acneTypes: [], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
      const P = rtPlan('pm'), ids = P.steps.filter((z) => z.k.startsWith('rx:')).map((z) => z.prods[0].p.id), txt = JSON.stringify(P.tips);
      if (ids.includes('p1')) bad.push('妊娠中に禁忌の塗り薬が手順に入る'); if (!/禁忌.*医師に相談/.test(String(P.rested.get('p1')))) bad.push('禁忌の理由と医師への相談が出ない ' + P.rested.get('p1'));
      if (!ids.includes('p2')) bad.push('禁忌でない塗り薬まで外れる'); if (/アダパレン[^。]*続け/.test(txt)) bad.push('妊娠中にアダパレンを「続けましょう」と出る');
      if (!/妊娠中は、飲んでいる「イソトレチノイン」について、必ず医師・薬剤師に伝えて/.test(txt)) bad.push('飲み薬の妊娠中の注意がない'); if (/やめ(ま|て|る)/.test(txt)) bad.push('やめると読める説明');
    } finally { state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 動画：夜のケアに「皮膚科の塗り薬」が4つ同じ名前で並び、同じ成分の注意・イソトレチノインとの注意が画面に出ていなかった。Myアイテムに同じ商品を2つ登録しない
  check('塗り薬は1つのカードに一覧で・同じ成分の重なりの注意は1回・医師に確認する注意が画面に出る・同じ商品は2つ登録しない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    try { const mk = (id, name, ing, cat, timing) => ({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: cat, purposes: [], ingredients: ing, timing, frequency: '毎日', startDate: addDays(d, -10), status: '使用中', endDate: '', memo: '', pao: 0, order: null});
      state.myProducts = [mk('r1', 'エピデュオゲル', 'アダパレン・過酸化ベンゾイル', '皮膚科の塗り薬', '夜'), mk('r2', 'ディフェリンゲル0.1%', 'アダパレン', '皮膚科の塗り薬', '夜'), mk('r4', 'ベピオゲル2.5%', '過酸化ベンゾイル', '皮膚科の塗り薬', '夜'), mk('o1', 'イソトレチノイン（内服）', 'イソトレチノイン', ORAL_CAT, '朝・夜')];
      state.settings.concernKeys = ['acne']; state.skinLogs = [{id: 'l', date: d, condition: 3, acneCount: 3, acneTypes: ['赤ニキビ'], usedProducts: [], memo: '', photo: ''}]; state = normalize(JSON.parse(JSON.stringify(state)));
      ui.rtTab = 'pm'; location.hash = '#/routine'; render(); await w(500); const txt = document.getElementById('main').innerText;
      /* 2026-11-21 動画：同じ成分の塗り薬（アダパレン＋過酸化ベンゾイル・アダパレン・過酸化ベンゾイル）が「皮膚科の塗り薬①②③」と別々の手順で並び、全部重ねて塗るように見えた。塗り薬は1つのカードにまとめ、どれか分かる一覧と、重なりの注意を1回だけ出す */
      const titles = [...document.querySelectorAll('#main .cm-t')].map((e) => e.textContent.replace(/\u200b/g, '').trim()).filter((t) => /皮膚科の塗り薬/.test(t)); if (titles.join() !== '皮膚科の塗り薬') bad.push('塗り薬が1つのカードにまとまっていない：' + titles.join('/'));
      { const card = [...document.querySelectorAll('#main .cm-t')].find((e) => /皮膚科の塗り薬/.test(e.textContent)); const c = card && (card.closest('li') || card.parentElement); const rows = c ? [...c.querySelectorAll('.cm-drugs li')].map((li) => li.textContent.replace(/\u200b/g, '')) : [];
        if (rows.length !== 3 || !rows[0].startsWith('アダパレン・過酸化ベンゾイル') || !rows[1].startsWith('アダパレン') || !rows[2].startsWith('過酸化ベンゾイル')) bad.push('どの塗り薬をいつ塗るかの一覧が、Myアイテムと同じ順で出ない：' + rows.join(' / '));
        if (rows.filter((r) => /成分が重なっています/.test(r)).length !== 3) bad.push('成分が重なっている薬に印が出ない');
        const ct = c ? c.textContent.replace(/\u200b/g, '') : ''; if ((ct.match(/同じ成分（/g) || []).length !== 1) bad.push('同じ成分の注意が1回ではない'); if ((ct.match(/イソトレチノインを飲んでいる間に/g) || []).length !== 1) bad.push('イソトレチノインとの注意が1回ではない'); if (/自分の判断でやめたり/.test(ct) === false) bad.push('「自分でやめない」の一言がない'); }
      state.myProducts.forEach((x) => { x.status = '使用中'; }); ui.myKind = 'rx'; location.hash = '#/my'; render(); await w(400); { const n = document.querySelector('#main .rx-dup'); if (!n || !/エピデュオゲル/.test(n.textContent) || !/ディフェリンゲル/.test(n.textContent) || !/ベピオゲル/.test(n.textContent)) bad.push('Myアイテムの塗り薬に、成分の重なりの知らせが出ない'); } location.hash = '#/routine'; render(); await w(300);
      if (/ディフェリン|ベピオ|エピデュオ/.test(txt.replace(/皮膚科の塗り薬[^\n]*/g, '')) && /ディフェリンを|ベピオを/.test(txt)) bad.push('商品名で注意している');
      /* 同じ商品 */
      state.myProducts = []; rxPick('ベピオゲル2.5%'); await w(700); closeModal(true); rxPick('ベピオゲル2.5%'); await w(300); closeModal(true); if (state.myProducts.filter((x) => x.name === 'ベピオゲル2.5%').length !== 1) bad.push('同じ塗り薬が2つ登録される');
      state.myProducts[0].status = '一時停止'; rxPick('ベピオゲル2.5%'); await w(300); closeModal(true); if (state.myProducts.length !== 1) bad.push('停止中の薬と同じ物が登録される');
      state.myProducts[0].status = '使用終了'; rxPick('ベピオゲル2.5%'); await w(700); closeModal(true); if (state.myProducts.length !== 2) bad.push('使い終わった物をもう一度登録できない');
      state.catalog.push({id: 'dupc1', isSample: false, verify: 'verified', name: '【送料無料】テスト 化粧水 しっとり 200ml 正規品', brand: 'テスト', category: '化粧水・トナー', origin: 'その他', price: 1000, volume: '', image: '', imageUrl: '', shopUrl: '', imgClean: false, purposes: [], ingredients: '', jan: '', offers: []});
      state.catalog.push({id: 'dupc2', isSample: false, verify: 'verified', name: 'テスト 化粧水 しっとり 200ml', brand: 'テスト', category: '化粧水・トナー', origin: 'その他', price: 1000, volume: '', image: '', imageUrl: '', shopUrl: '', imgClean: false, purposes: [], ingredients: '', jan: '', offers: []});
      const n0 = state.myProducts.length; quickAddMy('dupc1'); await w(700); closeModal(true); quickAddMy('dupc1'); await w(300); quickAddMy('dupc2'); await w(300); closeModal(true); if (state.myProducts.length !== n0 + 1) bad.push('同じ化粧品（店ごとに名前の書き方がちがう物）が2つ登録される ' + (state.myProducts.length - n0));
      openMyForm(); await w(300); const f = document.getElementById('my-form'); f.elements.name.value = 'テスト 化粧水 しっとり 200ml'; f.elements.brand.value = 'テスト'; f.requestSubmit(); await w(400); const err = document.querySelector('#my-form .field-error, #my-form .err, #my-form [role=alert]');
      if (state.myProducts.length !== n0 + 1) bad.push('入力した同じ化粧品が登録される'); if (!/すでに登録されています/.test(document.getElementById('modal-root').innerText)) bad.push('同じ商品のときの説明が出ない'); closeModal(true); await w(250);
    } finally { state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 ていねいな点検で見つけた8件が、もう起きないように
  check('点検で直した8件（授乳中の続ける・朝夜で分ければ可・黙って消える・同じ文の重なり・赤いニキビの理由・組み合わせのまとめ・アイテムの数・止まらない）', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    const P0 = (id, name, cat, ing, x) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: 'テスト', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}, x || {});
    const setup = (a, prods, log) => { state.settings.routine = {}; state.careLogs = {}; state.routineLogs = {}; state.settings.gender = a.gender || '女性'; /* 前の確認で「やった」にした手順・時短モードを残さない */ state.settings.diag = Object.assign({}, state.settings.diag || {}, {a: Object.assign({}, (state.settings.diag || {}).a || {}, a)}); state.settings.concernKeys = a.concerns || []; state.myProducts = prods; state.skinLogs = [Object.assign({id: 'k0', date: d, condition: 3, acneCount: 0, acneTypes: [], redness: 0, dryness: 0, oil: 0, usedProducts: [], memo: '', photo: ''}, log || {})]; state = normalize(JSON.parse(JSON.stringify(state))); };
    try {
      // ① 授乳中：バクチオールの美容液を「続ける」にしない（ケア管理と同じ判断）
      setup({preg: 'nursing', concerns: ['spot', 'dull']}, [P0('n1', 'バクチオール 美容液', '美容液・アンプル', '水、バクチオール'), P0('n2', 'UVミルク', '日焼け止め', '酸化亜鉛', {timing: '朝'})]);
      let A = personalAnalysis(), it = A.items.find((i) => i.x.p.id === 'n1'); if (!it || it.v === 'keep') bad.push('授乳中のバクチオールを「続ける」にしている');
      // ④ 悩みごとに同じケアの文を重ねない
      const cares = A.top.flatMap((c) => c.care || []); if (cares.length !== new Set(cares.map((x) => String(x).replace(/\s/g, ''))).size) bad.push('悩みごとに同じケアの文が重なる');
      // ② イソトレチノイン（飲み薬）と重なる化粧品に「朝夜で分ければ可」と書かない
      setup({preg: 'no', concerns: ['acne']}, [P0('i1', 'イソトレチノイン（内服）', ORAL_CAT, 'イソトレチノイン', {brand: '処方薬'}), P0('i2', 'レチノール 美容液', '美容液・アンプル', '水、レチノール', {timing: '夜'})], {acneCount: 3});
      A = personalAnalysis(); it = A.items.find((i) => i.x.p.id === 'i2'); if (!it || /朝夜で分ければ可/.test(it.note) || it.v === 'keep') bad.push('飲み薬と重なる化粧品の書き方 ' + (it && it.note));
      // ③⑤⑥ 化粧品が多い人：黙って消える物がない・同じ成分の説明は1回・赤いニキビの日の理由
      const many = [P0('c2', 'サリチル酸 洗顔フォーム', '洗顔', '水、サリチル酸、ラウリン酸'), P0('c3', 'さっぱり化粧水', '化粧水・トナー', '水、BG'), P0('c4', 'ナイアシンアミド 美容液', '美容液・アンプル', '水、ナイアシンアミド'), P0('c5', 'アゼライン酸 美容液', '美容液・アンプル', '水、アゼライン酸'), P0('c6', 'レチノール 美容液', '美容液・アンプル', '水、レチノール', {timing: '夜'}), P0('c7', 'ビタミンC 美容液', '美容液・アンプル', '水、アスコルビン酸'), P0('c8', 'ジェル乳液', '乳液', '水、グリセリン'), P0('c9', '日焼け止め SPF50+ PA++++', '日焼け止め', '酸化亜鉛', {timing: '朝'}), P0('c11', 'スポット ジェル', 'スポットケア', 'サリチル酸、水')];
      setup({preg: 'no', oilDay: 'much', concerns: ['acne', 'pore', 'oily']}, many, {acneCount: 4, oil: 4, acneTypes: ['白ニキビ', '赤ニキビ']});
      const plans = ['am', 'pm'].map((sl) => rtPlan(sl)), used = new Set(plans.flatMap((P) => P.steps.flatMap((z) => z.prods.map((x) => x.p.id))));
      A = personalAnalysis(); A.items.filter((i) => !used.has(i.x.p.id) && i.v === 'keep').forEach((i) => bad.push('ケア管理で使わない「' + i.x.p.name + '」を「続ける」にしている'));
      plans.forEach((P, k) => { const T = P.steps.flatMap((z) => z.today.filter((t) => t && t.src === '成分').map((t) => t.t)); if (T.length !== new Set(T).size) bad.push((k ? '夜' : '朝') + 'に同じ成分の説明が2回');
        const txt = JSON.stringify(P.steps.map((z) => z.today)); if (P.calm && (careTodayData().m.red || 0) < 3 && /赤み・肌あれが落ち着くまで/.test(txt)) bad.push('赤いニキビの日なのに「赤み・肌あれが落ち着くまで」'); });
      { const vt = (sl) => { ui.rtTab = sl; const dv = document.createElement('div'); dv.innerHTML = viewRoutine(); return dv.textContent; }; /* 画面の切り替え（ほかの確認の残り）に左右されないように、ケア管理の画面の中身を直接作る */ const a1 = vt('am'), a2 = vt('pm'); const all = (a1 + a2).replace(/[\s​「」]/g, '');
        many.forEach((x) => { const g = getMy(x.id); if (!all.includes(g.name.replace(/[\s「」]/g, '')) && !all.includes(prodIngLabel(g).replace(/[\s「」]/g, ''))) bad.push('ケア管理で「' + g.name + '」が黙って消える'); }); }
      // ⑦⑧ 成分の組み合わせ：同じ注意は1枚・「使用中のアイテム」
      const cbx = document.createElement('div'); cbx.innerHTML = viewCombo(); document.body.appendChild(cbx); const cards = [...cbx.querySelectorAll('.card:not(.combo-sum) p, .card:not(.combo-sum) li')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 25);
      if (cards.length !== new Set(cards).size) bad.push('組み合わせの画面に同じ注意の文が2回'); if (!/使用中のアイテム/.test(cbx.innerText)) bad.push('「使用中のアイテム」になっていない'); cbx.remove();
      // ⑨ 分析とケア管理が呼び合って止まらない
      const t0 = performance.now(); personalAnalysis(); rtPlan('pm'); careTodayData(); if (performance.now() - t0 > 3000) bad.push('分析・ケア管理の計算が遅すぎる（呼び合い） ' + Math.round(performance.now() - t0) + 'ms');
    } catch (e) { bad.push('エラー ' + e.message); } finally { state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 テストを作る前（11/13〜11/16）に直した不具合も、もう起きないように
  check('以前直した不具合（日付が変わったら描き直す・位置情報が取れなくてもエラーなし・なくなった画面・長押し・シート中の固定・お問い合わせの戻る・保存前にログアウトで消さない）', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium; window.isPremium = () => true;
    const errs = []; const oe = (e) => errs.push(String(e.message || e)); window.addEventListener('error', oe);
    try {
      // ① 開いたまま日付が変わったら、新しい日に描き直す（シートを開いている・入力中は描き直さない）
      location.hash = '#/home'; await w(150); render(); await w(200); SHOWN_DAY = '2000-01-01'; openModal({title: 'テスト', body: '<input id="dc-i">'}); await w(100); dayCheck(); if (SHOWN_DAY !== '2000-01-01') bad.push('シートを開いているのに日付で描き直した');
      closeModal(true); await w(300); dayCheck(); if (SHOWN_DAY !== todayStr()) bad.push('日付が変わっても描き直さない');
      // ② 位置情報が取れなくても、エラーの画面を出さず前の場所で続ける
      const kg = navigator.geolocation.getCurrentPosition, kf = window.fetch; navigator.geolocation.getCurrentPosition = (ok, ng) => setTimeout(() => ng({code: 2, message: 'x'}), 10); window.fetch = async () => { throw new Error('offline'); };
      state.settings.wxPref = '現在地'; state.settings.wxLoc = {lat: 35.68, lon: 139.76, at: Date.now()}; state.wxGeoAt = ''; WX_BUSY = false; WX_GEO_TS = 0;
      try { await Promise.race([wxFetch(true, false), w(4000)]); } catch (e) { bad.push('位置情報が取れないとエラー ' + e.message); }
      navigator.geolocation.getCurrentPosition = kg; window.fetch = kf; WX_BUSY = false;
      if (document.getElementById('modal-root').innerHTML) bad.push('位置情報が取れないときに窓が出る（聞いていないのに）'); closeModal(true);
      // ③ なくなった画面・ない商品・古い日付を開いても、白い画面やエラーにならない
      for (const h of ['#/compare', '#/design', '#/shortcuts', '#/weight', '#/xyz', '#/my/notexist', '#/log/2000-01-01', '#/product/none', '#/ingredient/なし']) { location.hash = h; await w(120); try { render(); } catch (e) { bad.push(h + ' でエラー ' + e.message); } await w(120); const m = document.getElementById('main'); if (!m || m.innerText.trim().length < 2) bad.push(h + ' で白い画面'); }
      location.hash = '#/home'; await w(150); render();
      // ④ リンク・ボタンを長押ししてもプレビュー（iPhoneの吹き出し）が出ない
      const src = await (await fetch(location.href.split('#')[0])).text(); if (!/body\{[^}]*-webkit-touch-callout:none/.test(src)) bad.push('長押しでプレビューが出る設定になっている');
      // ⑤ シートを開いても、体（body）に overflow:hidden を付けない（iPhoneで上のタブの固定が外れる）
      { const L = src.split('\n').filter((l) => /no-scroll[^{]*\{[^}]*overflow:\s*hidden/.test(l)); if (!L.length || L.some((l) => !/@media \(hover:hover\) and \(pointer:fine\)/.test(l))) bad.push('スマホでもシートを開くと overflow:hidden になる'); }
      // ⑥ お問い合わせ（サポート）から戻ると、開く前の画面に戻る（その前まで戻らない）
      location.hash = '#/account'; await w(200); render(); await w(200); const sb = document.querySelector('[data-action="support-open"]'); if (sb) { sb.click(); await w(600); const back = document.querySelector('[data-action="go-back"], .tb-back, [aria-label="戻る"]'); if (back) { back.click(); await w(700); } else history.back(); await w(500); if (!/account/.test(location.hash) && !document.querySelector('[data-action="support-open"]')) bad.push('お問い合わせから戻ると、開く前の画面に戻らない ' + location.hash); }
      // ⑦ クラウドに保存できていないときは、ログアウトで記録を消す前に確かめる（いいえなら消さない）
      const ks = {cl: acct.client, us: acct.user, push: syncPush, un: logoutUnsaved, cf: confirmDialog}, n0 = state.myProducts.length + state.skinLogs.length; let asked = '';
      acct.client = {auth: {signOut: async () => {}}, functions: {invoke: async () => ({})}}; acct.user = {id: 'test', email: 't@example.com'}; syncPush = async () => { SYNC.err = 'offline'; }; logoutUnsaved = () => true; confirmDialog = async (m) => { asked = m; return false; };
      try { await Promise.race([logoutAndWipe(), w(5000)]); } catch (e) { bad.push('ログアウトでエラー ' + e.message); }
      acct.client = ks.cl; acct.user = ks.us; syncPush = ks.push; logoutUnsaved = ks.un; confirmDialog = ks.cf; SYNC.err = ''; acct.busy = false;
      if (!/保存できていない/.test(asked)) bad.push('保存できていないのに確かめずにログアウトする'); if (state.myProducts.length + state.skinLogs.length !== n0) bad.push('いいえを押しても記録が消える');
    } catch (e) { bad.push('エラー ' + e.message); } finally { window.removeEventListener('error', oe); state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; location.hash = '#/'; render(); }
    if (errs.length) bad.push('画面のエラー ' + errs[0]);
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 全部のカメラを高画質に：アプリ内カメラは高い解像度で開き、AIに送る写真は大きく（送れる大きさを超えるときだけ縮める）
  check('カメラが高画質（解像度・AIに送る写真の大きさ）', await ev(async () => { const bad = [], keep = navigator.mediaDevices.getUserMedia, asked = [];
    navigator.mediaDevices.getUserMedia = async (c) => { asked.push(c.video); return keep.call(navigator.mediaDevices, c); };
    openCamLive('my'); await new Promise((r) => setTimeout(r, 800)); clStop(); await new Promise((r) => setTimeout(r, 300)); navigator.mediaDevices.getUserMedia = keep;
    const v = asked[0]; if (!v || !v.width || v.width.ideal < 3000) bad.push('商品のカメラの解像度が低い ' + JSON.stringify(v));
    if (!/facingMode:'user', width:\{ideal:1920\}/.test(String(openGuideCam)) ) bad.push('顔のカメラの解像度が低い');
    const mk = async (w, h, noisy) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (noisy) { const d = x.createImageData(w, h); for (let i = 0; i < d.data.length; i++) d.data[i] = Math.random() * 255; x.putImageData(d, 0, 0); } else { x.fillStyle = '#c8a'; x.fillRect(0, 0, w, h); } return new File([await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))], 'a.jpg', {type: 'image/jpeg'}); };
    const sz = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(Math.max(i.width, i.height)); i.src = u; });
    const a1 = await readImageAI(await mk(4000, 3000)); if ((await sz(a1)) !== 2048) bad.push('AIに送る写真が小さい ' + (await sz(a1)));
    const a2 = await readImageAI(await mk(4000, 3000, true)); if (a2.length > 1800000) bad.push('ざらざらの写真で送れる大きさを超える ' + a2.length);
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 カメラで撮った商品が出る：英語の商品名でも日本の通販の名前（カタカナ）で見つける。同じ名前のシートマスクより、撮った美容液を先に出す。塗り薬は撮った薬だけ出す
  check('カメラで撮った商品がいちばん上に出る・塗り薬は撮った薬だけ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keepF = findFetch, keepV = callVision, keepP = window.isPremium; window.isPremium = () => true;
    const SHOP = [{name: 'アヌア レチノール0.3 ナイアシン リニューイングセラム 30ml', site: '楽天', price: 3000, url: 'https://e.com/r'}, {name: 'アヌア ドクダミ77 スージングトナー 250ml', site: '楽天', price: 2500, url: 'https://e.com/t'}, {name: 'アヌア レチノール0.3 セラムマスク 7枚入り', site: '楽天', price: 1500, url: 'https://e.com/rm'},
      {name: 'ANUA アヌア アゼライン酸15インテンスカーミングセラムマスク 7枚入り AZELAIC ACID 15 INTENSE CALMING SERUM MASK', site: '楽天', price: 1180, url: 'https://e.com/am'}, {name: '【公式】アヌア アゼライン酸15 インテンスカーミングセラム 30ml', site: '楽天', price: 3200, url: 'https://e.com/a'}, {name: 'アヌア ナイアシンアミド10 TXA セラム', site: '楽天', price: 2900, url: 'https://e.com/n'}];
    findFetch = async (b) => { const q = b.q || ''; if (/アヌア/.test(q)) return SHOP.filter((x) => q.split(' ').slice(1).some((t) => x.name.includes(t))); return SHOP.filter((x) => /AZELAIC/i.test(x.name) && /AZELAIC/i.test(q)); };
    for (const [r, want] of [[{brand: 'Anua', name: 'ANUA RETINOL 0.3 + NIACIN RENEWING SERUM'}, 'リニューイングセラム 30ml'], [{brand: 'Anua', name: 'AZELAIC ACID 15 INTENSE CALMING SERUM'}, 'インテンスカーミングセラム 30ml']]) {
      callVision = async () => ({result: r}); openCamSheet('my'); const c = document.createElement('canvas'); c.width = 300; c.height = 300; const f = await new Promise((res) => c.toBlob((b) => res(new File([b], 'a.jpg', {type: 'image/jpeg'})), 'image/jpeg'));
      await camGot(f); await w(100); const first = document.querySelector('#find-list .net-item b'); if (!first || !first.textContent.includes(want)) bad.push(`${r.name} → ${first ? first.textContent : 'なし'}`); else if (!document.querySelector('#find-list .net-item.net-sure')) bad.push('いちばん合う物の印がない ' + r.name);
      closeModal(true); await w(200); }
    /* 塗り薬：自信があるときは撮った薬だけ */
    callVision = async () => ({result: {name: 'エピデュオゲル', ingredients: 'アダパレン・過酸化ベンゾイル'}}); openRxCamSheet(); const c2 = document.createElement('canvas'); c2.width = 200; c2.height = 200; const f2 = await new Promise((res) => c2.toBlob((b) => res(new File([b], 'b.jpg', {type: 'image/jpeg'})), 'image/jpeg'));
    await rxCamGot(f2); await w(100); const L = [...document.querySelectorAll('#rxcam-list .rx-item')].map((b) => b.dataset.rx); if (L.join() !== 'エピデュオゲル') bad.push('塗り薬にほかの薬も出る ' + L.join('/'));
    closeModal(true); findFetch = keepF; callVision = keepV; window.isPremium = keepP; findState = null; await w(200);
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 運動・睡眠・食事の「控えたいこと・気をつけること」は理由だけ（説明・代わりにこうするは出さない）。代わりにこうすることは、カードの「おすすめ」に必ず出す
  check('気をつけることは理由だけ・代わりはおすすめに出る', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms));
    LIFE_AVOID.forEach((r) => { if (!Array.isArray(r[4]) || !r[4].length) bad.push('代わりのおすすめがない ' + r[0]); });
    for (const [area, word] of [['運動', '汗をそのままにする'], ['睡眠', '寝る前のスマホ'], ['食事', '菓子パン'], ['運動', '顔を触る']]) {
      openLifeAvoidSheet(area, word); await w(50); const m = document.querySelector('.modal'), tx = m ? m.textContent : '';
      if (!/なぜ控えたほうがいい/.test(tx) || /説明|代わりにこうする/.test(tx)) bad.push('シート ' + word);
      closeModal && closeModal(); await w(30);
      const h = advChips({area, good: [], avoid: [word]}), d = document.createElement('div'); d.innerHTML = h;
      const goods = [...d.querySelectorAll('.adv-c.good')].map((b) => b.textContent.replace('›', ''));
      if (!goods.length) bad.push('おすすめが出ない ' + word);
      const alt = LIFE_AVOID.find(([re]) => re.test(word))[4]; if (!alt.every((v) => goods.includes(v))) bad.push('代わりがおすすめにない ' + word + ' ' + goods.join('/'));
      if (goods.some((v) => advSane(area, [v], [])[0].length === 0) && !alt.length) bad.push('おすすめがルールに合わない ' + word);
      const lb = d.querySelector('[data-lifegood]'); if (area !== '食事' && lb) { openLifeGoodSheet(area, alt[0]); await w(50); const t2 = (document.querySelector('.modal') || {}).textContent || ''; if (!/なぜいい/.test(t2) || !/やり方/.test(t2)) bad.push('おすすめのシート ' + alt[0]); closeModal && closeModal(); await w(30); } }
    /* 知らない言葉でも、気をつけることがあればおすすめを出す */
    for (const area of ['運動', '睡眠', '食事']) { const d = document.createElement('div'); d.innerHTML = advChips({area, good: [], avoid: ['なにかの注意']}); if (!d.querySelector('.adv-c.good')) bad.push('知らない言葉でおすすめなし ' + area); }
    { const d = document.createElement('div'); d.innerHTML = advChips({area: 'スキンケア', good: [], avoid: ['香料']}); if (!d.querySelector('.adv-c.good')) bad.push('肌：控えたい成分だけでおすすめなし'); }
    /* 今日運動した人のカード：気をつけることがあれば、おすすめも出る */
    const keep = JSON.stringify(state), keepPrem = window.isPremium, d = todayStr(); window.isPremium = () => true;
    for (const life of [{id: 'exl1', date: d, exercise: [{type: 'ウォーキング', minutes: 20}]}, null]) {
      state.settings.concernKeys = ['acne']; state.skinLogs = [{id: 'ex1', date: d, condition: 3, acneCount: 3, acneTypes: ['赤ニキビ'], usedProducts: [], memo: '', photo: ''}]; state.lifeLogs = life ? [life] : []; state = normalize(JSON.parse(JSON.stringify(state)));
      ui.homeTab = 'care'; location.hash = '#/home'; render(); let cs = []; for (let i = 0; i < 20 && !cs.length; i++) { await w(100); cs = document.querySelectorAll('#main .ct2-c'); } if (!cs.length) bad.push('カードがない');
      cs.forEach((c) => { if (c.querySelector('.adv-box.bad') && !c.querySelector('.adv-box.good')) bad.push((life ? '運動した日 ' : '記録なし ') + 'カードにおすすめなし ' + (c.querySelector('.ct2-sh span') || {}).textContent); }); }
    state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; render();
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-19 検索で塗り薬も化粧品も全部出す（化粧品の検索に処方の塗り薬・塗り薬の検索に市販薬と化粧品）。ジェネリックも出る。検索のシートは高さを決めておき、文字を入れても結果が出ても動かない
  check('検索で塗り薬も化粧品も出る・検索のシートが動かない', await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), keepFF = findFetch, bad = [];
    if (RX_DRUGS.some((d) => !Array.isArray(d) || d.length < 3)) bad.push('塗り薬の一覧に空き');
    for (const g of ['ビーソフテン', 'ヘパリン類似物質クリーム', 'アダパレンゲル', 'ベタメタゾン吉草酸エステル軟膏', 'クリンダマイシンゲル', 'ケトコナゾールクリーム']) if (!rxHits(g).length) bad.push('一覧にない ' + g);
    findFetch = async (b) => [{name: (b.q || '') + ' 市販の商品 24g', site: '楽天市場', price: 1000, url: 'https://example.com/a'}];
    const top = () => Math.round(document.querySelector('#modal-root .modal').getBoundingClientRect().top);
    openAddSheet('my'); await w(900); const t0 = top(); const q = document.getElementById('pop-q'); q.value = 'ヒルドイド'; q.dispatchEvent(new Event('input')); await w(150); const t1 = top(); await w(900); const t2 = top();
    if (!document.querySelector('#pop-list [data-action="rx-pick"]')) bad.push('化粧品の検索に塗り薬が出ない'); if (!document.querySelector('#pop-list [data-action="find-pick"]')) bad.push('化粧品の検索に市販の商品が出ない');
    q.value = 'ビーソフテン'; q.dispatchEvent(new Event('input')); await w(200); if (!/ビーソフテン/.test(document.querySelector('#pop-list [data-action="rx-pick"]').dataset.id)) bad.push('前の言葉の塗り薬が残る');
    if (!(t0 === t1 && t1 === t2)) bad.push('化粧品の追加のシートが動く ' + [t0, t1, t2]); closeModal(true); await w(300);
    openRxSheet(); await w(900); let r0 = top(); for (let i = 0; i < 10; i++) { await w(150); const z = top(); if (z === r0) break; r0 = z; } /* 開くときの動きが終わってから測る（重いときは900ミリ秒では終わらない） */ const rq = document.getElementById('rx-q'); rq.value = 'ペアアクネ'; rq.dispatchEvent(new Event('input')); await w(1000); const r1 = top();
    if (!document.querySelector('#find-list [data-action="find-pick"]')) bad.push('塗り薬の検索に市販薬が出ない'); if (r0 !== r1) bad.push('塗り薬のシートが動く ' + [r0, r1]); closeModal(true); await w(300);
    openFindSheet('my'); await w(900); const f0 = top(); const fq = document.getElementById('find-q'); fq.value = 'ディフェリン'; fq.dispatchEvent(new Event('input')); await w(1000); const f1 = top();
    if (!document.querySelector('#find-list [data-action="rx-pick"]')) bad.push('自分で入力の検索に塗り薬が出ない'); if (f0 !== f1) bad.push('自分で入力のシートが動く'); closeModal(true); await w(300);
    findFetch = keepFF; findState = null; if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 最初の設定から通しで確認して見つかった言い方のずれ：判断した記録の日（「最近の記録」と言わない）・妊娠していないと答えた人に妊娠の注意を出さない・荒れている理由は記録にあることだけ・同じ内容は1つ・成分が分からない物は商品名で
  check('ケア管理の言い方が記録と答えに合っている', await ev(async () => {
    const keep = JSON.stringify(state), keepP = window.isPremium, d = todayStr(); window.isPremium = () => true; const bad = [];
    state.settings.gender = '女性'; const a = {tight: 'some', oilDay: 'tzone', red: 'some', acne: 'some', sens: 'some', preg: 'no'}; state.settings.diag = {a, r: diagCompute(a, ['acne', 'dry'])}; state.settings.concernKeys = ['acne', 'dry'];
    state.myProducts = [{id: 'w1', demo: false, purchases: [], catalogId: null, name: 'ディフェリンゲル0.1%', brand: '処方薬', category: '皮膚科の塗り薬', purposes: [], ingredients: 'アダパレン', timing: '夜', frequency: '毎日', startDate: addDays(d, -3), status: '使用中', endDate: '', memo: '', pao: 0, order: null}, {id: 'w2', demo: false, purchases: [], catalogId: null, name: 'キュレル 潤浸保湿 化粧水', brand: '花王', category: '化粧水・トナー', purposes: [], ingredients: '', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -3), status: '使用中', endDate: '', memo: '', pao: 0, order: null}];
    state.skinLogs = [{id: 'w3', date: d, condition: 3, acneCount: 2, acneTypes: ['赤ニキビ'], dryness: 3, redness: 0, usedProducts: [], memo: '', photo: ''}]; const l = blankLife(d); l.bed = '02:00'; l.wake = '07:00'; state.lifeLogs = [l]; state = normalize(JSON.parse(JSON.stringify(state)));
    const T = ['am', 'pm'].map((sl) => rtPlan(sl).steps.map((z) => z.today.map((t) => t.t).join('／')).join('／')).join('／');
    if (/最近の記録で/.test(T)) bad.push('最近の記録'); if (/妊娠/.test(T)) bad.push('妊娠していない人に妊娠の注意'); if (/赤み・肌あれ|赤み・ヒリヒリが強い/.test(T)) bad.push('赤みがないのに赤み'); if (/「化粧水」は成分/.test(T)) bad.push('成分不明を種類名で');
    if (/皮膚科の薬を使っている間は、レチノール/.test(T) && /がある日は、刺激の強い成分はお休み/.test(T)) bad.push('同じ内容が2つ');
    state = normalize(JSON.parse(keep)); window.isPremium = keepP; render(); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 2026-11-19 全成分の自動の調べ：失敗しても（AIの上限など）ずっと空のままにしない。開き直すたびには調べず、3時間たったら調べ直す
  check('全成分の調べは、失敗したら3時間後にもう一度', await ev(async () => {
    const keepCV = callVision, keepU = acct.user, keep = JSON.stringify(state), d = todayStr(); let n = 0; acct.user = acct.user || {id: 'test'};
    callVision = async () => { n++; throw new Error('AIの回数の上限に達しました'); };
    state.myProducts = [{id: 'of1', demo: false, purchases: [], catalogId: null, name: 'テスト化粧水', brand: 'テスト', category: '化粧水・トナー', purposes: [], ingredients: '', timing: '朝・夜', frequency: '毎日', startDate: d, status: '使用中', endDate: '', memo: '', pao: 0, order: null}];
    await myOffFetch(getMy('of1')); const n1 = n; state = normalize(JSON.parse(JSON.stringify(state))); await myOffFetch(getMy('of1')); const n2 = n; /* 開き直してもすぐには調べない */
    getMy('of1').offErrAt = Date.now() - 4 * 3600 * 1000; await myOffFetch(getMy('of1')); const n3 = n; /* 3時間たったら調べる */
    callVision = keepCV; acct.user = keepU; state = normalize(JSON.parse(keep)); render(); const ok = n1 === 1 && n2 === 1 && n3 === 2; if (!ok) console.log('  ' + [n1, n2, n3]); return ok; }));
  // 2026-11-19 2台（iPhone・Mac）で使うとき：ほかの端末があとで保存した記録を、上書きして消さない（送る前にクラウドを確かめて合わせる）
  check('2台で使っても、ほかの端末の記録を消さない', await ev(async () => {
    const keep = JSON.stringify(state), keepC = acct.client, keepU = acct.user, keepPU = photoUpload, keepAt = SYNC.at, keepPF = SYNC.pulledFor, d = todayStr(); let cloud = null, t = 0;
    const iso = () => new Date(Date.UTC(2030, 0, 1, 0, 0, ++t)).toISOString();
    acct.user = {id: 'u-sync'}; SYNC.pulledFor = 'u-sync'; photoUpload = async () => false;
    acct.client = {from: () => ({select: (cols) => ({eq: () => ({maybeSingle: async () => ({data: cloud ? (cols === 'updated_at' ? {updated_at: cloud.updated_at} : {data: JSON.parse(JSON.stringify(cloud.data)), updated_at: cloud.updated_at}) : null, error: null})})}), upsert: async (row) => { cloud = {data: JSON.parse(JSON.stringify(row.data)), updated_at: iso()}; return {error: null}; }})};
    const mk = (id, date) => ({id, date, condition: 3, acneCount: 0, usedProducts: [], memo: '', photo: ''});
    state.skinLogs = [mk('s1', addDays(d, -2))]; state = normalize(JSON.parse(JSON.stringify(state))); save(); SYNC.at = ''; await syncPush(); /* この端末（A）が送る */
    const B = JSON.parse(JSON.stringify(cloud.data)); B.skinLogs.push(mk('s2', addDays(d, -1))); B.recT = Object.assign({}, B.recT, {'skinLogs|s2': Date.now()}); B.savedAt = Date.now(); cloud = {data: B, updated_at: iso()}; /* ほかの端末（B）があとで記録して送った */
    await new Promise((r) => setTimeout(r, 5)); state.skinLogs.push(normalize({skinLogs: [mk('s3', d)]}).skinLogs[0]); save(); await syncPush(); /* Aが、Bのことを知らずに記録して送る */
    const ids = (cloud.data.skinLogs || []).map((x) => x.id).sort().join(','), local = state.skinLogs.map((x) => x.id).sort().join(',');
    acct.client = keepC; acct.user = keepU; photoUpload = keepPU; SYNC.at = keepAt; SYNC.pulledFor = keepPF; state = normalize(JSON.parse(keep)); render();
    const ok = ids === 's1,s2,s3' && local === 's1,s2,s3'; if (!ok) console.log('  クラウド ' + ids + ' / この端末 ' + local); return ok; }));
  // 2026-11-19 古いiPhone（Safari）でも動く書き方だけを使う：ES2020の文法まで・正規表現の「後ろ読み」を使わない（iOS 16.3以前はアプリ全体が動かなくなる）
  { let ok = true, info = ''; try { const acorn = (() => { try { return require(path.join(__dirname, 'tools/node_modules/acorn')); } catch (e) { return require('acorn'); } })(), html = fs.readFileSync(FILE, 'utf8'); /* 確かめるファイルそのものを読む（クラウドの見回りでも同じに動くように） */
      [...html.matchAll(/<script(?![^>]*src)([^>]*)>([\s\S]*?)<\/script>/g)].forEach(([, attr, c], i) => { if (/json|template/.test(attr)) return; try { acorn.parse(c, {ecmaVersion: 2020, sourceType: 'script'}); } catch (e) { ok = false; info += ` script${i}:${e.message}`; } });
      if (/\(\?<[=!]/.test(html)) { ok = false; info += ' 後ろ読みの正規表現'; }
    } catch (e) { ok = false; info = String(e); }
    check('古いiPhoneでも動く書き方（ES2020・後ろ読みなし）', ok, info); }
  // 2026-11-19 記録が多い人（半年分・商品60個）でも、ホームがすぐ出る
  check('記録が多くても画面がすぐ出る', await ev(async () => { const keep = JSON.stringify(state), keepP = window.isPremium, d = todayStr(); window.isPremium = () => true;
    state.myProducts = Array.from({length: 60}, (_, i) => ({id: 'h' + i, demo: false, purchases: [], catalogId: null, name: 'テスト商品' + i, brand: 'B', category: i < 6 ? '皮膚科の塗り薬' : ['化粧水・トナー', '美容液・アンプル', '乳液', 'クリーム', '日焼け止め'][i % 5], purposes: [], ingredients: i < 6 ? ['アダパレン', 'ヘパリン類似物質', 'タクロリムス', '過酸化ベンゾイル', 'ベタメタゾン吉草酸エステル', 'ケトコナゾール'][i] : '水、グリセリン、BG、ナイアシンアミド、セラミドNP、ヒアルロン酸Na', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -200), status: '使用中', endDate: '', memo: '', pao: 0, order: null}));
    state.skinLogs = Array.from({length: 180}, (_, k) => ({id: 'hl' + k, date: addDays(d, -k), condition: 3, acneCount: k % 4, acneTypes: ['赤ニキビ'], dryness: k % 5, usedProducts: [], memo: '', photo: ''}));
    state = normalize(JSON.parse(JSON.stringify(state))); ui.homeTab = 'care'; location.hash = '#/home'; render(); const t0 = performance.now(); render(); const ms = performance.now() - t0;
    state = normalize(JSON.parse(keep)); window.isPremium = keepP; render(); if (ms > 400) console.log('  ' + Math.round(ms) + 'ms'); return ms <= 400; }));
  // 2026-11-19 よく入っている成分は、成分の一覧で分かる（分からないと、ケア管理で「合うか判断できない」になる）。成分の説明も開ける
  check('よく入っている成分が成分の一覧にある', await ev(async () => { const miss = [];
    for (const w of ['ホホバ種子油', '加水分解コラーゲン', 'ヒトオリゴペプチド-1', 'プラセンタエキス', 'メトキシケイヒ酸エチルヘキシル', '酸化チタン', 'ミネラルオイル', 'カンゾウ根エキス', 'カミツレ花エキス', 'ヘパリン類似物質', 'ベンゾイルパーオキサイド', 'パントテニルエチルエーテル', 'ココイルグルタミン酸Na', 'ナイアシンアミド', 'アスコルビルグルコシド', 'セラミドNP', 'カフェイン', '亜鉛PCA', 'メントール']) if (!masterIngsOf(w).length) miss.push(w);
    for (const k of ['jojoba', 'uvabs', 'heparinoid', 'aminocleanser', 'menthol']) { try { const e = ING_MASTER.find((x) => x.k === k); try { closeModal(true); } catch (er) {} await new Promise((r) => setTimeout(r, 300)); openIngSheet(chipText(e.ja)); await new Promise((r) => setTimeout(r, 300)); if (!document.querySelector('#modal-root .modal')) miss.push('説明が開かない ' + k); closeModal(true); await new Promise((r) => setTimeout(r, 300)); } catch (e) { miss.push(k + ' ' + e.message); } }
    if (miss.length) console.log('  ' + miss); return !miss.length; }));
  // 2026-11-19 料理名の取り違えを減らす：①ほかの候補を押して直せる ②直した名前を覚えて次から優先する ③料理名のヒントを添えられる
  { const run = async (hint) => { await ev(([hint]) => { window.__keepCV2 = window.__keepCV2 || callVision; window.__keepP2 = window.__keepP2 || window.isPremium; window.isPremium = () => true; window.__sent = null;
      callVision = async (mode, img, pl) => { window.__sent = pl; return {result: {items: [{kind: 'dish', name: '鶏の唐揚げとコロッケ', basis: '推定', kcal: 480, p: 15, f: 30, c: 38, salt: 1.8, veg: 0, alts: [{name: 'とんかつ', kcal: 450, p: 22, f: 28, c: 20, salt: 1.2, veg: 0}, {name: 'メンチカツ', kcal: 420, p: 14, f: 30, c: 22, salt: 1.3, veg: 0}]}]}}; };
      state.lifeLogs = []; actions['life-part']('meal'); setTimeout(() => { const h = document.getElementById('meal-hint'); if (h) h.value = hint; }, 200); }, [hint]); await p.waitForTimeout(450);
      const inp = await p.$('#modal-root input[data-mphoto="auto"]'); if (inp) { await inp.setInputFiles(__dirname + '/food_test.jpg'); await p.waitForTimeout(1200); } };
    await ev(() => { state.settings.foodFixes = []; });
    await run('とんかつ定食'); const r1 = await ev(() => ({sent: window.__sent, alt: [...document.querySelectorAll('#modal-root [data-aialt]')].map((b) => b.textContent)}));
    await ev(() => { const b = [...document.querySelectorAll('#modal-root [data-aialt]')].find((x) => x.textContent === 'とんかつ'); if (b) b.click(); }); await p.waitForTimeout(200);
    const r2 = await ev(() => ({t: (document.querySelector('#modal-root [data-pinfo] .notice') || {}).innerText || '', fixes: state.settings.foodFixes})); await ev(() => { try { closeModal(true); } catch (e) {} }); await p.waitForTimeout(300);
    await run(''); const r3 = await ev(() => ({t: (document.querySelector('#modal-root [data-pinfo] .notice') || {}).innerText || '', sent: window.__sent})); await ev(() => { try { closeModal(true); } catch (e) {} callVision = window.__keepCV2; window.isPremium = window.__keepP2; state.settings.foodFixes = []; });
    const ok = r1.sent && r1.sent.hint === 'とんかつ定食' && r1.alt.join() === 'とんかつ,メンチカツ' && /とんかつ/.test(r2.t) && /450kcal/.test(r2.t) && (r2.fixes || []).some((f) => f.from === '鶏の唐揚げとコロッケ' && f.to === 'とんかつ') && /とんかつ/.test(r3.t) && /前に直した名前/.test(r3.t) && (r3.sent.fixes || []).length === 1;
    check('料理名：候補で直せる・直した名前を覚える・ヒントを添えられる', ok, JSON.stringify([r1, r2.fixes, r3.t.slice(0, 80)])); }
  // 2026-11-19 おすすめケアの食事：今日の記録がなくても、この2週間の食事の記録（習慣）から出す。記録がまったくないときは決めつけない
  check('食事のおすすめは、今日の記録がなければ2週間の習慣から', await ev(() => { const keep = JSON.stringify(state), d = todayStr(); const bad = [];
    state.settings.concernKeys = ['acne']; state.skinLogs = [{id: 'hb0', date: d, condition: 3, acneCount: 2, usedProducts: [], memo: '', photo: ''}];
    state.lifeLogs = [1, 2, 3, 4, 5].map((k) => { const l = blankLife(addDays(d, -k)); l.foods = [{id: 'a' + k, meal: 'breakfast', name: '食パン', kcal: 250, p: 8, f: 4, c: 45, veg: 0, qty: 1}, {id: 'b' + k, meal: 'snack', name: 'チョコレート', kcal: 280, p: 3, f: 17, c: 28, veg: 0, qty: 1}]; return l; });
    state = normalize(JSON.parse(JSON.stringify(state))); let D = careTodayData(); const m = D.items.filter((x) => x.cat === '食事').map((x) => x.title + '／' + x.why).join(' ');
    if (!/この2週間の記録（5日分）で、甘い間食が5日/.test(m)) bad.push('甘い間食の習慣 ' + m); if (!/たんぱく質が1日11g/.test(m)) bad.push('たんぱく質の習慣'); if (!D.has['食事']) bad.push('チップが出ない');
    state.lifeLogs = []; state = normalize(JSON.parse(JSON.stringify(state))); D = careTodayData(); if (D.items.some((x) => x.cat === '食事' && !/を記録する$/.test(x.title))) bad.push('記録なしで決めつけ');
    state = normalize(JSON.parse(keep)); if (bad.length) console.log('  ' + bad); return !bad.length; }));
  // 主な画面をすべて開いて、エラーが出ないこと
  for (const h of ['#/home', '#/log', '#/my', '#/combo', '#/combo/ok', '#/combo/ng', '#/combo/search', '#/trouble', '#/account', '#/account/me', '#/account/me/name', '#/routine', '#/mycare', '#/ingredients']) {
    const before = errs.length; await ev((x) => { location.hash = x; }, h); await p.waitForTimeout(250);
    check(`${h} を開いてエラーが出ない`, errs.length === before, errs.slice(before).join(' / '));
  }
  // 2026-11-20 下に引っぱって更新：くるくるが回り続ける・画面が下にずれたまま（上の帯とタブが分かれる）にならない（指を離した合図が来ない／更新が終わらない／更新中にスクロール）。本物の指の動き（タッチ）で確かめる
  { const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), p2 = await ctx2.newPage(), e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
    await p2.route(/^(?!http:\/\/localhost)/, (r) => r.abort()); await p2.goto(URL0); await p2.waitForTimeout(1200);
    await p2.evaluate(() => { state.settings.onboarded = true; state.settings.permAsked2 = true; save(); try { closeModal(true); } catch (e) {} document.querySelectorAll('.pm-ov,.au-ov').forEach((x) => x.remove()); location.hash = '#/home'; render(); window.scrollTo(0, 0); }); await p2.waitForTimeout(500);
    const cdp = await ctx2.newCDPSession(p2), T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
    const pull = async (endIt) => { await T('touchStart', 300); for (let y = 312; y <= 560; y += 12) { await T('touchMove', y); await p2.waitForTimeout(16); } if (endIt) await T('touchEnd'); };
    const st = () => p2.evaluate(() => ({ s: window.__ptrState ? window.__ptrState() : null, tf: document.getElementById('page').style.transform, op: document.getElementById('ptr').style.opacity }));
    const bad = [];
    // ① 指を離した合図が来なくても、戻る
    await pull(false); await p2.waitForTimeout(300); let a = await st(); if (!a.tf) bad.push('引っぱっても更新が始まらない ' + JSON.stringify(a));
    await p2.waitForTimeout(7000); a = await st(); if ((a.s && a.s.phase !== 'idle') || a.tf || a.op === '1') bad.push('指を離した合図がないと、くるくる・ずれが残る ' + JSON.stringify(a));
    // ② 更新が終わらなくても、12秒で戻る
    await p2.evaluate(() => { window.__keepPR = ptrRefresh; ptrRefresh = () => new Promise(() => {}); }); await pull(true); await p2.waitForTimeout(13500); a = await st(); if ((a.s && a.s.phase !== 'idle') || a.tf) bad.push('更新が終わらないと、くるくる・ずれが残る ' + JSON.stringify(a));
    // ③ 更新中にスクロールしたら、すぐ画面のずれを戻す（上の帯とタブが分かれない）
    await pull(true); await p2.waitForTimeout(400); await p2.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 400); window.dispatchEvent(new Event('scroll')); }); await p2.waitForTimeout(200); a = await st(); if (a.tf) bad.push('更新中にスクロールしても、画面が下にずれたまま ' + a.tf);
    await p2.evaluate(() => { ptrRefresh = window.__keepPR; window.scrollTo(0, 0); }); await p2.waitForTimeout(13500);
    // ④ 戻ったあと、もう一度引っぱれる
    await pull(true); await p2.waitForTimeout(3000); a = await st(); if ((a.s && a.s.phase !== 'idle') || a.tf) bad.push('2回目の引っぱりのあと戻らない ' + JSON.stringify(a));
    if (e2.length) bad.push('エラー ' + e2[0]);
    check('下に引っぱって更新：くるくるが回り続けない・画面がずれたまま（上の帯とタブが分かれる）にならない', !bad.length, bad.join(' / ')); await ctx2.close(); }
  // 2026-11-20 パック・シートマスクは、化粧品を追加の検索・人気ランキング・カメラ・入力の種類に出さない
  check('化粧品にパック・シートマスクを入れない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), kf = findFetch;
    const L = [{ name: 'アヌア ドクダミ 化粧水 250ml', site: '楽天市場', price: 2000, url: 'https://e.com/1' }, { name: 'アヌア ドクダミ シートマスク 10枚', site: '楽天市場', price: 1500, url: 'https://e.com/2' }, { name: 'アヌア ドクダミ クレイパック 100ml', site: '楽天市場', price: 1800, url: 'https://e.com/3' }, { name: 'アヌア ドクダミ 化粧水 詰め替え用パック 200ml', site: '楽天市場', price: 1600, url: 'https://e.com/4' }];
    findFetch = async () => L.slice();
    try { findState = { kind: 'my', q: '', items: null, loading: false, err: '', timer: null }; openFindSheet('my'); await w(200); findState = Object.assign(findState || {}, { kind: 'my' }); await findRun('アヌア ドクダミ'); const n = (findState.items || []).map((x) => x.name).join('/');
      if (/シートマスク|クレイパック/.test(n)) bad.push('検索にパックが出る ' + n); if (!/化粧水 250ml/.test(n)) bad.push('化粧水まで消える ' + n); if (!/詰め替え用パック/.test(n)) bad.push('詰め替えのパックまで消える');
      if (isSkinItem({ name: 'メディヒール シートマスク 10枚入' }) || isSkinItem({ name: 'ラボラボ スーパーキープ ウォッシュオフパック' })) bad.push('人気ランキングにパックが入る'); closeModal(true); await w(250);
      openMyForm(); await w(300); if ([...document.querySelectorAll('#my-form [name=category] option')].some((o) => /パック/.test(o.value))) bad.push('入力の種類に「シートマスク・パック」がある'); closeModal(true); await w(250);
      const fs = { kind: 'my', q: '', items: null, loading: false, err: '', timer: null, cam: true }; findState = fs; await camSearch(fs, { brand: 'Anua', name: 'HEARTLEAF' }, 'アヌア ドクダミ', () => {}); if ((fs.items || []).some((x) => /シートマスク|クレイパック/.test(x.name))) bad.push('カメラの候補にパックが出る');
    } catch (e) { bad.push('エラー ' + e.message); } finally { findFetch = kf; findState = null; try { closeModal(true); } catch (e) {} }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 読み込みが止まっても、くるくるが回り続けない（3Dの顔・日焼け止めのSPF・商品の写真選び）
  check('読み込みが止まっても、時間で区切ってやり直せる（3Dの顔・SPF・写真選び）', await ev(async () => { const bad = [], kf = window.fetch, keep = {th: FACE3D.three, me: FACE3D.mesh, lo: FACE3D.loading, T: window.THREE};
    try { const src = await (await kf(location.href.split('#')[0])).text();
      if (!/name:x\.name, url:x\.url \|\| ''\}\)\)\}\)\}\), 25000\)/.test(src)) bad.push('SPFの問い合わせに時間の区切りがない'); if (!/mode:'pickimg', urls:urls\.slice\(0, 8\)\}\)\}\), 25000\)/.test(src)) bad.push('写真選びに時間の区切りがない');
      window.fetch = (u, o) => /face3d\.json/.test(String(u)) ? new Promise(() => {}) : kf(u, o); FACE3D.three = null; FACE3D.mesh = null; FACE3D.loading = null; window.THREE = window.THREE || {};
      const t0 = Date.now(); let r = 'まだ'; await Promise.race([face3dLoad().then(() => { r = '読めた'; }, () => { r = 'あきらめた'; }), new Promise((x) => setTimeout(x, 23000))]);
      if (r !== 'あきらめた') bad.push('3Dの顔の読み込みが止まると、ずっと待つ ' + r); else if (FACE3D.loading) bad.push('あきらめたあと、もう一度読み直せない'); else if (Date.now() - t0 > 22000) bad.push('あきらめるのが遅い');
    } catch (e) { bad.push('エラー ' + e.message); } finally { window.fetch = kf; FACE3D.three = keep.th; FACE3D.mesh = keep.me; FACE3D.loading = keep.lo; if (keep.T) window.THREE = keep.T; }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 カメラの「写真を撮って商品を探す」を出さない／お問い合わせのスクロールバー／画面を移っても全画面の3D・アイコンのメニューが残らない／位置情報の英語の文を出さない／日焼け止めの理由を重ねない／小さい画像に切れた文字を出さない／飲み薬の表記／研究に飲み薬を送らない
  check('写真検索の文字なし・お問い合わせのバー・画面移動で窓を閉じる・英語を出さない・日焼け止めの理由・小さい画像・飲み薬の表記・研究に飲み薬を送らない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), keepPrem = window.isPremium; window.isPremium = () => true;
    try {
      openCamLive('my'); await w(700); const tp = document.getElementById('cl-tip'); if (tp && tp.offsetParent && tp.textContent.trim()) bad.push('カメラに「' + tp.textContent + '」が出る'); const bb = document.querySelector('.cl-ov [data-cl="bar"]'); if (bb) { bb.click(); await w(200); if (!/バーコード/.test((document.getElementById('cl-tip') || {}).textContent || '')) bad.push('バーコードの説明が消えた'); } clStop(); await w(300);
      location.hash = '#/account'; await w(200); render(); await w(200); const sbt = document.querySelector('[data-action="support-open"]'); if (sbt) { sbt.click(); await w(700); const lg = document.getElementById('sp-log'); if (!lg) bad.push('お問い合わせが開かない'); else { if (!/none/.test(getComputedStyle(lg).scrollbarWidth || '')) bad.push('お問い合わせにiPhoneのスクロールバーが出る'); if (!document.querySelector('.sp-page > .msb')) bad.push('お問い合わせに細いスクロールバーがない'); } const cb = document.querySelector('.sp-backbtn'); if (cb) cb.click(); await w(600); }
      const box = document.createElement('div'); box.className = 'f3-full'; box.id = 'f3-full'; document.body.appendChild(box); const av = document.createElement('div'); av.id = 'av-menu'; document.body.appendChild(av);
      location.hash = '#/my'; await w(300); if (document.getElementById('f3-full') || document.getElementById('av-menu')) bad.push('画面を移っても、全画面の3D・アイコンのメニューが残る');
      WX_GEO_ERR = 1; WX_GEO_MSG = 'User denied Geolocation'; openGeoHelp(); await w(200); if (/User denied|Geolocation/.test(document.getElementById('modal-root').innerText)) bad.push('位置情報の英語のメッセージが出る'); closeModal(true); await w(200);
      const d = todayStr(), P0 = (id, name, cat, ing, x) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: cat, purposes: [], ingredients: ing, timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}, x || {});
      state.settings.concernKeys = ['spot', 'acne']; state.myProducts = [P0('r1', 'エピデュオゲル', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル', {timing: '夜'}), P0('o1', 'トランサミン（トラネキサム酸）', ORAL_CAT, 'トラネキサム酸'), P0('o2', 'ビタミンCのサプリメント', ORAL_CAT, 'ビタミンC', {brand: 'サプリ'})]; state = normalize(JSON.parse(JSON.stringify(state)));
      const sun = rtPlan('am').steps.find((z) => z.k === 'sunscreen'); const rxN = sun ? sun.today.filter((t) => t && t.src === '薬') : []; if (rxN.length !== 1) bad.push('日焼け止めの「薬の注意」が' + rxN.length + 'つ'); if (sun && sun.today.some((t) => t && t.src === '肌' && /紫外線で(濃く|悪く)なりやすい/.test(t.t))) bad.push('日焼け止めの理由が重なる');
      if (!/Myアイテム（化粧品・塗り薬・飲み薬）/.test(JSON.stringify(PLAN_ROWS || []))) { const src = await (await fetch(location.href.split('#')[0])).text(); if (!/Myアイテム（化粧品・塗り薬・飲み薬）/.test(src)) bad.push('プランの表に飲み薬がない'); }
      const rs = researchSummary(); if (JSON.stringify(rs).match(/飲み薬|サプリ|トラネキサム/)) bad.push('研究のデータに飲み薬・サプリが入る');
      const css = await (await fetch(location.href.split('#')[0])).text(); if (!/\.ngf-th \.thumb \.ph[^{]*\{font-size:0/.test(css)) bad.push('小さい画像に種類の文字が出る');
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { clStop(); } catch (e) {} try { closeModal(true); } catch (e) {} document.querySelectorAll('#f3-full,#av-menu,.au-ov').forEach((x) => x.remove()); state = normalize(JSON.parse(keep)); window.isPremium = keepPrem; location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 AIのケア説明に送る内容：薬は商品名ではなく成分名で送る（プライバシーポリシーどおり）
  check('AIに送るケアの内容で、薬は商品名を送らない', await ev(async () => { const bad = [], keep = JSON.stringify(state), kv = callVision, kp = window.isPremium; let sent = null; window.isPremium = () => true;
    try { const d = todayStr(), P0 = (id, name, cat, ing, x) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: '処方薬', category: cat, purposes: [], ingredients: ing, timing: '夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}, x || {});
      state.settings.concernKeys = ['acne']; state.myProducts = [P0('r1', 'エピデュオゲル', '皮膚科の塗り薬', 'アダパレン・過酸化ベンゾイル'), P0('r2', 'ヒルドイドソフト軟膏0.3%', '皮膚科の塗り薬', 'ヘパリン類似物質', {timing: '朝・夜'}), P0('o1', 'トランサミン（トラネキサム酸）', ORAL_CAT, 'トラネキサム酸'), P0('c1', 'テスト 化粧水', '化粧水・トナー', '水、グリセリン', {brand: 'テスト', timing: '朝・夜'})]; state = normalize(JSON.parse(JSON.stringify(state)));
      callVision = async (m, img, data) => { if (m === 'care') sent = data; return {result: {text: 'テスト'}}; }; try { await careAiRun(); } catch (e) { /* 画面がなくてもよい */ }
      if (!sent) bad.push('AIに送られなかった（確認できない）'); else if (/エピデュオ|ヒルドイド|トランサミン/.test(JSON.stringify(sent))) bad.push('薬の商品名を送っている ' + JSON.stringify(sent).match(/.{0,20}(エピデュオ|ヒルドイド|トランサミン).{0,10}/)[0]);
    } catch (e) { bad.push('エラー ' + e.message); } finally { callVision = kv; window.isPremium = kp; state = normalize(JSON.parse(keep)); try { closeModal(true); } catch (e) {} render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 飲み薬が化粧品の欄に入っていた：どこから登録しても、飲み薬・塗り薬はその欄に入れる。化粧品の検索でも、飲み薬・塗り薬は出す。「内服薬」は「飲み薬」に
  check('飲み薬・塗り薬は化粧品の欄に入らない（化粧品の検索から選んでも・入力しても・前のデータも）・「飲み薬」の表記', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), kf = findFetch;
    const L = [{name: 'ハイチオールC ホワイティア 120錠 第3類医薬品', site: '楽天市場', price: 2000, url: 'https://e.com/1'}, {name: 'ビタミンC 美容液 30ml', site: '楽天市場', price: 1500, url: 'https://e.com/2'}, {name: 'DHC ビタミンC ハードカプセル 60日分', site: '楽天市場', price: 400, url: 'https://e.com/3'}, {name: 'オロナインH軟膏 100g 第2類医薬品', site: '楽天市場', price: 900, url: 'https://e.com/4'}];
    try { findFetch = async () => L.slice(); state.myProducts = [];
      const openAdd = async () => { for (let k = 0; k < 6; k++) { try { closeModal(true); } catch (e) {} await w(250); location.hash = '#/my'; await w(150); openAddSheet('my'); for (let t = 0; t < 10; t++) { await w(150); if (document.getElementById('pop-q')) return document.getElementById('pop-q'); } } return null; };
      const kindOf = (nm) => { const x = state.myProducts.find((p) => p.name.includes(nm)); return x ? x.category : 'なし'; };
      for (const [nm, want] of [['ハイチオール', ORAL_CAT], ['DHC', ORAL_CAT], ['ビタミンC 美容液', '美容液・アンプル'], ['オロナイン', '皮膚科の塗り薬']]) {
        const q = await openAdd(); if (!q) { bad.push('化粧品を追加の画面が開かない'); continue; } q.value = nm; q.dispatchEvent(new Event('input')); await w(1100);
        const items = (findState && findState.items) || []; const i = items.findIndex((x) => x.name.includes(nm)); if (i < 0) { bad.push('化粧品の検索に「' + nm + '」が出ない'); closeModal(true); await w(250); continue; }
        findPick(i); await w(700); try { closeModal(true); } catch (e) {} await w(250); const c = kindOf(nm); if (c !== want && !(want === '美容液・アンプル' && !isMedCat(c))) bad.push(`「${nm}」が ${c} に入る（${want} のはず）`); }
      const q2 = await openAdd(); if (!q2) throw new Error('化粧品を追加の画面が開かない'); q2.value = 'トランサミン'; q2.dispatchEvent(new Event('input')); await w(400); const rb = document.querySelector('#pop-list [data-action="rx-pick"][data-id="トランサミン（トラネキサム酸）"]'); if (!rb) bad.push('化粧品の検索に、飲み薬の一覧の物が出ない'); else { rb.click(); await w(700); if (kindOf('トランサミン') !== ORAL_CAT) bad.push('化粧品の検索から選んだ飲み薬が、飲み薬の欄に入らない'); } try { closeModal(true); } catch (e) {} await w(250);
      openMyForm(); await w(300); const f = document.getElementById('my-form'); f.elements.name.value = 'ネイチャーメイド マルチビタミン 100粒'; f.elements.brand.value = 'テスト'; f.elements.category.value = '美容液・アンプル'; f.requestSubmit(); await w(500); try { closeModal(true); } catch (e) {} if (kindOf('マルチビタミン') !== ORAL_CAT) bad.push('化粧品の種類で入力したサプリが、化粧品の欄に入る');
      const old = JSON.parse(keep); old.myProducts = [{id: 'm1', name: 'ファンケル ビタミンC 90粒', brand: 'テスト', category: '美容液・アンプル', ingredients: '', timing: '朝', frequency: '毎日', startDate: todayStr(), status: '使用中', purchases: []}, {id: 'm2', name: 'メラノCC 薬用しみ集中対策 美容液', brand: 'テスト', category: '美容液・アンプル', ingredients: '', timing: '朝・夜', frequency: '毎日', startDate: todayStr(), status: '使用中', purchases: []}];
      const n0 = normalize(old); if (n0.myProducts[0].category !== ORAL_CAT) bad.push('前のデータの化粧品の欄のサプリが、そのまま'); if (n0.myProducts[1].category === ORAL_CAT) bad.push('ビタミンCの美容液まで飲み薬にしてしまう');
      ui.myKind = 'oral'; location.hash = '#/my'; await w(200); render(); await w(200); if (/内服薬/.test(document.getElementById('main').innerText)) bad.push('「内服薬」の表記が残る'); if (!/飲み薬/.test(document.querySelector('.my-tabs').innerText)) bad.push('タブが「飲み薬」になっていない');
    } catch (e) { bad.push('エラー ' + e.message); } finally { findFetch = kf; findState = null; try { closeModal(true); } catch (e) {} state = normalize(JSON.parse(keep)); ui.myKind = 'cos'; location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 プライバシーポリシーに飲み薬・サプリの扱いを書き足し、前から使っている人に1回だけ改定のお知らせを出す
  check('プライバシーポリシーの飲み薬・サプリの追記と、改定のお知らせ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try { const pv = document.createElement('div'); pv.innerHTML = viewPrivacy(); const t = pv.textContent.replace(/[\u200b\s]/g, ''); /* 画面の切り替え（前の確認の残り）に左右されないように、中身を直接作る */
      [['最終改定日：2026年11月21日', '改定日'], ['性別・生年月日・身長・体重', 'プロフィール'], ['塗り薬・飲み薬・サプリメントを含みます', '基本の考え方'], ['健康に関する情報', '取得する情報'], ['要配慮個人情報', '要配慮個人情報'], ['続けるかやめるかの判断には使いません', '利用目的'], ['飲み薬・サプリメントの情報は、研究には送りません', '研究'], ['薬の商品名は送りません', 'Gemini']].forEach(([k, n]) => { if (!t.includes(k)) bad.push('ポリシーに「' + n + '」の追記がない'); });
      if (/内服薬/.test(t)) bad.push('ポリシーに「内服薬」が残る');
      state.settings.policySeen = ''; state.myProducts = [{id: 'pp', name: 'テスト', brand: 'テスト', category: '化粧水・トナー', status: '使用中', timing: '朝', frequency: '毎日', startDate: todayStr(), purchases: []}]; state = normalize(JSON.parse(JSON.stringify(state))); if (!/pol-note/.test(policyNoticeHtml())) bad.push('前から使っている人に改定のお知らせが出ない');
      { const src = await (await fetch(location.href.split('#')[0])).text(); if (!/onboard \+ policyNoticeHtml\(\) \+ startHtml\(\)/.test(src)) bad.push('ホームに改定のお知らせを出す所がない'); }
      actions['policy-seen'](); await w(200); if (/pol-note/.test(policyNoticeHtml())) bad.push('閉じても改定のお知らせが残る'); if (normalize(JSON.parse(JSON.stringify(state))).settings.policySeen !== POLICY_VER) bad.push('お知らせを見たことが保存されない');
      state.myProducts = []; state.skinLogs = []; state.settings.policySeen = ''; if (/pol-note/.test(policyNoticeHtml())) bad.push('はじめて使う人にも改定のお知らせが出る');
    } catch (e) { bad.push('エラー ' + e.message); } finally { state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 健康に関する情報（要配慮個人情報）を扱うため、ログインのときにプライバシーポリシーへの同意をもらう。前からログインしている人には1回だけ聞き、同意しない人はバックアップを止める
  check('ログイン時のプライバシーポリシーの同意と、同意しない人のバックアップ停止', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), ku = acct.user, kc = acct.client, kp = SYNC.pulledFor, kcd = window.confirmDialog;
    try {
      try { localStorage.removeItem('nk_pol_ok'); } catch (e) {}
      const pr = openAuth('login'); await w(350); const ov = document.querySelector('.au-ov');
      if (!ov || !ov.querySelector('#au-agree')) bad.push('ログインの画面に同意のチェックがない');
      else { if (!/健康に関する情報/.test(ov.querySelector('#au-agree').closest('label').textContent.replace(/\u200b/g, ''))) bad.push('同意のチェックに健康に関する情報のことが書いていない');
        ov.querySelector('#au-email').value = 'a@example.com'; ov.querySelector('#au-pw').value = 'abc12345'; ov.querySelector('[data-au="login"]').click(); await w(150);
        if (!/同意/.test(ov.querySelector('.au-err').textContent)) bad.push('同意にチェックしないでもログインに進む');
        const g = ov.querySelector('[data-au="google"]'); if (g) { ov.querySelector('.au-err').textContent = ''; g.click(); await w(150); if (!document.querySelector('.au-ov') || !/同意/.test(document.querySelector('.au-ov .au-err').textContent)) bad.push('同意にチェックしないでもGoogleでログインに進む'); }
        ov.querySelector('[data-au="close"]').click(); } await pr; await w(300);
      { const src = await (await fetch(location.href.split('#')[0])).text(); if (!/if \(error\) throw error;\s*policyAgree\(\);\s*return done\('ログインしました'\)/.test(src)) bad.push('ログインできたときに同意を記録しない'); if (!/wantSync = [^\n]*\n\s*policyAgree\(\);/.test(src)) bad.push('新規登録のときに同意を記録しない'); if (!/removeItem\('nk_pol_ok'\)/.test(src)) bad.push('ログアウトしても同意の記録が端末に残る'); }
      // 前からログインしている人
      state.settings.policyAgreed = ''; state.settings.backupPaused = false; state.settings.policySeen = ''; acct.user = {id: 'u-pol', email: 'a@example.com'}; acct.client = acct.client || {}; SYNC.pulledFor = 'u-pol'; try { closeModal(true); } catch (e) {}
      document.getElementById('modal-root').innerHTML = '';
      policyGate(); await w(250); let po = document.getElementById('pol-ov');
      if (!po) bad.push('同意していない人に同意のお願いが出ない');
      else { if (!/健康に関する情報/.test(po.textContent.replace(/\u200b/g, ''))) bad.push('同意のお願いに健康に関する情報のことが書いていない');
        po.querySelector('[data-pol="no"]').click(); await w(300);
        if (!state.settings.backupPaused) bad.push('同意しないを押してもバックアップが止まらない'); if (syncOn()) bad.push('同意しない人もバックアップが続く');
        if (document.getElementById('pol-ov')) bad.push('同意しないを押しても画面が閉じない');
        policyGate(); await w(250); if (document.getElementById('pol-ov')) bad.push('同意しないを選んだあとも、何度も同意のお願いが出る');
        if (!/policy-resume/.test(syncCardHtml())) bad.push('バックアップを止めていることと、再開のボタンが出ない'); if (/自動でバックアップしています|バックアップ先/.test(syncCardHtml())) bad.push('止めているのに「バックアップしています」と出る');
        if (!normalize(JSON.parse(JSON.stringify(state))).settings.backupPaused) bad.push('バックアップを止めたことが保存されない');
        let msg = ''; window.confirmDialog = async (m) => { msg = m; return false; }; acct.busy = false; await logoutAndWipe(); if (!/元に戻せません/.test(msg)) bad.push('バックアップを止めた人がログアウトするとき、記録が消えると知らせない'); window.confirmDialog = kcd;
        policyAgree(); if (!syncOn()) bad.push('同意したあともバックアップが止まったまま'); if (normalize(JSON.parse(JSON.stringify(state))).settings.policyAgreed !== POLICY_VER) bad.push('同意したことが保存されない');
        state.myProducts = [{id: 'pp', name: 'テスト', brand: 'テスト', category: '化粧水・トナー', status: '使用中', timing: '朝', frequency: '毎日', startDate: todayStr(), purchases: []}]; state.settings.policySeen = ''; if (/pol-note/.test(policyNoticeHtml())) bad.push('同意した人にも改定のお知らせが出る');
      }
      // 同意した人には出ない
      state.settings.backupPaused = false; state.settings.policyAgreed = POLICY_VER; policyGate(); await w(250); if (document.getElementById('pol-ov')) bad.push('同意した人にも同意のお願いが出る');
      // クラウドの設定で上書きされても、この端末で同意していれば聞き直さない
      state.settings.policyAgreed = ''; try { localStorage.setItem('nk_pol_ok', POLICY_VER); } catch (e) {} policyGate(); await w(250); if (document.getElementById('pol-ov')) bad.push('この端末で同意したのに、また同意のお願いが出る');
    } catch (e) { bad.push('エラー ' + e.message); } finally { window.confirmDialog = kcd; const o = document.getElementById('pol-ov'); if (o) o.remove(); document.querySelectorAll('.au-ov').forEach((x) => x.remove()); try { localStorage.removeItem('nk_pol_ok'); } catch (e) {} acct.user = ku; acct.client = kc; SYNC.pulledFor = kp; acct.busy = false; state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-20 アカウントの設定を6つの区分（プロフィール・肌の情報・アプリ設定・データ・サービス・サポート）に整理。前からある項目が1つも消えず、正しい区分に入り、押すと前と同じ中身が出ること
  check('アカウントの設定が6つの区分に整理され、全部の項目が正しい区分にあり、前と同じように動く', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      state.settings.onboarded = true; document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      state.skinLogs.push({id: 'demo-x', date: todayStr(), demo: true, condition: 3}); // デモデータがあるときの「デモデータを削除」
      location.hash = '#/account'; await w(400); render(); await w(200);
      const want = [['プロフィール', ['性別', '生年月日', '身長', '体重']], ['肌の情報', ['肌質', '肌悩み'].concat(state.settings.gender === '男性' ? [] : ['妊娠・授乳'])], ['アプリ設定', ['お知らせ', '画面の表示', 'アプリとして使う']], ['データ', ['データ']], ['サービス', ['ナカカラモについて', '研究への協力']], ['サポート', ['プライバシー', 'お問い合わせ']]];
      const hs = [...document.querySelectorAll('#main .acc-grp-h')].map((h) => h.textContent.trim());
      if (hs.join(',') !== want.map((x) => x[0]).join(',')) bad.push('区分の見出しが違う：' + hs.join(','));
      [...document.querySelectorAll('#main .acc-grp-h')].forEach((h, i) => { const rows = [...h.nextElementSibling.querySelectorAll('.acc-row b')].map((b) => b.textContent.trim()); if (want[i] && rows.join(',') !== want[i][1].join(',')) bad.push(`「${h.textContent}」の項目が違う：${rows.join(',')}`); });
      const rows = [...document.querySelectorAll('#main .acc-grp .acc-row')]; const st = rows.map((r) => getComputedStyle(r)); if (new Set(st.map((x) => x.paddingLeft + x.fontSize)).size !== 1) bad.push('項目の左の余白・文字の大きさがそろっていない');
      if (rows.some((r) => r.getBoundingClientRect().height < 44)) bad.push('項目が小さくて押しにくい');
      if (rows.some((r) => !r.querySelector('svg'))) bad.push('アイコンがない項目がある');
      // 前からある設定の枠が、どこかの項目のページに必ず入っている（消えていない）
      const t = document.createElement('template'); t.innerHTML = embedView(viewSettings); const titles = [...t.content.children].filter((c) => c.classList.contains('card')).map((c) => { const h = c.querySelector('.card-h h2'); return h ? h.textContent.trim() : ''; }).filter((x) => x && !/^(プラン・アカウント|記録のリマインダー)$/.test(x));
      const D = accItemDefs(), pages = {}; for (const k of Object.keys(D)) { if (D[k].hide || !D[k].html) continue; pages[k] = D[k].html(); if (!pages[k] || pages[k].length < 40) bad.push(`「${D[k].t}」のページが空`); }
      const all = Object.values(pages).join('');
      const conc = {'身長・体重': 'acc-num-form', '肌質・性別・生年月日・肌悩み': 'st-concern2', '自動バックアップ': 'sync-sub', 'データの保存状況': '保存状況', 'すべてのデータを削除': 'delete-all', 'デモデータ': 'demo-remove'};
      titles.forEach((x) => { const needle = conc[x] || x; if (!all.includes(needle)) bad.push(`前からある「${x}」が、どの項目にも入っていない`); });
      for (const [k, needle] of [['gender', 'acc-gender'], ['age', 'bd-wheel'], ['height', 'acc-num-form'], ['weight', 'acc-num-form'], ['skintype', 'data-action="setup"'], ['concerns', 'st-concern2'], ['display', 'data-action="theme"'], ['data', 'delete-all'], ['data', 'sync-sub'], ['research', '研究'], ['privacy', 'プライバシーポリシー'], ['about', 'サービス名']]) if (!(pages[k] || '').includes(needle)) bad.push(`「${D[k].t}」のページに、前と同じ設定がない`);
      // 押すと開く・タイトル・戻る
      location.hash = '#/account/s/gender'; await w(400); if (!document.querySelector('#main .pick-row')) bad.push('「性別」を押しても開かない'); if (!/性別/.test((document.querySelector('.topbar') || document.body).textContent)) bad.push('項目のページの上に名前が出ない');
      const pr0 = document.querySelector('#main .pick-row'); if (pr0) { pr0.click(); await w(700); if (state.settings.gender !== '男性') bad.push('性別を変えても保存されない'); }
      location.hash = '#/account'; await w(400); if (!/男性/.test((document.getElementById('acc-it-gender') || {}).textContent || '')) bad.push('一覧に今の性別が出ない');
      if (!document.querySelector('#acc-it-support[data-action="support-open"]')) bad.push('お問い合わせが前と同じに開かない');
      for (const old of ['body', 'settings', 'privacy', 'settings/0']) { location.hash = '#/account/' + old; await w(400); if (/^#\/account\/(body|settings|privacy)/.test(location.hash)) bad.push(`前の画面（${old}）へのリンクが行き止まり`); }
      { const src = await (await fetch(location.href.split('#')[0])).text(); if (/#\/account\/(body|settings|privacy)['"]/.test(src)) bad.push('前の区分へのリンクが残る'); if (/「設定」の「肌質・年代」|先に「肌質・年代」/.test(src)) bad.push('なくなった区分の名前が説明に残る'); }
    } catch (e) { bad.push('エラー ' + e.message); } finally { state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 年代を生年月日に変える（年代は生年月日から自動で決める）。性別・生年月日・身長・体重は、アカウントの一覧で押したらすぐ変えられる。ログインのまちがいの知らせは、ログインボタンのすぐ上に出す
  check('生年月日・その場で変える性別と身長体重・ログインのまちがいの知らせの位置', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      // 生年月日から年代（誕生日の前日・当日）
      for (const [bd, t, want] of [['2008-11-22', '2026-11-21', '17歳以下'], ['2008-11-21', '2026-11-21', '18〜19歳'], ['2000-01-01', '2026-11-21', '20代'], ['1966-11-22', '2026-11-21', '50代'], ['1966-11-21', '2026-11-21', '60代以上']]) { const a = ageOfBirth(bd, t); const band = a < 18 ? '17歳以下' : a < 20 ? '18〜19歳' : a < 60 ? `${Math.floor(a / 10) * 10}代` : '60代以上'; if (band !== want) bad.push(`${bd}生まれ（${t}）の年代が${band}`); }
      if (validBirth('2026-02-30') || validBirth('2999-01-01') || validBirth('abc')) bad.push('ありえない生年月日を受け付ける');
      { const n = normalize(Object.assign(JSON.parse(keep), {settings: Object.assign(JSON.parse(keep).settings, {birthDate: '1995-05-05', ageBand: '60代以上'})})); if (n.settings.birthDate !== '1995-05-05' || n.settings.ageBand !== ageBandOfBirth('1995-05-05')) bad.push('生年月日が保存されない・年代が生年月日に合わない'); }
      { const src = await (await fetch(location.href.split('#')[0])).text(); if (/id="f_ageBand"|swOpts\('ageBand'/.test(src)) bad.push('年代を選ぶ欄が残っている'); if (!/au-in:-webkit-autofill/.test(src)) bad.push('自動入力の欄が黄色くなる'); }
      // 2026-11-21 性別・生年月日・身長・体重は、押すとそれぞれのページが開いて設定できる。生年月日はカレンダーではなく、くるくる回して選ぶ形
      state.settings.onboarded = true; document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      location.hash = '#/account'; await w(400); render(); await w(200);
      for (const k of ['gender', 'age', 'height', 'weight']) { const r = document.getElementById('acc-it-' + k); if (!r || r.getAttribute('href') !== '#/account/s/' + k) bad.push(`${k}を押してもページが開かない`); }
      if (!/生年月日/.test((document.getElementById('acc-it-age') || {}).textContent || '')) bad.push('一覧に「生年月日」がない');
      // 性別
      location.hash = '#/account/s/gender'; await w(450); const gb = [...document.querySelectorAll('#main .pick-row')];
      if (gb.map((b) => b.textContent.trim()).join(',') !== '男性,女性,回答しない') bad.push('性別のページの選ぶところが違う');
      else { gb[0].click(); await w(700); if (state.settings.gender !== '男性') bad.push('性別を選んでも保存されない'); if (location.hash !== '#/account') bad.push('性別を選んだあと一覧に戻らない'); await w(200); if (!/男性/.test((document.getElementById('acc-it-gender') || {}).textContent || '')) bad.push('選んだ性別が一覧に出ない'); }
      // 生年月日：回して選ぶ
      location.hash = '#/account/s/age'; await w(500); const wh = document.getElementById('bd-wheel');
      if (!wh || wh.querySelectorAll('.wh-col').length !== 3) bad.push('生年月日が、年・月・日を回して選ぶ形になっていない');
      else { if (document.querySelector('#main input[type="date"]')) bad.push('生年月日にカレンダーの欄が残っている');
        const col = (k) => wh.querySelector('.wh-' + k), idxOf = (k, v) => [...col(k).querySelectorAll('.wh-it')].findIndex((x) => Number(x.dataset.v) === v);
        if (whVal('y') !== 2000 || whVal('m') !== 1 || whVal('d') !== 1) bad.push('まだ設定していないとき、2000年1月1日から始まらない');
        if (getComputedStyle(col('y')).scrollSnapType.indexOf('y') < 0) bad.push('回したとき、1つずつ止まらない');
        whTo(col('y'), idxOf('y', 2001)); whTo(col('m'), idxOf('m', 2)); whTo(col('d'), idxOf('d', 31)); whSettle(col('d')); await w(700);
        if (whVal('d') !== 28) bad.push('2月31日のような、ない日を選べてしまう（' + whVal('d') + '日）');
        whTo(col('y'), idxOf('y', 1990)); whTo(col('m'), idxOf('m', 4)); whTo(col('d'), idxOf('d', 10)); whSettle(col('d')); await w(300);
        if (document.getElementById('bd-band') || /年代：/.test(document.getElementById('main').textContent)) bad.push('生年月日の下に年代の文が残っている'); // 2026-11-21 年代の文は消す
        document.querySelector('[data-action="acc-birth-save"]').click(); await w(500);
        if (state.settings.birthDate !== '1990-04-10' || state.settings.ageBand !== ageBandOfBirth('1990-04-10')) bad.push('生年月日を選んで保存しても保存されない：' + state.settings.birthDate);
        await w(200); if (!/1990年4月10日/.test((document.getElementById('acc-it-age') || {}).textContent || '')) bad.push('選んだ生年月日が一覧に出ない');
        location.hash = '#/account/s/age'; await w(500); if (whVal('y') !== 1990 || whVal('m') !== 4 || whVal('d') !== 10) bad.push('もう一度開くと、保存した生年月日の位置になっていない'); }
      // 身長・体重：それぞれのページで1つだけ
      for (const [k, v, unit] of [['height', '170', 'cm'], ['weight', '６２．５', 'kg']]) { const nm = k === 'height' ? '身長' : '体重';
        location.hash = '#/account/s/' + k; await w(450); const f = document.getElementById('acc-num-form'), inp = document.getElementById('acc-num-in');
        if (!f || !inp) { bad.push(`${nm}のページに入力がない`); continue; }
        if (f.querySelectorAll('input:not([switch])').length !== 1) /* 押したときの振動用の見えないスイッチは数えない */ bad.push(`${nm}のページに、ほかの入力欄も出る`);
        inp.value = '5'; f.requestSubmit(); await w(200); if (!/の数字で入力/.test(f.textContent.replace(/\u200b/g, ''))) bad.push('ありえない数字でもエラーが出ない');
        inp.value = v; f.requestSubmit(); await w(600); const want = k === 'height' ? 170 : 62.5;
        if (state.settings[k] !== want) bad.push(`${nm}が保存されない（${state.settings[k]}）`);
        if (!new RegExp(String(want) + unit).test((document.getElementById('acc-it-' + k) || {}).textContent || '')) bad.push(`${nm}が一覧に出ない`); }
      // はじめの質問：年代ではなく生年月日
      { const tmp = document.createElement('div'); swState = {v: {birthDate: ''}}; tmp.innerHTML = swStepHtml('age'); swState = null; if (!tmp.querySelector('.wh .wh-y') || tmp.querySelector('input[type="date"]') || /20代/.test(tmp.textContent)) bad.push('はじめの質問の生年月日が、回して選ぶ形になっていない'); }
      // ログイン：まちがいの知らせはログインボタンのすぐ上・見えない空白や全角が入っていても通る・入れ直すと消える
      if (authErrMsg({message: 'Invalid login credentials'}) !== 'メールアドレスまたはパスワードを正しく入力してください') bad.push('メールアドレス・パスワードがちがうときの知らせが違う');
      const pr = openAuth('login'); await w(350); const ov = document.querySelector('.au-ov');
      const er = ov.querySelector('.au-err'), go = ov.querySelector('[data-au="login"]'); const nx = (el) => el && el.nextElementSibling; if (!er || !(nx(er) === go || (nx(er) && nx(er).contains(go)))) bad.push('まちがいの知らせがログインボタンのすぐ上にない');
      ov.querySelector('#au-email').value = 'ｔａｒｏ@example.com​ '; ov.querySelector('#au-pw').value = ''; go.click(); await w(150);
      if (!/パスワードを入力/.test(ov.querySelector('.au-err').textContent.replace(/\u200b/g, ''))) bad.push('自動入力などで見えない空白・全角が入ると、正しいメールアドレスでもエラーになる：' + ov.querySelector('.au-err').textContent);
      ov.querySelector('#au-pw').dispatchEvent(new Event('input', {bubbles: true})); await w(50); if (!ov.querySelector('.au-err').hidden) bad.push('入れ直しても、前のまちがいの知らせが残る');
      ov.querySelector('[data-au="close"]').click(); await pr; await w(300);
      const pr2 = openAuth('signup'); await w(350); const ov2 = document.querySelector('.au-ov'); if (!ov2 || !(nx(ov2.querySelector('.au-err')) === ov2.querySelector('.au-go') || (nx(ov2.querySelector('.au-err')) || document.body).contains(ov2.querySelector('.au-go')) && nx(ov2.querySelector('.au-err')) !== null)) bad.push('登録の画面でも、まちがいの知らせがボタンのすぐ上にない'); ov2.querySelector('[data-au="close"]').click(); await pr2; await w(300);
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { closeModal(true); } catch (e) {} document.querySelectorAll('.au-ov').forEach((x) => x.remove()); state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 見回り：Myアイテムで長押しして並べ替え中に、指を離した合図が来ないと、元に戻るまで5秒以上かかることがあった（確かめる間かくが1秒おきだった）
  check('並べ替え中に指を離した合図が来なくても、5秒ほどで必ず元に戻る', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      const d = todayStr(); state.settings.onboarded = true; state.myProducts = [0, 1, 2].map((i) => ({ id: 'rg' + i, demo: false, purchases: [], catalogId: null, name: 'テスト化粧水' + i, brand: 'テスト', category: '化粧水・トナー', purposes: [], ingredients: '水', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -5), status: '使用中', endDate: '', memo: '', pao: 0, order: null }));
      state = normalize(JSON.parse(JSON.stringify(state))); try { closeModal(true); } catch (e) {} await w(800); /* 前の確かめの画面の切り替えが終わるのを待つ */
      for (let k = 0; k < 10 && !document.querySelector('.mrow-w'); k++) { ui.myKind = 'cos'; location.hash = '#/my'; await w(300); render(); await w(200); }
      for (const off of [0, 333, 666]) { /* 確かめる時刻のずれ方を変えて3回 */
        await w(off); const row = document.querySelector('.mrow-w .mrow-in') || document.querySelector('.mrow-w'); if (!row) { bad.push('Myアイテムの行がない'); break; }
        const r = row.getBoundingClientRect(), t0 = performance.now();
        row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        await w(600); if (!document.body.classList.contains('m-dragging')) { bad.push('長押ししても持ち上がらない'); break; }
        while (document.body.classList.contains('m-dragging') && performance.now() - t0 < 9000) await w(20);
        const dt = performance.now() - t0; if (dt > 5700) bad.push(`元に戻るまで${Math.round(dt)}ミリ秒かかった`); await w(400); }
    } catch (e) { bad.push('エラー ' + e.message); } finally { document.body.classList.remove('m-dragging'); try { closeModal(true); } catch (e) {} state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 アカウントの「肌質」は、開いたらすぐ診断結果が出て、すぐ下に「診断をやり直す」。生年月日は、回している間もなめらかに数字が変わる
  check('肌質を開くとすぐ診断結果とやり直すボタン・生年月日がなめらかに回る', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      state.settings.onboarded = true; document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      await w(600); /* 前の確かめの画面の移り変わりが終わるのを待つ */ state.settings.diag = null; location.hash = '#/account/s/skintype'; await w(450); if (location.hash !== '#/account/s/skintype') { location.hash = '#/account/s/skintype'; await w(450); } render(); await w(150);
      if (!/まだ肌質診断をしていません/.test(document.getElementById('main').textContent.replace(/​/g, '')) || !document.querySelector('#main [data-action="setup"]')) bad.push('まだ診断していない人に、診断するボタンが出ない（' + location.hash + '：' + document.getElementById('main').textContent.replace(/\s+/g, ' ').slice(0, 100) + '）');
      state.settings.diag = {a: {}, r: diagCompute({}, [])}; location.hash = '#/account'; await w(300); location.hash = '#/account/s/skintype'; await w(450);
      const top = document.querySelector('#main .dg-top'), d = diagNow();
      if (!top) bad.push('肌質を開いても、すぐ診断結果が出ない');
      else { if (!top.querySelector('.dg-type') || top.querySelector('.dg-type').textContent.replace(/​/g, '') !== typeLabel(d)) bad.push('診断結果の肌質が違う');
        const rb = top.querySelector('[data-action="setup"]'); if (!rb || !/診断をやり直す/.test(rb.textContent.replace(/​/g, ''))) bad.push('診断結果のすぐ近くに「診断をやり直す」がない');
        if (document.querySelectorAll('#main [data-action="setup"]').length !== 1) bad.push('やり直すボタンが2つある'); }
      { const hs = [...document.querySelectorAll('#main .card-h h2')].filter((h) => h.offsetParent && /肌質の特徴/.test(h.textContent.replace(/\u200b/g, ''))); if (!hs.length) bad.push('診断結果のくわしい内容（見出しつき）が出ない'); }
      // 生年月日：回している間に、まん中の数字が変わる（止まるまで待たない）・離れた数字は薄く傾く
      location.hash = '#/account/s/age'; await w(500); const c = document.querySelector('#bd-wheel .wh-y');
      if (!c) bad.push('生年月日の回すところがない');
      else { const its = [...c.querySelectorAll('.wh-it')], on0 = c.querySelector('.wh-it.on'); const i0 = its.indexOf(on0);
        c.scrollTop = (i0 + 3) * 40; c.dispatchEvent(new Event('scroll')); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (its.indexOf(c.querySelector('.wh-it.on')) !== i0 + 3) bad.push('回している間、まん中の数字がすぐ変わらない（止まるまで待つ）');
        const mid = its[i0 + 3], far = its[i0 + 5]; if (!(Number(mid.style.opacity) > Number(far.style.opacity))) bad.push('まん中から離れた数字が薄くならない');
        if (!/rotateX/.test(far.style.transform)) bad.push('離れた数字が傾かない');
        if (/font-size/.test([...document.styleSheets].map((ss) => { try { return [...ss.cssRules].map((r) => r.cssText).join(''); } catch (e) { return ''; } }).join('').match(/\.wh-it\.on\s*\{[^}]*\}/) || '')) bad.push('まん中の数字だけ大きさが変わり、カクッと動く');  if (Number(getComputedStyle(c.querySelector('.wh-it.on') || c).fontWeight) > 500) bad.push('生年月日のまん中の数字が太字'); }
    } catch (e) { bad.push('エラー ' + e.message); } finally { state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 肌質診断のやり直しは、肌質の質問だけ（性別・生年月日・身長体重・肌悩みは聞かない）。いちばん最初の質問は、性別・生年月日・身長体重・肌質・肌悩みを全部聞く
  check('いちばん最初は全部聞き、肌質診断のやり直しは肌質の質問だけ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      await w(500); try { closeModal(true); } catch (e) {} document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      const secs = () => [...document.querySelectorAll('#sw-body .sw-card')].filter((x) => !x.hidden).map((x) => x.id.replace('sw-s-', ''));
      // いちばん最初
      state.settings.onboarded = false; openSetupWizard(); await w(400);
      const f = secs(); for (const k of ['gender', 'age', 'body', 'skin', 'concerns']) if (!f.includes(k)) bad.push('いちばん最初の質問に「' + ({gender: '性別', age: '生年月日', body: '身長・体重', skin: '肌質', concerns: '肌悩み'})[k] + '」がない');
      if (!document.querySelector('#sw-body #bd-wheel .wh-y')) bad.push('いちばん最初の生年月日が、回して選ぶ形になっていない');
      if (!document.getElementById('sw-h') || !document.getElementById('sw-w')) bad.push('いちばん最初に身長・体重を聞かない');
      // 「あとで」で閉じた人（まだ最初の質問を終えていない）が、あとで「肌質診断をする」を押したときも、全部の質問を出す
      { const k0 = JSON.stringify(state.settings); try { closeModal(true); } catch (e) {} swState = null; state.settings.onboarded = true; state.settings.surveyDone = false; state.settings.diag = null; openSetupWizard(); await w(400); const f2 = secs(); if (!['gender', 'age', 'body', 'skin', 'concerns'].every((k) => f2.includes(k))) bad.push('「あとで」で閉じた人が、あとで診断するときに全部の質問が出ない：' + f2.join(',')); try { closeModal(true); } catch (e) {} swState = null; Object.assign(state.settings, JSON.parse(k0)); state.settings.onboarded = false; openSetupWizard(); await w(400); }
      // 生年月日にさわらなければ「答えない」、回したらその日
      document.getElementById('sw-h').value = '158'; document.getElementById('sw-w').value = '50';
      const ans = (k, v) => { const b = document.querySelector(`#sw-body [data-sw="${k}"][data-v="${v}"]`); if (b) b.click(); };
      ans('gender', '女性'); ans('tight', 'yes'); ans('oilDay', 'little'); ans('oilDay', document.querySelector('#sw-body [data-sw="oilDay"]').dataset.v); ans('acne', 'rare'); ans('red', 'rare'); ans('sens', 'no');
      const wh = document.getElementById('bd-wheel'); const col = (k) => wh.querySelector('.wh-' + k), idx = (k, v) => [...col(k).querySelectorAll('.wh-it')].findIndex((x) => Number(x.dataset.v) === v);
      if (whBirth() !== '') bad.push('生年月日にさわっていないのに、2000年1月1日として保存されてしまう');
      wh.dispatchEvent(new Event('pointerdown')); whTo(col('y'), idx('y', 1995)); whTo(col('m'), idx('m', 7)); whTo(col('d'), idx('d', 3)); await w(200);
      document.querySelector('[data-action="setup-finish"]').click(); await w(700);
      if (document.querySelector('#sw-body')) bad.push('いちばん最初の質問を終えられない：' + ((document.querySelector('.sw-err-in') || {}).textContent || ''));
      const st = state.settings; if (st.birthDate !== '1995-07-03') bad.push('回して選んだ生年月日が保存されない：' + st.birthDate); if (st.height !== 158 || st.weight !== 50) bad.push('いちばん最初の身長・体重が保存されない'); if (st.gender !== '女性') bad.push('いちばん最初の性別が保存されない');
      // やり直し：肌質の質問だけ
      const before = JSON.stringify([st.gender, st.birthDate, st.height, st.weight, concernKeysNow()]);
      location.hash = '#/account/s/skintype'; await w(500); const rb = document.querySelector('#main .dg-redo'); if (rb) rb.click(); else openSetupWizard(); await w(400);
      const r = secs(); if (r.join(',') !== 'skin') bad.push('やり直しで、肌質以外も聞く：' + r.join(','));
      if (document.querySelector('#sw-body #bd-wheel, #sw-body #sw-h, #sw-body [data-sw="concerns"], #sw-body [data-sw="gender"]')) bad.push('やり直しに、生年月日・身長体重・肌悩み・性別が入っている');
      ans('tight', 'no'); document.querySelector('[data-action="setup-finish"]').click(); await w(700);
      if (document.querySelector('#sw-body')) bad.push('やり直しを終えられない');
      if (JSON.stringify([st.gender, st.birthDate, st.height, st.weight, concernKeysNow()]) !== before) bad.push('やり直しで、性別・生年月日・身長体重・肌悩みが変わってしまう');
      if (!state.settings.diag || state.settings.diag.a.tight !== 'no') bad.push('やり直しの答えが肌質に入らない');
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { closeModal(true); } catch (e) {} swState = null; state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 妊娠・授乳は、肌質診断のやり直しから外し、アカウントの「肌の情報」でいつでも変えられるようにする（控えたい成分を外す安全のため）
  check('妊娠・授乳をアカウントの肌の情報で変えられ、提案に反映される', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    try {
      await w(500); try { closeModal(true); } catch (e) {} document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      state.settings.onboarded = true; state.settings.gender = '女性'; state.settings.preg = ''; state.settings.diag = {a: {preg: 'no'}, r: diagCompute({}, [])};
      location.hash = '#/account'; await w(400); render(); await w(150);
      const grp = [...document.querySelectorAll('#main .acc-grp-h')].find((h) => h.textContent.trim() === '肌の情報');
      const row = document.getElementById('acc-it-preg'); if (!row || !grp || !grp.nextElementSibling.contains(row)) bad.push('「肌の情報」に「妊娠・授乳」がない');
      if (row && !/どちらでもない/.test(row.textContent)) bad.push('今の答え（肌質診断のときの答え）が一覧に出ない');
      location.hash = '#/account/s/preg'; await w(450); const bs = [...document.querySelectorAll('#main .pick-row')];
      if (bs.length !== 3) bad.push('妊娠・授乳のページの選ぶところが違う');
      else { bs[0].click(); await w(700); if (pregNow() !== 'preg') bad.push('妊娠中を選んでも反映されない'); if (state.settings.diag.a.preg !== 'preg') bad.push('肌質診断の答えと食い違う');
        if (!normalize(JSON.parse(JSON.stringify(state))).settings.preg) bad.push('妊娠・授乳が保存されない'); }
      // 肌質診断をやり直しても、妊娠・授乳の答えは消えない
      openSetupWizard(); await w(400); if (document.getElementById('sw-s-preg')) bad.push('やり直しに妊娠・授乳が入っている');
      ['tight', 'oilDay', 'acne'].forEach((k) => { const b = document.querySelector(`#sw-body [data-sw="${k}"]`); if (b) b.click(); }); document.querySelector('[data-action="setup-finish"]').click(); await w(700);
      if (pregNow() !== 'preg') bad.push('肌質診断をやり直すと、妊娠中の答えが消える');
      state.settings.gender = '男性'; location.hash = '#/account'; await w(400); render(); await w(150); if (document.getElementById('acc-it-preg')) bad.push('男性にも妊娠・授乳が出る'); if (pregNow()) bad.push('男性なのに妊娠中として扱う');
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { closeModal(true); } catch (e) {} swState = null; state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 妊娠中のまま10か月・授乳中のまま1年たったら「今もそうですか？」と一度だけ聞く（「あとで」なら30日は聞かない）
  check('妊娠中・授乳中のまま長くたったら、今もそうか一度だけ聞く', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state);
    const ask = async () => { document.getElementById('preg-ov')?.remove(); pregCheck(); await w(300); return document.getElementById('preg-ov'); };
    try {
      await w(400); try { closeModal(true); } catch (e) {} document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov,#pol-ov').forEach((e) => e.remove());
      const st = state.settings; st.onboarded = true; st.gender = '女性';
      st.preg = 'nursing'; st.pregAt = addDays(todayStr(), -200); st.pregAskAt = ''; if (await ask()) bad.push('授乳中になってまだ200日なのに聞く');
      st.pregAt = addDays(todayStr(), -370); let ov = await ask(); if (!ov || !/今も授乳中ですか/.test(ov.textContent.replace(/​/g, ''))) bad.push('授乳中のまま1年たっても聞かない');
      else { ov.querySelector('[data-preg="later"]').click(); await w(300); if (st.preg !== 'nursing') bad.push('「あとで」で答えが変わる'); if (await ask()) bad.push('「あとで」のあと、すぐまた聞く');
        st.pregAskAt = addDays(todayStr(), -31); ov = await ask(); if (!ov) bad.push('「あとで」から30日たっても聞かない');
        else { ov.querySelector('[data-preg="no"]').click(); await w(300); if (pregNow() !== '' || st.preg !== 'no') bad.push('「どちらでもない」を選んでも反映されない'); if (await ask()) bad.push('答えたのにまた聞く'); } }
      st.preg = 'preg'; st.pregAt = addDays(todayStr(), -301); st.pregAskAt = ''; ov = await ask(); if (!ov || !/今も妊娠中ですか/.test(ov.textContent.replace(/​/g, ''))) bad.push('妊娠中のまま10か月たっても聞かない');
      else { ov.querySelector('[data-preg="preg"]').click(); await w(300); if (st.pregAt !== todayStr()) bad.push('「今も妊娠中」と答えたら、また数え直さない'); if (await ask()) bad.push('答えたのにまた聞く'); }
      st.preg = 'no'; st.pregAt = addDays(todayStr(), -900); if (await ask()) bad.push('どちらでもない人に聞く');
      st.gender = '男性'; st.preg = 'preg'; if (await ask()) bad.push('男性に聞く');
      // 前から答えていた人（答えた日がない）：肌質診断の日から数える
      st.gender = '女性'; st.preg = ''; st.pregAt = ''; st.diag = {a: {preg: 'nursing'}, r: Object.assign(diagCompute({}, []), {at: addDays(todayStr(), -400)})}; if (!(await ask())) bad.push('前から授乳中と答えていた人に、1年たっても聞かない');
      // アカウントで選んだら、その日から数え直す
      document.getElementById('preg-ov')?.remove(); st.pregAt = ''; actions['acc-preg']('nursing'); await w(400); if (st.pregAt !== todayStr()) bad.push('アカウントで選んだ日を覚えない');
      if (normalize(JSON.parse(JSON.stringify(state))).settings.pregAt !== todayStr()) bad.push('答えた日が保存されない');
    } catch (e) { bad.push('エラー ' + e.message); } finally { document.getElementById('preg-ov')?.remove(); state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 ①運動は記録がなければ「未記録」 ②塗り薬の題名は「皮膚科の塗り薬」だけ ③肌に合わなかったときの「使い始めてから出るまで」は聞かず、使い始めた日と使用頻度を自動で出す ④「同じころに、ほかの新しい物も使い始めた」は消す（自動で調べる） ⑤肌質の確信度はボタンに見えない表示、やり直すははっきりボタン、ほかのカードの字の太さ・段落をそろえる
  check('運動の未記録・塗り薬の題名・合わなかったときの自動の期間と頻度・肌質のカードの見やすさ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), d = todayStr(), T = (el) => (el ? el.textContent : '').replace(/​/g, '');
    try {
      await w(400); try { closeModal(true); } catch (e) {} document.getElementById('modal-root').innerHTML = ''; document.querySelectorAll('.pm-ov').forEach((e) => e.remove());
      state.settings.onboarded = true; state.lifeLogs = []; location.hash = '#/'; await w(300); render(); await w(200);
      { const box = document.createElement('div'); box.innerHTML = lifeSumHtml(null); const rows = [...box.querySelectorAll('.ls-row')].map(T); const ex = rows.find((t) => /運動/.test(t)); /* 画面のタブに左右されないよう、ホームの睡眠・運動・食事の表をそのまま作って確かめる */ if (!ex || !/未記録/.test(ex) || /なし/.test(ex)) bad.push('運動が記録されていないのに「なし」と出る：' + ex); }
      // ③④
      const mk = (id, name, start) => ({id, demo: false, purchases: [], catalogId: null, name, brand: 'B', category: '美容液・アンプル', purposes: [], ingredients: '水', timing: '朝・夜', frequency: '週2〜3回', startDate: start, status: '使用中', endDate: '', memo: '', pao: 0, order: null});
      state.myProducts = [mk('a1', 'テスト美容液', addDays(d, -20)), mk('a2', 'ほかの化粧水', addDays(d, -5))];
      state.skinLogs = []; for (let i = 0; i < 10; i++) state.skinLogs.push({id: 'k' + i, date: addDays(d, -i), condition: 3, acneCount: 0, usedProducts: i % 2 ? [] : ['a1'], usageRecorded: true, memo: '', photo: ''});
      state = normalize(JSON.parse(JSON.stringify(state)));
      openNgForm('a1'); await w(400); const m = document.getElementById('modal-root');
      if (/使い始めてから、出るまで/.test(T(m)) || m.querySelector('[name="ng-when"]')) bad.push('「使い始めてから、出るまで」が残っている');
      if (/同じころに、ほかの新しい物も使い始めた/.test(T(m)) || m.querySelector('#ng-other')) bad.push('「同じころに…」のチェックが残っている');
      const est = m.querySelector('#ng-est'); if (!est) bad.push('使っていた期間と頻度が自動で出ない');
      else { if (!/気づいた日まで20日/.test(T(est))) bad.push('使い始めてからの日数が違う：' + T(est)); if (!/週2〜3回|週4〜6回/.test(T(est)) || !/記録10日のうち5日使った/.test(T(est))) bad.push('使用頻度が記録から推定されない：' + T(est)); if (!/ほかの化粧水/.test(T(est))) bad.push('同じころに使い始めた物が自動で出ない');
        const di = m.querySelector('#ng-date'); di.value = addDays(d, -15); di.dispatchEvent(new Event('change', {bubbles: true})); await w(100); if (!/気づいた日まで5日/.test(T(m.querySelector('#ng-est')))) bad.push('気づいた日を変えても、期間が変わらない'); }
      m.querySelector('[name="ng-sym"]').click(); document.querySelector('[data-action="ng-save"]').click(); await w(400);
      { const ng = getMy('a1').ng || {}; if (ng.when !== '数日〜1週間後' || ng.days !== 5 || !ng.freq || ng.newOther !== false) bad.push('自動の推定が保存されない：' + JSON.stringify({when: ng.when, days: ng.days, freq: ng.freq, o: ng.newOther})); }
      // ⑤
      state.settings.diag = {a: {}, r: diagCompute({}, [])}; location.hash = '#/account/s/skintype'; await w(500);
      const top = document.querySelector('#main .dg-top'), cf = top && top.querySelector('.dg-conf'), rb = top && top.querySelector('.dg-redo');
      if (!cf || !rb) bad.push('確信度か、やり直すボタンがない');
      else { const a = getComputedStyle(cf), b = getComputedStyle(rb); if (cf.tagName === 'BUTTON' || a.backgroundColor === b.backgroundColor && a.borderRadius === b.borderRadius) bad.push('確信度とやり直すボタンが同じ見た目');
        if (!(parseFloat(b.borderTopWidth) >= 1) || rb.getBoundingClientRect().height < 40) bad.push('やり直すがボタンに見えない・押しにくい'); if (parseFloat(a.paddingLeft) > 2 && a.backgroundColor !== 'rgba(0, 0, 0, 0)') bad.push('確信度がボタンのような形'); }
      const ps = [...document.querySelectorAll('#main .dg-c p:not(.dg-note), #main .dg-c li')].filter((e) => e.offsetParent); const fs = new Set(ps.map((e) => getComputedStyle(e).fontSize + '/' + getComputedStyle(e).fontWeight + '/' + getComputedStyle(e).lineHeight));
      if (fs.size !== 1) bad.push('肌質のカードの本文の字の大きさ・太さ・行の高さがそろっていない：' + [...fs].join(' | '));
      if ([...document.querySelectorAll('#main .dg-c p b')].length) bad.push('本文の中に太字のラベルがまざっている（ラベルは上に分ける）');
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { closeModal(true); } catch (e) {} state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 点検で見つけた：データのページのいちばん上に区切り線だけが出る・研究への協力の説明が古い（肌質は「選ぶ」ではなく「診断」）・妊娠の確認とポリシーの同意が重なって出る
  check('データの上の区切り線・研究の説明・確認の窓が重ならない', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), T = (el) => (el ? el.textContent : '').replace(/​/g, '');
    try {
      await w(300); location.hash = '#/account/s/data'; await w(450); const f = document.querySelector('#main .acc-item .card > .set-sub'); if (!f) bad.push('データのページに自動バックアップがない'); else if (parseFloat(getComputedStyle(f).borderTopWidth) > 0) bad.push('データのページのいちばん上に区切り線だけが出る');
      state.settings.skinType = ''; location.hash = '#/account/s/research'; await w(450); const t = T(document.getElementById('main')); if (/肌質を選ぶ/.test(t)) bad.push('研究の説明が「肌質を選ぶ」のまま'); if (!/肌質診断をすると/.test(t)) bad.push('研究の説明に「肌質診断をすると」がない');
      const src = await (await fetch(location.href.split('#')[0])).text(); if (!/getElementById\('pol-ov'\) \|\| document\.getElementById\('preg-ov'\)/.test(src)) bad.push('ポリシーの同意が、妊娠の確認と重なって出ることがある');
    } catch (e) { bad.push('エラー ' + e.message); } finally { state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 飲み薬・サプリは1日に何錠かが人それぞれなので、登録したらすぐ飲む量（1回の量・単位・タイミング）を入れる。あとから商品の画面でも変えられる
  check('飲み薬は登録のときに飲む量を入れられ、あとから変えられる', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), keep = JSON.stringify(state), T = (el) => (el ? el.textContent : '').replace(/​/g, '');
    try {
      await w(300); try { closeModal(true); } catch (e) {} state.myProducts = []; state.settings.onboarded = true;
      const oral = RX_DRUGS.find((d) => isOralKind(d[0]) && /錠/.test(d[1])) || RX_DRUGS.find((d) => isOralKind(d[0]));
      rxPick(oral[1]); await w(900); const m = document.getElementById('modal-root');
      if (!m.querySelector('#mf-dn')) bad.push('飲み薬を登録しても、飲む量を入れる画面が出ない');
      else { if (!/医師・薬剤師の指示/.test(T(m))) bad.push('飲む量は指示どおりに入れる、の一言がない');
        m.querySelector('[data-dsn="1"]').click(); await w(50); if (m.querySelector('#mf-dn').value !== '2') bad.push('＋で量が増えない：' + m.querySelector('#mf-dn').value);
        m.querySelector('input[name="mf-du"][value="錠"]').click(); $$('#modal-root input[name="mf-dw"]').forEach((x) => { x.checked = ['朝', '昼', '夜'].includes(x.value); });
        document.querySelector('[data-action="my-field-save"]').click(); await w(400);
        const p = state.myProducts.find((x) => x.name === oral[1]); if (!p || !p.dose || p.dose.n !== 2 || p.dose.unit !== '錠' || p.dose.when.join() !== '朝,昼,夜') bad.push('飲む量が保存されない：' + JSON.stringify(p && p.dose));
        if (p && p.timing !== '朝・夜') bad.push('飲むタイミングがケアの朝・夜に反映されない');
        if (p && doseText(p) !== '1回2錠・朝・昼・夜（1日3回）') bad.push('飲む量の書き方：' + doseText(p));
        ui.myKind = 'oral'; location.hash = '#/my'; render(); await w(300); if (!/1回2錠・朝・昼・夜（1日3回）/.test(T(document.getElementById('main')))) bad.push('Myアイテムの一覧に飲む量が出ない');
        location.hash = '#/my/' + p.id; await w(400); const ed = document.querySelector('#main [data-action="my-field"][data-id$="|dose"]'); if (!ed) bad.push('商品の画面で飲む量を変えられない');
        else { ed.click(); await w(400); const ip = document.getElementById('mf-dn'); ip.value = '0'; document.querySelector('[data-action="my-field-save"]').click(); await w(200); if (!/数字で入れてください/.test(T(document.getElementById('modal-root')))) bad.push('0錠でも保存できてしまう'); try { closeModal(true); } catch (e) {} }
        if (normalize(JSON.parse(JSON.stringify(state))).myProducts.find((x) => x.id === p.id).dose.n !== 2) bad.push('飲む量が残らない'); }
      // 塗り薬は今までどおり（飲む量の画面は出さない）
      try { closeModal(true); } catch (e) {} const rx = RX_DRUGS.find((d) => !isOralKind(d[0])); rxPick(rx[1]); await w(900); if (document.querySelector('#modal-root #mf-dn')) bad.push('塗り薬にも飲む量の画面が出る');
    } catch (e) { bad.push('エラー ' + e.message); } finally { try { closeModal(true); } catch (e) {} state = normalize(JSON.parse(keep)); location.hash = '#/'; render(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 動画：飲む量を入れたあと開き直すと「保存データを読み込めなかったため、初期状態で起動しました」になった（読み込みより後ろで用意した物を、読み込みのときに使っていた）。
  // 全部の項目が入ったデータを保存して、本当に開き直して読めることを確かめる。読めなかったデータは、準備が終わったあとに自動で元に戻す
  { const keepRaw = await p.evaluate(() => localStorage.getItem(STORE_KEY));
    const rich = await ev(() => { const d = todayStr(), st = JSON.parse(JSON.stringify(state)); Object.assign(st.settings, {gender: '女性', birthDate: '1995-07-03', preg: 'nursing', pregAt: addDays(d, -10), policyAgreed: POLICY_VER, onboarded: true, surveyDone: true, concernKeys: ['acne'], diag: {a: {tight: 'yes', oilDay: 'little', acne: 'some', red: 'rare', sens: 'no', preg: 'nursing'}, r: diagCompute({tight: 'yes', oilDay: 'little', acne: 'some', red: 'rare', sens: 'no'}, ['acne'])}, height: 160, weight: 52});
      const P = (id, name, cat, extra) => Object.assign({id, demo: false, purchases: [], catalogId: null, name, brand: 'B', category: cat, purposes: [], ingredients: '水', timing: '朝・夜', frequency: '毎日', startDate: addDays(d, -20), status: '使用中', endDate: '', memo: '', pao: 0, order: null}, extra || {});
      st.myProducts = [P('o1', 'テスト錠', ORAL_CAT, {dose: {n: 2, unit: '錠', when: ['朝', '夜']}}), P('c1', 'テスト化粧水', '化粧水・トナー', {ng: {date: d, sym: ['赤み'], when: '数日〜1週間後', days: 5, freq: '毎日', level: '軽い', where: ['ほほ'], note: '', newOther: false}}), P('r1', 'テスト軟膏', '皮膚科の塗り薬')];
      st.skinLogs = [{id: 'L1', date: d, condition: 3, acneCount: 1, acneTypes: ['赤ニキビ'], usedProducts: ['c1'], usageRecorded: true, memo: '', photo: ''}];
      localStorage.setItem(STORE_KEY, JSON.stringify(st)); localStorage.removeItem(STORE_KEY + '_broken_backup'); return true; });
    await p.reload(); await p.waitForTimeout(1500);
    const r1 = await ev(() => ({w: loadWarning, dose: (getMy('o1') || {}).dose, bd: state.settings.birthDate, preg: state.settings.preg, ng: (getMy('c1') || {}).ng && getMy('c1').ng.days, logs: state.skinLogs.length}));
    const ok1 = r1 && !r1.w && r1.dose && r1.dose.n === 2 && r1.bd === '1995-07-03' && r1.preg === 'nursing' && r1.ng === 5 && r1.logs === 1;
    // 読めなかったデータが退避されていたら、開き直したときに自動で元に戻す（今のデータも残す）
    await ev(() => { const old = localStorage.getItem(STORE_KEY); const fresh = JSON.parse(JSON.stringify(normalize(freshState()))); fresh.skinLogs = [{id: 'L2', date: addDays(todayStr(), -1), condition: 4, acneCount: 0, usedProducts: [], memo: '', photo: ''}]; fresh.recT = {}; localStorage.setItem(STORE_KEY + '_broken_backup', old); localStorage.setItem(STORE_KEY, JSON.stringify(fresh)); return true; });
    await p.reload(); await p.waitForTimeout(1500);
    const r2 = await ev(() => ({w: loadWarning, dose: (getMy('o1') || {}).dose, bd: state.settings.birthDate, logs: state.skinLogs.map((l) => l.id).sort().join(), left: !!localStorage.getItem(STORE_KEY + '_broken_backup')}));
    const ok2 = r2 && r2.dose && r2.dose.n === 2 && r2.bd === '1995-07-03' && r2.logs === 'L1,L2' && !r2.left && /元に戻しました/.test(r2.w);
    if (!(ok1 && ok2)) console.log('  ' + JSON.stringify([r1, r2]));
    check('全部の項目が入ったデータを、開き直しても読める・読めなかったデータは自動で元に戻す', ok1 && ok2);
    await p.evaluate((k) => { if (k) localStorage.setItem(STORE_KEY, k); else localStorage.removeItem(STORE_KEY); localStorage.removeItem(STORE_KEY + '_broken_backup'); localStorage.removeItem(STORE_KEY + '_restored_copy'); }, keepRaw); await p.reload(); await p.waitForTimeout(1500); }
  // 2026-11-21 アイコンの「写真を撮る」は、押したらすぐカメラになる（アプリの中のカメラ）。「ライブラリから選択」は写真を選ぶだけ（カメラを指定しない）
  check('アイコンの写真を撮るは押したらすぐカメラ・ライブラリは写真を選ぶ', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms));
    try { openAvatarMenu(); await w(300); const m = document.getElementById('av-menu');
      const lib = [...m.querySelectorAll('label.avm-b')].find((l) => /ライブラリ/.test(l.textContent)); const li = lib && lib.querySelector('input[type=file]'); if (!li || li.hasAttribute('capture') || !/image/.test(li.accept)) bad.push('ライブラリから選択が、写真を選ぶ入力になっていない');
      const cam = m.querySelector('[data-avm="cam"]'); if (!cam) bad.push('写真を撮るのボタンがない'); else { cam.click(); await w(600); const k = document.getElementById('av-cam'); if (!k || !k.querySelector('video') || !k.querySelector('[data-avk="shot"]')) bad.push('写真を撮るを押しても、すぐカメラにならない'); else { k.querySelector('[data-avk="cancel"]').click(); await w(200); if (document.getElementById('av-cam')) bad.push('カメラのキャンセルで閉じない'); } }
    } catch (e) { bad.push('エラー ' + e.message); } finally { document.getElementById('av-menu')?.remove(); document.getElementById('av-cam')?.remove(); try { unlockScroll(); } catch (e) {} }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-21 使っている人の画面から「Myアイテムが横にはみ出している」が届いた：タブを横になぞっている途中・切り替えの動きの途中を測っていた。動いている途中は知らせず、止まってもはみ出しているときだけ知らせる
  check('横になぞっている途中・動きの途中は「はみ出し」と知らせない（止まってもずれていれば知らせる）', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = document.getElementById('main'), d = document.createElement('div'); d.style.cssText = 'width:300px;height:20px'; m.appendChild(d);
    try { UI_TOUCH = true; d.style.transform = 'translateX(200px)'; if (!uiMoving(d)) bad.push('指でなぞっている途中を、動いている途中と見なさない'); UI_TOUCH = false;
      const an = d.animate([{transform: 'translateX(200px)'}, {transform: 'none'}], {duration: 2000}); await w(50); if (!uiMoving(d)) bad.push('動きの途中を、動いている途中と見なさない'); an.cancel();
      d.style.transform = 'translateX(200px)'; await w(50); if (uiMoving(d)) bad.push('止まったままずれている物を見のがす');
    } catch (e) { bad.push('エラー ' + e.message); } finally { UI_TOUCH = false; d.remove(); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-22 画面の点検で見つけた：Myアイテムの成分「水」を押すと、ヒアルロン酸の説明が出ていた（「加水分解ヒアルロン酸」の「水」の1文字に当たっていた）。1文字の成分は、名前が同じときだけ当てる
  check('成分「水」などの1文字の成分を押しても、別の成分の説明が出ない', await ev(() => { const bad = [];
    ['水', '酸', '油', '塩'].forEach((w) => { const e = ingEntryOf(w), m = masterOf(w), I = ingInfo(e, w);
      if (e && normIng(e.name.replace(/（.*?）/g, '')) !== normIng(w) && !(e.aliases || []).some((a) => normIng(a) === normIng(w))) bad.push(w + '→' + e.name);
      if (m && normIng(m.ja.replace(/（.*?）/g, '')) !== normIng(w) && !(m.inci || []).some((a) => normIng(a) === normIng(w))) bad.push(w + '→' + m.ja);
      if (w === '水' && /抱えこみ/.test(I.desc)) bad.push('水にヒアルロン酸の説明'); });
    const h = ingEntryOf('ヒアルロン酸Na'); if (!h || !/ヒアルロン/.test(h.name)) bad.push('ヒアルロン酸Naが見つからなくなった');
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-22 画面の点検で見つけた：ダーク表示で、グラフ「使用商品と肌記録の時系列」の商品名が暗い色のままで読めなかった
  check('ダーク表示でも、グラフの商品名が読める色になっている', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), th = document.documentElement.getAttribute('data-theme');
    const lum = (c) => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v - 0.03928) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    try { document.documentElement.setAttribute('data-theme', 'dark'); const d = document.createElement('div'); d.className = 'card'; d.innerHTML = '<svg class="chart"><text class="rowlbl" x="0" y="10">テスト</text></svg>'; document.getElementById('main').appendChild(d); await w(50);
      const fg = lum(getComputedStyle(d.querySelector('.rowlbl')).fill), bgc = getComputedStyle(d).backgroundColor, bg = /rgba?\(/.test(bgc) && !/,\s*0\)$/.test(bgc) ? lum(bgc) : lum(getComputedStyle(document.body).backgroundColor);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05); if (ratio < 4.5) bad.push('文字と背景の差が小さい（' + ratio.toFixed(2) + '）'); d.remove();
    } catch (e) { bad.push('エラー ' + e.message); } finally { if (th) document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme'); }
    if (bad.length) console.log('  ' + bad.join(' / ')); return !bad.length; }));
  // 2026-11-22 おすすめの食べ物：「果物」「ナッツ」のような総称を出さず具体的に。どの食べ物も、押すと「効果を高めるコツ」（トマトは加熱＋油でリコピン、キウイはゴールドなど）が出る
  check('おすすめの食べ物は具体的な名前で、全部に効果を高めるコツがある', await ev(async () => { const bad = [], w = (ms) => new Promise((r) => setTimeout(r, ms)), ABS = /^(果物|フルーツ|ナッツ|きのこ|季節の野菜|野菜|水・お茶|お茶|青魚|魚|肉|乳製品|大豆製品|発酵食品|海藻)$/;
    try { const goods = new Set(Object.keys(FOOD_INFO)); LIFE_AVOID.forEach((r) => { if (!r[5]) (r[4] || []).forEach((v) => goods.add(v)); }); goods.add(LIFE_ALT_DEF['食事']);
      const html = advChips({area: '食事', good: ['果物', 'ナッツ', 'きのこ', '季節の野菜', '水・お茶', 'トマト'], avoid: ['菓子パン', '炭酸ジュース']}); const chips = [...html.matchAll(/data-food="([^"]+)"/g)].map((m) => m[1]);
      chips.filter((v) => ABS.test(chipText(v))).forEach((v) => bad.push('総称のまま出ている：' + v)); if (!chips.includes('キウイ') || !chips.includes('アーモンド')) bad.push('果物・ナッツが具体的な食べ物にならない');
      const mealGoods = ['キウイ', 'ブロッコリー', 'パプリカ', 'トマト', '水・麦茶', 'アーモンド', 'ヨーグルト', 'まいたけ', 'ほうれん草', 'にんじん', '納豆', '鮭', '卵', 'バナナ', 'いちご', 'みかん', '鶏むね肉', '豆腐', 'ギリシャヨーグルト', 'まぐろ', 'レバー', 'みそ汁', 'ミネストローネ', '鮭の塩焼き', '蒸し鶏', 'さば', 'わかめ', 'キムチ', '玄米'];
      [...goods, ...mealGoods].forEach((v) => { const f = foodInfo(v); if (!f || !f[2] || f[2].length < 15) bad.push('コツがない：' + v); });
      if (!/加熱|油/.test(foodInfo('トマト')[2]) || !/ゴールド/.test(foodInfo('キウイ')[2])) bad.push('トマト・キウイのコツが違う');
      openFoodSheet('トマト'); await w(300); const t = document.querySelector('.modal-overlay:last-of-type') || document.body; if (!/効果を高めるコツ/.test(t.textContent)) bad.push('シートにコツが出ない'); closeModal && closeModal();
    } catch (e) { bad.push('エラー ' + e.message); }
    if (bad.length) console.log('  ' + bad.slice(0, 8).join(' / ')); return !bad.length; }));
  check('読み込み時にエラーが出ない', errs.length === 0, errs.join(' / '));
  await b.close(); srv.close();
  const bad = results.filter((r) => !r.ok);
  results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok || !r.info ? '' : '：' + r.info}`));
  if (SKIPPED.length) console.log(`（手元だけのファイルを読む確かめ ${SKIPPED.length}件は、ここでは飛ばしました）`);
  console.log(bad.length ? `\n失敗 ${bad.length}件：公開を止めます` : `\nすべて合格（${results.length}件）`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
