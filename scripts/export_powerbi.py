# -*- coding: utf-8 -*-
"""
Exporta os dados do Duka para uma planilha pronta pro Power BI.

Rode na pasta do painel:  python scripts/export_powerbi.py
Gera data/exports/duka_powerbi_<data>.xlsx

Uma aba por tabela, uma linha por fato, sem fórmulas (o Power BI faz as contas).
Em TODA aba de atividade o usuário vem identificado por nome, @usuario, escola
e ano — a pergunta que a planilha responde é "quem, de qual escola, fez o quê".

Fora de propósito: e-mail, telefone, conteúdo de redações/flashcards e
qualquer campo de premium (o arquivo vai pra outra pessoa e essa classificação
não interessa aqui). A escola vem da planilha do WhatsApp (data/alunos_duka.csv)
cruzada por nome completo; quem não está lá fica "Não identificada".
"""
import csv, json, re, sys, unicodedata, datetime as dt
from pathlib import Path
import requests
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

RAIZ = Path(__file__).resolve().parent.parent
ENV = Path(r"F:\ian\prog\Path_app\.env.local")
CSV = RAIZ / "data" / "alunos_duka.csv"
OUT_DIR = RAIZ / "data" / "exports"
OUT_DIR.mkdir(parents=True, exist_ok=True)
HOJE = dt.date.today().isoformat()
OUT = OUT_DIR / f"duka_powerbi_{HOJE}.xlsx"

env = {}
for line in ENV.read_text(encoding="utf-8").splitlines():
    m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
URL = env.get("EXPO_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
KEY = env.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY:
    sys.exit("faltou EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")

def fetch(table, select="*", schema="public", order=None):
    rows, start = [], 0
    while True:
        h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Range": f"{start}-{start+999}", "Prefer": "count=exact"}
        if schema != "public":
            h["Accept-Profile"] = schema
        p = {"select": select}
        if order: p["order"] = order
        r = requests.get(f"{URL}/rest/v1/{table}", headers=h, params=p, timeout=60)
        if r.status_code not in (200, 206):
            sys.exit(f"{schema}.{table}: HTTP {r.status_code} {r.text[:200]}")
        chunk = r.json()
        rows += chunk
        if len(chunk) < 1000: break
        start += 1000
    print(f"  {schema}.{table}: {len(rows)} linhas")
    return rows

print("Baixando…")
users = fetch("users", "id,full_name,username,target_exam,target_course,age,school_type,school_year,onboarding_completed,tutorial_done,total_points,current_streak,longest_streak,last_activity_date,terms_accepted_at,hide_from_ranking,is_banned,created_at", order="created_at")
opens = fetch("app_opens", "user_id,dia,aberturas", order="dia")
usage = fetch("ai_usage", "id,user_id,feature,model,prompt_tokens,completion_tokens,total_tokens,ok,cost_usd,created_at", order="created_at")
sims = fetch("simulations", "id,user_id,type,exam,subject,mode,total_questions,correct_answers,time_spent_seconds,points_earned,status,started_at,completed_at", order="started_at")
essays_raw = fetch("essays", "id,user_id,theme,target_exam,ai_score,teacher_score,created_at,content_text", order="created_at")
# O app chegou a gravar a MESMA redação 4 vezes em 2 segundos (toque repetido no
# botão de enviar). Aqui fica uma por usuário + texto; a primeira vale.
import hashlib
_vistas, essays, essays_dup = set(), [], 0
for e in essays_raw:
    k = (e["user_id"], hashlib.md5((e.get("content_text") or "").encode("utf-8")).hexdigest())
    if k in _vistas: essays_dup += 1; continue
    _vistas.add(k); e.pop("content_text", None); essays.append(e)
print(f"  redações duplicadas ignoradas: {essays_dup}")
cards = fetch("flashcards", "user_id,subject,repetitions,easiness_factor,created_at,last_reviewed_at")
badges = fetch("user_badges", "user_id,badge_id,unlocked_at", order="unlocked_at")
feedback = fetch("beta_feedback", "id,user_id,versao,respostas,comentario,app_version,plataforma,respondido_em", order="respondido_em")
groups = fetch("study_groups", "id,name,created_at")
members = fetch("study_group_members", "group_id,user_id,joined_at")
tickets = fetch("tickets", "id,ref,kind,source,status,priority,priority_source,title,occurrences,affected_users,user_id,app_version,platform,os_version,device_model,first_seen_at,last_seen_at,resolved_at,created_at", schema="support", order="created_at")

# ── helpers ──────────────────────────────────────────────────────────────────
def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c)).lower()).strip()

