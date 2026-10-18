# Private speech backend for AttentionOS

This is **real model inference**, not an audio mock. It is an optional Python service, and **the Vercel website alone cannot run OmniVoice**. Speech requires somewhere to run Python, download model weights, and maintain an HTTPS endpoint reachable by Vercel. No always-free GPU host is assumed.

## Provider routing and license

| Request | Engine | License considerations |
|---|---|---|
| Personal, private JARVIS conversation | OmniVoice when explicitly enabled, otherwise Kokoro | OmniVoice Python code is Apache-2.0, **its pretrained k2-fsa/OmniVoice weights are CC BY-NC**. Private access alone does not guarantee a noncommercial purpose. |
| TrendWale marketing captions / Reels / promotional voice | Kokoro | Official Kokoro-82M weights and inference library are Apache-2.0. |

A commercial request with `provider=omnivoice` is rejected. Only clone a voice with the speaker's explicit permission. Reference WAV files are held temporarily and removed after generation; this service does not persist them.

## Installation (hardware you control)

Python 3.10+ recommended (prefer 3.11 or 3.12), Linux/macOS and network access for initial model download.

```sh
cd services/voice
python -m venv .venv
. .venv/bin/activate
# Install PyTorch for YOUR machine first, following https://pytorch.org/get-started/locally/
pip install torch torchaudio
pip install -r requirements.txt
# Ubuntu/Debian: sudo apt-get install espeak-ng
export VOICE_SERVER_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(40))')"
uvicorn server:app --host 127.0.0.1 --port 8050
```

Kokoro downloads its weights on first synthesis. A CUDA GPU is not required for Kokoro but generation speed depends on CPU, RAM and the size of the model.

Optional OmniVoice for personal/noncommercial requests, on compatible hardware:

```sh
pip install git+https://github.com/k2-fsa/OmniVoice.git
# Or install your own approved/local source folder: pip install -e /path/to/OmniVoice-master
export ENABLE_OMNIVOICE=true
# Not recommended: export ALLOW_OMNIVOICE_CPU=true
uvicorn server:app --host 127.0.0.1 --port 8050
```

OmniVoice loads `k2-fsa/OmniVoice` weights when first used and uses `model.generate(text=...,instruct='male, low pitch, british accent',speed=1.0)` or a consented reference WAV. It can consume substantial memory and startup time. If neither GPU nor opt-in CPU is present, /v1/speak returns 503 for OmniVoice.

## Connect to your private website

Set **server-only** Vercel Environment Variables (Production):

- `VOICE_SERVER_URL`: public **HTTPS** address of *your own, authenticated* model service (e.g. your approved HTTPS reverse proxy). Do **not** use localhost: Vercel cannot reach your phone/PC via localhost. An accessible HTTPS endpoint requires networking and hosting you supply.
- `VOICE_SERVER_TOKEN`: the **same random secret** used by this Python service. Never put it in the browser, GitHub, screenshots, or frontend scripts.

Redeploy the site after setting the environment variables. The Vercel route /api/voice proxies authenticated requests; it never forwards the owner access code or the private model token to the browser. The Python service requires its bearer token on every request and should also be protected behind TLS / a firewall. **Do not expose port 8050 publicly.**

## Examples (on your host)

```sh
curl -H "Authorization: Bearer $VOICE_SERVER_TOKEN" http://127.0.0.1:8050/health
curl -X POST http://127.0.0.1:8050/v1/speak \\
 -H "Authorization: Bearer $VOICE_SERVER_TOKEN" -H 'Content-Type: application/json' \\
 -d '{"text":"At your service, Master.","purpose":"personal","provider":"kokoro","voice":"bm_george","speed":1.0}' \\
 --output sample.wav
```

Default commercial voice: `bm_george`. Alternative: `bm_lewis`. Private OmniVoice: `male, low pitch, british accent`. All audio is 24kHz PCM WAV.

## Status and testing

`python -m compileall server.py` checks syntax but **does not test the pretrained model**. Only report voice operational after /v1/speak returns real generated WAV from an installed provider and a browser plays it. No hardware or free cloud server was provisioned by this repository change.
