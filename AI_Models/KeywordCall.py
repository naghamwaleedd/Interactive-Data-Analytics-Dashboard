import sys
import json
from Advanced_Keyword_Models import extract_keywords_keybert, extract_keywords_yake
import re
from collections import Counter  
from arabic_reshaper import reshape
from bidi.algorithm import get_display

# ✅ Force stdout to use UTF-8 (fixes UnicodeEncodeError on Windows)
sys.stdout.reconfigure(encoding='utf-8')

# Read JSON input from stdin
input_json = sys.stdin.read()

try:
    texts = json.loads(input_json)
except json.JSONDecodeError:
    texts = []

all_keywords = []

for text in texts:
    if not text.strip():
        continue

    if re.search(r'[\u0600-\u06FF]', text):  # detect Arabic
        keywords = extract_keywords_yake(text)
    else:  
        keywords = extract_keywords_keybert(text)

    all_keywords.extend(keywords)

# Aggregate counts
counts = Counter(all_keywords)

output = [{"Keyword": get_display(reshape(kw)), "Count": count} 
          for kw, count in counts.items()]

print(json.dumps(output, ensure_ascii=False))