def d(s):
    if not s: return None
    try:
        if len(s) == 10: return dt.date.fromisoformat(s)
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(dt.timezone(dt.timedelta(hours=-3))).replace(tzinfo=None)
    except Exception:
        return s

FEATURE = {"ai-chat": "Chat Duka IA", "essay-correct": "Correção de redação", "flashcards-generate": "Geração de flashcards",
           "questions-generate": "Geração de questões", "subject-plan-generate": "Plano por matéria", "moderate-avatar": "Moderação de avatar"}
DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]

# ── planilha do WhatsApp (sem telefone) → escola por usuário ────────────────
# Cruzamento em camadas (exata/parcial/usuario/perfil/manual) no módulo
# duka_contatos, compartilhado com scripts/sync_contatos_whatsapp.py.
import sys as _sys; _sys.path.insert(0, str(Path(__file__).resolve().parent))
from duka_contatos import ler_planilha, cruzar, ANO, TIPO_ESCOLA
alunos_ws = ler_planilha(CSV)
by_id = {u["id"]: u for u in users}
ws_por_conta = cruzar(users, alunos_ws)
for a in alunos_ws: a.pop("_t", None); a.pop("contato", None); a.pop("telefone_informado", None)   # telefone NÃO vai pro arquivo
from collections import Counter
print("  cruzamento planilha × contas:", dict(Counter(v["como"] for v in ws_por_conta.values())), f"de {len(users)} contas")

def quem(uid):
    """As 4 colunas de identificação que entram em toda aba de atividade."""
    u = by_id.get(uid) or {}
    w = ws_por_conta.get(uid)
    escola = w["escola"] if w else "Não identificada"
    ano = (w["ano"] if w and w["ano"] else None) or ANO.get((u.get("school_year") or "").lower(), u.get("school_year") or "")
    return {"usuario_nome": u.get("full_name") or "", "username": u.get("username") or "", "escola": escola, "ano": ano}

# agregados por usuário
ab_tot, ab_dias, ab_ult = {}, {}, {}
for o in opens:
    ab_tot[o["user_id"]] = ab_tot.get(o["user_id"], 0) + (o["aberturas"] or 0)
    ab_dias[o["user_id"]] = ab_dias.get(o["user_id"], 0) + 1
    ab_ult[o["user_id"]] = max(ab_ult.get(o["user_id"], ""), o["dia"] or "")
fc = {}
for c in cards:
    f = fc.setdefault(c["user_id"], {"cartoes": 0, "revisoes": 0})
    f["cartoes"] += 1; f["revisoes"] += c["repetitions"] or 0
def cnt(rows, uid, cond=lambda r: True):
    return sum(1 for r in rows if r.get("user_id") == uid and cond(r))

# ── workbook ─────────────────────────────────────────────────────────────────
wb = Workbook()
FONT = "Arial"
H_FILL = PatternFill("solid", fgColor="5B34C7"); H_FONT = Font(name=FONT, bold=True, color="FFFFFF", size=10)
B_FONT = Font(name=FONT, size=10)
DT = "dd/mm/yyyy hh:mm"; DD = "dd/mm/yyyy"; MONEY = '"US$" #,##0.0000'; INT = "#,##0"
ID = [("usuario_nome", "usuario_nome", 28), ("username", "username", 18), ("escola", "escola", 24), ("ano", "ano", 12)]

