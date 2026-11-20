// ナカカラモ：ていねいな点検（画面に出ている内容が、正しく・矛盾なく・重ならずに出ているか）
// 使い方：node hadatomo-cloud/tests/audit.js [skinwise.html のパス]（ONLY=名前の頭 で1人だけ）
// 2026-11-20 「同じ名前の塗り薬のカードが4つ」「注意を作ったのに画面に出ていない」「説明は“使わない”なのに手順に入っている」のようなミスを、全部の人・全部の画面で探す
//  ・手順：同じ時間に「おすすめ」と「控えたい」に同じ成分／控えたい成分が入った化粧品を使う／「使わない」と書いた物を使う／同じ名前の手順・同じメモが2つ
//  ・画面：手順のメモが画面に出ていない／同じ文のかたまりが2回／「〇〇」を押して、と書いてあるのにそのボタンがない／中身のない見出し／タブの数と一覧の数がちがう
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { PERSONAS, setBD } = require('./people.js');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const ROUTES = ['#/home', '#/home?care', '#/routine', '#/routine?pm', '#/log', '#/charts', '#/my', '#/my?rx', '#/my?oral', '#/combo', '#/ingredients', '#/mycare', '#/report', '#/account', '#/settings', '#/plan', '#/visit', '#/trouble', '#/care/diag', '#/care/guide'];
(async () => {
  const b = await chromium.launch(), out = [];
  for (const pz of PERSONAS.filter((x) => !process.env.ONLY || x.k.startsWith(process.env.ONLY))) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
    const p = await ctx.newPage(), bad = [], note = (m) => { if (!bad.includes(m)) bad.push(m); };
    let where = 'はじめ';
    p.on('pageerror', (e) => note(`${where}：エラー ${String(e.message).split('\n')[0].slice(0, 140)}`));
    p.on('dialog', (d) => d.dismiss());
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(URL0); await p.waitForTimeout(1500);
    const W = (ms) => p.waitForTimeout(ms);
    const ev = (f, a) => p.evaluate(f, a).catch((e) => { note(`${where}：止まった ${String(e.message).split('\n')[0].slice(0, 140)}`); return null; });
    await ev(() => { window.isPremium = () => true; window.open = () => null; navigator.vibrate = () => true; });
    for (const [k, v] of Object.entries(pz.a)) if (v !== undefined) for (const x of [].concat(v)) if (k === 'ageBand') await setBD(p, x); else await ev((s) => { const e = document.querySelector(s); if (e) e.click(); }, `[data-sw="${k}"][data-v="${x === '回答しない' ? '' : x}"]`);
    await ev(() => { const e = document.querySelector('[data-action="setup-finish"]'); if (e) e.click(); }); await W(600);
    await ev(() => { try { closeModal(true); } catch (e) {} const s = document.querySelector('.pm-skip'); if (s) s.click(); state.settings.permAsked2 = true; });
    await ev(([L, lg]) => { const d = todayStr(); L.forEach((x) => { const y = Object.assign({}, x, { startDate: addDays(d, -(x.ago || 20)) }); delete y.ago; state.myProducts.push(y); });
      state.skinLogs.push(Object.assign({ id: 'sl0', date: d, condition: 3, acneCount: 0, acneTypes: [], redness: 0, dryness: 0, oil: 0, usedProducts: [], memo: '', photo: '' }, lg));
      state = normalize(JSON.parse(JSON.stringify(state))); save(); render(); }, [pz.prods, pz.log || {}]);
    await W(300);
    // ① 手順の中身（朝・夜）
    for (const sl of ['am', 'pm']) {
      where = sl === 'am' ? '朝のケア' : '夜のケア';
      const r = await ev((sl) => { const P = rtPlan(sl), o = [], N = (v) => normIng(chipText(v)).replace(/（.*?）/g, ''), slotJa = sl === 'am' ? '朝' : '夜';
        const goods = new Map(), avoids = new Map(); P.steps.forEach((s) => { (s.good || []).forEach((g) => goods.set(N(g), [s.name, chipText(g)])); (s.avoid || []).forEach((a) => avoids.set(N(a), [s.name, chipText(a)])); });
        goods.forEach(([sn, g], k) => { const hit = [...avoids.keys()].find((a) => a && k && (a === k || (a.length >= 3 && k.includes(a)) || (k.length >= 3 && a.includes(k)))); if (hit && !/併用|と[^と]*の/.test(avoids.get(hit)[1])) o.push(`「${sn}」でおすすめの「${g}」を、「${avoids.get(hit)[0]}」では控えたいと書いている`); });
        // 控えたい成分が入った化粧品を、同じ時間に使う
        P.steps.forEach((s) => (s.prods || []).forEach((x) => { if (x.rx) return; const ing = normIng(`${ingsOfMy(x.p) || ''} ${x.p.name}`); avoids.forEach(([sn, a], k) => { if (k.length >= 2 && ing.includes(k) && !/熱いお湯|こする|コットン|重いクリーム|多く入った|併用|と/.test(a)) o.push(`控えたい「${a}」が入った「${prodIngLabel(x.p)}」を${slotJa}に使う`); }); }));
        // 説明で「使わず・使いません・お休み」と書いた物を使う
        const used = P.steps.flatMap((s) => (s.prods || []).filter((x) => !x.rx).map((x) => x.p));
        P.steps.flatMap((s) => (s.today || []).map((t) => (t && t.t) || '')).concat(P.tips || []).forEach((t) => { (t.match(/「([^」]+)」は[^。]*(お休み|使いません|使わず|手順に入れて)/g) || []).forEach((m) => { const nm = m.match(/「([^」]+)」/)[1]; used.forEach((pp) => { if (prodIngLabel(pp) === nm || pp.name === nm) o.push(`「${nm}」は休むと書いてあるのに、${slotJa}の手順で使う`); }); }); });
        // 同じ名前の手順・同じメモ
        const nm = P.steps.map((s) => s.name), dn = nm.filter((n, i) => nm.indexOf(n) !== i); if (dn.length) o.push('同じ名前の手順が2つ以上：' + [...new Set(dn)].join('・'));
        P.steps.forEach((s) => { const T = (s.today || []).map((t) => (t && t.t) || ''); const d = T.filter((t, i) => T.indexOf(t) !== i); if (d.length) o.push(`「${s.name}」に同じメモが2つ：${d[0].slice(0, 30)}`); });
        // 画面に出るはずのメモ（薬の手順の「薬の注意」は詳しい画面で出すので除く）が、画面に出ているか
        const show = P.steps.flatMap((s) => (s.today || []).filter((t) => t && !(s.fixed && t.src === '薬')).map((t) => ({ s: s.name, t: t.t })));
        return { o, show }; }, sl);
      if (!r) continue; r.o.forEach((m) => note(`${where}：${m}`));
      await ev((sl) => { try { closeModal(true); } catch (e) {} ui.rtTab = sl; location.hash = '#/routine'; render(); }, sl); await W(700);
      const txt = await ev(() => document.getElementById('main').innerText.replace(/[\s\u200b]+/g, ''));
      (r.show || []).forEach(({ s, t }) => { const cl = (v) => String(v).replace(/[\s\u200b「」。、]/g, ''); const k = cl(t), mid = k.slice(0, 10); if (txt && mid.length >= 8 && !cl(txt).includes(mid)) note(`${where}：作ったメモが画面に出ていない（${s}）「${t.slice(0, 40)}」`); });
    }
    { where = 'ケア管理（説明なしで消えた物）'; let all = ''; for (const sl of ['am', 'pm']) { await ev((sl) => { try { closeModal(true); } catch (e) {} ui.rtTab = sl; location.hash = '#/routine'; render(); }, sl); await W(600); all += await ev(() => document.getElementById('main').innerText.replace(/[\s\u200b「」]/g, '')) || ''; }
      const labs = await ev((ids) => ids.map((id) => { const x = getMy(id); return x ? [id, x.name, prodIngLabel(x), x.status] : null; }).filter(Boolean), pz.prods.filter((x) => x.category !== '皮膚科の塗り薬' && x.category !== '飲み薬・サプリ').map((x) => x.id)) || [];
      labs.forEach(([id, nm, lb, st]) => { if (st !== '使用中') return; const c = (v) => String(v).replace(/[\s\u200b「」]/g, ''); if (!all.includes(c(nm)) && !all.includes(c(lb))) note(`ケア管理：「${nm}」が手順にも説明にも出てこない（黙って消えている）`); }); }
    { where = '#/mycare（ケア管理との食い違い）'; const used = await ev(() => { const s = new Set(); ['am', 'pm'].forEach((sl) => rtPlan(sl).steps.forEach((z) => (z.prods || []).forEach((y) => s.add(y.p.id)))); return [...s]; });
      await ev(() => { try { closeModal(true); } catch (e) {} location.hash = '#/mycare'; render(); }); await W(700); const t = await ev(() => document.getElementById('main').innerText.replace(/\u200b/g, ''));
      if (used && t) pz.prods.filter((x) => x.category !== '皮膚科の塗り薬' && x.category !== '飲み薬・サプリ' && !used.includes(x.id)).forEach((x) => { if (new RegExp('続ける\\s*' + x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t)) note(`#/mycare：ケア管理では使わない「${x.name}」を「続ける」と書いている`); }); }
    // ② どの画面も：同じ文が2回・押すボタンがない・中身のない見出し・タブの数
    const pages = ROUTES.concat(pz.prods.map((x) => '#/my/' + x.id));
    for (const h of pages) {
      where = h;
      await ev((hh) => { try { closeModal(true); } catch (e) {} const [path, q] = hh.split('?'); if (path === '#/home') ui.homeTab = q === 'care' ? 'care' : 'rec'; if (path === '#/routine') ui.rtTab = q === 'pm' ? 'pm' : 'am'; if (path === '#/my') ui.myKind = q || 'cos'; location.hash = path; render(); }, h);
      await W(/routine|home/.test(h) ? 800 : 450);
      const r = await ev(() => { const o = [], main = document.getElementById('main'); if (!main) return o;
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        // 同じ文のかたまりが2回（25文字以上）
        const seen = new Map(); main.querySelectorAll('p, li, .notice, .cm-today, .rt-note, .tip, small, dd').forEach((e) => { if (!vis(e) || e.querySelector('p, li') || e.closest('.combo-sum') || e.closest('.pc-it')) return; /* 「使っている物」は商品ごとの行なので、同じ理由が並ぶことがある */ /* 成分の組み合わせの一番上は、下の一覧のまとめ（わざと同じ） */ const t = e.innerText.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim(); if (t.length < 25) return; if (seen.has(t)) { const k = '同じ文が2回出る「' + t.slice(0, 40) + '」'; if (!o.includes(k)) o.push(k); } else seen.set(t, e); });
        // 「〇〇」を押す・「〇〇」から、と書いてあるのに、そのボタンがない
        const labels = [...document.querySelectorAll('button, a, [role=button], label, summary, .ht, .tab, .tabbar a, .topbar *, [data-action]')].map((e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/[\s\u200b]+/g, '')).filter(Boolean);
        const txt = main.innerText; (txt.match(/「[^」]{2,20}」(ボタン)?(を押|から|で(登録|記録|追加|選)|ボタン)/g) || []).forEach((m) => { const l = m.match(/「([^」]+)」/)[1].replace(/[\s\u200b]+/g, ''); if (/^(朝|夜|保存|記録する)$/.test(l)) return; if (!labels.some((x) => x.includes(l))) { const k = `「${l}」を押すように書いてあるが、その名前のボタンがない`; if (!o.includes(k)) o.push(k); } });
        // 中身のない「おすすめ」「控えたい」
        main.querySelectorAll('.cm-ing').forEach((e) => { if (vis(e) && !e.querySelector('div') || (e.querySelector('div') && !e.querySelector('div').innerText.trim())) o.push('中身のない「' + (e.querySelector('small') || {}).innerText + '」'); });
        // 見出しだけのカード
        main.querySelectorAll('.card').forEach((c) => { if (!vis(c)) return; const h = c.querySelector('h2, h3'); if (h && c.innerText.replace(/\s+/g, '') === h.innerText.replace(/\s+/g, '')) o.push('見出しだけのカード「' + h.innerText.trim().slice(0, 20) + '」'); });
        // タブの数と一覧の数
        const at = main.querySelector('.my-tabs .ht.active .ht-n'); if (at) { const n = main.querySelectorAll('.mrow-w').length; if (Number(at.textContent) !== n) o.push(`タブの数（${at.textContent}）と一覧の数（${n}）がちがう`); }
        // 一覧に同じ商品が2つ
        const rows = [...main.querySelectorAll('.mrow b')].map((e) => e.innerText.trim()); const dr = rows.filter((t, i) => rows.indexOf(t) !== i); if (dr.length) o.push('一覧に同じ商品が2つ：' + dr[0]);
        return o; });
      (r || []).forEach((m) => note(`${h}：${m}`));
    }
    out.push([pz.k, bad]); await ctx.close();
  }
  await b.close(); srv.close();
  let n = 0; for (const [k, L] of out) { console.log((L.length ? '✗ ' : '✓ ') + k); L.forEach((m) => console.log('   ・' + m)); n += L.length; }
  console.log(n ? `ていねいな点検で見つかった問題 ${n}件` : 'ていねいな点検：すべての人で問題なし'); process.exit(n ? 1 : 0);
})();
