import openpyxl, json, re, sys
src=sys.argv[1]; out=sys.argv[2]
wb=openpyxl.load_workbook(src,read_only=True); ws=wb['表全体']
rows=list(ws.iter_rows(values_only=True))
ids=rows[11]
col={ (v or '').strip():i for i,v in enumerate(ids) if v}
# 使う成分（成分識別子 → 短い名前）
WANT=[('ENERC_KCAL','kcal'),('PROT-','p'),('FAT-','f'),('CHOCDF-','c'),('FIB-','fib'),('CHOAVLDF-','avl'),('NA','na'),('K','k'),('CA','ca'),('MG','mg'),('FE','fe'),('ZN','zn'),('VITA_RAE','va'),('VITD','vd'),('TOCPHA','ve'),('THIA','b1'),('RIBF','b2'),('NIA','nia'),('VITB6A','b6'),('VITB12','b12'),('FOL','fol'),('VITC','vc'),('NACL_EQ','salt')]
for k,_ in WANT: assert k in col, k
def val(v):
    # 戻り値：数値（推定値の( )も数値）、Tr は 0、(0) は 0、'-'（未測定）は None
    if v is None: return None
    if isinstance(v,(int,float)): return round(float(v),3)
    s=str(v).strip().replace('(','').replace(')','')
    if s in ('','-','*'): return None
    if s=='Tr': return 0
    try: return round(float(s),3)
    except: return None
foods=[]
for r in rows[12:]:
    if not r or not r[1] or not re.match(r'^\d{5}$',str(r[1])): continue
    name=re.sub(r'[　 ]+',' ',str(r[3])).strip()
    d={'id':str(r[1]),'g':int(str(r[0])),'n':name,'r':val(r[4]) or 0}
    for k,s in WANT: d[s]=val(r[col[k]])
    foods.append(d)
json.dump({'src':'日本食品標準成分表（八訂）増補2023年（文部科学省）可食部100g当たり','ver':'2023','foods':foods},open(out,'w'),ensure_ascii=False,separators=(',',':'))
print(len(foods))