def sheet(title, cols, rows, formats=None):
    ws = wb.create_sheet(title)
    ws.append([c[0] for c in cols])
    for cell in ws[1]:
        cell.font = H_FONT; cell.fill = H_FILL; cell.alignment = Alignment(vertical="center")
    for r in rows:
        ws.append([json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in (r.get(c[1]) for c in cols)])
    for i, c in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = c[2]
        fmt = (formats or {}).get(c[1])
        for cell in ws.iter_rows(min_row=2, min_col=i, max_col=i):
            cell[0].font = B_FONT
            if fmt: cell[0].number_format = fmt
    ws.freeze_panes = "A2"
    t = Table(displayName=re.sub(r"[^A-Za-z0-9_]", "_", title), ref=f"A1:{get_column_letter(len(cols))}{max(len(rows), 1) + 1}")
    t.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    ws.add_table(t)
    return ws

def com_quem(rows, uid_key="user_id", **extra):
    out = []
    for r in rows:
        x = dict(r); x.update(quem(r.get(uid_key))); x.update({k: f(r) for k, f in extra.items()}); out.append(x)
    return out

# Usuarios (dimensão) — sem premium
sheet("Usuarios", [
    ("user_id","id",38), ("nome","full_name",28), ("username","username",18), ("escola","escola",24), ("ano","ano",12), ("tipo_escola","tipo_escola",12),
    ("na_planilha_whatsapp","na_ws",10), ("vestibular_alvo","target_exam",14), ("curso_alvo","target_course",22), ("idade","age",7),
    ("onboarding_completo","onboarding_completed",10), ("tutorial_feito","tutorial_done",10), ("pontos","total_points",10), ("ofensiva_atual","current_streak",10), ("maior_ofensiva","longest_streak",10),
    ("ultima_atividade","last_activity_date",14), ("aceitou_termos_em","terms_accepted_at",16), ("cadastro_em","created_at",16),
    ("aberturas_total","aberturas_total",10), ("dias_com_app_aberto","dias_ativos",10), ("ultima_abertura","ultima_abertura",14),
    ("conta_de_teste","teste",10), ("banido","is_banned",8),
], [dict(u, **{k: v for k, v in quem(u["id"]).items() if k in ("escola", "ano")}, tipo_escola=TIPO_ESCOLA.get(u["school_type"] or "", u["school_type"] or ""), na_ws=u["id"] in ws_por_conta,
        last_activity_date=d(u["last_activity_date"]), terms_accepted_at=d(u["terms_accepted_at"]), created_at=d(u["created_at"]),
        aberturas_total=ab_tot.get(u["id"], 0), dias_ativos=ab_dias.get(u["id"], 0), ultima_abertura=d(ab_ult.get(u["id"])) if ab_ult.get(u["id"]) else None,
        teste=bool(u["hide_from_ranking"])) for u in users],
  {"last_activity_date": DD, "terms_accepted_at": DT, "created_at": DT, "ultima_abertura": DD, "total_points": INT})

# ResumoPorUsuario — quem fez o quê, em números
sheet("ResumoPorUsuario", [
    ("user_id","id",38), *ID, ("aberturas","aberturas",10), ("dias_com_app_aberto","dias",10), ("simulados_iniciados","sim_i",10), ("simulados_concluidos","sim_c",10),
    ("redacoes","red",9), ("chamadas_ia","ia",9), ("chats_ia","chat",9), ("flashcards","fc",9), ("revisoes_flashcards","fcr",10), ("conquistas","bad",9), ("tickets","tk",8), ("feedbacks_beta","fb",9), ("grupos","gr",7),
], [dict({"id": u["id"]}, **quem(u["id"]), aberturas=ab_tot.get(u["id"], 0), dias=ab_dias.get(u["id"], 0),
         sim_i=cnt(sims, u["id"]), sim_c=cnt(sims, u["id"], lambda s: s.get("completed_at")), red=cnt(essays, u["id"]),
         ia=cnt(usage, u["id"]), chat=cnt(usage, u["id"], lambda x: x.get("feature") == "ai-chat"),
         fc=fc.get(u["id"], {}).get("cartoes", 0), fcr=fc.get(u["id"], {}).get("revisoes", 0), bad=cnt(badges, u["id"]),
         tk=cnt(tickets, u["id"]), fb=cnt(feedback, u["id"]), gr=cnt(members, u["id"])) for u in users])

# Atividades — UMA linha por ação de qualquer tipo (a aba pra cortar por escola/tipo/data)
ativ = []
def add(uid, tipo, quando, detalhe, ref=None):
    ativ.append(dict({"user_id": uid, "tipo": tipo, "quando": d(quando), "detalhe": detalhe, "ref": ref}, **quem(uid)))
