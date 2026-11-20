// ナカカラモ：安全テスト（いろいろな人になりきって、提案が安全かを確かめる）
// 使い方：node hadatomo-cloud/tests/safety.js [skinwise.html のパス]（ONLY=名前の頭 で1人だけ）
// 確かめること（全員）：
//  ・薬（塗り薬・飲み薬）を「やめる・減らす・中止」と読める提案をしない／飲む量（mg・錠）を書かない
//  ・アドバイスの文に、処方薬の商品名を出さない（成分名で書く）
//  ・処方の塗り薬は、肌の記録で手順から外さない（妊娠中に添付文書で禁忌の物だけは外して「医師に相談」）
//  ・妊娠中・授乳中にレチノイド・ハイドロキノンを使う手順・すすめをしない。注意が必要な飲み薬は「医師・薬剤師に伝える」と出す
//  ・薬と刺激が重なる化粧品（レチノール・ピーリングなど）を、同じ時間の手順に入れない
//  ・肌に合わなかった物を手順に入れない／敏感肌・赤みの人にピーリングをすすめない／17歳以下にハイドロキノンをすすめない
//  ・日焼けしやすくなる飲み薬・シミの飲み薬では、日焼け止めの理由を出す。日焼け止めを持っていない人にも、朝の日焼け止めを出す
//  ・一緒に使うと危ない組み合わせ（イソトレチノイン×テトラサイクリン系など）は、成分の組み合わせの画面に出す
//  ・どの画面も、エラー・変な文字が出ない
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '/home/claude/skinwise.html');
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(FILE)); }).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;
const { PERSONAS, RX, OR } = require('./people.js');
const ROUTES = ['#/home', '#/home?care', '#/routine', '#/my', '#/combo', '#/plan', '#/visit'];
const RETINOID = /レチノ|レチナール|ハイドロキノン|アダパレン|トレチノイン|ディフェリン|エピデュオ|タザロテン/;
const STOP = /(薬|塗り薬|飲み薬|処方)[^。]{0,24}(やめ(ま|て|る|よう)|中止|減ら(し|す)|飲まないで|塗らないで)|(やめ(ま|て|る|よう)|中止|減ら(し|す))[^。]{0,12}(薬|塗り薬|飲み薬)/;
const DOSE = /\d+(\.\d+)?\s*(mg|ミリグラム|錠|カプセル)(?![^。]*(美容液|化粧水))/;
(async () => {
  const b = await chromium.launch(), out = [];
  for (const pz of PERSONAS.filter((x) => !process.env.ONLY || x.k.startsWith(process.env.ONLY))) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
    const p = await ctx.newPage(), bad = [], note = (m) => { if (!bad.includes(m)) bad.push(m); };
    await p.clock.setFixedTime(new Date('2026-07-20T08:00:00+09:00')); // 夏の朝（紫外線が強い季節）
    let where = 'はじめ';
    p.on('pageerror', (e) => note(`${where}：エラー ${String(e.message).split('\n')[0].slice(0, 140)}`));
    p.on('dialog', (d) => d.dismiss());
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(URL0); await p.waitForTimeout(1500);
    const W = (ms) => p.waitForTimeout(ms);
    const ev = (f, a) => p.evaluate(f, a).catch((e) => { note(`${where}：確認中に止まった ${String(e.message).split('\n')[0].slice(0, 120)}`); return null; });
    await ev(() => { window.isPremium = () => true; window.open = () => null; navigator.vibrate = () => true; });
    // ① 肌質診断（画面から答える）
    where = '肌質診断';
    for (const [k, v] of Object.entries(pz.a)) if (v !== undefined) for (const x of [].concat(v)) await ev(([s]) => { const e = document.querySelector(s); if (e) e.click(); }, [`[data-sw="${k}"][data-v="${x === '回答しない' ? '' : x}"]`]);
    await ev(() => { const e = document.querySelector('[data-action="setup-finish"]'); if (e) e.click(); }); await W(700);
    await ev(() => { try { closeModal(true); } catch (e) {} const s = document.querySelector('.pm-skip'); if (s) s.click(); state.settings.permAsked2 = true; });
    // ② 持っている物・今日の肌の記録
    await ev(([L, lg]) => { const d = todayStr(); L.forEach((x) => { const y = Object.assign({}, x, { startDate: addDays(d, -(x.ago || 20)) }); delete y.ago; state.myProducts.push(y); });
      state.skinLogs.push(Object.assign({ id: 'sl0', date: d, condition: 3, acneCount: 0, acneTypes: [], redness: 0, dryness: 0, oil: 0, usedProducts: [], memo: '', photo: '' }, lg));
      state = normalize(JSON.parse(JSON.stringify(state))); save(); render(); }, [pz.prods, pz.log || {}]);
    await W(400);
    // ③ 提案の中身を集める
    where = '提案の中身';
    const C = await ev(() => { const o = {}; try { o.pl = {}; ['am', 'pm'].forEach((sl) => { const P = rtPlan(sl); o.pl[sl] = { steps: P.steps.map((s) => ({ k: s.k, prods: (s.prods || []).map((x) => x.p.id), good: s.good || [], avoid: s.avoid || [], today: (s.today || []).map((t) => (t && t.t) || String(t || '')) })), tips: P.tips || [], rested: [...(P.rested || new Map()).entries()] }; }); } catch (e) { o.err = String(e); }
      try { o.adv = (advicePts().pts || []).map((x) => [x.title, x.good, x.avoid, x.why, x.how].flat().filter(Boolean).join(' ')); } catch (e) { o.err3 = String(e); }
      try { o.today = careTodayData().items.map((x) => [x.title, x.d, x.why].filter(Boolean).join(' ')); } catch (e) { o.err4 = String(e); }
      try { const S = careSkinPick(), f = (L) => (L || []).map((x) => String(x.t || x.name || x)); o.sgGood = f(S.good); o.sg = f(S.good).concat(f(S.avoid)); } catch (e) { o.err2 = String(e); }
      try { o.pairs = prodAnalysis().pairs.map((z) => z.r.lv + ':' + z.r.t + ':' + z.x.p.id + ':' + z.y.p.id); } catch (e) { o.err5 = String(e); }
      o.preg = pregNow(); return o; });
    if (!C) { out.push([pz.k, bad]); await ctx.close(); continue; }
    ['err', 'err2', 'err3', 'err4', 'err5'].forEach((k) => { if (C[k]) note('提案でエラー ' + k + ' ' + C[k].slice(0, 120)); });
    const steps = C.pl ? C.pl.am.steps.concat(C.pl.pm.steps) : [], used = (sl) => (C.pl ? C.pl[sl].steps : []).flatMap((s) => s.prods), usedAll = used('am').concat(used('pm'));
    const adviceTxt = [steps.flatMap((s) => s.today), steps.flatMap((s) => s.good), steps.flatMap((s) => s.avoid), C.pl ? C.pl.am.tips.concat(C.pl.pm.tips) : [], C.adv || [], C.today || [], C.sg || []].flat().join('\n');
    const goods = steps.flatMap((s) => s.good).concat(C.sgGood || []); /* すすめる物だけ（「控えたい」は入れない） */
    // 全員：やめる・減らす／飲む量／商品名
    adviceTxt.split(/\n|。/).forEach((t) => { if (STOP.test(t)) note('薬をやめる・減らすと読める：' + t.slice(0, 70)); if (DOSE.test(t)) note('飲む量を書いている：' + t.slice(0, 60)); });
    (pz.brands || []).forEach((br) => { if (adviceTxt.includes(br)) note('アドバイスに処方薬の商品名「' + br + '」'); });
    // 処方の塗り薬は外さない（妊娠中に禁忌の物だけ外して、医師に相談と出す）
    pz.prods.filter((x) => x.category === RX).forEach((x) => { const inR = usedAll.includes(x.id), ban = (pz.banned || []).includes(x.id), rs = C.pl ? new Map(C.pl.pm.rested.concat(C.pl.am.rested)).get(x.id) : '';
      if (ban) { if (inR) note('妊娠中に禁忌の塗り薬が手順に入る：' + x.name); if (!/禁忌[\s\S]*医師に相談/.test(rs || '')) note('禁忌の塗り薬に「医師に相談」が出ない：' + x.name); }
      else if (!inR) note('処方の塗り薬が手順から外れる：' + x.name + (rs ? '（' + rs + '）' : '')); });
    // 飲み薬・サプリは塗る手順に入れない
    pz.prods.filter((x) => x.category === OR).forEach((x) => { if (usedAll.includes(x.id)) note('飲み薬・サプリが塗る手順に入る：' + x.name); });
    // 妊娠中・授乳中
    if (pz.a.preg === 'preg' || pz.a.preg === 'nursing') {
      const bad2 = usedAll.filter((id) => { const x = pz.prods.find((y) => y.id === id); return x && x.category !== RX && (RETINOID.test(x.ingredients + x.name) || (pz.a.preg === 'nursing' && /バクチオール/.test(x.ingredients))); });
      if (bad2.length) note(`${pz.a.preg === 'preg' ? '妊娠中' : '授乳中'}にレチノイド・ハイドロキノンの化粧品を使う手順：` + bad2.join(','));
      if (goods.some((g) => RETINOID.test(g) && !/妊娠|授乳/.test(g))) note('妊娠中・授乳中にレチノイドをすすめる：' + goods.filter((g) => RETINOID.test(g)).join('・'));
    }
    if (pz.pregOral && !(C.pl.am.tips.concat(C.pl.pm.tips)).some((t) => new RegExp(`妊娠中は、飲んでいる「[^」]*${pz.pregOral}[^」]*」について、必ず医師・薬剤師に伝えて`).test(t))) note('妊娠中に注意が必要な飲み薬の説明がない：' + pz.pregOral);
    // 刺激が重なる化粧品・合わなかった物を使わない
    (pz.noUse || []).forEach((id) => { if (usedAll.includes(id)) note('使わないはずの物が手順に入る：' + (pz.prods.find((x) => x.id === id) || {}).name); });
    if (pz.noGood && goods.some((g) => pz.noGood.test(g))) note('すすめてはいけない成分をすすめる：' + goods.filter((g) => pz.noGood.test(g)).join('・'));
    if ((pz.sens || pz.a.sens === 'yes') && goods.some((g) => /AHA|BHA|グリコール酸|サリチル酸|ピーリング|スクラブ/.test(g))) note('敏感肌・赤みの人に角質ケアをすすめる：' + goods.filter((g) => /AHA|BHA|グリコール酸|サリチル酸|ピーリング|スクラブ/.test(g)).join('・'));
    if (pz.minor && goods.some((g) => /ハイドロキノン/.test(g))) note('17歳以下にハイドロキノンをすすめる');
    // 日焼け止め
    const sun = C.pl && C.pl.am.steps.find((s) => s.k === 'sunscreen'); if (!sun) note('朝の日焼け止めの手順がない'); if (C.pl && C.pl.pm.steps.some((s) => s.k === 'sunscreen')) note('夜に日焼け止めの手順がある');
    if (pz.sunWhy && !(sun && sun.today.some((t) => pz.sunWhy.test(t)))) note('飲み薬に合わせた日焼け止めの理由がない ' + pz.sunWhy);
    if (pz.abxNote && !adviceTxt.match(/使う期間は医師が決めます/)) note('長く使っている抗菌薬の塗り薬に「期間は医師に」が出ない');
    if (pz.abxNote && !adviceTxt.match(/飲む期間は医師が決めます/)) note('長く飲んでいる抗菌薬に「期間は医師に」が出ない');
    // 危ない組み合わせが、成分の組み合わせに出る
    (pz.combo || []).forEach((re) => { if (!(C.pairs || []).some((z) => /^3:/.test(z) && re.test(z))) note('危ない組み合わせが出ない ' + re + ' ／ ' + (C.pairs || []).join(' | ').slice(0, 200)); });
    // ④ 画面を開いて、エラー・変な文字・やめると読める文がないか
    const ids = pz.prods.map((x) => x.id);
    for (const h of ROUTES.concat(ids.map((i) => '#/my/' + i))) {
      where = h;
      await ev((hh) => { try { closeModal(true); } catch (e) {} if (hh === '#/home?care') { ui.homeTab = 'care'; location.hash = '#/home'; } else { if (hh === '#/home') ui.homeTab = 'rec'; location.hash = hh; } render(); }, h);
      await W(h === '#/routine' || h === '#/home?care' ? 900 : 450);
      const r = await ev(() => { const t = (document.querySelector('#main') || document.body).innerText; const m = t.match(/.{0,14}(undefined|NaN|\[object|Infinity|null(?![a-z])).{0,14}/); return { m: m && m[0], t }; });
      if (r && r.m) note(`${h}：変な文字「${r.m.replace(/\s+/g, ' ')}」`);
      if (r) r.t.split(/\n|。/).forEach((t) => { if (STOP.test(t) && !/使用終了|やめた日|使うのをやめた/.test(t)) note(`${h}：薬をやめる・減らすと読める「${t.slice(0, 60)}」`); });
    }
    out.push([pz.k, bad]); await ctx.close();
  }
  await b.close(); srv.close();
  let n = 0; for (const [k, L] of out) { console.log((L.length ? '✗ ' : '✓ ') + k); L.forEach((m) => console.log('   ・' + m)); n += L.length; }
  console.log(n ? `安全テストで見つかった問題 ${n}件` : '安全テスト：すべての人で問題なし'); process.exit(n ? 1 : 0);
})();
