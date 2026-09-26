"""Serves api/kora-tts.py locally, for development and the end to end suite.

Usage: python scripts/kora-tts-local.py [port]   (default 8765), in a
virtual environment holding requirements.txt; then set
KORA_TTS_URL=http://127.0.0.1:8765 and the same KORA_TTS_SECRET for both.
"""

import importlib.util
import os
import sys
from http.server import ThreadingHTTPServer

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("kora_tts", os.path.join(root, "api", "kora-tts.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f"kora-tts on http://127.0.0.1:{port}")
ThreadingHTTPServer(("127.0.0.1", port), module.handler).serve_forever()