for s in sims:
    add(s["user_id"], "Simulado" if s.get("completed_at") else "Simulado (não concluído)", s["completed_at"] or s["started_at"],
        f"{s.get('subject') or s.get('type') or ''} · {s.get('total_questions') or 0} questões · {s.get('correct_answers') or 0} acertos".strip(" ·"), s["id"])
for e in essays:
    sc = e.get("ai_score"); tot = sc.get("total") if isinstance(sc, dict) else sc
    add(e["user_id"], "Redação", e["created_at"], f"{e.get('theme') or ''}{f' · nota IA {tot}' if tot is not None else ''}", e["id"])
for x in usage:
    add(x["user_id"], FEATURE.get(x["feature"], x["feature"]), x["created_at"], f"{x.get('total_tokens') or 0} tokens{'' if x.get('ok') else ' · falhou'}", x["id"])
for b in badges:
    add(b["user_id"], "Conquista", b["unlocked_at"], b["badge_id"])
for f_ in feedback:
    add(f_["user_id"], "Feedback do beta", f_["respondido_em"], (f_.get("comentario") or "")[:120], f_["id"])
for t in tickets:
    if t.get("user_id"): add(t["user_id"], "Ticket de suporte", t["created_at"], f"{t.get('kind')} · {t.get('title') or ''}", t["ref"])
for o in opens:
    add(o["user_id"], "Abertura do app", o["dia"], f"{o['aberturas']} abertura(s) no dia")
ativ.sort(key=lambda r: (str(r["quando"] or "")), reverse=True)
sheet("Atividades", [("user_id","user_id",38), *ID, ("tipo","tipo",22), ("quando","quando",16), ("detalhe","detalhe",50), ("ref","ref",10)], ativ, {"quando": DT})

# Fatos detalhados, cada um com as 4 colunas de identificação
sheet("Aberturas", [("user_id","user_id",38), *ID, ("dia","dia",12), ("aberturas","aberturas",10), ("dia_semana","dow",10)],
      com_quem(opens, dia=lambda o: d(o["dia"]), dow=lambda o: DOW[dt.date.fromisoformat(o["dia"]).weekday()]), {"dia": DD})

sheet("UsoIA", [("id","id",8), ("user_id","user_id",38), *ID, ("recurso","recurso",22), ("modelo","model",26), ("tokens_entrada","prompt_tokens",12),
                ("tokens_saida","completion_tokens",12), ("tokens_total","total_tokens",12), ("ok","ok",6), ("custo_usd","cost_usd",12), ("quando","created_at",16)],
      com_quem(usage, recurso=lambda x: FEATURE.get(x["feature"], x["feature"]), created_at=lambda x: d(x["created_at"])),
      {"created_at": DT, "cost_usd": MONEY, "prompt_tokens": INT, "completion_tokens": INT, "total_tokens": INT})

sheet("Simulados", [("id","id",38), ("user_id","user_id",38), *ID, ("tipo","type",12), ("vestibular","exam",12), ("materia","subject",14), ("modo","mode",10),
                    ("questoes","total_questions",9), ("acertos","correct_answers",9), ("pct_acerto","pct",10), ("tempo_seg","time_spent_seconds",10), ("pontos","points_earned",9), ("concluido","concluido",9), ("status","status",12), ("inicio","started_at",16), ("fim","completed_at",16)],
      com_quem(sims, pct=lambda s: (round(s["correct_answers"] / s["total_questions"], 4) if s.get("total_questions") and s.get("correct_answers") is not None else None),
               concluido=lambda s: bool(s.get("completed_at")), started_at=lambda s: d(s["started_at"]), completed_at=lambda s: d(s["completed_at"])),
      {"started_at": DT, "completed_at": DT, "pct": "0.0%"})

def comp(e, k):
    s = e.get("ai_score")
    return s.get(k) if isinstance(s, dict) else (s if k == "total" else None)
