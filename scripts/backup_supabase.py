# -*- coding: utf-8 -*-
"""
Backup diário do banco do Duka (Supabase kpmsvfbjgrhynxdewppw).

Exporta TODAS as tabelas dos schemas public e support (usuários, questões, quarentena,
simulados, redações, flashcards, chat, tickets, WhatsApp…) via PostgREST com a service
role, em JSONL comprimido, uma pasta por dia:

    C:\\Users\\ianma\\backups\\duka\\2026-09-30\\public.questions.jsonl.gz
                                     \\support.tickets.jsonl.gz
                                     \\manifesto.json   (tabelas, linhas, tamanho, duração)

Retenção: os últimos 30 dias + o primeiro backup de cada mês (para sempre).
Cópia opcional numa segunda pasta (BACKUP_COPIA, ex.: um HD ou pasta sincronizada).

Se SUPABASE_DB_URL estiver no .env.local (o Ian coloca; nunca este script), também roda
`supabase db dump` completo (schema + dados, inclui o schema auth): é o único jeito de
restaurar 100% (senhas, funções, triggers). Sem ele, o backup cobre os DADOS das tabelas.

Uso (na pasta do painel):
    python scripts/backup_supabase.py                 → backup de hoje
    python scripts/backup_supabase.py listar          → backups existentes
    python scripts/backup_supabase.py restaurar 2026-09-30 public.questions [--sim]
        → upsert das linhas daquele backup na tabela (por chave primária); --sim só conta

Service role: lida de F:\\ian\\prog\\Path_app\\.env.local (nunca no painel, nunca no git).
Backups ficam FORA do repositório (a pasta é no C:, e data/ está no .gitignore).
"""
import gzip, io, json, os, re, shutil, subprocess, sys, time, datetime as dt
from pathlib import Path
import requests

ENV = Path(r"F:\ian\prog\Path_app\.env.local")
SUPABASE_EXE = Path(r"F:\ian\prog\Path_app\supabase_2.101.0_windows_amd64\supabase.exe")
DESTINO = Path(os.environ.get("BACKUP_DIR") or r"C:\Users\ianma\backups\duka")
COPIA = os.environ.get("BACKUP_COPIA")  # segunda pasta, opcional
SCHEMAS = ("public", "support")
PAGINA = 1000
DIAS_GUARDADOS = 30


