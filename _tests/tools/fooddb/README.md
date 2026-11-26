# fooddb.json の作り方（食事写真の解析で使う食品成分表）

元のデータ：文部科学省「日本食品標準成分表（八訂）増補2023年」本表のExcel（20230428-mxt_kagsei-mext_00001_012.xlsx）

1. `python3 build_fooddb.py 本表.xlsx fooddb_full.json` … 本表から、使う成分（可食部100g当たり）を取り出す
   - 値の記号：Tr（微量）→ 0、(0)・( )付きの推定値 → その数字、-（未測定）→ null
2. `python3 build2.py ../../../fooddb.json fooddb_full.json` … alias.py（AIに使わせる食材の名前 → 食品番号）と、調理後の値（ゆで・焼き・油いため など）を足して、アプリが読む形にする

※ 2つ目の引数が手順1の出力です。