sheet("Redacoes", [("id","id",38), ("user_id","user_id",38), *ID, ("tema","theme",40), ("vestibular","target_exam",12),
                   ("nota_ia_total","total",10), ("c1","c1",6), ("c2","c2",6), ("c3","c3",6), ("c4","c4",6), ("c5","c5",6), ("nota_professor","teacher_score",12), ("quando","created_at",16)],
      com_quem(essays, created_at=lambda e: d(e["created_at"]), total=lambda e: comp(e, "total"), c1=lambda e: comp(e, "c1"), c2=lambda e: comp(e, "c2"),
               c3=lambda e: comp(e, "c3"), c4=lambda e: comp(e, "c4"), c5=lambda e: comp(e, "c5")), {"created_at": DT})

sheet("Conquistas", [("user_id","user_id",38), *ID, ("badge","badge_id",22), ("desbloqueada_em","unlocked_at",16)],
      com_quem(badges, unlocked_at=lambda b: d(b["unlocked_at"])), {"unlocked_at": DT})

sheet("FeedbackBeta", [("id","id",8), ("user_id","user_id",38), *ID, ("versao_questionario","versao",10), ("respostas_json","respostas",50), ("comentario","comentario",50), ("app_version","app_version",10), ("plataforma","plataforma",10), ("quando","respondido_em",16)],
      com_quem(feedback, respondido_em=lambda f_: d(f_["respondido_em"])), {"respondido_em": DT})

gname = {g["id"]: g["name"] for g in groups}
sheet("Grupos", [("group_id","group_id",38), ("grupo","grupo",24), ("user_id","user_id",38), *ID, ("entrou_em","joined_at",16)],
      com_quem(members, grupo=lambda m: gname.get(m["group_id"], ""), joined_at=lambda m: d(m["joined_at"])), {"joined_at": DT})

def horas(t):
    if not t.get("resolved_at"): return None
    return round((dt.datetime.fromisoformat(t["resolved_at"].replace("Z", "+00:00")) - dt.datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))).total_seconds() / 3600, 1)
sheet("Tickets", [("id","id",8), ("ref","ref",10), ("user_id","user_id",38), *ID, ("tipo","kind",12), ("origem","source",10), ("status","status",12), ("prioridade","priority",8), ("prioridade_por","priority_source",12), ("titulo","title",44),
                  ("ocorrencias","occurrences",10), ("usuarios_afetados","affected_users",10), ("app_version","app_version",10), ("plataforma","platform",10), ("os","os_version",10), ("aparelho","device_model",16),
                  ("primeira_vez","first_seen_at",16), ("ultima_vez","last_seen_at",16), ("resolvido_em","resolved_at",16), ("aberto_em","created_at",16), ("horas_ate_resolver","horas",10)],
      com_quem(tickets, first_seen_at=lambda t: d(t["first_seen_at"]), last_seen_at=lambda t: d(t["last_seen_at"]), resolved_at=lambda t: d(t["resolved_at"]), created_at=lambda t: d(t["created_at"]), horas=horas),
      {"first_seen_at": DT, "last_seen_at": DT, "resolved_at": DT, "created_at": DT})

sheet("AlunosWhatsApp", [("nome","nome",34), ("escola","escola",26), ("escola_original","escola_original",34), ("ano","ano",14), ("ano_original","ano_original",26), ("status","status",14), ("observacao","observacao",50), ("user_id_no_app","user_id",38)], alunos_ws)

ini = min(dt.date.fromisoformat(u["created_at"][:10]) for u in users)
cal, dia = [], ini
while dia <= dt.date.today():
    cal.append({"data": dia, "ano": dia.year, "mes": dia.month, "mes_nome": ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][dia.month-1],
                "semana_iso": dia.isocalendar()[1], "dia_semana": DOW[dia.weekday()], "fim_de_semana": dia.weekday() >= 5})
    dia += dt.timedelta(days=1)
sheet("Calendario", [("data","data",12), ("ano","ano",7), ("mes","mes",6), ("mes_nome","mes_nome",9), ("semana_iso","semana_iso",10), ("dia_semana","dia_semana",11), ("fim_de_semana","fim_de_semana",12)], cal, {"data": DD})

