// ナカカラモ：テストで使う人物像（安全テスト・ていねいな点検で共通）
const RX = '皮膚科の塗り薬', OR = '飲み薬・サプリ';
const P = (id, name, cat, ings, x) => Object.assign({ id, name, brand: cat === RX || cat === OR ? '処方薬' : 'テスト', category: cat, ingredients: ings, status: '使用中', timing: '朝・夜', frequency: '毎日', purposes: [], purchases: [], demo: false, ago: 20 }, x || {});
const base = (o) => Object.assign({ gender: '女性', ageBand: '20代', tight: 'some', oilDay: 'tzone', acne: 'some', red: 'rare', sens: 'no', preg: 'no', concerns: ['acne'] }, o);
const PERSONAS = [
  { k: '01_妊娠中_ニキビの処方薬とレチノール', a: base({ preg: 'preg', concerns: ['acne', 'spot'] }), log: { acneCount: 3, acneTypes: ['赤ニキビ'] },
    prods: [P('p1', 'エピデュオゲル', RX, 'アダパレン・過酸化ベンゾイル', { timing: '夜' }), P('p2', 'ベピオゲル2.5%', RX, '過酸化ベンゾイル', { timing: '夜' }), P('p3', 'ダラシンTゲル1%', RX, 'クリンダマイシン', { timing: '朝・夜' }), P('p4', 'レチノール 美容液', '美容液・アンプル', '水、レチノール'), P('p5', 'アルダクトンA（スピロノラクトン）', OR, 'スピロノラクトン')],
    brands: ['エピデュオ', 'ベピオ', 'ダラシン', 'アルダクトン'], banned: ['p1'], pregOral: 'スピロノラクトン' },
  { k: '02_授乳中_シミ_院内のトレチノインと飲み薬', a: base({ preg: 'nursing', concerns: ['spot', 'dull'] }), log: { acneCount: 0 },
    prods: [P('n1', 'ハイドロキノンクリーム（院内製剤）', RX, 'ハイドロキノン', { timing: '夜' }), P('n2', 'トランサミン（トラネキサム酸）', OR, 'トラネキサム酸'), P('n3', 'バクチオール 美容液', '美容液・アンプル', '水、バクチオール'), P('n4', 'UVミルク', '日焼け止め', '酸化亜鉛', { timing: '朝' })],
    brands: ['トランサミン'], sunWhy: /トラネキサム酸/ },
  { k: '03_17歳以下_ニキビ_処方と市販薬', a: base({ ageBand: '17歳以下', gender: '回答しない', preg: undefined, acne: 'often', concerns: ['acne'] }), log: { acneCount: 5, acneTypes: ['白ニキビ', '赤ニキビ'] },
    prods: [P('m1', 'ディフェリンゲル0.1%', RX, 'アダパレン', { timing: '夜' }), P('m2', '薬用 洗顔フォーム', '洗顔', '水、サリチル酸、ラウリン酸'), P('m3', 'ビタミンB2・B6の市販薬', OR, 'リボフラビン・ピリドキシン', { brand: '市販薬' })], brands: ['ディフェリン'], minor: true },
  { k: '04_イソトレチノイン_危ない組み合わせ', a: base({ concerns: ['acne', 'pore'] }), log: { acneCount: 4, dryness: 4 },
    prods: [P('i1', 'イソトレチノイン（内服）', OR, 'イソトレチノイン'), P('i2', 'ミノマイシン（ミノサイクリン）', OR, 'ミノサイクリン'), P('i3', 'ビタミンAのサプリメント', OR, 'ビタミンAサプリ', { brand: 'サプリ' }), P('i4', 'レチノール 美容液', '美容液・アンプル', '水、レチノール', { timing: '夜' }), P('i5', 'グリコール酸 拭き取り化粧水', '化粧水・トナー', '水、グリコール酸、サリチル酸')],
    brands: ['ミノマイシン'], noUse: ['i4', 'i5'], combo: [/イソトレチノイン[\s\S]*テトラサイクリン|テトラサイクリン[\s\S]*イソトレチノイン/, /ビタミンA/], noGood: /レチノール|AHA|BHA|ピーリング/ },
  { k: '05_ドキシサイクリン_日焼け止めなし_UV強い日', a: base({ concerns: ['acne'] }), log: { acneCount: 2 },
    prods: [P('d1', 'ビブラマイシン（ドキシサイクリン）', OR, 'ドキシサイクリン'), P('d2', 'しっとり化粧水', '化粧水・トナー', '水、グリセリン')], brands: ['ビブラマイシン'], sunWhy: /ドキシサイクリン.*日焼けしやすく/ },
  { k: '06_アトピー_飲み薬と塗り薬', a: base({ sens: 'yes', red: 'often', tight: 'yes', concerns: ['sensitive', 'dry', 'redness'] }), log: { acneCount: 0, redness: 4, dryness: 4 },
    prods: [P('t1', 'オルミエント（バリシチニブ）', OR, 'バリシチニブ'), P('t2', 'アレグラ（フェキソフェナジン）', OR, 'フェキソフェナジン'), P('t3', 'プロトピック軟膏0.1%', RX, 'タクロリムス', { timing: '夜' }), P('t4', 'ロコイド軟膏0.1%', RX, 'ヒドロコルチゾン酪酸エステル', { timing: '朝・夜' }), P('t5', 'ピーリングジェル', 'その他', 'グリコール酸、水', { frequency: '週1回' })],
    brands: ['オルミエント', 'アレグラ', 'プロトピック', 'ロコイド'], sens: true, noUse: ['t5'] },
  { k: '07_赤み_酒さの塗り薬_敏感', a: base({ sens: 'yes', red: 'often', concerns: ['redness', 'sensitive'] }), log: { acneCount: 0, redness: 4 },
    prods: [P('r1', 'ロゼックスゲル0.75%', RX, 'メトロニダゾール', { timing: '朝・夜' }), P('r2', 'ビタミンC 美容液', '美容液・アンプル', '水、アスコルビン酸、エタノール')], brands: ['ロゼックス'], sens: true },
  { k: '08_60代以上_トレチノインとハイドロキノン', a: base({ ageBand: '60代以上', tight: 'yes', acne: 'rare', concerns: ['aging', 'spot', 'dry'] }), log: { acneCount: 0, dryness: 4 },
    prods: [P('o1', 'トレチノインクリーム（院内製剤）', RX, 'トレチノイン', { timing: '夜' }), P('o2', 'ハイドロキノンクリーム（院内製剤）', RX, 'ハイドロキノン', { timing: '夜' }), P('o3', 'レチノール アイクリーム', 'クリーム', 'レチノール、スクワラン', { timing: '夜' })], noUse: ['o3'] },
  { k: '09_男性_処方なし_サプリだけ', a: base({ gender: '男性', preg: undefined, concerns: ['dull', 'pore'] }), log: { acneCount: 0 },
    prods: [P('s1', 'ビタミンCのサプリメント', OR, 'ビタミンC', { brand: 'サプリ', timing: '朝' }), P('s2', 'コラーゲンのサプリメント', OR, 'コラーゲン', { brand: 'サプリ' }), P('s3', '飲む日焼け止め', OR, '飲む日焼け止め（植物エキス）', { brand: 'サプリ' })], sunWhy: /飲む日焼け止めだけでは/ },
  { k: '10_抗菌薬を長く_ニキビの記録なし', a: base({ acne: 'rare', concerns: ['pore'] }), log: { acneCount: 0 },
    prods: [P('l1', 'ダラシンTゲル1%', RX, 'クリンダマイシン', { timing: '朝・夜', ago: 150 }), P('l2', 'ディフェリンゲル0.1%', RX, 'アダパレン', { timing: '夜', ago: 300 }), P('l3', 'ミノマイシン（ミノサイクリン）', OR, 'ミノサイクリン', { ago: 120 })], brands: ['ダラシン', 'ディフェリン', 'ミノマイシン'], abxNote: true },
  { k: '11_合わなかった物が多い_処方あり', a: base({ sens: 'some', concerns: ['acne', 'sensitive'] }), log: { acneCount: 2, redness: 3 },
    prods: [P('g1', 'ベピオゲル2.5%', RX, '過酸化ベンゾイル', { timing: '夜' }), P('g2', '合わなかった化粧水', '化粧水・トナー', '水、エタノール、香料', { ng: { date: '2026-11-01', sym: ['赤み'] } }), P('g3', '合わなかったクリーム', 'クリーム', '水、香料、ミネラルオイル', { ng: { date: '2026-11-02', sym: ['かゆみ'] } }), P('g4', 'ふつうの化粧水', '化粧水・トナー', '水、グリセリン')],
    brands: ['ベピオ'], noUse: ['g2', 'g3'] },
  { k: '12_妊娠中_何も登録していない', a: base({ preg: 'preg', concerns: ['spot', 'aging'] }), log: { acneCount: 0 }, prods: [] },
  { k: '13_妊娠中_イソトレチノインを飲んでいる', a: base({ preg: 'preg', concerns: ['acne'] }), log: { acneCount: 3 },
    prods: [P('q1', 'イソトレチノイン（内服）', OR, 'イソトレチノイン'), P('q2', 'ハイドロキノン 美白クリーム', 'クリーム', 'ハイドロキノン、グリセリン', { timing: '夜' })], pregOral: 'イソトレチノイン', noUse: ['q2'] },
  { k: '14_化粧品がたくさん_脂性ニキビ', a: base({ oilDay: 'much', acne: 'often', concerns: ['acne', 'pore', 'oily'] }), log: { acneCount: 4, oil: 4, acneTypes: ['白ニキビ', '赤ニキビ'] },
    prods: [P('c1', 'クレンジングオイル', 'クレンジング', 'ミネラルオイル、PEG-20'), P('c2', 'サリチル酸 洗顔フォーム', '洗顔', '水、サリチル酸、ラウリン酸'), P('c3', 'さっぱり化粧水', '化粧水・トナー', '水、BG、グリチルリチン酸2K'), P('c4', 'ナイアシンアミド 美容液', '美容液・アンプル', '水、ナイアシンアミド'),
      P('c5', 'アゼライン酸 美容液', '美容液・アンプル', '水、アゼライン酸'), P('c6', 'レチノール 美容液', '美容液・アンプル', '水、レチノール', { timing: '夜' }), P('c7', 'ビタミンC 美容液', '美容液・アンプル', '水、アスコルビン酸'), P('c8', 'ジェル乳液', '乳液', '水、グリセリン'),
      P('c9', '日焼け止め SPF50+ PA++++', '日焼け止め', '酸化亜鉛', { timing: '朝' }), P('c10', 'トーンアップUV SPF30 PA+++', '日焼け止め', '酸化チタン', { timing: '朝' }), P('c11', 'スポット ジェル', 'スポットケア', 'サリチル酸、水')] },
  { k: '15_化粧品だけ_乾燥敏感', a: base({ tight: 'yes', sens: 'yes', red: 'often', acne: 'rare', concerns: ['dry', 'sensitive', 'redness'] }), log: { acneCount: 0, dryness: 5, redness: 4 },
    prods: [P('e1', 'ミルククレンジング', 'クレンジング', '水、ミネラルオイル'), P('e2', 'アミノ酸 洗顔', '洗顔', 'ココイルグルタミン酸Na'), P('e3', '高保湿 化粧水', '化粧水・トナー', '水、グリセリン、セラミドNP'), P('e4', 'グリコール酸 ピーリング美容液', '美容液・アンプル', '水、グリコール酸'), P('e5', 'セラミド クリーム', 'クリーム', 'セラミドNP、スクワラン'), P('e6', '香料入り クリーム', 'クリーム', '水、香料、エタノール')] },
];
// 2026-11-21 はじめの質問は「年代」ではなく「生年月日」。テストの人物の年代に合う生年月日を入れる
const BD_OF = (band) => ({ '17歳以下': '2011-06-15', '18〜19歳': '2007-06-15', '20代': '2001-06-15', '30代': '1991-06-15', '40代': '1981-06-15', '50代': '1971-06-15', '60代以上': '1955-06-15' })[band] || '';
const setBD = (p, band) => p.evaluate((d) => { const w = document.getElementById('bd-wheel'); if (!w) return false; try { whInit(); } catch (e) {} const [y, m, dd] = d.split('-').map(Number), col = (k) => w.querySelector('.wh-' + k), idx = (k, v) => [...col(k).querySelectorAll('.wh-it')].findIndex((x) => Number(x.dataset.v) === v); whTo(col('y'), idx('y', y)); whTo(col('m'), idx('m', m)); whTo(col('d'), idx('d', dd)); w.dataset.touched = '1'; return true; }, BD_OF(band)).catch(() => false); // 2026-11-21 生年月日は回して選ぶ形
module.exports = { PERSONAS, P, RX, OR, base, BD_OF, setBD };
