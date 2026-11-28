# 2026-11-28 検索から来る人向けの記事ページ（nakakaramo.com/guide/）を作る。記事を足すときは ARTICLES に足して、
#   python3 _tests/tools/guide/build.py
# を実行する（guide/*.html と sitemap.xml を作り直す）。薬機法に配慮：治る・効く・改善などは使わず、一般的な情報として書く。
import html, json, os, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SITE = 'https://nakakaramo.com'
TODAY = datetime.date.today().isoformat()

ARTICLES = [
 dict(slug='vitamin-c-retinol', title='ビタミンCとレチノールは一緒に使える？朝と夜の使い分け',
  desc='ビタミンCとレチノールを両方使いたいときの、朝と夜の分け方、重ねるときの注意、肌の様子の見方をまとめました。',
  lead='ビタミンCとレチノールは、どちらも人気のある成分です。一緒に使われることもありますが、濃度の高いもの同士を重ねると刺激を感じる人もいます。迷ったら「朝にビタミンC、夜にレチノール」と分けるのが取り入れやすい方法です。',
  sections=[
   ('なぜ朝と夜に分けるの？', ['レチノールは光や空気で分解されやすく、夜のスキンケアで使う商品が多い成分です。', 'ビタミンCは朝のスキンケアで使われることが多く、日焼け止めと一緒に使う人も多くいます。', '時間を分けると、1回のスキンケアで重なる刺激が少なくなり、どちらが肌に合っているかも見分けやすくなります。']),
   ('同じ時間に使いたいときは', ['はじめは片方ずつ、数日あけて肌の様子を見ます。', '重ねるときは、どちらかを低い濃度のものにします。', 'ピリピリ感・赤み・乾燥が続くときは、使う回数を減らすか、一度やめて様子を見ます。']),
   ('日焼け止めを忘れずに', ['レチノールを使っている期間は、肌が紫外線の影響を受けやすいと言われています。朝は日焼け止めを使いましょう。']),
  ], app='ナカカラモでは、使っている化粧品を登録すると、ビタミンCとレチノールのような「時間を分けたほうがよい組み合わせ」を自動で見つけて、朝と夜の順番に並べ直します。'),
 dict(slug='retinol-aha-bha', title='レチノールとピーリング（AHA・BHA）を同じ日に使っていい？',
  desc='レチノールとAHA・BHAなどの角質ケア成分を一緒に使うときの注意と、日を分ける使い方をまとめました。',
  lead='レチノールとAHA・BHA（グリコール酸・サリチル酸など）は、どちらも刺激を感じやすい成分です。同じタイミングで重ねると、乾燥や赤みが出やすくなる場合があります。使う日を分けるのが安心です。',
  sections=[
   ('おすすめの分け方', ['レチノールを使う日と、角質ケアをする日を分けます（例：月・木は角質ケア、ほかの日はレチノール）。', '同じ日に使う場合も、朝と夜で分けます。', 'はじめは週1〜2回から始めて、肌の様子を見ながら回数を決めます。']),
   ('こんなときは一度お休み', ['ヒリヒリする、赤みが引かない、皮むけが続くときは、両方とも一度やめて保湿だけにします。', '皮膚科で薬をもらっている人は、化粧品を足す前に医師・薬剤師に相談しましょう。']),
  ], app='ナカカラモは、レチノールと角質ケア成分が両方入った商品を登録したとき、同じ日に重ならないように「A日・B日」の使い分けを提案します。'),
 dict(slug='niacinamide-vitamin-c', title='ナイアシンアミドとビタミンCは一緒に使える？',
  desc='ナイアシンアミドとビタミンCを同じスキンケアで使うときのポイントをまとめました。',
  lead='ナイアシンアミドとビタミンCは、同じスキンケアで一緒に使う人も多い組み合わせです。最近の化粧品では、両方が1本に入っている商品もあります。',
  sections=[
   ('使うときのポイント', ['新しく使い始めるときは、1つずつ足して、肌の様子を数日見ます。', 'ピリピリ感が出たときは、朝と夜に分けて使います。', '同じ成分が入った商品を何本も重ねると、思ったより多く使っていることがあります。成分表示を見て、重なりを確かめましょう。']),
   ('成分表示の見方', ['成分表示は、基本的に多く入っている順に書かれています（1%以下のものは順不同）。', 'ナイアシンアミドは「ナイアシンアミド」、ビタミンCは「アスコルビン酸」「アスコルビルグルコシド」「3-O-エチルアスコルビン酸」などの名前で書かれています。']),
  ], app='ナカカラモでは、化粧品を登録すると成分表示から同じ成分の重なりを見つけて知らせます。'),
 dict(slug='skincare-order', title='スキンケアの正しい順番｜朝と夜の基本',
  desc='洗顔・化粧水・美容液・乳液・クリーム・日焼け止めの順番と、それぞれの量やコツをまとめました。',
  lead='スキンケアの基本の順番は「洗う → 整える → 補う → 守る」です。水っぽいものから油っぽいものの順に重ねると、なじみやすくなります。',
  sections=[
   ('朝の順番', ['1. 洗顔（ぬるま湯だけでもよい人もいます）', '2. 化粧水', '3. 美容液', '4. 乳液・クリーム', '5. 日焼け止め']),
   ('夜の順番', ['1. クレンジング（メイクや日焼け止めを落とす）', '2. 洗顔', '3. 化粧水', '4. 美容液（レチノールなどは夜に使う商品が多い）', '5. 乳液・クリーム']),
   ('よくある迷い', ['商品の説明書に順番が書いてあるときは、そちらに合わせます。', 'オールインワンは、化粧水〜クリームの代わりに1つで使えます。', '肌が荒れているときは、品数を減らして「洗顔・保湿・日焼け止め」の3つにしぼるのも1つの方法です。']),
  ], app='ナカカラモでは、登録した化粧品を自動で朝・夜の順番に並べ、使い方のコツも一緒に表示します。'),
 dict(slug='ingredient-label', title='化粧品の成分表示の読み方｜敏感肌の人が見るポイント',
  desc='化粧品の全成分表示の並び方と、肌がゆらぎやすい人が確かめておきたいポイントをまとめました。',
  lead='化粧品の箱やボトルには、入っている成分がすべて書かれています（全成分表示）。読み方のルールを知っておくと、自分に合う商品を選ぶ手がかりになります。',
  sections=[
   ('並び方のルール', ['基本的に、多く入っている順に書かれています。', '1%以下の成分は順不同で書かれています。', '香料は「香料」とまとめて書かれることがあります。']),
   ('確かめておきたいこと', ['前にかぶれたことがある成分が入っていないか。', 'アルコール（エタノール）が前のほうに書かれていないか（刺激を感じやすい人の場合）。', '同じ種類の成分（レチノール類、角質ケア成分など）を、何本もの商品で重ねていないか。']),
   ('新しい化粧品を試すときは', ['腕の内側などで試してから、顔に使う方法もあります。', '赤み・かゆみが出たら使うのをやめ、続くときは皮膚科で相談しましょう。']),
  ], app='ナカカラモでは、成分表示をカメラで読み取って登録でき、成分ごとの説明や、ほかの化粧品との重なりを確かめられます。'),
 dict(slug='skin-diary', title='肌の記録のつけ方｜ニキビ・赤み・乾燥を毎日メモするコツ',
  desc='肌の調子を記録して、使った化粧品や睡眠との関係を見つけるためのコツをまとめました。',
  lead='肌の調子は日によって変わります。毎日少しずつ記録しておくと、化粧品を変えたときや寝不足の日に肌がどう変わったかを、あとから見比べられます。',
  sections=[
   ('記録するとよいこと', ['肌の調子（5段階など）', 'ニキビの数と場所、赤み・乾燥の程度', 'その日使った化粧品', '寝た時間、食べたもの、生理の時期など']),
   ('続けるコツ', ['毎日同じ時間（朝の洗顔のあとなど）に記録します。', '完璧に書かなくても大丈夫。調子だけでも残しておくと、あとで役に立ちます。', '写真を同じ場所・同じ明るさで撮ると、見比べやすくなります。']),
   ('記録を見るときの注意', ['肌の変化には、季節や体調などいろいろなことが関わります。1つの原因と決めつけず、傾向として見ましょう。', '症状が続くときや強いときは、記録を持って皮膚科で相談すると、伝えやすくなります。']),
  ], app='ナカカラモは、肌・化粧品・食事・睡眠の記録をまとめて残し、グラフや週ごとのレポートで変化を見られるアプリです。'),
]

