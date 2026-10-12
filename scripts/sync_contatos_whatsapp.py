# -*- coding: utf-8 -*-
"""
Leva o cruzamento WhatsApp × contas do app pro banco: support.contatos_whatsapp
(user_id → telefone do WhatsApp, escola, ano, como casou). É de onde o painel e o
bot tiram "essa conta é essa pessoa do WhatsApp".

FONTE (12/10/2026): a tabela do scan, support.alunos_whatsapp (uma linha por número,
com o nome do perfil do WhatsApp em `nome`). Só cai no data/alunos_duka.csv se a
tabela estiver vazia. Antes o script só lia o CSV manual — por isso quem entrou no
app sem responder o questionário ficava "não respondeu" e "sem conta" no painel.

CAMADAS, da mais segura pra menos (cada conta registra COMO casou):
  telefone  users.phone igual ao número do WhatsApp (canônico 55+DDD+9+8 dígitos)
  manual    data/escola_overrides.csv
  exata     nome completo igual
  parcial   tokens do nome da conta (2+) em ordem no nome do WhatsApp, ou 1º nome + sobrenome
  usuario   o @usuario tem 2+ pedaços que estão todos no nome
  perfil    conta só com o primeiro nome; tipo de escola + ano fecham 1 candidato

Rode na pasta do painel (ou `npm run contatos`):
    python scripts/sync_contatos_whatsapp.py [--sim]

Usa a service role key do .env.local do app (leitura de users/alunos_whatsapp +
escrita em contatos_whatsapp). Nunca imprime a chave.
"""
import re, sys, datetime as dt
from pathlib import Path
import requests
from duka_contatos import ler_planilha, cruzar, norm, linhas_do_banco, telefone_canonico

SIM = "--sim" in sys.argv
ENV = Path(r"F:\ian\prog\Path_app\.env.local")
env = {}
for line in ENV.read_text(encoding="utf-8").splitlines():
    m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
URL = env.get("EXPO_PUBLIC_SUPABASE_URL"); KEY = env.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY: sys.exit("faltou EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def get(table, select, schema="public", params=None):
    rows, start = [], 0
    while True:
        h = dict(H, Range=f"{start}-{start+999}")
        if schema != "public": h["Accept-Profile"] = schema
        r = requests.get(f"{URL}/rest/v1/{table}", headers=h, params=dict({"select": select}, **(params or {})), timeout=60)
        r.raise_for_status(); chunk = r.json(); rows += chunk
        if len(chunk) < 1000: return rows
        start += 1000

users = get("users", "id,full_name,username,school_type,school_year,phone")
scan = get("alunos_whatsapp", "telefone,contato,nome,telefone_informado,escola_bruta,ano_bruto,status,observacao", schema="support")
if scan:
    alunos = linhas_do_banco(scan); fonte = f"support.alunos_whatsapp ({len(scan)} números)"
else:
    alunos = ler_planilha(); fonte = "data/alunos_duka.csv"

# ── camada 0: telefone do cadastro ──────────────────────────────────────────
por_tel = {}
for a in alunos:
    for t in (telefone_canonico(a["contato"]), telefone_canonico(a["telefone_informado"])):
        if t and t not in por_tel: por_tel[t] = a
por_conta = {}
for u in users:
    t = telefone_canonico(u.get("phone") or "")
    a = por_tel.get(t) if t else None
    if a and not a["user_id"]:
        a["user_id"] = u["id"]; a["como"] = "telefone"
        por_conta[u["id"]] = {"escola": a["escola"], "ano": a["ano"], "como": "telefone", "ws": a}

# ── demais camadas (nome/usuário/perfil/manual) só pra quem sobrou ──────────
restantes = [u for u in users if u["id"] not in por_conta]
for uid, v in cruzar(restantes, alunos).items():
    por_conta[uid] = v

linhas, agora = [], dt.datetime.now(dt.timezone.utc).isoformat()
for uid, v in por_conta.items():
    ws = v["ws"]
    fone = (ws or {}).get("contato") or ""
    if not fone: continue        # override manual sem linha no WhatsApp: sem telefone
    linhas.append({"user_id": uid, "nome_planilha": ws["nome"], "telefone": fone, "escola": v["escola"] or None, "ano": v["ano"] or None,
                   "como": v["como"], "atualizado_em": agora})

por_como = {}
for l in linhas: por_como[l["como"]] = por_como.get(l["como"], 0) + 1
print(f"fonte: {fonte}")
print(f"contas casadas: {len(linhas)} de {len(users)} · " + " · ".join(f"{k} {v}" for k, v in sorted(por_como.items(), key=lambda x: -x[1])))
nao_resp = [a for a in alunos if a["user_id"] and not a["status"].startswith("Respondeu")]
print(f"'não respondeu' que JÁ estão no app: {len(nao_resp)}")
if SIM:
    for a in nao_resp[:30]: print(f"  {a['nome']:<32} {a['como']:<9} {a['status']}")
    sys.exit("(simulação, nada gravado)")

h = dict(H, **{"Content-Profile": "support", "Prefer": "resolution=merge-duplicates,return=minimal", "Content-Type": "application/json"})
# Limpa as pontes antigas que não casaram mais (a tabela é derivada; recriar é o certo).
r = requests.delete(f"{URL}/rest/v1/contatos_whatsapp?user_id=not.in.({','.join(l['user_id'] for l in linhas) or '00000000-0000-0000-0000-000000000000'})", headers=dict(h, Prefer="return=minimal"), timeout=60)
if r.status_code not in (200, 204): sys.exit(f"limpeza falhou: {r.status_code} {r.text[:300]}")
r = requests.post(f"{URL}/rest/v1/contatos_whatsapp?on_conflict=user_id", headers=h, json=linhas, timeout=60)
if r.status_code not in (200, 201, 204): sys.exit(f"upsert falhou: {r.status_code} {r.text[:300]}")

com_fone_cadastro = sum(1 for u in users if (u.get("phone") or "").strip())
print(f"gravado em support.contatos_whatsapp · {com_fone_cadastro} de {len(users)} contas têm telefone no cadastro")
