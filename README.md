# Duka · JARVIS — painel de gestão do app

Painel privado, **local no seu PC**, que lê o Supabase do Duka e vira o centro de
gestão do app: visão geral de usuários (funil, grupos, rotina), tickets, métricas,
e um **JARVIS** que escreve relatórios (usuários / erros / tickets / diário), fala o
resumo em voz alta (Chatterbox) e salva tudo como notas no **Obsidian**.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Painel Next.js 15 | esta pasta | `/` visão geral · `/relatorios` JARVIS · `/tickets` fila · `/metricas` · `/regras` |
| Sidecar de voz | `jarvis-voice/` | FastAPI + Chatterbox Multilingual (pt), CUDA. `POST /tts` → WAV |
| Vault Obsidian | `G:\ian\obsidian\Duka` | `Relatórios/{Diário,Usuários,Erros,Tickets}` + `audio/` |
| Edge Function `report-generate` | repo do app | dossiê SQL (`support.jarvis_digest`) → OpenRouter → `support.reports` |
| Migration `081` | repo do app | `support.reports`, `jarvis_digest()`, policies de admin em `users`/`app_opens`, cron 08:00 |

## Subir (ordem)

**1. Supabase** (uma vez, no projeto `kpmsvfbjgrhynxdewppw`)
```sql
-- aplicar supabase/migrations/081_jarvis_reports_admin_reads.sql
-- habilitar extensões: pg_cron, pg_net  (Database › Extensions)
select vault.create_secret('<segredo-longo-aleatorio>', 'jarvis_cron_secret');
```
```bash
supabase secrets set JARVIS_CRON_SECRET=<o mesmo segredo>
supabase functions deploy report-generate --no-verify-jwt --project-ref kpmsvfbjgrhynxdewppw
```
> `--no-verify-jwt` porque o cron não tem JWT; a função valida sozinha (admin JWT **ou** `x-cron-secret`).

**2. Voz** (terminal 1 — primeira vez instala, ~5–10 min)
```powershell
.\jarvis-voice\start.ps1
```

**3. Painel** (terminal 2)
```bash
npm run dev      # http://localhost:3100
```

## Como usa no dia a dia

- **08:00** o cron gera o *Resumo diário* e grava no banco (mesmo com o PC desligado).
- Abre o painel → `/relatorios` mostra **"Bom dia. O resumo de hoje está pronto"** → **🔊 Ouvir**.
  (Navegador não deixa tocar sozinho sem clique — é regra do Chrome, não do painel.)
- Qualquer relatório: **Gerar** → o modelo escreve → vira nota no Obsidian na hora → **Ouvir** gera o áudio e embeda na nota.
- Relatórios gerados enquanto o PC estava desligado aparecem como *não sincronizado*; **Sincronizar pendentes** escreve todos na vault.

## Layout "mesa de operação" (desenho F)

O painel tem a cara do app (Baloo 2 + Nunito, roxo `#AC53D5`, botões clay) e um
trilho de ícones de 68px no lugar da barra lateral. Duas telas são "mesas" de
três colunas fixas que rolam por coluna, sem sair da tela:

- **/tickets** — `Hoje` (resumo da manhã, quatro números, quem sumiu) · lista de
  tickets com busca e chips · o ticket selecionado (`?t=id`) com resposta,
  histórico e contexto. `/t/[id]` só redireciona pra cá (links antigos valem).
  **Apelido**: no cabeçalho do ticket, "🏷️ dar um apelido" (até 60 letras,
  coluna `support.tickets.apelido`, migration 092). O apelido vira o nome do
  ticket na fila (título original embaixo), entra na busca e aparece nos
  tickets do aluno; cada troca fica no histórico.
- **/alunos** — os três relatórios da base (`De onde vêm`, `Frequência`, `Uso`) ·
  lista com busca (`?q=`) e filtros (`?f=sumiram|habito|nunca|beta|premium`) ·
  os mesmos três relatórios só do aluno selecionado (`?u=id`), com calendário de
  14 dias e os tickets dele.

As outras rotas (`/` visão geral, `/relatorios`, `/metricas`, `/regras`) só
trocaram de casca. Código: `src/components/RailNav.tsx`, `FilaLista.tsx`,
`TicketDetalhe.tsx`, `AlunosWorkbench.tsx` e `src/lib/alunosAnalise.ts`.

## WhatsApp: aviso automático pra quem abriu ticket

O banco enfileira (migration 088) e um bot local manda pelo WhatsApp Web do Ian:

- ticket novo de aluno (feedback do beta, questão reportada, bug, ideia…) →
  mensagem "entrou em análise";
- ticket marcado como **Resolvido** → "já foi corrigida" (questão reportada) ou
  "entra na próxima atualização" (o resto).

Textos em `support.whatsapp_templates` (`{nome} {ref} {titulo}`); a fila em
`support.whatsapp_outbox` pode ser editada antes do envio, e cada ticket mostra
o estado das mensagens no painel. Liga/desliga em `support.whatsapp_settings`.