CSS = """*{box-sizing:border-box}body{margin:0;background:#F7F4EE;color:#26372B;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.85;-webkit-text-size-adjust:100%}
a{color:#3F6B4E}header,main,footer{max-width:720px;margin:0 auto;padding:0 16px}header{padding-top:18px;font-weight:700;letter-spacing:.08em}header a{text-decoration:none;color:#26372B}
h1{font-size:1.5rem;line-height:1.45;margin:18px 0 10px}h2{font-size:1.15rem;margin:30px 0 8px;padding-left:10px;border-left:4px solid #3F6B4E}
.lead{font-size:1.02rem}.meta{color:#626A65;font-size:.85rem}ul,ol{padding-left:1.3em}li{margin:4px 0}
.app{background:#fff;border:1px solid #E2DCD1;border-radius:16px;padding:18px;margin:34px 0}.app p{margin:0 0 12px}
.btn{display:inline-block;background:#3F6B4E;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px}
.note{color:#626A65;font-size:.85rem;margin-top:28px}.more{margin:30px 0}.more li{margin:6px 0}footer{padding:24px 16px 40px;color:#626A65;font-size:.85rem}
@media (prefers-color-scheme:dark){body{background:#151B17;color:#E8EEE9}header a,h1,h2{color:#E8EEE9}a{color:#8FCB9F}h2{border-color:#8FCB9F}.app{background:#1D2B21;border-color:#2D3D31}.btn{background:#8FCB9F;color:#0E1A12}.meta,.note,footer{color:#A9B3AC}}"""

