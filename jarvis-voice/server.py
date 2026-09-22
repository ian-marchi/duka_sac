"""
JARVIS Voice — sidecar de text-to-speech (Chatterbox Multilingual, Resemble AI).

Roda LOCAL na máquina do Ian, em 127.0.0.1:8765. O painel Next chama POST /tts
com o resumo executivo do relatório e recebe um WAV. Nada aqui sai da máquina.

  GET  /health           -> {"ok": true, "device": "cuda", "loaded": bool}
  POST /tts              -> audio/wav
       {"text": "...", "language_id": "pt", "exaggeration": 0.5, "cfg_weight": 0.5}

Voz: por padrão a voz built-in do modelo. Para clonar uma voz (um "JARVIS" seu),
grave ~10 s de áudio limpo em WAV e aponte JARVIS_VOICE_WAV=caminho\\voz.wav.

O modelo é carregado uma vez, na primeira chamada (demora ~10-30 s: baixa os
pesos do Hugging Face na primeira execução, depois fica em cache).
"""

from __future__ import annotations

import io
import os
import re
import threading

# O huggingface_hub cria symlinks no cache; no Windows isso exige Modo Desenvolvedor
# e falha com WinError 1314. Com esta flag ele copia os arquivos em vez de linkar.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

import torch
import torchaudio as ta
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
VOICE_WAV = os.environ.get("JARVIS_VOICE_WAV") or None
# Chatterbox degrada em textos longos num único generate(); quebramos por frase.
CHUNK_CHARS = 280
SILENCE_SEC = 0.35

app = FastAPI(title="JARVIS Voice")
_model = None
_lock = threading.Lock()


def get_model():
    global _model
    with _lock:
        if _model is None:
            import inspect
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            print(f"[voice] carregando Chatterbox Multilingual em {DEVICE}…", flush=True)
            # `t3_model="v3"` só existe na versão do GitHub; o chatterbox-tts do PyPI
            # (0.1.7) não aceita o parâmetro e cai com TypeError. Passamos só se existir.
            kwargs = {"device": DEVICE}
            if "t3_model" in inspect.signature(ChatterboxMultilingualTTS.from_pretrained).parameters:
                kwargs["t3_model"] = "v3"
            _model = ChatterboxMultilingualTTS.from_pretrained(**kwargs)
            print("[voice] pronto", flush=True)
        return _model


class TtsReq(BaseModel):
    text: str
    language_id: str = "pt"
    exaggeration: float = 0.5
    cfg_weight: float = 0.5


def chunks(text: str, limit: int = CHUNK_CHARS) -> list[str]:
    """Agrupa frases até ~limit caracteres, sem cortar no meio de uma frase."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?…])\s+", text)
    out: list[str] = []
    cur = ""
    for s in sentences:
        if cur and len(cur) + 1 + len(s) > limit:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "loaded": _model is not None, "voice": bool(VOICE_WAV)}


@app.post("/tts")
def tts(req: TtsReq):
    parts = chunks(req.text)
    if not parts:
        raise HTTPException(400, "texto vazio")
    if len(req.text) > 6000:
        raise HTTPException(413, "texto longo demais (máx. 6000 caracteres)")

    m = get_model()
    extra = {"audio_prompt_path": VOICE_WAV} if VOICE_WAV else {}
    silence = torch.zeros(1, int(m.sr * SILENCE_SEC))
    pieces: list[torch.Tensor] = []
    with torch.inference_mode():
        for p in parts:
            wav = m.generate(
                p,
                language_id=req.language_id,
                exaggeration=req.exaggeration,
                cfg_weight=req.cfg_weight,
                **extra,
            )
            pieces.append(wav.detach().cpu())
            pieces.append(silence)
    audio = torch.cat(pieces, dim=1)

    buf = io.BytesIO()
    ta.save(buf, audio, m.sr, format="wav")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