Telefone: `users.phone` ou, se vazio, a planilha do WhatsApp — rode
`npm run contatos` (`scripts/sync_contatos_whatsapp.py`) sempre que trocar
`data/alunos_duka.csv`; ele grava `support.contatos_whatsapp` com o mesmo
cruzamento por nome do Power BI (`scripts/duka_contatos.py`).

Bot: é o **duka_whas_bot** (`F:\ian\prog\duka_whas_bot`, repositório `ian-marchi/duka_whas_bot`), o
mesmo bot da Lumi que cadastra os beta testers. Com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no
`.env` dele, ele passa a esvaziar a fila (1 mensagem a cada 5 s, máximo 40 por hora) e avisa o admin
quando um aluno responde. `npm run whatsapp` aqui só chama o `npm start` de lá.

### Responder ticket pelo WhatsApp (migration 091)

O painel **não responde mais por e-mail**. Na mesa `/tickets`, o card
**Responder pelo WhatsApp** (`src/components/ReplyBox.tsx`) tem:

- **Modelo** — `support.whatsapp_templates` com chave `resposta:<nome>`
  (`questao`, `bug`, `sugestao`, `pc`, `voz`, `default`); troca `{nome}`, `{ref}`
  e `{titulo}` no texto;
- **Número** — `support.telefone_do_usuario(uid)` (`users.phone` ou
  `contatos_whatsapp`); sem número, aparece "sem número" e dá para digitar um;
- **Salvar rascunho** → linha `tipo='manual'`, `status='draft'` na fila (o bot
  ignora); **Enviar pelo WhatsApp** → `status='queued'` e o ticket vai para
  *Aguardando*.

O painel só insere na fila; quem envia é o bot. Em **WhatsApp** (lateral do
ticket) cada rascunho tem **Liberar** (draft→queued) e **Descartar**
(draft→skipped, erro `descartada`). Actions em `src/app/(painel)/t/[id]/actions.ts`
(`enviarWhatsapp`, `liberarWhatsapp`, `descartarWhatsapp`); cada passo vira um
evento `whatsapp` no histórico. O `sendReply` (e-mail via Edge `ticket-reply`)
continua no código, mas a UI não usa.

## Aba WhatsApp: quem chegou pelo WhatsApp (por escola)

A aba **`/whatsapp`** é a métrica separada de quem foi abordado pelo WhatsApp:
quantos responderam, quantos já têm conta no app, por escola e por ano, com a
lista completa (busca e filtros). O botão de scan e o download do CSV moram
lá. Em `/alunos` (as contas do app) os balões de filtro da lista são as escolas (nome curto: *Escola Normal* = E.E. Prof. Plínio Ribeiro,
*Polivalente* = E.E. Prof. Alcides de Carvalho, *Atenas*; escola nova ganha balão sozinha — apelidos em
`ESCOLAS`, `src/lib/alunos.ts`).

A fonte é o banco: `support.alunos_whatsapp` (uma linha por número) e
`support.alunos_scan_runs` (cada varredura), migration 089 do app. Três jeitos de
alimentar:

| Quem | Quando | Como |
|---|---|---|
| Rotina do Claude **"WhatsApp Duka Alunos Scan"** | todo dia às **21h** (app do Claude aberto) ou "Executar agora" | abre o WhatsApp Web, monta o CSV e roda `python scripts/scan_alunos.py importar …` |
| Bot **duka_whas_bot** | quando alguém aperta **Escanear agora** no painel (olha a fila a cada 30 s); opcional `SCAN_AGENDADO_HORA=21` | varre os chats com o whatsapp-web.js e grava direto |
| Você | qualquer hora | `python scripts/scan_alunos.py iniciar` → `importar arquivo.csv --run <id>` |

O botão **Escanear agora** só registra o pedido (`support.solicitar_scan_alunos`);
quem executa é quem está com o WhatsApp Web aberto. **Baixar CSV** entrega a
planilha atual (`/api/alunos/planilha`, só admin logado).

## Aba Ranking: pontos dos alunos com filtros

`/ranking` ordena as contas por `users.total_points` (só existe o total acumulado;
o app não guarda pontos por dia). Filtros combináveis pela URL: escola, ano, por
onde chegou (WhatsApp / contato direto / outro), grupo de frequência e "só quem
abriu nos últimos 14 dias", mais busca. A coluna da esquerda mostra pódio, soma,
média e mediana do recorte e pontos somados por escola e por ano. "ver" abre o
mesmo pop-up de perfil da aba WhatsApp.

## Deploy no Railway (projeto `duka-sac`)

Repositório: `ian-marchi/duka_sac` (branch `main`). O `railway.json` já diz build
(`npm run build`) e start (`npm run start`, porta 3100 — o Railway injeta `PORT`,
então em **Settings → Networking** use a porta 3100 ou troque o `start` no
`package.json`). Variáveis necessárias:

| Var | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpmsvfbjgrhynxdewppw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (nunca a service role) |
| `NEXT_PUBLIC_SITE_URL` | a URL pública do Railway |
| `HIDE_USER_EMAILS` | contas de teste, separadas por vírgula |

Sem `OBSIDIAN_VAULT` e `JARVIS_VOICE_URL` o painel roda igual; só a nota no
Obsidian e a voz do JARVIS ficam desligadas (são coisas do PC do Ian). O
`data/alunos_duka.csv` não vai pro repositório: no Railway a única fonte dos
alunos do WhatsApp é o banco. O repositório é **público** — por isso `.claude/`,
`CLAUDE.md` e `data/` ficam de fora.

## Alunos abordados no WhatsApp (planilha manual, legado)

A visão geral (`/`) tem, no fim, uma seção separada com a lista de alunos que
o Ian abordou no WhatsApp pro beta. A fonte é **`data/alunos_duka.csv`** — um
arquivo mantido à mão, fora do banco.

- Pra atualizar: exporte a planilha de novo com as mesmas colunas
  (`Contato WhatsApp, Nome, Telefone informado, Escola, Ano, Status, Observação`),
  sobrescreva `data/alunos_duka.csv` e recarregue a página. Nada mais precisa mudar.
- Escola e ano são normalizados (`Plínio`/`Normal` → Plínio Ribeiro, `Atenas` → Colégio
  Atenas; `1º/2º/3º`, professor). A coluna Observação vira a lista de avisos.
- O cruzamento "quem já criou conta" é por **nome completo** (sem acento), porque
  `users` não guarda telefone. Nome igual não garante que é a mesma pessoa.
- Código: `src/lib/alunos.ts` (parser e resumo) e `src/components/AlunosBeta.tsx` (seção).

## Falar com o JARVIS ("Ok Jarvis")

O orbe 🎙️ no canto inferior direito é um **agente de voz** com acesso ao banco:

1. Clique **Ativar "Ok Jarvis"** (uma vez; o Chrome pede permissão de microfone e a escolha fica salva).
2. Diga **"Ok Jarvis, …"** e faça a pergunta na mesma frase, ou espere o *bip* e fale. Uma pausa de ~1,5 s fecha a pergunta.
3. Ele consulta o Supabase com **ferramentas** (dossiê, tickets, relatórios, usuário, top IA) e responde em voz alta.

Exemplos: *"quantas pessoas abriram o app hoje?"* · *"o que tem de ticket sem resposta?"* ·
*"me fala do ticket onze"* · *"quem mais gastou token esse mês?"* · *"como está a Karen?"* ·
*"gera o relatório de erros"* (ele gera, salva no Obsidian e lê o resumo).

- 🎤 no painel = falar sem dizer o wake word. Também dá pra **digitar**.
- Ouvido: Web Speech API do **Chrome** (pt-BR). Cérebro: Edge Function `jarvis-chat` (OpenRouter, function calling; custo em `ai_usage` com `feature='jarvis'`). Voz: Chatterbox.
- **Privacidade**: o reconhecimento de fala do Chrome envia o áudio aos servidores do Google
  para transcrever (é assim que a Web Speech API funciona). A voz do JARVIS (Chatterbox) e o
  Obsidian são 100% locais. Se quiser o ouvido 100% local também, o próximo passo é
  `faster-whisper` no sidecar `jarvis-voice/` — troca só o STT, o resto fica igual.

## Variáveis (`.env.local`)

| Var | O quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase (anon key, protegida por RLS) |
| `NEXT_PUBLIC_SITE_URL` | origem do painel |
| `OBSIDIAN_VAULT` | pasta da vault |
| `JARVIS_VOICE_URL` | sidecar (`http://127.0.0.1:8765`) |
| `HIDE_USER_EMAILS` | contas de teste ocultas da Visão geral |

**Nunca** `SUPABASE_SERVICE_ROLE_KEY` aqui. Voz, Obsidian e disco são locais — por isso o painel roda no PC, não na Vercel.

## Voz do JARVIS

Padrão: voz built-in do Chatterbox em português. Para uma voz sua: grave ~10 s de
áudio limpo em WAV e rode o sidecar com `$env:JARVIS_VOICE_WAV='C:\caminho\voz.wav'`.
Expressividade: `exaggeration`/`cfg_weight` em `src/lib/voice.ts`.

## Ambiente (G: é exFAT)

- Use **npm** (pnpm falha por symlink). `npm run dev` funciona normal.
- `next build` não roda no F: (`readlink EISDIR`). Pra validar build, copie pra NTFS ou deixe o Railway buildar. `npm run typecheck` roda ok.

## Segurança

- Painel **não escreve** em `public.*` — as policies novas (`users_select_admin`, `app_opens_select_admin`) são só SELECT.
- `jarvis_digest()` é SECURITY DEFINER e recusa quem não é admin/servidor.
- `/api/audio/[id]` exige admin logado.
