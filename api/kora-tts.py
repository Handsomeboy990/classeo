"""Kora's French voice: Piper, voice fr_FR-siwis-medium, the same on every device.

A Vercel Python function (file based, next to the Next.js app), called only
by the Next.js route /api/voix on the server, never by a browser: POST
{"text": "..."} with the header X-Kora-Key, answer a 16 bit mono WAV.

The key is KORA_TTS_SECRET when set, otherwise an HMAC of SESSION_SECRET
(the same derivation as src/lib/voice/piper.ts), so no new secret is needed.

The model (63 MB) is not in git: it is fetched from a pinned revision of
rhasspy/piper-voices on the first request of an instance, checked against its
sha256, kept in /tmp and reused by every later request of that instance.
Bundling it would push the function over the 225 MB mark past which Vercel
installs Python packages at each cold start instead, which costs more.

Model credit: Piper voice fr_FR-siwis-medium, trained on the SIWIS French
speech synthesis database (University of Edinburgh), CC BY 4.0.
"""

import hashlib
import hmac
import io
import json
import os
import tempfile
import threading
import time
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler

VOICE = "fr_FR-siwis-medium"
REVISION = "c10ece1aade47bb51c153c893d14e5bf8e5b7117"
BASE_URL = f"https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}/fr/fr_FR/siwis/medium/"
FILES = {
    f"{VOICE}.onnx": "641d1ab097da2b81128c076810edb052b385decc8be3381814802a64a73baf99",
    f"{VOICE}.onnx.json": "39479916c2db192b5ac9764daddd0c744d83e023ad890c6976c0633ae4df8959",
}
# The pace the owner chose: a little slower than the model's default, with a
# short pause between sentences. Part of the cache key on the Next.js side.
LENGTH_SCALE = 1.1
SENTENCE_SILENCE = 0.25
MAX_TEXT = 1000
MAX_BODY = 16_000
VOICE_DIR = os.environ.get("KORA_VOICE_DIR") or os.path.join(tempfile.gettempdir(), "kora-voice")

_lock = threading.Lock()
_voice = None


def _expected_key() -> bytes:
    explicit = os.environ.get("KORA_TTS_SECRET", "")
    if explicit:
        return explicit.encode()
    secret = os.environ.get("SESSION_SECRET", "")
    if len(secret) < 32:
        return b""
    return hmac.new(secret.encode(), b"kora-tts", hashlib.sha256).hexdigest().encode()


def _fetch(name: str, sha256: str) -> str:
    path = os.path.join(VOICE_DIR, name)
    if os.path.exists(path):
        return path
    os.makedirs(VOICE_DIR, exist_ok=True)
    digest = hashlib.sha256()
    fd, partial = tempfile.mkstemp(dir=VOICE_DIR)
    try:
        with os.fdopen(fd, "wb") as out, urllib.request.urlopen(BASE_URL + name, timeout=60) as res:
            while chunk := res.read(1 << 20):
                digest.update(chunk)
                out.write(chunk)
        if digest.hexdigest() != sha256:
            raise RuntimeError(f"{name}: sha256 mismatch")
        os.replace(partial, path)
    finally:
        if os.path.exists(partial):
            os.remove(partial)
    return path


def _load():
    global _voice
    with _lock:
        if _voice is None:
            from piper import PiperVoice

            model = _fetch(f"{VOICE}.onnx", FILES[f"{VOICE}.onnx"])
            config = _fetch(f"{VOICE}.onnx.json", FILES[f"{VOICE}.onnx.json"])
            _voice = PiperVoice.load(model, config_path=config)
        return _voice


def synthesise(text: str) -> bytes:
    from piper import SynthesisConfig

    voice = _load()
    silence = bytes(int(voice.config.sample_rate * SENTENCE_SILENCE) * 2)
    buffer = io.BytesIO()
    written = False
    with wave.open(buffer, "wb") as wav:
        for i, chunk in enumerate(voice.synthesize(text, SynthesisConfig(length_scale=LENGTH_SCALE))):
            if not written:
                wav.setframerate(chunk.sample_rate)
                wav.setsampwidth(chunk.sample_width)
                wav.setnchannels(chunk.sample_channels)
                written = True
            if i > 0:
                wav.writeframes(silence)
            wav.writeframes(chunk.audio_int16_bytes)
        if not written:
            raise ValueError("nothing to say")
    return buffer.getvalue()


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, message: str):
        self._send(status, json.dumps({"error": message}).encode())

    def do_GET(self):
        self._error(405, "POST only")

    def do_POST(self):
        expected = _expected_key()
        given = (self.headers.get("X-Kora-Key") or "").encode()
        if not expected or not hmac.compare_digest(given, expected):
            return self._error(403, "forbidden")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._error(400, "invalid body")
        try:
            text = json.loads(self.rfile.read(length)).get("text")
        except (ValueError, AttributeError):
            return self._error(400, "invalid body")
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
            return self._error(400, "invalid text")
        started = time.monotonic()
        try:
            audio = synthesise(text)
        except ValueError:
            return self._error(422, "nothing to say")
        except Exception as error:  # noqa: BLE001 - reported to the caller, which falls back
            print("kora-tts failed:", type(error).__name__, error)
            return self._error(503, "voice unavailable")
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Kora-Voice", VOICE)
        self.send_header("X-Kora-Ms", str(int((time.monotonic() - started) * 1000)))
        self.end_headers()
        self.wfile.write(audio)