# Leia-me (primeira aba)
ws = wb["Sheet"]; ws.title = "LeiaMe"
ws.column_dimensions["A"].width = 22; ws.column_dimensions["B"].width = 100
n_ws = sum(1 for u in users if u["id"] in ws_por_conta)
linhas = [
    ("Duka · dados para Power BI", ""),
    ("Exportado em", dt.datetime.now().strftime("%d/%m/%Y %H:%M") + " (horário de Brasília)"),
    ("Fonte", "Supabase do app Duka + planilha manual dos alunos abordados no WhatsApp"),
    ("Pergunta que responde", "Quem, de qual escola, fez o quê e quando. Toda aba de atividade traz usuario_nome, username, escola e ano ao lado do user_id."),
    ("Escola", f"Vem do cruzamento por nome completo com a planilha do WhatsApp ({n_ws} de {len(users)} contas identificadas). Quem não está na planilha aparece como 'Não identificada'; o tipo (pública/particular) vem do cadastro e está só em Usuarios."),
    ("Privacidade", "E-mail, telefone, conteúdo de redações/flashcards e classificação premium NÃO estão neste arquivo, de propósito."),
    ("Como usar no Power BI", "Obter dados → Excel → marque todas as tabelas (já são Tabelas nomeadas). Relacione Usuarios[user_id] 1:N com as demais. Relacione Calendario[data] com Atividades[quando], Aberturas[dia] etc. Para 'quais alunos de qual escola fizeram X', comece por Atividades filtrando tipo."),
    ("", ""),
    ("Aba", "O que tem / observações"),
    ("Usuarios", "Uma linha por conta, com escola e ano, tipo de escola, objetivo, pontos, datas e o resumo de aberturas."),
    ("ResumoPorUsuario", "Uma linha por conta com as contagens: aberturas, dias ativos, simulados (iniciados/concluídos), redações, chamadas de IA, chats, flashcards, conquistas, tickets, feedbacks, grupos."),
    ("Atividades", "UMA linha por ação de qualquer tipo (simulado, redação, cada chamada de IA, conquista, feedback, ticket, abertura do app), com quem fez, escola, quando e um detalhe curto. É a aba mais útil para cruzar escola × atividade × tempo."),
    ("Aberturas", "Uma linha por usuário por dia em que abriu o app, com a contagem do dia. Base para frequência/hábito."),
    ("UsoIA", "Uma linha por chamada de IA (chat, flashcards, redação, questões geradas…). custo_usd é estimado. ok = false quando falhou."),
    ("Simulados", "Uma linha por simulado iniciado. concluido diz se terminou; pct_acerto = acertos/questoes."),
    ("Redacoes", "Uma linha por redação enviada: tema, nota total e por competência (c1–c5), sem o texto."),
    ("Conquistas", "Uma linha por badge desbloqueada."),
    ("FeedbackBeta", "Respostas do questionário de beta dentro do app; respostas_json guarda o formulário bruto."),
    ("Grupos", "Uma linha por membro de grupo de estudo."),
    ("Tickets", "Tickets de suporte. horas_ate_resolver só nos resolvidos. Ticket sem user_id (automático) fica sem nome/escola."),
    ("AlunosWhatsApp", "A planilha do WhatsApp normalizada (sem telefone). user_id_no_app é o cruzamento por nome — nome igual não garante que é a mesma pessoa."),
    ("Calendario", "Dimensão de datas do primeiro cadastro até hoje."),
    ("", ""),
    ("Sem fórmulas", "Só dados; cálculos ficam no Power BI. Para atualizar: python scripts/export_powerbi.py (gera um arquivo novo com a data do dia)."),
]
for i, (a, b) in enumerate(linhas, 1):
    ws.cell(row=i, column=1, value=a).font = Font(name=FONT, bold=True, size=10 if i > 1 else 14, color="5B34C7" if i == 1 else "161823")
    ws.cell(row=i, column=2, value=b).font = B_FONT
    ws.cell(row=i, column=2).alignment = Alignment(wrap_text=True, vertical="top")
for c in ws[9]: c.font = H_FONT; c.fill = H_FILL

wb.save(OUT)
print("salvo:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
print({"usuarios": len(users), "com_escola": n_ws, "atividades": len(ativ), "simulados": len(sims), "redacoes": len(essays), "usoIA": len(usage), "tickets": len(tickets)})
