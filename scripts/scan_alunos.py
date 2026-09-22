# -*- coding: utf-8 -*-
"""
Scan dos alunos do WhatsApp → support.alunos_whatsapp (migration 089).

É o "carteiro" entre quem varre o WhatsApp Web (a rotina "WhatsApp Duka Alunos
Scan" do Claude, o chat do Cowork, ou você à mão) e o painel. Não abre o
WhatsApp: recebe um CSV pronto e grava no banco, registrando a execução.

Uso (na pasta do painel):
    python scripts/scan_alunos.py iniciar [--origem agendado|manual|cowork]
        → imprime o id da execução (adota um pedido 'solicitado' se houver)
    python scripts/scan_alunos.py importar <arquivo.csv> --run <id> [--origem cowork]
        → sobe as linhas (telefone é a chave), junta com os cadastros do bot
          (F:/ian/prog/duka_whas_bot/data/cadastros.csv, se existir) e conclui a execução
    python scripts/scan_alunos.py falhou <id> "motivo"
    python scripts/scan_alunos.py pendente
        → imprime o id do pedido em aberto (ou nada)

CSV aceito: as mesmas colunas da planilha manual
    Contato WhatsApp, Nome, Telefone informado, Escola, Ano, Status, Observação
(+ opcional "Última mensagem" em ISO ou dd/mm/aaaa). Cabeçalho sem acento também vale.

Service role: lida de F:/ian/prog/Path_app/.env.local (nunca no painel).
"""
import csv, json, re, sys, argparse, datetime as dt, unicodedata
from pathlib import Path
import requests

ENV = Path(r"F:\ian\prog\Path_app\.env.local")
CADASTROS_BOT = Path(r"F:\ian\prog\duka_whas_bot\data\cadastros.csv")

def carregar_env():
    env = {}
    if not ENV.exists(): sys.exit(f"não achei {ENV}")
    for line in ENV.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    url = env.get("EXPO_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL"); key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: sys.exit("faltou EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
    return url.rstrip("/"), key

URL, KEY = carregar_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": "support", "Content-Profile": "support", "Content-Type": "application/json"}

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c)).lower()).strip()

def so_digitos(s):
    d = re.sub(r"\D", "", s or "")
    if not d: return ""
    if d.startswith("0"): d = d.lstrip("0")
    if len(d) in (10, 11) and not d.startswith("55"): d = "55" + d
    return d

def agora(): return dt.datetime.now(dt.timezone.utc).isoformat()

def rest(method, path, **kw):
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers=dict(H, **kw.pop("headers", {})), timeout=60, **kw)
    if r.status_code >= 300: sys.exit(f"{method} {path} → {r.status_code} {r.text[:300]}")
    return r

def rpc(nome, **args):
    r = requests.post(f"{URL}/rest/v1/rpc/{nome}", headers=H, json=args, timeout=60)
    if r.status_code >= 300: sys.exit(f"rpc {nome} → {r.status_code} {r.text[:300]}")
    return r.json()

# ── comandos ────────────────────────────────────────────────────────────────
def cmd_pendente(_):
    rows = rest("GET", "alunos_scan_runs?status=in.(solicitado,rodando)&order=id.asc&limit=1&select=id,origem,status").json()
    if rows: print(rows[0]["id"])

def cmd_iniciar(a):
    rows = rest("GET", "alunos_scan_runs?status=eq.solicitado&order=id.asc&limit=1&select=id").json()
    if rows: rid = rows[0]["id"]
    else: rid = rpc("solicitar_scan_alunos", p_origem=a.origem)
    rest("PATCH", f"alunos_scan_runs?id=eq.{rid}", json={"status": "rodando", "iniciado_em": agora()}, headers={"Prefer": "return=minimal"})
    print(rid)

def cmd_falhou(a):
    rest("PATCH", f"alunos_scan_runs?id=eq.{a.id}", json={"status": "falhou", "erro": a.motivo[:500], "concluido_em": agora()}, headers={"Prefer": "return=minimal"})
    print("ok")

def ler_csv(caminho):
    with Path(caminho).open(encoding="utf-8-sig", newline="") as fh:
        rd = csv.DictReader(fh)
        cab = {norm(c): c for c in (rd.fieldnames or [])}
        def col(r, *nomes):
            for n in nomes:
                c = cab.get(norm(n))
                if c is not None: return (r.get(c) or "").strip()
            return ""
        for r in rd:
            yield {
                "contato": col(r, "Contato WhatsApp", "WhatsApp", "Contato", "Telefone"),
                "nome": col(r, "Nome"), "telefone_informado": col(r, "Telefone informado", "Telefone"),
                "escola_bruta": col(r, "Escola"), "ano_bruto": col(r, "Ano", "Série"),
                "status": col(r, "Status"), "observacao": col(r, "Observação", "Observacao", "Obs"),
                "ultima_msg": col(r, "Última mensagem", "Ultima mensagem", "Última msg"),
            }

