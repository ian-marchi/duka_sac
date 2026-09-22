# JARVIS Voice — sobe o sidecar de TTS em http://127.0.0.1:8765
# Uso:  .\jarvis-voice\start.ps1        (na primeira vez instala tudo; ~5-10 min)
# Requer Python 3.10–3.12 no PATH e driver NVIDIA atualizado.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
# Cache do Hugging Face sem symlinks (Windows sem Modo Desenvolvedor dá WinError 1314).
$env:HF_HUB_DISABLE_SYMLINKS = '1'

# Versão do CUDA do índice do PyTorch. A RTX 5070 (Blackwell, sm_120) só funciona
# com CUDA 12.8+, e o índice cu128 começa no torch 2.7 — por isso fixamos a versão
# em vez de reaproveitar a pinada pelo chatterbox-tts (2.6.0, que não existe em cu128).
$CUDA = 'cu128'
$TORCH_VER = '2.7.1'

# Onde fica o venv. O F: é um HD USB exFAT (~15 arquivos/s) — um venv com torch
# ali leva horas, então o padrão é em C:. Sobrescreva com $env:JARVIS_VENV.
$VENV = if ($env:JARVIS_VENV) { $env:JARVIS_VENV } else { "$env:USERPROFILE\venvs\jarvis-voice" }

if (-not (Test-Path $VENV)) {
  Write-Host "[voice] criando venv em $VENV…"
  python -m venv $VENV
}
& "$VENV\Scripts\Activate.ps1"

if (-not (Test-Path "$VENV\.installed")) {
  Write-Host '[voice] instalando dependências (primeira vez)…'
  python -m pip install --upgrade pip
  pip install -r requirements.txt

  # O chatterbox-tts pina torch 2.6.0 (CPU). Trocamos por $TORCH_VER vindo do índice
  # CUDA, sem mexer nas demais dependências (o chatterbox importa e gera normalmente
  # com 2.7.x; o `pip check` só reclama do pino).
  Write-Host "[voice] trocando torch/torchaudio para $TORCH_VER ($CUDA)…"
  pip install "torch==$TORCH_VER" "torchaudio==$TORCH_VER" --index-url "https://download.pytorch.org/whl/$CUDA" --force-reinstall --no-deps
  pip install "sympy>=1.13.3"

  New-Item "$VENV\.installed" -ItemType File | Out-Null
}

python -c "import torch;print('[voice] CUDA disponível:', torch.cuda.is_available(), '|', (torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'))"
Write-Host '[voice] servindo em http://127.0.0.1:8765  (Ctrl+C para parar)'
uvicorn server:app --host 127.0.0.1 --port 8765
