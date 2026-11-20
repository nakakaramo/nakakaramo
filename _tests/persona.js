// ナカカラモ：いろいろな人になりきって、はじめから使ってみるテスト
// 使い方：node hadatomo-cloud/tests/persona.js [skinwise.html のパス] [画面写真の保存先]
// 肌質診断 → 化粧品・塗り薬 → 肌・睡眠・運動・食事の記録 → ホーム・おすすめケア・ケア管理・記録一覧・Myアイテム・アカウント…を、人ごとに通して、
// エラー・「undefined」などの変な文字・画面からのはみ出し・押せないボタン・その人に合わない提案（妊娠中にレチノールなど）を探す
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html'), SHOT = process.argv[3] || '';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const P = (id, name, cat, ings, x) => Object.assign({ id, name, brand: x && x.brand || 'テスト', category: cat, ingredients: ings, status: '使用中', timing: x && x.timing || '朝・夜', purposes: [], purchases: [], demo: false }, x || {});
const PERSONAS = [
  { k: 'A_ニキビ脂性_女性20代', vw: 390, prem: true, a: { gender: '女性', ageBand: '20代', tight: 'no', oilDay: 'much', acne: 'often', red: 'some', sens: 'no', preg: 'no', concerns: ['acne', 'pore', 'oily'] },
    prods: [P('a1', 'ベピオゲル2.5%', '皮膚科の塗り薬', '過酸化ベンゾイル', { timing: '夜' }), P('a2', 'ディフェリンゲル0.1%', '皮膚科の塗り薬', 'アダパレン', { timing: '夜' }), P('a3', '薬用 ニキビケア化粧水', '化粧水', '水、BG、グリチルリチン酸2K、サリチル酸、エタノール'), P('a4', 'オイルフリー ジェル', '乳液', '水、グリセリン、ナイアシンアミド、カルボマー'), P('a5', 'スキンアクア UVジェル', '日焼け止め', '水、エタノール、メトキシケイヒ酸エチルヘキシル', { timing: '朝' })],
    log: { condition: 2, acneCount: 6, oil: 4, redness: 2 }, sleep: ['02:30', '07:00'], ex: 0, meal: ['菓子パン', 'カップラーメン'] },
  { k: 'B_乾燥敏感_女性30代_ダーク', vw: 390, prem: true, dark: true, a: { gender: '女性', ageBand: '30代', tight: 'yes', oilDay: 'little', acne: 'rare', red: 'often', sens: 'yes', preg: 'no', concerns: ['dry', 'sensitive', 'redness'] },
    prods: [P('b1', 'レチノール 美容液', '美容液', '水、レチノール、グリセリン'), P('b2', 'ピュアビタミンC 美容液', '美容液', '水、アスコルビン酸、エタノール'), P('b3', 'セラミド クリーム', 'クリーム', '水、セラミドNP、スクワラン、香料'), P('b4', '敏感肌用 化粧水', '化粧水', '水、グリセリン、パンテノール')],
    log: { condition: 2, acneCount: 0, dryness: 4, redness: 4 }, sleep: ['23:30', '07:00'], ex: 30, meal: ['鮭の塩焼き', 'ごはん', '味噌汁'] },
  { k: 'C_妊娠中_シミ_女性30代', vw: 390, prem: true, a: { gender: '女性', ageBand: '30代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'rare', sens: 'some', preg: 'preg', concerns: ['spot', 'dull'] },
    prods: [P('c1', 'レチノール クリーム', 'クリーム', 'レチノール、スクワラン'), P('c2', 'ハイドロキノン 美白クリーム', 'クリーム', 'ハイドロキノン、グリセリン', { timing: '夜' }), P('c3', 'ビタミンC誘導体 化粧水', '化粧水', '水、リン酸アスコルビルMg'), P('c4', 'ANESSA パーフェクトUV スキンケアミルク', '日焼け止め', '酸化亜鉛、水', { timing: '朝' })],
    log: { condition: 3, acneCount: 1 }, sleep: ['23:00', '07:00'], ex: 20, meal: ['サラダ', 'パスタ'] },
  { k: 'D_男性40代_無料', vw: 390, prem: false, a: { gender: '男性', ageBand: '40代', tight: 'some', oilDay: 'tzone', acne: 'rare', red: 'rare', sens: 'no', concerns: ['aging', 'pore'] },
    prods: [P('d1', 'メンズ オールインワンジェル', 'オールインワン', '水、グリセリン、ヒアルロン酸Na')], log: { condition: 4, acneCount: 0 }, sleep: ['00:30', '06:30'], ex: 45, meal: ['牛丼'] },
  { k: 'E_17歳以下_ニキビ_小さい画面', vw: 320, prem: false, a: { gender: '回答しない', ageBand: '17歳以下', tight: 'no', oilDay: 'much', acne: 'often', red: 'some', sens: 'some', concerns: ['acne'] },
    prods: [P('e1', '薬用 洗顔フォーム', '洗顔', '水、ラウリン酸、サリチル酸')], log: { condition: 2, acneCount: 4, oil: 5 }, sleep: ['01:00', '07:30'], ex: 60, meal: ['唐揚げ'] },
  { k: 'F_60代以上_シワ乾燥_大きい画面', vw: 430, prem: true, a: { gender: '女性', ageBand: '60代以上', tight: 'yes', oilDay: 'little', acne: 'rare', red: 'rare', sens: 'some', preg: 'no', concerns: ['aging', 'dry', 'spot'] },
    prods: [P('f1', 'エイジングケア クリーム', 'クリーム', 'ナイアシンアミド、レチノール、セラミドNP'), P('f2', 'しっとり化粧水', '化粧水', '水、グリセリン、ヒアルロン酸Na'), P('f3', 'ヒルドイドソフト軟膏', '皮膚科の塗り薬', 'ヘパリン類似物質')],
    log: { condition: 3, acneCount: 0, dryness: 5 }, sleep: ['22:00', '05:30'], ex: 15, meal: ['納豆', 'ごはん'] },
  { k: 'I_授乳中_種類の書き方がばらばら', vw: 375, prem: true, a: { gender: '女性', ageBand: '30代', tight: 'some', oilDay: 'little', acne: 'rare', red: 'some', sens: 'some', preg: 'nursing', concerns: ['dry', 'dull'] },
    prods: [P('i1', 'うるおい化粧水', '化粧水', '水、グリセリン、BG'), P('i2', 'バクチオール 美容液', '美容液', '水、バクチオール、スクワラン'), P('i3', 'ナイトクリーム', 'クリーム', 'レチノール、シアバター'), P('i4', 'UVミルク', 'UV', '酸化亜鉛', { timing: '朝' }), P('i5', '合わなかった美容液', '美容液', '水、エタノール、香料', { ng: { date: '2026-11-01', sym: ['赤み'] } })],
    log: { condition: 3, acneCount: 0, dryness: 3 }, sleep: ['00:00', '06:00'], ex: 10, meal: ['唐揚げ', 'サラダ', 'ごはん', 'みそ汁'] },
  { k: 'J_化粧品なし_プレミアム_夜9時', vw: 390, prem: true, at: '2026-11-20T21:00:00+09:00', a: { gender: '女性', ageBand: '20代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'rare', sens: 'no', preg: 'no', concerns: ['pore', 'dull'] },
    prods: [], log: { condition: 4, acneCount: 1 }, sleep: ['23:00', '07:00'], ex: 0, meal: ['おにぎり', 'ラーメン', 'ヨーグルト'] },
  { k: 'K_塗り薬だけ_男性20代_赤み', vw: 390, prem: true, at: '2026-11-20T07:30:00+09:00', a: { gender: '男性', ageBand: '20代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'often', sens: 'some', concerns: ['redness', 'acne'] },
    prods: [P('k1', 'ロコイド軟膏0.1%', '皮膚科の塗り薬', 'ヒドロコルチゾン酪酸エステル', { timing: '夜' }), P('k2', 'ヒルドイドローション0.3%', '皮膚科の塗り薬', 'ヘパリン類似物質'), P('k3', 'デュアック配合ゲル', '皮膚科の塗り薬', 'クリンダマイシン・過酸化ベンゾイル', { timing: '夜' })],
    log: { condition: 2, acneCount: 3, redness: 4 }, sleep: ['01:30', '07:00'], ex: 0, meal: ['牛丼'] },
  { k: 'G_診断しない_何もしない', vw: 390, prem: false, skip: true, prods: [] },
  { k: 'H_たくさん記録_化粧品40個', vw: 390, prem: true, heavy: true, a: { gender: '女性', ageBand: '20代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'some', sens: 'some', preg: 'no', concerns: ['acne', 'dry', 'pore', 'dull'] },
    prods: Array.from({ length: 40 }, (_, i) => P('h' + i, ['化粧水', '美容液', '乳液', 'クリーム', '日焼け止め', 'クレンジング', '洗顔', 'パック'][i % 8] + ' テスト商品 ' + i + (i % 8 === 4 ? ' SPF50+ PA++++' : ''), ['化粧水', '美容液', '乳液', 'クリーム', '日焼け止め', 'クレンジング', '洗顔', 'シートマスク・パック'][i % 8], ['水、グリセリン', 'ナイアシンアミド、水', 'レチノール、水', 'セラミドNP、水', '酸化亜鉛', 'ミネラルオイル', 'ラウリン酸', 'ヒアルロン酸Na'][i % 8])),
    log: { condition: 3, acneCount: 2 }, sleep: ['23:45', '07:15'], ex: 25, meal: ['ヨーグルト', 'バナナ'] },
];
const ROUTES = ['#/home', '#/home?care', '#/log', '#/charts', '#/my', '#/routine', '#/mycare', '#/report', '#/account', '#/settings', '#/ingredients', '#/combo', '#/plan', '#/care/diag', '#/visit'];
const RETINOID = /レチノ|レチナール|ハイドロキノン|アダパレン|トレチノイン|ディフェリン/;
(async () => {
  const b = await chromium.launch(), out = [];
  for (const pz of PERSONAS.filter((x) => !process.env.ONLY || x.k.startsWith(process.env.ONLY))) {
    const ctx = await b.newContext({ viewport: { width: pz.vw, height: 844 }, isMobile: true, hasTouch: true, colorScheme: pz.dark ? 'dark' : 'light', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
    const p = await ctx.newPage(), bad = [], note = (m) => { if (!bad.includes(m)) bad.push(m); };
    if (pz.at) await p.clock.setFixedTime(new Date(pz.at));
    let where = 'はじめ';
    p.on('pageerror', (e) => note(`${where}：エラー ${String(e.message).split('\n')[0].slice(0, 140)}`));
    p.on('dialog', (d) => d.dismiss());
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(URL0); await p.waitForTimeout(1500);
    const W = (ms) => p.waitForTimeout(ms);
    const ev = (f, a) => p.evaluate(f, a).catch((e) => { note(`${where}：確認中に止まった ${String(e.message).split('\n')[0].slice(0, 120)}`); return null; });
    // 押す：画面の上でほかの物に隠れていないかも確かめる（中の見えないスイッチ hap-ov は、押した物の一部とみなす）
    const tap = async (sel, label) => ev(([s, l]) => { const e = document.querySelector(s); if (!e) return 'なし'; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const ok = t && (t === e || e.contains(t) || t.contains(e) || (t.closest('label') && e.contains(t.closest('label'))) || (t.closest('.hap-wrap') && t.closest('.hap-wrap').contains(e)) || (t.closest('.hap-ov') && t.closest('.hap-ov').parentElement.contains(e)));
      e.click(); return ok ? 'ok' : '隠れている:' + (t ? (t.className || t.tagName) : '') + ':' + l; }, [sel, label || sel]).then((r) => { if (r && r !== 'ok') note(`${where}：${label || sel} ${r}`); return r; });
    // 画面の中身を確かめる
    const check = async (name) => {
      where = name;
      const r = await ev(() => {
        const o = [], vw = innerWidth, txt = (document.querySelector('#main') || document.body).innerText + ' ' + ((document.querySelector('#modal-root') || {}).innerText || '');
        const m = txt.match(/.{0,14}(undefined|NaN|\[object|Infinity|null(?![a-z])|function \(|=>).{0,14}/); if (m) o.push('変な文字「' + m[0].replace(/\s+/g, ' ') + '」');
        if (document.documentElement.scrollWidth > vw + 1) o.push('横にはみ出し ' + document.documentElement.scrollWidth + '>' + vw);
        const sc = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll|hidden)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
        const seen = new Set();
        document.querySelectorAll('#main *, #modal-root *').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= vw + 1 || r.left >= vw) return; if (sc(e)) return; const k = e.className && String(e.className).split(' ')[0] || e.tagName; if (seen.has(k)) return; seen.add(k); o.push('画面の右にはみ出す ' + k + ' (' + Math.round(r.right) + ')'); });
        document.querySelectorAll('#main button, #main a, #modal-root button').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; if (!e.querySelector('ol,ul,p,div') && e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow === 'visible' && !/ellipsis/.test(getComputedStyle(e).textOverflow)) { const k = 'ボタンの文字がはみ出す「' + e.innerText.trim().slice(0, 16) + '」'; if (!o.includes(k)) o.push(k); } });
        document.querySelectorAll('#main img').forEach((e) => { if (e.complete && e.naturalWidth === 0 && e.getAttribute('src') && !/^https?:/.test(e.getAttribute('src'))) o.push('画像が出ない ' + e.getAttribute('src').slice(0, 30)); });
        // 文字が背景に溶けて読めない所（明るさの比が低い）
        const rgb = (c) => { const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const BGC = new Map(); const bgOf = (e) => { if (BGC.has(e)) return BGC.get(e); const v = bgOf0(e); BGC.set(e, v); return v; }; const bgOf0 = (e) => { for (let x = e; x; x = x.parentElement) { if (x !== e && BGC.has(x)) return BGC.get(x); const c = rgb(getComputedStyle(x).backgroundColor); if (c && c[3] > 0.6) return c; if (getComputedStyle(x).backgroundImage !== 'none') return null; } return rgb(getComputedStyle(document.body).backgroundColor); };
        const low = new Set();
        [...document.querySelectorAll('#main *, #modal-root *')].slice(0, 1500).forEach((e) => { if (low.size > 3) return; const t = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(''); if (!t) return; const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 3) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.5) return;
          const pb = (x) => x && ['::before', '::after'].some((ps) => { const c = rgb(getComputedStyle(x, ps).backgroundColor); return c && c[3] > 0.3; }); if (pb(e) || pb(e.parentElement) || e.closest('.sc-tabs,.seg,.chips-sw,[class*="tabs"]')) return; /* 色の板が後ろの別の物（::before）のときは測れない */
          const fg = rgb(cs.color), bg = bgOf(e); if (!fg || !bg || fg[3] < 0.5) return; const a = lum(fg), b2 = lum(bg), cr = (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05); if (cr < 2.6) low.add('「' + t.slice(0, 12) + '」' + cr.toFixed(1)); });
        if (low.size) o.push('文字が読みにくい ' + [...low].join(' '));
        return o.slice(0, 8);
      });
      (r || []).forEach((m) => note(`${name}：${m}`));
      if (SHOT) await p.screenshot({ path: path.join(SHOT, `${pz.k}_${name.replace(/[#/?]/g, '_')}.png`), fullPage: false }).catch(() => {});
    };
    await ev((pr) => { window.isPremium = () => pr; window.open = () => null; navigator.vibrate = () => true; }, pz.prem);
    // ① 肌質診断（はじめに自動で開く）
    where = '肌質診断';
    const opened = await ev(() => !!document.querySelector('#sw-body'));
    if (!opened) note('はじめに肌質診断が開かない');
    if (pz.skip) await tap('[data-action="setup-later"]', 'あとで');
    else {
      for (const [k, v] of Object.entries(pz.a)) for (const x of [].concat(v)) await tap(`[data-sw="${k}"][data-v="${x === '回答しない' ? '' : x}"]`, `${k}=${x}`);
      await check('肌質診断');
      await tap('[data-action="setup-finish"]', '診断する'); await W(700);
      const st = await ev(() => ({ on: !!state.settings.onboarded, diag: !!(state.settings.diag), skin: state.settings.skinType, preg: pregNow(), c: concernKeysNow() }));
      if (!st || !st.diag) note('肌質診断が保存されない');
      if (st && pz.a.preg === 'preg' && st.preg !== 'preg') note('妊娠中が保存されない ' + st.preg);
      if (st && pz.a.concerns.some((c) => !st.c.includes(c))) note('肌悩みが保存されない ' + st.c.join(','));
      await check('診断の結果');
      await ev(() => { const m = document.querySelector('#modal-root [data-action="close-modal"]'); if (m) m.click(); });
    }
    await W(600); await ev(() => { const s = document.querySelector('.pm-skip'); if (s) s.click(); }); await W(500);
    await ev(() => { ui.homeTab = 'rec'; location.hash = '#/home'; render(); }); await W(500); await ev(() => { const s = document.querySelector('.pm-skip'); if (s) s.click(); }); await W(400);
    await check('ホーム（はじめ）');
    // ② 化粧品・塗り薬（たくさんある人は、まとめて入れる）
    await ev(([L, heavy]) => { const d = todayStr(); L.forEach((x) => state.myProducts.push(Object.assign({ startDate: addDays(d, -20) }, x)));
      if (heavy) { state.skinLogs = Array.from({ length: 120 }, (_, i) => ({ id: 'hl' + i, date: addDays(d, -i - 1), condition: 1 + (i % 5), acneCount: i % 7, usedProducts: L.slice(0, 6).map((x) => x.id), memo: i % 3 ? '' : 'メモ' + i, photo: '' }));
        state.lifeLogs = Array.from({ length: 90 }, (_, i) => ({ id: 'hf' + i, date: addDays(d, -i - 1), bed: '23:30', wake: '07:00', exercise: i % 2 ? [{ type: 'ウォーキング', minutes: 30 }] : [], meals: { breakfast: { items: [{ name: 'ヨーグルト', kcal: 90 }] } } })); }
      state = normalize(JSON.parse(JSON.stringify(state))); save(); render(); }, [pz.prods, !!pz.heavy]);
    await W(400); await ev(() => { ui.homeTab = 'rec'; location.hash = '#/home'; render(); }); await W(400);
    if (!pz.skip) {
      // ③ 今日の肌を記録（画面から）
      where = '肌の記録';
      await tap('[data-action="new-log"]', '今日の肌を記録'); await W(700);
      await ev((L) => { const set = (n, v) => { const i = document.querySelector(`#modal-root input[name="${n}"][value="${v}"]`); if (i) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } };
        set('condition', L.condition); if (L.redness) set('redness', L.redness); if (L.dryness) set('dryness', L.dryness); if (L.oil) set('oil', L.oil);
        const a = document.querySelector('#f_acneCount'); if (a) { a.value = String(L.acneCount || 0); a.dispatchEvent(new Event('input', { bubbles: true })); }
        const m = document.querySelector('#f_memo'); if (m) m.value = '今日のメモ'; }, pz.log);
      await check('肌の記録の画面');
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /記録する|保存/.test(x.innerText)); if (s) s.click(); }); await W(900);
      const n = await ev(() => state.skinLogs.filter((l) => l.date === todayStr()).length); if (!n) note('肌の記録が保存されない');
      // ④ 睡眠
      where = '睡眠の記録'; await ev(() => actions['life-part']('sleep')); await W(600);
      await ev(([bd, wk]) => { const f = (id, v) => { const i = document.getElementById(id); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }; f('f_bed', bd); f('f_wake', wk); }, pz.sleep);
      await check('睡眠の記録の画面');
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(700);
      // ⑤ 運動
      if (pz.ex) { where = '運動の記録'; await ev(() => actions['life-part']('exercise')); await W(600);
        await ev((m) => { const i = document.getElementById('ex-min'); i.value = String(m); i.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ex-add').click(); }, pz.ex); await W(200);
        await check('運動の記録の画面');
        await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(700); }
      // ⑥ 食事（文字で入れる）
      where = '食事の記録'; await ev(() => actions['life-part']('meal')); await W(700);
      for (const f of pz.meal) await ev((v) => { const i = document.querySelector('#modal-root [data-fq]'); if (!i) return 'なし'; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); const bt = document.querySelector(`#modal-root [data-fadd="${i.dataset.fq}"]`); if (bt) bt.click(); }, f);
      await W(400); await check('食事の記録の画面');
      await ev(() => { const s = [...document.querySelectorAll('#modal-root button')].find((x) => /保存する/.test(x.innerText)); if (s) s.click(); }); await W(800);
      const lf = await ev(() => { const l = state.lifeLogs.find((x) => x.date === todayStr()); return l ? { bed: l.bed, ex: (l.exercise || []).length, meal: JSON.stringify(l.meals || {}).length } : null; });
      if (!lf) note('生活の記録が保存されない'); else { if (!lf.bed) note('睡眠が保存されない'); if (pz.ex && !lf.ex) note('運動が保存されない'); const nf = await ev(() => (state.lifeLogs.find((x) => x.date === todayStr()).foods || []).length); if (!nf) note('食事が保存されない'); }
    }
    await ev(() => { try { closeModal(true); } catch (e) {} });
    // ⑦ いろいろな画面
    for (const h of ROUTES) {
      await ev((hh) => { try { closeModal(true); } catch (e) {} const ps = document.getElementById('prem-sheet'); if (ps) ps.remove(); if (hh === '#/home?care') { ui.homeTab = 'care'; location.hash = '#/home'; } else { if (hh === '#/home') ui.homeTab = 'rec'; location.hash = hh; } render(); }, h);
      await W(h === '#/routine' || h === '#/home?care' ? 900 : 500); await check(h);
    }
    // ⑧ その人に合っているか（ケア管理・おすすめケア）
    where = '提案の中身';
    const care = await ev(() => { const o = { steps: {}, good: [], avoid: [], adv: [] }; try { ['am', 'pm'].forEach((sl) => { o.steps[sl] = rtPlan(sl).steps.map((s) => ({ k: s.k, name: s.name, prods: (s.prods || []).map((x) => x.p.name), good: s.good, today: (s.today || []).map((t) => t.t || t), avoidOwn: (s.avoidOwn || []).map((a) => (a.nm || '') + ':' + (a.why || a.here || '')) })); }); } catch (e) { o.err = String(e); }
      try { const S = careSkinPick(); o.good = S.good; o.avoid = S.avoid; } catch (e) { o.err2 = String(e); }
      try { o.adv = (advicePts().pts || []).map((x) => ({ area: x.area, title: x.title, good: x.good, avoid: x.avoid })); } catch (e) { o.err3 = String(e); }
      try { o.today = careTodayData().items.map((x) => x.cat + ':' + x.title); } catch (e) { o.err4 = String(e); }
      try { const R = routineDesign('normal'), f = (L) => L.map((z) => z.kind + ':' + (z.x ? z.x.p.name : '-') + (z.missing ? '(missing)' : '') + (z.day ? '/' + z.day : '')); o.R = { infos: R.A.infos.map((x) => x.p.name + ':' + x.step + (x.rx ? '(rx)' : '') + (x.nightOnly ? '(夜)' : '')), am: f(R.am), pm: f(R.pm), paused: (R.paused || []).map((x) => x.p.name), notes: JSON.stringify(R.notes || R.msgs || '').slice(0, 400) }; } catch (e) { o.Rerr = String(e); }
      try { o.life = state.lifeLogs.filter((l) => l.date === todayStr()); o.LN = skinLean(state.skinLogs.find((l) => l.date === todayStr())); } catch (e) { o.lerr = String(e); }
      try { o.rested = [...RESTED.entries()].map(([id, w]) => (getMy(id) || {}).name + '：' + w); } catch (e) {} return o; });
    if (care) {
      ['err', 'err2', 'err3', 'err4'].forEach((k) => { if (care[k]) note('提案でエラー ' + care[k].slice(0, 120)); });
      const used = Object.values(care.steps).flat().flatMap((s) => s.prods), goods = Object.values(care.steps).flat().flatMap((s) => s.good).concat(care.good);
      if (pz.a && pz.a.preg === 'nursing' && Object.values(care.steps).flat().flatMap((s) => s.prods).some((n) => /バクチオール|ナイトクリーム/.test(n))) note('授乳中なのにレチノール・バクチオールの物を使う');
      if (pz.prods.some((x) => x.ng) && Object.values(care.steps).flat().flatMap((s) => s.prods).some((n) => pz.prods.find((x) => x.ng && x.name === n))) note('肌に合わなかった物を手順に入れる');
      if (pz.prods.some((x) => x.category === '化粧水') && !Object.values(care.steps).flat().some((s) => s.k === 'toner' && (s.prods.length || s.avoidOwn.length || s.today.some((t) => /お休み/.test(t))))) note('「化粧水」と書いた物が化粧水の手順に入らない');
      if (pz.prods.some((x) => x.category === 'UV') && !care.steps.am.some((s) => s.k === 'sunscreen' && s.prods.length)) note('「UV」と書いた日焼け止めが使われない');
      if (pz.a && pz.a.preg === 'preg') { if (used.some((n) => RETINOID.test(n))) note('妊娠中なのにレチノイド・ハイドロキノンを使う手順 ' + used.filter((n) => RETINOID.test(n)).join('・'));
        if (goods.some((g) => RETINOID.test(g))) note('妊娠中なのにレチノイドをすすめる');
        Object.values(care.steps).flat().flatMap((s) => s.today).filter((t) => /「(レチノール|ハイドロキノン)」/.test(t) && /お休み|使いません/.test(t)).forEach((t) => { if (!/妊娠中/.test(t)) note('妊娠中に休む理由が妊娠ではない：' + t.slice(0, 60)); }); }
      if (pz.a && pz.a.sens === 'yes' && goods.some((g) => /AHA|BHA|グリコール酸|ピーリング|スクラブ/.test(g))) note('敏感肌なのに角質ケアをすすめる');
      Object.entries(care.steps).forEach(([sl, L]) => { const c = {}; L.flatMap((s) => s.today).filter((t) => /お休み|使いません/.test(t)).forEach((t) => (t.match(/「[^」]+」/g) || []).forEach((q) => { c[q] = (c[q] || 0) + 1; })); Object.entries(c).forEach(([q, n]) => { if (n > 1) note(`${sl}：同じ物を2回「お休み」と書いている ${q}`); }); });
      Object.entries(care.steps).forEach(([sl, L]) => { const all = L.flatMap((s) => s.prods); const dup = all.filter((n, i) => all.indexOf(n) !== i); if (dup.length) note(`${sl}：同じ商品を2回使う ${dup.join('・')}`); });
      if (pz.prods.length && pz.prem && !Object.values(care.steps).flat().length) note('ケア管理の手順が空');
      if (pz.prem && !Object.values(care.steps).flat().length) note('ケア管理に手順がひとつもない');
      if (pz.prem && (care.today || []).some((t) => /朝はぬるま湯だけで洗う/.test(t)) && care.steps.am.some((s) => s.k === 'wash')) note('おすすめケアは「朝はぬるま湯」なのに、ケア管理は洗顔料で洗う');
      if (pz.prem && (care.today || []).some((t) => /朝も洗顔料で/.test(t)) && care.steps.am.some((s) => s.k === 'water')) note('おすすめケアは「朝も洗顔料」なのに、ケア管理はぬるま湯');
      if (pz.prods.some((x) => /過酸化ベンゾイル/.test(x.ingredients)) && !JSON.stringify(care.steps.pm).match(/デュアック|ベピオ|過酸化ベンゾイル/)) note('ニキビの塗り薬が夜の手順にない');
      if (pz.prods.some((x) => /ヒドロコルチゾン|ロコイド/.test(x.name + x.ingredients)) && !JSON.stringify(care.steps).match(/ロコイド|ヒドロコルチゾン|ステロイド/)) note('ステロイドの塗り薬が手順にない');
      if (pz.prem && pz.prods.some((x) => /日焼け止め/.test(x.category)) && !care.steps.am.some((s) => s.k === 'sunscreen')) note('朝に日焼け止めの手順がない');
      if (pz.prem && care.steps.pm.some((s) => s.k === 'sunscreen')) note('夜に日焼け止めの手順がある');
      care.steps.am.forEach((s) => s.prods.forEach((n) => { const x = pz.prods.find((y) => y.name === n); if (x && !/皮膚科/.test(x.category) && /レチノール|ハイドロキノン/.test(x.ingredients)) note('朝にレチノールなど夜向きの物を使う：' + n); }));
      if (pz.prods.some((x) => /過酸化ベンゾイル/.test(x.ingredients)) && pz.prods.some((x) => /アダパレン/.test(x.ingredients))) { /* 併用の注意が出ているか */ const t = JSON.stringify(care.steps.pm); if (!/過酸化ベンゾイル|ベピオ/.test(t) && !/アダパレン|ディフェリン/.test(t)) note('ニキビの塗り薬が夜の手順にない'); }
      if (pz.a && pz.a.concerns.includes('acne') && care.adv.length) { const sk = care.adv.find((x) => x.area === 'スキンケア'); if (sk && (sk.good || []).some((g) => /オイル|油分の多い/.test(g))) note('ニキビの人にオイルをすすめる'); }
      if (SHOT) fs.writeFileSync(path.join(SHOT, `${pz.k}_care.json`), JSON.stringify(care, null, 1));
    }
    out.push([pz.k, bad]); await ctx.close();
  }
  await b.close(); srv.close();
  let n = 0; for (const [k, L] of out) { console.log((L.length ? '✗ ' : '✓ ') + k); L.forEach((m) => console.log('   ・' + m)); n += L.length; }
  console.log(n ? `見つかった問題 ${n}件` : 'すべての人で問題なし'); process.exit(n ? 1 : 0);
})();
