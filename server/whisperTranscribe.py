import argparse
import json
import os
import sys

# Force UTF-8 encoding for stdout/stderr to handle Unicode characters
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import whisper
except ImportError:
    print(json.dumps({"error": "Whisper library not installed"}))
    sys.exit(1)

parser = argparse.ArgumentParser(description="Transcribe audio with OpenAI Whisper")
parser.add_argument("--audio", required=True, help="Path to audio file")
parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"), help="Whisper model name")
parser.add_argument("--language", default=None, help="Optional language code hint")
args = parser.parse_args()

if not os.path.exists(args.audio):
    print(json.dumps({"error": f"Audio file not found: {args.audio}"}))
    sys.exit(2)

try:
    model = whisper.load_model(args.model)
    result = model.transcribe(args.audio, language=args.language, fp16=False)
    output = {
        "text": result.get("text", "").strip(),
        "language": result.get("language"),
        "segments": result.get("segments", []),
        "model": args.model,
    }
    print(json.dumps(output, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"error": str(exc)}))
    sys.exit(3)



