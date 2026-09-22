# data/

Arquivos locais, fora do git (têm telefone e nome de aluno):

- `alunos_duka.csv` — planilha manual antiga do WhatsApp. Só é lida quando a tabela
  `support.alunos_whatsapp` está vazia (o scan nunca rodou).
- `escola_overrides.csv` — correções à mão (`username → escola, ano`) usadas pelo Power BI.
- `scan/` — CSVs gerados pela rotina "WhatsApp Duka Alunos Scan" antes de subir pro banco.
- `exports/` — planilhas do `npm run powerbi`.