def carregar_env():
    env = {}
    if not ENV.exists():
        sys.exit(f"não achei {ENV}")
    for line in ENV.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    url = env.get("EXPO_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("faltou EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
    return url.rstrip("/"), key, env.get("SUPABASE_DB_URL", "")


URL, KEY, DB_URL = carregar_env()


def headers(schema, extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": schema, "Content-Profile": schema,
         "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def log(msg):
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


# ── quais tabelas existem (pelo OpenAPI do PostgREST, que lista as tabelas do schema) ──
def tabelas(schema):
    r = requests.get(f"{URL}/rest/v1/", headers=headers(schema), timeout=60)
    r.raise_for_status()
    defs = r.json().get("definitions", {})
    # views também aparecem; o manifesto marca e o restore ignora o que não tiver PK
    return sorted(defs.keys())


def chave_primaria(schema, tabela, defs_cache={}):
    """PK pela descrição do OpenAPI ('Note: This is a Primary Key.<pk/>')."""
    if schema not in defs_cache:
        r = requests.get(f"{URL}/rest/v1/", headers=headers(schema), timeout=60)
        r.raise_for_status()
        defs_cache[schema] = r.json().get("definitions", {})
    props = defs_cache[schema].get(tabela, {}).get("properties", {})
    return [c for c, p in props.items() if "<pk/>" in (p.get("description") or "")]


# ── exportar ──
def exportar_tabela(schema, tabela, destino):
    arq = destino / f"{schema}.{tabela}.jsonl.gz"
    pk = chave_primaria(schema, tabela)
    ordem = ",".join(pk) if pk else None
    linhas = 0
    offset = 0
    with gzip.open(arq, "wt", encoding="utf-8") as f:
        while True:
            params = {"select": "*", "limit": PAGINA, "offset": offset}
            if ordem:
                params["order"] = ordem
            r = requests.get(f"{URL}/rest/v1/{tabela}", headers=headers(schema), params=params, timeout=120)
            if r.status_code >= 300:
                raise RuntimeError(f"{schema}.{tabela} → {r.status_code} {r.text[:200]}")
            lote = r.json()
            for row in lote:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            linhas += len(lote)
            if len(lote) < PAGINA:
                break
            offset += PAGINA
    return {"tabela": f"{schema}.{tabela}", "linhas": linhas, "pk": pk, "arquivo": arq.name, "bytes": arq.stat().st_size}


def dump_completo(destino):
    """pg_dump via CLI do Supabase, só se o Ian colocou SUPABASE_DB_URL no .env.local."""
    if not DB_URL:
        return {"dump_sql": None, "motivo": "SUPABASE_DB_URL não definido no .env.local (backup só dos dados das tabelas)"}
    if not SUPABASE_EXE.exists():
        return {"dump_sql": None, "motivo": f"CLI não encontrada em {SUPABASE_EXE}"}
    out = {}
    for nome, args in (("schema.sql", []), ("data.sql", ["--data-only"])):
        alvo = destino / nome
        cmd = [str(SUPABASE_EXE), "db", "dump", "--db-url", DB_URL, "-f", str(alvo), "-s", "public,support,auth,storage"] + args
        t = time.time()
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if p.returncode != 0:
            out[nome] = {"ok": False, "erro": (p.stderr or p.stdout)[-400:]}
            continue
        with open(alvo, "rb") as src, gzip.open(str(alvo) + ".gz", "wb") as dst:
            shutil.copyfileobj(src, dst)
        alvo.unlink()
        out[nome] = {"ok": True, "bytes": (destino / (nome + ".gz")).stat().st_size, "segundos": round(time.time() - t)}
    return {"dump_sql": out}


def limpar_antigos(base):
    """Guarda 30 dias + o primeiro backup de cada mês."""
    pastas = sorted(p for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.name))
    hoje = dt.date.today()
    primeiro_do_mes = {}
    for p in pastas:
        primeiro_do_mes.setdefault(p.name[:7], p.name)
    apagadas = []
    for p in pastas:
        idade = (hoje - dt.date.fromisoformat(p.name)).days
        if idade > DIAS_GUARDADOS and primeiro_do_mes[p.name[:7]] != p.name:
            shutil.rmtree(p, ignore_errors=True)
            apagadas.append(p.name)
    return apagadas


def backup():
    inicio = time.time()
    hoje = dt.date.today().isoformat()
    destino = DESTINO / hoje
    destino.mkdir(parents=True, exist_ok=True)
    itens = []
    for schema in SCHEMAS:
        for tabela in tabelas(schema):
            try:
                item = exportar_tabela(schema, tabela, destino)
                log(f"{item['tabela']}: {item['linhas']} linhas, {item['bytes'] // 1024} KB")
            except Exception as e:  # noqa: BLE001
                item = {"tabela": f"{schema}.{tabela}", "erro": str(e)[:300]}
                log(f"ERRO {item['tabela']}: {item['erro']}")
            itens.append(item)
    extra = dump_completo(destino)
    manifesto = {
        "projeto": "kpmsvfbjgrhynxdewppw", "data": hoje, "gerado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "tabelas": itens, "total_linhas": sum(i.get("linhas", 0) for i in itens),
        "erros": [i for i in itens if "erro" in i], "segundos": round(time.time() - inicio), **extra,
    }
    (destino / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    apagadas = limpar_antigos(DESTINO)
    if COPIA:
        try:
            alvo = Path(COPIA) / hoje
            if alvo.exists():
                shutil.rmtree(alvo)
            shutil.copytree(destino, alvo)
            limpar_antigos(Path(COPIA))
            log(f"cópia em {alvo}")
        except Exception as e:  # noqa: BLE001
            log(f"cópia falhou: {e}")
    tam = sum(f.stat().st_size for f in destino.iterdir()) // 1024
    log(f"backup {hoje}: {len(itens)} tabelas, {manifesto['total_linhas']} linhas, {tam} KB, "
        f"{manifesto['segundos']} s, {len(manifesto['erros'])} erro(s)"
        + (f"; apagados antigos: {', '.join(apagadas)}" if apagadas else ""))
    if not DB_URL:
        log("aviso: sem SUPABASE_DB_URL o backup cobre os dados das tabelas, não senhas/funções (ver docstring)")
    return 1 if manifesto["erros"] else 0


def listar():
    if not DESTINO.exists():
        print("nenhum backup ainda")
        return
    for p in sorted(DESTINO.iterdir()):
        m = p / "manifesto.json"
        if m.exists():
            j = json.loads(m.read_text(encoding="utf-8"))
            tam = sum(f.stat().st_size for f in p.iterdir()) // 1024
            print(f"{p.name}  {len(j['tabelas'])} tabelas  {j['total_linhas']} linhas  {tam} KB  "
                  f"{len(j['erros'])} erro(s)  dump_sql={'sim' if j.get('dump_sql') else 'não'}")


def restaurar(data, tabela_completa, simular):
    schema, tabela = tabela_completa.split(".", 1)
    arq = DESTINO / data / f"{schema}.{tabela}.jsonl.gz"
    if not arq.exists():
        sys.exit(f"não achei {arq}")
    pk = chave_primaria(schema, tabela)
    if not pk:
        sys.exit(f"{tabela_completa} não tem chave primária: restaure à mão")
    linhas = [json.loads(l) for l in gzip.open(arq, "rt", encoding="utf-8") if l.strip()]
    log(f"{tabela_completa}: {len(linhas)} linhas no backup de {data} (chave {','.join(pk)})")
    if simular:
        log("--sim: nada gravado")
        return
    # upsert por PK; o banco decide conflitos (triggers de proteção continuam valendo)
    for i in range(0, len(linhas), 500):
        lote = linhas[i:i + 500]
        r = requests.post(f"{URL}/rest/v1/{tabela}", headers=headers(schema, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
                          params={"on_conflict": ",".join(pk)}, data=json.dumps(lote, ensure_ascii=False).encode("utf-8"), timeout=300)
        if r.status_code >= 300:
            sys.exit(f"lote {i}: {r.status_code} {r.text[:300]}")
        log(f"{min(i + 500, len(linhas))}/{len(linhas)}")
    log("restaurado")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "backup":
        sys.exit(backup())
    if a[0] == "listar":
        listar()
    elif a[0] == "restaurar" and len(a) >= 3:
        restaurar(a[1], a[2], "--sim" in a)
    else:
        print(__doc__)
