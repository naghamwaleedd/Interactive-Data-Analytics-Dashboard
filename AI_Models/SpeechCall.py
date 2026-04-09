import sys
import json
from Yake_Model import WhisperSpeechRecognizer

# Get audio file path from .NET
audio_path = sys.argv[1]

# Reuse the WhisperSpeechRecognizer class
recognizer = WhisperSpeechRecognizer(model_size="small")

# Instead of recording, directly transcribe a given file
result = recognizer.model.transcribe(audio_path)

# Return JSON with the text
print(json.dumps({"Text": result["text"]}))
