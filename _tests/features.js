// ナカカラモ：全部の機能テスト（いろいろな人になりきって、はじめから全部の機能を使ってみる）
// 使い方：node hadatomo-cloud/tests/features.js [skinwise.html のパス]（ONLY=名前の頭 で1人だけ）
// 通販の検索・写真の読み取り（AI）は、にせの返事にする（外へは送らない）。各手順のあとに、エラー・変な文字・はみ出し・保存されたかを確かめる
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const base = (o) => Object.assign({ gender: '女性', ageBand: '20代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'rare', sens: 'no', preg: 'no', concerns: ['acne'] }, o);
const PERSONAS = [
  { k: 'A_女性20代_ニキビ_プレミアム', vw: 390, prem: true, a: base({ acne: 'often', concerns: ['acne', 'pore'] }), q: 'アヌア', rx: 'ベピオゲル2.5%', oral: 'ビタミンB2・B6の市販薬', log: { condition: 2, acneCount: 4 } },
  { k: 'B_妊娠中_ダーク_プレミアム', vw: 375, prem: true, dark: true, a: base({ ageBand: '30代', preg: 'preg', concerns: ['spot', 'dry'] }), q: 'ハトムギ', oral: 'トランサミン（トラネキサム酸）', log: { condition: 3, acneCount: 0, dryness: 4 } },
  { k: 'C_男性40代_無料', vw: 390, prem: false, a: base({ gender: '男性', ageBand: '40代', preg: undefined, acne: 'rare', concerns: ['aging', 'pore'] }), q: 'オールインワン', log: { condition: 4, acneCount: 0 } },
  { k: 'D_17歳以下_無料_小さい画面', vw: 320, prem: false, a: base({ ageBand: '17歳以下', gender: '回答しない', preg: undefined, acne: 'often', concerns: ['acne'] }), q: 'ニキビ 洗顔', rx: 'ディフェリンゲル0.1%', log: { condition: 2, acneCount: 6 } },
  { k: 'E_60代以上_プレミアム_大きい画面', vw: 430, prem: true, a: base({ ageBand: '60代以上', tight: 'yes', acne: 'rare', concerns: ['aging', 'dry', 'spot'] }), q: 'セラミド クリーム', rx: 'ヒルドイドソフト軟膏0.3%', oral: 'コラーゲンのサプリメント', log: { condition: 3, acneCount: 0, dryness: 5 } },
  { k: 'F_アトピー_薬が多い_電波なし', vw: 390, prem: true, offline: true, a: base({ sens: 'yes', red: 'often', tight: 'yes', concerns: ['sensitive', 'dry', 'redness'] }), q: '敏感肌 化粧水', rx: 'ロコイド軟膏0.1%', oral: 'アレグラ（フェキソフェナジン）', log: { condition: 2, acneCount: 0, redness: 4, dryness: 4 } },
  { k: 'G_診断しない_何もしない_無料', vw: 390, prem: false, skip: true },
  { k: 'H_記録が多い_プレミアム', vw: 390, prem: true, heavy: true, a: base({ concerns: ['acne', 'dry', 'dull'] }), q: 'ビタミンC 美容液', rx: 'エピデュオゲル', oral: 'ビタミンCのサプリメント', log: { condition: 3, acneCount: 2 } },
];
const ROUTES = ['#/home', '#/home?care', '#/log', '#/charts', '#/my', '#/combo', '#/combo/ok', '#/combo/ng', '#/combo/search', '#/ingredients', '#/routine', '#/mycare', '#/report', '#/account', '#/account/me', '#/settings', '#/plan', '#/scan', '#/care/diag', '#/care/guide', '#/terms', '#/privacy', '#/law', '#/visit', '#/trouble'];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }), out = [];
  for (const pz of PERSONAS.filter((x) => (!process.env.ONLY || x.k.startsWith(process.env.ONLY)) && (!process.env.SET || process.env.SET.split(',').some((c) => x.k.startsWith(c))))) {
    const t0 = Date.now();
    const ctx = await b.newContext({ viewport: { width: pz.vw, height: 844 }, isMobile: true, hasTouch: true, colorScheme: pz.dark ? 'dark' : 'light', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', acceptDownloads: true, permissions: ['camera'] });
    const p = await ctx.newPage(), bad = [], note = (m) => { if (!bad.includes(m)) bad.push(m); };
    let where = 'はじめ';
    p.on('pageerror', (e) => note(`${where}：エラー ${String(e.message).split('\n')[0].slice(0, 150)}`));
    p.on('dialog', (d) => d.accept());
    p.on('download', () => {});
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(URL0); await p.waitForTimeout(1500);
    const W = (ms) => p.waitForTimeout(ms);
    const ev = (f, a) => p.evaluate(f, a).catch((e) => { note(`${where}：止まった ${String(e.message).split('\n')[0].slice(0, 140)}`); return null; });
    // にせの返事（通販の検索・写真の読み取り・AI）
    await ev(([pr, off]) => {
      window.isPremium = () => pr; window.open = () => null; navigator.vibrate = () => true;
      if (off) Object.defineProperty(navigator, 'onLine', { get: () => false });
      const shop = (q) => [1, 2, 3].map((i) => ({ name: `${q} テスト商品${i} ${i === 1 ? '30ml' : i === 2 ? '50ml' : '60粒 サプリメント'}`, site: i % 2 ? '楽天市場' : 'Yahoo!ショッピング', shop: 'テスト店', price: 1000 * i, url: 'https://example.com/' + i, image: '' }));
      findFetch = async (bd) => { if (off) throw new Error('offline'); await new Promise((r) => setTimeout(r, 80)); return shop(bd.q || bd.jan || 'テスト'); };
      callVision = async (mode, img, pl) => { if (off) throw new Error('電波のよい場所で、もう一度お試しください。'); await new Promise((r) => setTimeout(r, 100));
        const R = {
          package: { brand: 'テストブランド', name: 'テスト 化粧水 しっとり', volume: '200ml', ingredients: '水、グリセリン、BG、ナイアシンアミド', category: '化粧水・トナー' },
          meal: { items: [{ kind: 'dish', name: '鮭の塩焼き', amount: '1切れ', kcal: 180, p: 20, f: 9, c: 0, salt: 1.5, veg: 0, basis: '推定', alts: [{ name: 'サバの塩焼き', kcal: 250 }] }, { kind: 'dish', name: 'ごはん', amount: '茶碗1杯', kcal: 250, p: 4, f: 0.5, c: 55, salt: 0, veg: 0, basis: '推定' }], note: '' },
          skin: { face: 1, condition: 3, acne: [{ zone: 'あご', count: 2 }], zones: [{ zone: '頬', concern: '乾燥', level: 3 }], box: [0.2, 0.15, 0.8, 0.85], note: '' },
          advice: { summary: 'テストのまとめ', points: [{ area: 'スキンケア', title: '保湿を丁寧に', text: '乾燥しやすい日は保湿を重ねます。', basis: '記録', good: ['セラミド'], avoid: ['熱いお湯'] }] },
          menu: { meals: [{ meal: '夕食', when: '19時', plans: [{ label: '和食', dishes: [{ name: '鮭の塩焼き', role: '主菜' }, { name: 'ほうれん草のおひたし', role: '副菜' }] }] }], note: '' },
          recipe: { name: '鮭の塩焼き', time: '15分', ingredients: [{ name: '鮭', amount: '1切れ' }], steps: ['塩をふる', '焼く'], tip: '' },
          support: { answer: 'テストの答えです。', handoff: false, topic: '使い方' }, care: { text: 'テストの説明です。' },
        }[mode] || {};
        return { result: R, remaining: 10, kindName: 'テスト' }; };
    }, [pz.prem, !!pz.offline]);
    // 各手順のあとに確かめる
    const look = async (name) => { where = name; await W(120);
      const r = await ev(() => { const o = [], vw = innerWidth, txt = ((document.querySelector('#main') || document.body).innerText || '') + ' ' + ((document.querySelector('#modal-root') || {}).innerText || '');
        const m = txt.match(/.{0,14}(undefined|NaN|\[object|Infinity|null(?![a-z])|function \(|=>).{0,14}/); if (m) o.push('変な文字「' + m[0].replace(/\s+/g, ' ') + '」');
        if (document.documentElement.scrollWidth > vw + 1) o.push('横にはみ出し ' + document.documentElement.scrollWidth + '>' + vw);
        const sc = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll|hidden)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
        const seen = new Set(); document.querySelectorAll('#main *, #modal-root *').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= vw + 1 || r.left >= vw) return; if (sc(e)) return; const k = e.className && String(e.className).split(' ')[0] || e.tagName; if (seen.has(k)) return; seen.add(k); o.push('画面の右にはみ出す ' + k); });
        document.querySelectorAll('#main button, #modal-root button').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; if (!e.querySelector('ol,ul,p,div') && e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow === 'visible' && !/ellipsis/.test(getComputedStyle(e).textOverflow)) { const k = 'ボタンの文字がはみ出す「' + e.innerText.trim().slice(0, 16) + '」'; if (!o.includes(k)) o.push(k); } });
        return o.slice(0, 6); });
      (r || []).forEach((m) => note(`${name}：${m}`)); };
    const click = async (sel, name) => { const ok = await ev((s) => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel); if (!ok) note(`${where}：「${name || sel}」が見つからない`); await W(350); return ok; };
    const close = () => ev(() => { try { closeModal(true); } catch (e) {} document.querySelectorAll('.cl-ov,#prem-sheet').forEach((x) => x.remove()); try { clStop(); } catch (e) {} });
    const go = async (h, name) => { await close(); await ev((hh) => { if (hh === '#/home?care') { ui.homeTab = 'care'; location.hash = '#/home'; } else { if (hh === '#/home') ui.homeTab = 'rec'; location.hash = hh; } render(); }, h); await W(h === '#/routine' || /home/.test(h) ? 800 : 400); await look(name || h); };
    const img = async (w = 400, h = 400) => ev(([w, h]) => new Promise((res) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#e8c4b0'; x.fillRect(0, 0, w, h); x.fillStyle = '#c99'; x.beginPath(); x.arc(w / 2, h / 2, w / 3, 0, 7); x.fill(); c.toBlob((b) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }, 'image/jpeg', 0.9); }), [w, h]);
    const setFile = async (sel, name) => { const d = await img(); if (!d) return false; const buf = Buffer.from(d.split(',')[1], 'base64'); const h = await p.$(sel); if (!h) { note(`${where}：写真を入れる所「${name}」が見つからない`); return false; } await h.setInputFiles({ name: 'a.jpg', mimeType: 'image/jpeg', buffer: buf }); await W(900); return true; };
    // ① 肌質診断
    where = '肌質診断';
    if (pz.skip) await click('[data-action="setup-later"]', 'あとで');
    else { for (const [k, v] of Object.entries(pz.a)) if (v !== undefined) for (const x of [].concat(v)) await ev((s) => { const e = document.querySelector(s); if (e) e.click(); }, `[data-sw="${k}"][data-v="${x === '回答しない' ? '' : x}"]`);
      await look('肌質診断'); await click('[data-action="setup-finish"]', '診断する'); await W(500); await look('診断の結果');
      if (!(await ev(() => !!state.settings.diag))) note('肌質診断が保存されない'); }
    await close(); await ev(() => { const s = document.querySelector('.pm-skip'); if (s) s.click(); state.settings.permAsked2 = true; save(); }); await W(300);
    if (pz.heavy) await ev(() => { const d = todayStr(); state.skinLogs = Array.from({ length: 150 }, (_, i) => ({ id: 'hl' + i, date: addDays(d, -i - 1), condition: 1 + (i % 5), acneCount: i % 7, acneTypes: i % 3 ? [] : ['赤ニキビ'], redness: i % 4, dryness: i % 5, usedProducts: [], memo: i % 4 ? '' : 'メモ' + i, photo: '' }));
      state.lifeLogs = Array.from({ length: 100 }, (_, i) => ({ id: 'hf' + i, date: addDays(d, -i - 1), bed: '23:30', wake: '07:00', exercise: i % 2 ? [{ type: 'ウォーキング', minutes: 30 }] : [], meals: {}, foods: [{ name: 'ヨーグルト', kcal: 90, p: 4 }] }));
      state = normalize(JSON.parse(JSON.stringify(state))); save(); render(); });
    await go('#/home', 'ホーム（はじめ）');
    if (!pz.skip) {
      // ② 化粧品を検索して追加
      where = '化粧品を検索して追加'; await go('#/my'); await click('[data-action="add-sheet"]', '化粧品を追加'); await W(400); await look('化粧品を追加の画面');
      await ev((q) => { const i = document.getElementById('pop-q'); if (!i) return; i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }, pz.q); await W(1300); await look('化粧品の検索結果');
      const n0 = await ev(() => state.myProducts.length);
      if (pz.offline) { if (!(await ev(() => /電波|探せませんでした|見つかりませんでした/.test(document.getElementById('modal-root').innerText)))) note('電波がないときに、探せなかったことが出ない'); }
      else { await click('#modal-root [data-action="find-pick"]', 'これを選ぶ'); await W(900); await close(); if ((await ev(() => state.myProducts.length)) !== n0 + 1) note('検索から選んだ化粧品が登録されない'); }
      // ③ カメラで探す（プレミアム）／無料の人は案内が出る
      where = 'カメラで探す'; await close(); await ev(() => openAddSheet('my')); await W(400); await click('#modal-root [data-action="add-camera"]', 'カメラ'); await W(1500);
      if (pz.prem) { const live = await ev(() => !!document.querySelector('.cl-ov')); if (!live) note('カメラが開かない'); else { await look('カメラの画面'); await click('.cl-ov [data-cl="shot"]', '撮る'); await W(2500); await look('カメラで撮ったあと'); if (!pz.offline && !(await ev(() => document.querySelectorAll('#find-list .net-item').length))) note('カメラで撮った商品の候補が出ない'); } }
      else { await look('無料の人がカメラを押したとき'); if (!(await ev(() => /プレミアム/.test(document.body.innerText)))) note('無料の人に、プレミアムの案内が出ない'); }
      await close();
      // ④ 塗り薬・飲み薬を追加
      if (pz.rx) { where = '塗り薬を追加'; await go('#/my'); await ev(() => actions['my-kind']('rx')); await W(400); await click('[data-action="rx-sheet"]', '塗り薬を追加'); await W(400); await look('塗り薬を追加の画面'); await click(`#rx-list [data-rx="${pz.rx}"]`, pz.rx); await W(900); await close();
        if (!(await ev((n) => state.myProducts.some((x) => x.name === n && x.category === '皮膚科の塗り薬'), pz.rx))) note('塗り薬が登録されない'); }
      if (pz.oral) { where = '飲み薬を追加'; await go('#/my'); await ev(() => actions['my-kind']('oral')); await W(400); await click('[data-action="oral-sheet"]', '飲み薬を追加'); await W(400); await look('飲み薬を追加の画面'); await click(`#rx-list [data-rx="${pz.oral}"]`, pz.oral); await W(900); await close();
        if (!(await ev((n) => state.myProducts.some((x) => x.name === n && x.category === ORAL_CAT), pz.oral))) note('飲み薬が登録されない'); }
      // ⑤ 一覧にない物を自分で入力
      where = '自分で入力'; await go('#/my'); await ev(() => actions['oral-manual']()); await W(700); await look('自分で入力の画面');
      await ev(() => { const f = document.getElementById('my-form'); if (!f) return; f.querySelector('[name=name]').value = 'テスト 手入力のサプリ'; const br = f.querySelector('[name=brand]'); if (br) br.value = 'テスト'; f.requestSubmit(); }); await W(800); await close();
      if (!(await ev(() => state.myProducts.some((x) => x.name === 'テスト 手入力のサプリ' && x.category === ORAL_CAT)))) note('手入力した飲み薬が登録されない（または飲み薬にならない）');
      // ⑥ 詳しい画面・使用中の切り替え・肌に合わなかった
      const ids = await ev(() => state.myProducts.map((x) => x.id)) || [];
      for (const id of ids.slice(0, 6)) await go('#/my/' + id, 'アイテムの画面 ' + id);
      if (ids[0]) { where = '使用中の切り替え'; await go('#/my'); await ev(() => actions['my-kind']('cos')); await W(300); const sw = await ev(() => { const i = document.querySelector('.m-sw-in'); if (!i) return null; const id = i.dataset.id; i.click(); return id; }); await W(500);
        if (sw && (await ev((id) => getMy(id).status, sw)) === '使用中') note('使用中・停止中を切り替えられない'); if (sw) { await ev((id) => { const i = document.querySelector(`.m-sw-in[data-id="${id}"]`); if (i) i.click(); }, sw); await W(400); } await look('切り替えたあと');
        where = '肌に合わなかった'; const cos = await ev(() => (state.myProducts.find((x) => !isMedCat(x.category)) || {}).id); if (cos) { await ev((id) => actions['ng-open'](id), cos); await W(500); await look('肌に合わなかったの画面'); await ev(() => { const c = document.querySelector('#modal-root .ng-sym input'); if (c) c.click(); }); await click('#modal-root [data-action="ng-save"]', '記録する'); await W(500); await close();
          if (!(await ev((id) => !!getMy(id).ng, cos))) note('肌に合わなかったが保存されない'); await go('#/trouble', '肌に合わなかった化粧品の画面'); } }
      // ⑦ 今日の肌を記録（写真つき）
      where = '肌の記録'; await go('#/home'); await click('[data-action="new-log"]', '今日の肌を記録'); await W(700); await look('肌の記録の画面');
      await ev((L) => { const set = (n, v) => { const i = document.querySelector(`#modal-root input[name="${n}"][value="${v}"]`); if (i) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }; set('condition', L.condition); if (L.redness) set('redness', L.redness); if (L.dryness) set('dryness', L.dryness);
        const a = document.querySelector('#f_acneCount'); if (a) { a.value = String(L.acneCount || 0); a.dispatchEvent(new Event('input', { bubbles: true })); } const m = document.querySelector('#f_memo'); if (m) m.value = 'テストのメモ'; }, pz.log);
      const fi = await ev(() => { const L = [...document.querySelectorAll('#modal-root input[type=file]')]; const i = L.find((x) => !x.hasAttribute('capture')) || L[0]; if (!i) return ''; i.setAttribute('data-ftest', '1'); return '1'; });
      if (fi) { await setFile('#modal-root input[data-ftest="1"]', '肌の写真'); await W(800); await look('肌の写真を入れたあと'); }
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /記録する|保存/.test(x.innerText)); if (s) s.click(); }); await W(900); await close();
      if (!(await ev(() => state.skinLogs.some((l) => l.date === todayStr())))) note('肌の記録が保存されない');
      // ⑧ 睡眠・運動・食事（文字と写真）
      where = '睡眠の記録'; await ev(() => actions['life-part']('sleep')); await W(600); await ev(() => { const f = (id, v) => { const i = document.getElementById(id); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }; f('f_bed', '23:30'); f('f_wake', '07:00'); }); await look('睡眠の画面');
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(700); await close();
      where = '運動の記録'; await ev(() => actions['life-part']('exercise')); await W(600); await ev(() => { const i = document.getElementById('ex-min'); if (!i) return; i.value = '30'; i.dispatchEvent(new Event('input', { bubbles: true })); const a = document.getElementById('ex-add'); if (a) a.click(); }); await look('運動の画面');
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(700); await close();
      where = '食事の記録'; await ev(() => actions['life-part']('meal')); await W(700); await ev(() => { const i = document.querySelector('#modal-root [data-fq]'); if (!i) return; i.value = 'カレーライス'; i.dispatchEvent(new Event('input', { bubbles: true })); const bt = document.querySelector(`#modal-root [data-fadd="${i.dataset.fq}"]`); if (bt) bt.click(); }); await W(400); await look('食事の画面（文字）');
      if (pz.prem) { const has = await ev(() => { const i = document.querySelector('#modal-root input[data-mphoto]:not([capture])'); if (!i) return ''; i.setAttribute('data-ftest', 'm'); return '1'; }); if (has) { await setFile('#modal-root input[data-ftest="m"]', '食事の写真'); await W(1500); await look('食事の写真を読み取ったあと'); if (!pz.offline && !(await ev(() => /鮭の塩焼き/.test(document.getElementById('modal-root').innerText)))) note('食事の写真の読み取り結果が出ない'); } else note('食事の写真を入れる所がない'); }
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(800); await close();
      const lf = await ev(() => { const l = state.lifeLogs.find((x) => x.date === todayStr()); return l ? { bed: !!l.bed, ex: (l.exercise || []).length, foods: (l.foods || []).length } : null; });
      if (!lf) note('生活の記録が保存されない'); else { if (!lf.bed) note('睡眠が保存されない'); if (!lf.ex) note('運動が保存されない'); if (!lf.foods) note('食事が保存されない'); }
      // ⑨ ケア管理（チェック・時短・夜）
      where = 'ケア管理'; await go('#/routine');
      if (pz.prem) { await ev(() => { const c = document.querySelector('#main [data-action="rt-check"], #main [data-action="cm-check"]'); if (c) c.click(); }); await W(400); await look('ケアをチェックしたあと');
        await ev(() => { const q = document.querySelector('#main [data-action="rt-mode"], #main [data-action="rt-quick"]'); if (q) q.click(); }); await W(500); await look('時短モード');
        await ev(() => actions['rt-tab']('pm')); await W(600); await look('夜のケア'); }
      // ⑩ 記録の画面・日の画面・グラフ・レポート
      where = '記録の画面'; await go('#/log'); for (const t of ['list', 'cal', 'photo', 'life']) { await ev((t) => { try { actions['log-tab'](t); } catch (e) {} }, t); await W(400); await look('記録 ' + t); }
      await ev(() => { const r = document.querySelector('#main [data-action="chart-range"]'); if (r) r.click(); }); await W(300);
      // ⑪ AIの機能（相談・アドバイス）
      if (pz.prem) { where = 'AIの機能'; for (const a of ['advice-ai', 'care-ai', 'support-open']) { await go(a === 'support-open' ? '#/account' : '#/home?care'); const ok = await ev((a) => { const e = document.querySelector(`[data-action="${a}"]`); if (!e) return false; e.click(); return true; }, a); await W(1200); if (ok) await look('AI ' + a); await close(); } }
      // ⑫ 設定：テーマ・肌質診断のやり直し（妊娠の答えを変える）
      where = '設定'; await go('#/settings'); await ev(() => { const t = document.querySelector('[data-action="theme"]'); if (t) t.click(); }); await W(400); await look('テーマを変えたあと');
      await ev(() => { const t = document.querySelector('[data-action="theme"]'); if (t) t.click(); }); await W(300);
      await ev(() => actions['setup']()); await W(700); await look('肌質診断のやり直し'); await close();
      // ⑬ データの書き出し
      where = 'データの書き出し'; await ev(() => { try { actions['export'](); } catch (e) { throw e; } }); await W(800); await close();
      // ⑭ 削除（スワイプの削除）
      where = '削除'; const del = await ev(() => (state.myProducts.find((x) => x.name === 'テスト 手入力のサプリ') || {}).id);
      if (del) { await ev((id) => actions['swipe-del'](id), del); await W(600); if (await ev((id) => !!getMy(id), del)) note('アイテムを削除できない'); }
    }
    // ⑮ 全部の画面
    for (const h of ROUTES) await go(h);
    const logD = await ev(() => (state.skinLogs[0] || {}).date); if (logD) await go('#/log/' + logD, '記録の日の画面');
    // ⑯ 開き直しても消えていない
    where = '開き直し'; const before = await ev(() => JSON.stringify([state.myProducts.length, state.skinLogs.length, state.lifeLogs.length]));
    await p.reload(); await W(1500); const after = await ev(() => JSON.stringify([state.myProducts.length, state.skinLogs.length, state.lifeLogs.length]));
    if (before !== after) note(`開き直すと記録が変わる ${before}→${after}`);
    if (!pz.skip) { await W(1200); const ph = await ev(() => { const l = state.skinLogs.find((x) => x.date === todayStr()); return l ? String(safeImg(l.photo) || '').length : -1; }); if (!(ph > 100)) note('開き直すと、肌の記録の写真が消える ' + ph); } /* 2026-11-14 写真を端末の大きい保存場所へ移したときの確認 */
    out.push([pz.k, bad, Math.round((Date.now() - t0) / 1000)]); await ctx.close();
  }
  await b.close(); srv.close();
  let n = 0; for (const [k, L, s] of out) { console.log((L.length ? '✗ ' : '✓ ') + k + `（${s}秒）`); L.forEach((m) => console.log('   ・' + m)); n += L.length; }
  console.log(n ? `全部の機能テストで見つかった問題 ${n}件` : '全部の機能テスト：すべての人で問題なし'); process.exit(n ? 1 : 0);
})();
