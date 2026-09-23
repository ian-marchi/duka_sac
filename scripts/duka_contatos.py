# -*- coding: utf-8 -*-
"""
Planilha dos alunos abordados no WhatsApp (data/alunos_duka.csv) e o cruzamento
por nome com as contas do app. Usado pelo export do Power BI e pelo sync de
contatos do WhatsApp (support.contatos_whatsapp).

Camadas do cruzamento, da mais segura pra menos, cada conta registra COMO casou:
  exata     nome completo igual
  parcial   tokens do nome da conta (2+) aparecem em ordem no nome da planilha,
            ou primeiro nome + sobrenome presentes
  usuario   o @usuario tem 2+ pedaços que estão todos no nome da planilha
  perfil    conta SÓ com o primeiro nome; tipo de escola + ano fecham 1 candidato
  manual    data/escola_overrides.csv (username ou user_id → escola, ano)
Fora da camada 'exata', tipo de escola e ano do cadastro não podem contradizer
a planilha.
"""
import csv, re, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV_PADRAO = RAIZ / "data" / "alunos_duka.csv"
OVERRIDES_PADRAO = RAIZ / "data" / "escola_overrides.csv"

ANO = {"em1": "1º ano", "em2": "2º ano", "em3": "3º ano", "cursinho": "Cursinho", "formado": "Formado", "fundamental": "Fundamental"}
TIPO_ESCOLA = {"publica": "Pública", "particular": "Particular"}
TIPO_DA_ESCOLA = {"E.E. Prof. Plínio Ribeiro": "publica", "E.E. Prof. Alcides de Carvalho": "publica", "Colégio Atenas": "particular"}
PARTICULAS = {"de", "da", "do", "dos", "das", "e"}

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c)).lower()).strip()

def tokens(s):
    return [t for t in norm(s).split(" ") if t and t not in PARTICULAS]

def subseq(a, c):
    i = 0
    for t in c:
        if i < len(a) and a[i] == t: i += 1
    return i == len(a)

def ler_planilha(caminho=CSV_PADRAO):
    """Uma entrada por linha do CSV, com escola/ano normalizados e o telefone do contato."""
    alunos = []
    with Path(caminho).open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            nome = (r.get("Nome") or "").strip()
            esc = norm(r.get("Escola") or "")
            escola = ("E.E. Prof. Plínio Ribeiro" if ("plinio" in esc or "normal" in esc) else "E.E. Prof. Alcides de Carvalho" if ("alcides" in esc or "polivalente" in esc) else "Colégio Atenas" if "atenas" in esc else ("Outra" if esc else "")) if nome else ""
            ano_b = norm(r.get("Ano") or ""); obs = r.get("Observação") or ""
            if "professor" in ano_b or "professor" in norm(obs): ano = "Professor(a)"
            elif re.search(r"\b1\b|primeiro|1º|1°|1-", ano_b): ano = "1º ano"
            elif re.search(r"\b2\b|segundo|2º|2°|2•", ano_b): ano = "2º ano"
            elif re.search(r"\b3\b|terceiro|3º|3°|3•", ano_b): ano = "3º ano"
            else: ano = "Não informado" if nome else ""
            st = norm(r.get("Status") or "")
            status = "Respondeu" if st.startswith("respondeu") else "Sem dados" if "sem dados" in st else "Não respondeu"
            alunos.append({
                "nome": nome, "escola": escola, "escola_original": r.get("Escola") or "", "ano": ano, "ano_original": r.get("Ano") or "",
                "status": status, "observacao": obs,
                "contato": (r.get("Contato WhatsApp") or "").strip(),          # número do WhatsApp (o que vale pro envio)
                "telefone_informado": (r.get("Telefone informado") or "").strip(),
                "user_id": None, "como": None, "_t": tokens(nome),
            })
    return alunos

def ler_overrides(caminho=OVERRIDES_PADRAO):
    manual = {}
    p = Path(caminho)
    if not p.exists(): return manual
    with p.open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            chave = (r.get("user_id") or "").strip() or norm(r.get("username") or "")
            if chave: manual[chave] = {"escola": (r.get("escola") or "").strip(), "ano": (r.get("ano") or "").strip()}
    return manual

def compativel(u, a):
    tipo = (u.get("school_type") or "").lower()
    t_ws = TIPO_DA_ESCOLA.get(a["escola"])
    if tipo and t_ws and tipo != t_ws: return False
    ano = ANO.get((u.get("school_year") or "").lower())
    if ano and a["ano"] not in ("", "Não informado") and a["ano"] != ano: return False
    return True

def casar(u, nomeados):
    """(linha da planilha, como) ou (None, None). `u` = dict com full_name, username, school_type, school_year."""
    A = tokens(u.get("full_name") or "")
    if not A: return None, None
    ex = [a for a in nomeados if a["_t"] == A]
    if len(ex) == 1: return ex[0], "exata"
    cand = [a for a in nomeados if compativel(u, a)]
    if len(A) >= 2:
        pa = [a for a in cand if subseq(A, a["_t"]) or (len(a["_t"]) >= 2 and subseq(a["_t"], A))]
        if len(pa) == 1: return pa[0], "parcial"
        ps = [a for a in cand if a["_t"] and a["_t"][0] == A[0] and A[-1] in a["_t"][1:]]
        if len(ps) == 1: return ps[0], "parcial"
    U = [t for t in re.split(r"[._\-\d]+", norm(u.get("username") or "")) if len(t) >= 3]
    if len(U) >= 2:
        us = [a for a in cand if all(t in a["_t"] for t in U)]
        if len(us) == 1: return us[0], "usuario"
    tipo = (u.get("school_type") or "").lower(); ano = ANO.get((u.get("school_year") or "").lower())
    if len(A) == 1 and tipo and ano:
        pf = [a for a in cand if a["_t"] and a["_t"][0] == A[0] and TIPO_DA_ESCOLA.get(a["escola"]) == tipo and a["ano"] == ano]
        if len(pf) == 1: return pf[0], "perfil"
    return None, None

def cruzar(users, alunos, overrides=None):
    """user_id → {"escola","ano","como","ws"(linha da planilha ou None)}. Marca user_id/como nas linhas da planilha."""
    manual = overrides if overrides is not None else ler_overrides()
    nomeados = [a for a in alunos if a["nome"]]
    por_conta = {}
    for u in users:
        m = manual.get(u["id"]) or manual.get(norm(u.get("username") or ""))
        if m:
            por_conta[u["id"]] = {"escola": m["escola"], "ano": m["ano"], "como": "manual", "ws": None}
            continue
        a, como = casar(u, nomeados)
        if a:
            por_conta[u["id"]] = {"escola": a["escola"], "ano": a["ano"], "como": como, "ws": a}
            if not a["user_id"]: a["user_id"] = u["id"]; a["como"] = como
    return por_conta
