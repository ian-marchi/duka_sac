# -*- coding: utf-8 -*-
"""
Leva o cruzamento planilha × contas pro banco: support.contatos_whatsapp
(user_id → telefone do WhatsApp, escola, ano). É de onde o bot de WhatsApp tira
o número de quem não preencheu telefone no cadastro.

Rode na pasta do painel sempre que trocar data/alunos_duka.csv:
    python scripts/sync_contatos_whatsapp.py

Usa a service role key do .env.local do app (só leitura de users + escrita na
tabela de contatos).
"""
import re, sys, datetime as dt
from pathlib import Path
import requests
from duka_contatos import ler_planilha, cruzar, norm

ENV = Path(r"F:\ian\prog\Path_app\.env.local")
env = {}
for line in ENV.read_text(encoding="utf-8").splitlines():
    m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
URL = env.get("EXPO_PUBLIC_SUPABASE_URL"); KEY = env.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY: sys.exit("faltou EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def get(table, select, schema="public"):
    rows, start = [], 0
    while True:
        h = dict(H, Range=f"{start}-{start+999}")
        if schema != "public": h["Accept-Profile"] = schema
        r = requests.get(f"{URL}/rest/v1/{table}", headers=h, params={"select": select}, timeout=60)
        r.raise_for_status(); chunk = r.json(); rows += chunk
        if len(chunk) < 1000: return rows
        start += 1000

users = get("users", "id,full_name,username,school_type,school_year,phone")
alunos = ler_planilha()
por_conta = cruzar(users, alunos)

linhas = []
for uid, v in por_conta.items():
    ws = v["ws"]
    fone = (ws or {}).get("contato") or ""
    if not fone: continue        # override manual sem linha na planilha: sem telefone
    linhas.append({"user_id": uid, "nome_planilha": ws["nome"], "telefone": fone, "escola": v["escola"], "ano": v["ano"],
                   "como": v["como"], "atualizado_em": dt.datetime.now(dt.timezone.utc).isoformat()})

h = dict(H, **{"Content-Profile": "support", "Prefer": "resolution=merge-duplicates,return=minimal", "Content-Type": "application/json"})
r = requests.post(f"{URL}/rest/v1/contatos_whatsapp?on_conflict=user_id", headers=h, json=linhas, timeout=60)
if r.status_code not in (200, 201, 204): sys.exit(f"upsert falhou: {r.status_code} {r.text[:300]}")

com_fone_cadastro = sum(1 for u in users if (u.get("phone") or "").strip())
so_planilha = sum(1 for l in linhas if not (next((u for u in users if u["id"] == l["user_id"]), {}).get("phone") or "").strip())
print(f"contatos sincronizados: {len(linhas)} contas com número da planilha "
      f"({so_planilha} delas sem telefone no cadastro) · {com_fone_cadastro} de {len(users)} contas têm telefone no cadastro")
