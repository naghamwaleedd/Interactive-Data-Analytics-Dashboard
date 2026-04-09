import sys
import json
from Advanced_Keyword_Models import get_sentiment_score

text = sys.argv[1]
result = get_sentiment_score(text)

print(json.dumps(result))