def iso_ou_none(s):
    s = (s or "").strip()
    if not s: return None
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})(?:[ T](\d{2}):(\d{2}))?$", s)
    if m:
        d, mo, y, hh, mm = m.groups()
        return f"{y}-{mo}-{d}T{hh or '00'}:{mm or '00'}:00-03:00"
    return s

def cadastros_do_bot():
    """nome/escola/ano de quem se cadastrou pelo bot, por telefone (é a fonte mais confiável de escola)."""
    out = {}
    if not CADASTROS_BOT.exists(): return out
    with CADASTROS_BOT.open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            for chave in ("WhatsApp", "Telefone"):
                d = so_digitos(r.get(chave, ""))
                if d: out[d] = r
    return out

def cmd_importar(a):
    bot = cadastros_do_bot()
    linhas, vistos = [], set()
    for r in ler_csv(a.arquivo):
        tel = so_digitos(r["contato"]) or so_digitos(r["telefone_informado"])
        if not tel or tel in vistos: continue
        vistos.add(tel)
        b = bot.get(tel)
        linha = {
            "telefone": tel, "contato": r["contato"] or None, "nome": r["nome"] or (b or {}).get("Nome") or None,
            "telefone_informado": r["telefone_informado"] or None,
            "escola_bruta": r["escola_bruta"] or (b or {}).get("Escola") or None,
            "ano_bruto": r["ano_bruto"] or (b or {}).get("Ano") or None,
            "status": r["status"] or ("Respondeu" if (r["nome"] or b) else "Não respondeu"),
            "observacao": r["observacao"] or None,
            "cadastrado_no_bot": bool(b),
            "registrado_no_app": bool(b and re.match(r"^(sim|s|true|1|x)$", (b.get("Registrado no app") or "").strip(), re.I)),
            "ultima_msg": iso_ou_none(r["ultima_msg"]),
            "fonte": a.origem, "run_id": a.run, "atualizado_em": agora(),
        }
        linhas.append(linha)
    # quem só está no bot (cadastrou mas não apareceu no CSV) também entra
    for tel, b in bot.items():
        if tel in vistos: continue
        vistos.add(tel)
        linhas.append({"telefone": tel, "contato": b.get("WhatsApp") or None, "nome": b.get("Nome") or None, "telefone_informado": b.get("Telefone") or None,
                       "escola_bruta": b.get("Escola") or None, "ano_bruto": b.get("Ano") or None, "status": "Respondeu", "observacao": None,
                       "cadastrado_no_bot": True, "registrado_no_app": bool(re.match(r"^(sim|s|true|1|x)$", (b.get("Registrado no app") or "").strip(), re.I)),
                       "ultima_msg": None, "fonte": "bot", "run_id": a.run, "atualizado_em": agora()})
    if not linhas: sys.exit("nenhuma linha com telefone no CSV")
    for i in range(0, len(linhas), 500):
        rest("POST", "alunos_whatsapp?on_conflict=telefone", json=linhas[i:i+500], headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
    por_escola = {}
    for l in linhas:
        if l["nome"]: por_escola[l["escola_bruta"] or "Não informada"] = por_escola.get(l["escola_bruta"] or "Não informada", 0) + 1
    rest("PATCH", f"alunos_scan_runs?id=eq.{a.run}", headers={"Prefer": "return=minimal"},
         json={"status": "concluido", "concluido_em": agora(), "total": len(linhas), "por_escola": por_escola, "erro": None})
    print(f"importadas {len(linhas)} linhas (execução #{a.run}) · escolas: {json.dumps(por_escola, ensure_ascii=False)}")

ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
sub.add_parser("pendente").set_defaults(fn=cmd_pendente)
p = sub.add_parser("iniciar"); p.add_argument("--origem", default="agendado", choices=["agendado", "manual", "cowork", "importacao"]); p.set_defaults(fn=cmd_iniciar)
p = sub.add_parser("importar"); p.add_argument("arquivo"); p.add_argument("--run", type=int, required=True); p.add_argument("--origem", default="cowork"); p.set_defaults(fn=cmd_importar)
p = sub.add_parser("falhou"); p.add_argument("id", type=int); p.add_argument("motivo"); p.set_defaults(fn=cmd_falhou)
args = ap.parse_args(); args.fn(args)
