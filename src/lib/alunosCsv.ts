import fs from 'node:fs'
import path from 'node:path'
import { anoDe, escolaDe, parseCsv, semAcento, statusDe, type Aluno } from './alunos'

/**
 * Leitura do CSV manual (`data/alunos_duka.csv`), usada só quando
 * `support.alunos_whatsapp` está vazia. Fica num arquivo separado porque usa
 * `node:fs`, e `alunos.ts` é importado por componentes 'use client' — no
 * Railway o webpack do cliente quebrava com "Reading from node:fs is not handled".
 */
// ── carga ───────────────────────────────────────────────────────────────────
export const ARQUIVO_ALUNOS = path.join(process.cwd(), 'data', 'alunos_duka.csv')

export function carregarAlunos(): { alunos: Aluno[]; atualizadoEm: string | null } {
  if (!fs.existsSync(ARQUIVO_ALUNOS)) return { alunos: [], atualizadoEm: null }
  const texto = fs.readFileSync(ARQUIVO_ALUNOS, 'utf8')
  const [cab, ...linhas] = parseCsv(texto)
  const idx = (nome: string) => cab.findIndex((c) => semAcento(c) === semAcento(nome))
  const iContato = idx('Contato WhatsApp'), iNome = idx('Nome'), iTel = idx('Telefone informado')
  const iEscola = idx('Escola'), iAno = idx('Ano'), iStatus = idx('Status'), iObs = idx('Observação')
  const col = (l: string[], i: number) => (i >= 0 ? (l[i] ?? '').trim() : '')

  const alunos: Aluno[] = linhas.map((l) => {
    const anoBruto = col(l, iAno), obs = col(l, iObs)
    const { ano, professor } = anoDe(anoBruto, obs)
    return {
      contato: col(l, iContato),
      nome: col(l, iNome),
      telefone: col(l, iTel),
      escolaBruta: col(l, iEscola),
      escola: col(l, iNome) ? escolaDe(col(l, iEscola)) : 'Não informada',
      anoBruto,
      ano,
      professor,
      status: statusDe(col(l, iStatus)),
      obs,
      primeiraMsg: null,
      ultimaMsg: null,
      conta: null,
    }
  })
  const atualizadoEm = fs.statSync(ARQUIVO_ALUNOS).mtime.toISOString()
  return { alunos, atualizadoEm }
}
