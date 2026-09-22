'use client'

import { useEffect, useRef, useState } from 'react'
import { askJarvis, type JarvisTurn } from '@/app/(painel)/jarvis/actions'

// ── Web Speech API (Chrome): lib.dom não declara os tipos, então o mínimo aqui ──
type SRResult = { isFinal: boolean; 0: { transcript: string } }
type SRResultEvent = { resultIndex: number; results: ArrayLike<SRResult> }
type SR = {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((e: SRResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SR
    webkitSpeechRecognition?: new () => SR
  }
}

// "ok jarvis", "okay jarvis", "ei jarvis", "ô jarvis"… e o clássico "jarbas" que
// o reconhecedor em pt-BR adora inventar.
const WAKE = /\b(ok|okay|oquei|o|ô|ei|hey|hei)[\s,]*j[aá]rv[ie]s\b|\bjarbas\b/i
const SILENCIO_MS = 1400        // pausa que fecha a pergunta
const LS_KEY = 'jarvis.wake.v1'

type Estado = 'off' | 'escutando' | 'ativo' | 'pensando' | 'falando'
const ROTULO: Record<Estado, string> = {
  off: 'JARVIS desligado', escutando: 'Ouvindo "Ok Jarvis"…', ativo: 'Pode falar…',
  pensando: 'Pensando…', falando: 'Falando…',
}
const COR: Record<Estado, string> = {
  off: 'bg-muted', escutando: 'bg-brand', ativo: 'bg-emerald-500', pensando: 'bg-p2', falando: 'bg-p1',
}

export function JarvisVoice() {
  const [estado, setEstado] = useState<Estado>('off')
  const [aberto, setAberto] = useState(false)
  const [suportado, setSuportado] = useState(true)
  const [turnos, setTurnos] = useState<JarvisTurn[]>([])
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [ferramentas, setFerramentas] = useState<string[]>([])

  const recRef    = useRef<SR | null>(null)
  const estadoRef = useRef<Estado>('off')
  const wakeRef   = useRef(false)          // modo "Ok Jarvis" ligado
  const bufRef    = useRef('')             // fala acumulada no modo ativo
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const turnosRef = useRef<JarvisTurn[]>([])
  const listRef   = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    turnosRef.current = turnos
    listRef.current?.scrollTo({ top: 1e9 })
  }, [turnos])

  // religa sozinho se estava ligado na última sessão
  useEffect(() => {
    try { if (localStorage.getItem(LS_KEY) === '1') ligar() } catch { /* sem storage */ }
    return () => desligar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(e: Estado) { estadoRef.current = e; setEstado(e) }

  function chime(freq = 880) {
    try {
      const C = new AudioContext(); const o = C.createOscillator(); const g = C.createGain()
      o.frequency.value = freq; g.gain.value = 0.06
      o.connect(g).connect(C.destination); o.start(); o.stop(C.currentTime + 0.14)
    } catch { /* sem áudio */ }
  }

  function voltarAoRepouso() {
    bufRef.current = ''
    if (wakeRef.current) { set('escutando'); startRec() } else set('off')
  }

  async function perguntar(q: string) {
    const question = q.trim()
    if (question.length < 2) { voltarAoRepouso(); return }
    stopRec()
    if (timerRef.current) clearTimeout(timerRef.current)
    set('pensando'); setParcial(''); setErro(null); setAberto(true)
    const hist = turnosRef.current
    setTurnos((t) => [...t, { role: 'user', content: question }])

    const r = await askJarvis(question, hist, true)
    if (!r.ok) { setErro(r.error); voltarAoRepouso(); return }
    setTurnos((t) => [...t, { role: 'assistant', content: r.text }])
    setFerramentas(r.tools)

    const el = audioRef.current
    if (r.audio && el) {
      set('falando')
      el.src = r.audio
      el.onended = () => voltarAoRepouso()
      try { await el.play() } catch { voltarAoRepouso() }
    } else {
      voltarAoRepouso()
    }
  }

  function agendarEnvio() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const q = bufRef.current; bufRef.current = ''
      void perguntar(q)
    }, SILENCIO_MS)
  }

  function criarRec(): SR | null {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true

    rec.onresult = (e) => {
      let finais = '', interino = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finais += r[0].transcript + ' '; else interino += r[0].transcript
      }
      const ouvido = (finais || interino).trim()
      const st = estadoRef.current

      if (st === 'escutando') {
        const m = WAKE.exec(ouvido)
        if (!m) { setParcial(''); return }
        chime()
        set('ativo'); setAberto(true)
        // o que veio DEPOIS do "ok jarvis" já é a pergunta
        const resto = ouvido.slice(m.index + m[0].length).replace(/^[\s,.!?]+/, '')
        bufRef.current = finais ? resto : ''
        setParcial(resto)
        if (finais && resto.split(/\s+/).filter(Boolean).length >= 2) agendarEnvio()
        return
      }

      if (st === 'ativo') {
        setParcial((bufRef.current + ' ' + (finais || interino)).trim())
        if (finais) { bufRef.current = (bufRef.current + ' ' + finais).trim(); agendarEnvio() }
      }
    }

    // o Chrome encerra sozinho após silêncio/60 s: religa enquanto estiver no modo wake
    rec.onend = () => {
      const st = estadoRef.current
      if ((st === 'escutando' || st === 'ativo') && wakeRef.current) {
        setTimeout(() => { try { rec.start() } catch { /* já rodando */ } }, 150)
      } else if (st === 'ativo' && !wakeRef.current && !bufRef.current) {
        set('off')   // push-to-talk sem fala nenhuma
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setErro('Permita o microfone para este site no Chrome.'); desligar()
      }
    }
    return rec
  }

  function startRec() {
    if (!recRef.current) recRef.current = criarRec()
    if (!recRef.current) { setSuportado(false); return }
    try { recRef.current.start() } catch { /* já iniciado */ }
  }
  function stopRec() { try { recRef.current?.stop() } catch { /* ok */ } }

  function ligar() {
    wakeRef.current = true
    try { localStorage.setItem(LS_KEY, '1') } catch { /* ok */ }
    set('escutando'); setErro(null); setAberto(true); startRec()
  }
  function desligar() {
    wakeRef.current = false
    try { localStorage.setItem(LS_KEY, '0') } catch { /* ok */ }
    if (timerRef.current) clearTimeout(timerRef.current)
    bufRef.current = ''
    audioRef.current?.pause()
    stopRec(); set('off'); setParcial('')
  }
  /** Push-to-talk: pula o "Ok Jarvis". */
  function falarAgora() {
    if (estadoRef.current === 'falando') audioRef.current?.pause()
    chime(); set('ativo'); setAberto(true); bufRef.current = ''; setParcial(''); startRec()
  }

  const ligado = wakeRef.current || estado !== 'off'

  return (
    <>
      <audio ref={audioRef} className="hidden" />

      {/* orbe flutuante */}
      <button
        onClick={() => setAberto((v) => !v)}
        title={ROTULO[estado]}
        className={`fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition
                    ${COR[estado]} ${estado === 'escutando' ? 'animate-pulse' : ''} ${estado === 'ativo' ? 'ring-4 ring-emerald-300/60' : ''}`}
      >
        <span className="text-2xl">{estado === 'pensando' ? '…' : estado === 'falando' ? '🔊' : '🎙️'}</span>
      </button>

      {aberto && (
        <div className="fixed bottom-24 right-5 z-50 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b p-3">
            <span className={`h-2.5 w-2.5 rounded-full ${COR[estado]} ${estado === 'escutando' ? 'animate-pulse' : ''}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">JARVIS</div>
              <div className="truncate text-xs text-muted">{ROTULO[estado]}</div>
            </div>
            {ligado
              ? <button onClick={desligar} className="rounded-lg border px-2 py-1 text-xs hover:bg-bg">Desligar</button>
              : <button onClick={ligar} disabled={!suportado} className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Ativar &ldquo;Ok Jarvis&rdquo;</button>}
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {turnos.length === 0 && (
              <p className="text-xs text-muted">
                Diga <b>&ldquo;Ok Jarvis&rdquo;</b> e faça a pergunta. Ex.: <i>&ldquo;Ok Jarvis, quantas pessoas abriram o app hoje?&rdquo;</i>,{' '}
                <i>&ldquo;o que tem de ticket aberto?&rdquo;</i>, <i>&ldquo;gera o relatório de erros&rdquo;</i>.
              </p>
            )}
            {turnos.map((t, i) => (
              <div key={i} className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${t.role === 'user' ? 'ml-auto bg-brand/15' : 'bg-bg'}`}>
                {t.content}
              </div>
            ))}
            {parcial && <div className="ml-auto max-w-[92%] rounded-xl bg-brand/5 px-3 py-2 text-sm italic text-muted">{parcial}</div>}
            {estado === 'pensando' && <div className="text-xs text-muted">consultando o banco…</div>}
            {ferramentas.length > 0 && estado !== 'pensando' && (
              <div className="text-[10px] text-muted">ferramentas: {ferramentas.join(', ')}</div>
            )}
            {erro && <div className="rounded-lg bg-p0/10 px-3 py-2 text-xs text-p0">{erro}</div>}
            {!suportado && <div className="text-xs text-p1">Este navegador não tem reconhecimento de voz — use o Chrome ou digite abaixo.</div>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); const q = texto; setTexto(''); void perguntar(q) }}
            className="flex items-center gap-2 border-t p-2"
          >
            <button type="button" onClick={falarAgora} disabled={!suportado || estado === 'pensando'}
              title="Falar agora (sem dizer Ok Jarvis)"
              className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-bg disabled:opacity-50">🎤</button>
            <input
              value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ou digite…"
              className="min-w-0 flex-1 rounded-lg border bg-bg px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button type="submit" disabled={!texto.trim() || estado === 'pensando'}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">→</button>
          </form>
        </div>
      )}
    </>
  )
}
