import json,sys
sys.path.insert(0,'.')
from alias import A
d=json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'fooddb.json'))
foods=d['foods']; byid={f['id']:f for f in foods}; names={f['n']:f['id'] for f in foods}
COOK={'茹でる':['ゆで','水煮'],'焼く':['焼き','目玉焼き','ソテー'],'蒸す':['蒸し','電子レンジ調理'],'揚げる':['から揚げ','とんかつ','素揚げ','天ぷら','フライ'],'炒める':['油いため','いり','ソテー']}
alias=[]; bad=[]
for nm,syn,i in A:
    if i not in byid: bad.append((nm,i)); continue
    raw=byid[i]['n']; v={}
    if raw.endswith(' 生') or raw.endswith(' 冷凍'):
        pre=raw[:-2] if raw.endswith(' 生') else raw
        for ck,toks in COOK.items():
            for t in toks:
                hit=[f['id'] for f in foods if f['n']==pre+' '+t or f['n'].startswith(pre+' '+t+' ')]
                if hit: v[ck]=hit[0]; break
    alias.append([nm,syn.split() if syn else [],i,v])
if bad: print('BAD',bad); sys.exit(1)
KEYS=['kcal','p','f','c','fib','na','k','ca','mg','fe','zn','va','vd','ve','b1','b2','nia','b6','b12','fol','vc','salt']
out={'src':d['src'],'keys':KEYS,'foods':[[f['id'],f['g'],f['n'],f['r']]+[f[k] for k in KEYS] for f in foods],'alias':alias}
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,separators=(',',':'))
print(len(alias),'aliases;', sum(1 for a in alias if a[3]),'with cooked variants')
for a in alias[:200]:
    if a[3]: print(a[0], {k:byid[x]['n'].split(' ',)[-1] for k,x in a[3].items()})