def page(a):
    e = html.escape
    body = []
    for h, items in a['sections']:
        ordered = all(i[:2].rstrip('.').isdigit() for i in items)
        if ordered:
            body.append(f'<h2>{e(h)}</h2><ol>' + ''.join(f'<li>{e(i.split(". ",1)[1])}</li>' for i in items) + '</ol>')
        elif len(items) == 1:
            body.append(f'<h2>{e(h)}</h2><p>{e(items[0])}</p>')
        else:
            body.append(f'<h2>{e(h)}</h2><ul>' + ''.join(f'<li>{e(i)}</li>' for i in items) + '</ul>')
    others = ''.join(f'<li><a href="/guide/{o["slug"]}.html">{e(o["title"])}</a></li>' for o in ARTICLES if o is not a)
    url = f'{SITE}/guide/{a["slug"]}.html'
    ld = json.dumps({"@context":"https://schema.org","@type":"Article","headline":a['title'],"description":a['desc'],"dateModified":TODAY,"author":{"@type":"Organization","name":"ナカカラモ"},"publisher":{"@type":"Organization","name":"ナカカラモ","logo":{"@type":"ImageObject","url":SITE+"/icon-512.png"}},"mainEntityOfPage":url}, ensure_ascii=False)
    return f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(a["title"])}｜ナカカラモ</title><meta name="description" content="{e(a["desc"])}"><link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:title" content="{e(a["title"])}"><meta property="og:description" content="{e(a["desc"])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/icon-512.png"><meta property="og:site_name" content="ナカカラモ"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#3F6B4E">
<script type="application/ld+json">{ld}</script><style>{CSS}</style></head>
<body><header><a href="/">ナカカラモ</a></header><main><article>
<h1>{e(a["title"])}</h1><p class="meta">更新：{TODAY.replace("-", "年", 1).replace("-", "月", 1)}日</p>
<p class="lead">{e(a["lead"])}</p>
{"".join(body)}
<div class="app"><p>{e(a["app"])}</p><a class="btn" href="/">ナカカラモを無料で使ってみる</a></div>
<p class="note">この記事は一般的な情報です。肌の状態や合う化粧品には個人差があります。診断や治療の代わりにはなりません。肌の症状が続くときや強いとき、薬を使っているときは、皮膚科の医師や薬剤師に相談してください。</p>
</article><nav class="more" aria-label="ほかの記事"><h2>ほかの記事</h2><ul>{others}</ul></nav></main>
<footer><a href="/guide/">記事の一覧</a>　<a href="/#/terms">利用規約</a>　<a href="/#/privacy">プライバシーポリシー</a><br>© ナカカラモ</footer></body></html>
'''

def index_page():
    e = html.escape
    li = ''.join(f'<li><a href="/guide/{a["slug"]}.html">{e(a["title"])}</a><br><span class="meta">{e(a["desc"])}</span></li>' for a in ARTICLES)
    return f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>スキンケアの記事｜ナカカラモ</title><meta name="description" content="成分の組み合わせ、スキンケアの順番、成分表示の読み方、肌の記録のつけ方など、毎日のスキンケアに役立つ記事です。"><link rel="canonical" href="{SITE}/guide/">
<link rel="icon" href="/icon-192.png"><meta name="theme-color" content="#3F6B4E"><style>{CSS}</style></head>
<body><header><a href="/">ナカカラモ</a></header><main><h1>スキンケアの記事</h1><ul class="more">{li}</ul>
<div class="app"><p>ナカカラモは、肌の記録・化粧品・食事・睡眠をまとめて記録して、自分の肌に合うケアを見つけるアプリです。</p><a class="btn" href="/">ナカカラモを無料で使ってみる</a></div></main>
<footer><a href="/#/terms">利用規約</a>　<a href="/#/privacy">プライバシーポリシー</a><br>© ナカカラモ</footer></body></html>
'''

os.makedirs(os.path.join(ROOT, 'guide'), exist_ok=True)
for a in ARTICLES:
    open(os.path.join(ROOT, 'guide', a['slug'] + '.html'), 'w').write(page(a))
open(os.path.join(ROOT, 'guide', 'index.html'), 'w').write(index_page())
urls = [(SITE + '/', 'weekly', '1.0'), (SITE + '/guide/', 'weekly', '0.8')] + [(f'{SITE}/guide/{a["slug"]}.html', 'monthly', '0.7') for a in ARTICLES]
open(os.path.join(ROOT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n' for u, c, p in urls) + '</urlset>\n')
print(len(ARTICLES), 'articles')
