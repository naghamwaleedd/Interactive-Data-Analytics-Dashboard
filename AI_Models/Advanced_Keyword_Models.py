import yake
from collections import Counter
from keybert import KeyBERT
from sklearn.feature_extraction.text import CountVectorizer, ENGLISH_STOP_WORDS
import re
import nltk
from nltk.corpus import stopwords
import arabic_reshaper
from bidi.algorithm import get_display
from sentence_transformers import SentenceTransformer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from deep_translator import GoogleTranslator

#----- Clean the text--------
# Make sure you have stopwords downloaded once
#nltk.download('stopwords')



def clean_arabic_sentence(sentence):
    # Common Arabic prepositions and stopwords
    arabic_stopwords = [
    "في", "على", "من", "إلى", "عن", "مع", "حتى", "ك", "ل", "التي", "الذي",
    "و", "إن", "أن", "لا", "ما", "هذا", "هذه", "هناك", "هو", "هي", "قد", "تماما",
    "انا", "غير", "كدة", "كده", "لدي", "ليس", "ولكن", "جدا", "تمام", "أكتر", "لقد", "بي",
    "كل", "أي", "أو", "بين", "بعد", "قبل"
    ]
    # 1. Remove diacritics
    sentence = re.sub(r'[\u0617-\u061A\u064B-\u0652]', '', sentence)
    
    # 2. Remove punctuation and symbols
    sentence = re.sub(r'[^\w\s]', '', sentence)
    
    # 3. Remove extra spaces
    sentence = re.sub(r'\s+', ' ', sentence).strip()
    
    # 4. Remove stopwords / prepositions
    words = sentence.split()
    words = [w for w in words if w not in arabic_stopwords]
    
    return " ".join(words)

# ---- Advanced YAKE keyword extraction ----

def extract_keywords_yake(text, max_ngram_size=1, score_threshold=0.2):
    """
    Extract keywords from a single text using YAKE.
    
    Args:
        text (str): Input text string
        max_ngram_size (int): Maximum n-gram size
        score_threshold (float): Max YAKE score to keep keyword
    
    Returns:
        list[str]: Keywords extracted from the text
    """
    if not text.strip():
        return []
    
    text = clean_arabic_sentence(text)
    text = combine_arabic(text)

    # Extract keywords
    kw_extractor = yake.KeywordExtractor(n=max_ngram_size, top=1000)
    keywords = kw_extractor.extract_keywords(text)

    # Filter by score threshold and normalize to lowercase
    filtered = [kw[0].lower() for kw in keywords if kw[1] <= score_threshold]

    # Fallback: if nothing passed threshold, take best one
    if not filtered and keywords:
        filtered = [keywords[0][0].lower()]

    return filtered

# ---- Add KeyBert keyword extraction(fully dynamically EL MAFROOD) ----

# Initialize KeyBERT model once (can be reused)

kw_model = KeyBERT()

def extract_keywords_keybert(text, min_score=0.4, max_ngram_size=1):
    """
    Extract keywords from a single text using KeyBERT.
    
    Args:
        text (str): Input text string
        max_ngram_size (int): Maximum size of keyword phrases
        min_score (float): Minimum similarity score to keep a keyword (dynamic threshold)
    
    Returns:
        list[str]: Keywords extracted from the text
    """
    if not text.strip():
        return []

    # Extract keywords
    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, max_ngram_size),
    )

    # Filter by minimum score (dynamic relevance)
    filtered = [kw[0].lower() for kw in keywords if kw[1] >= min_score]

    # Fallback: if nothing passed min_score, take top 1
    if not filtered and keywords:
        filtered = [keywords[0][0]]

    return filtered

def combine_arabic(text):
    # Step 1: Join letters of each word (preserve spaces between words)
    words = text.split()
    fixed_text = " ".join(["".join(list(word)) for word in words])

    # Step 2: Reshape (fixes letter forms: isolated, start, middle, end)
    reshaped_text = arabic_reshaper.reshape(fixed_text)

    # Step 3: Apply BiDi algorithm (fixes left-to-right reversal issue)
    bidi_text = get_display(reshaped_text)

    return bidi_text


def get_sentiment_score(text):
    if re.search(r'[\u0600-\u06FF]', text):
        text = GoogleTranslator(source='ar', target='en').translate(text)
    analyzer = SentimentIntensityAnalyzer()
    score = analyzer.polarity_scores(text)['compound']
    sentiment_score = int((score + 1) * 4)  # Transforming from -1..1 to 0..8
    sentiment_text = ""
    if sentiment_score in range(0, 3):
        sentiment_text = "Bad"
    elif sentiment_score in range(3, 6):
        sentiment_text = "Neutral"
    else:
        sentiment_text = "Good"
    
    # Return dict instead of tuple
    return {
        "Score": sentiment_score,
        "Sentiment": sentiment_text
    }

'''
def get_sentiment_score_arabic(text):
    # Load the Arabic sentiment analyzer
    analyzer = SentimentAnalyzer.pretrained()
    
    # Predict sentiment: "positive", "negative", or "neutral"
    result = analyzer.predict(text)
    sentiment_text = ""

    if result == "negative":
        sentiment_text = "Bad"
    elif result == "neutral":
        sentiment_text = "Neutral"
    else:  # positive
        sentiment_text = "Good"

    return {"Sentiment": sentiment_text}
'''    

if __name__ == "__main__":

    '''
    texts = [
    "My internet connection keeps dropping every few minutes, it’s very frustrating",
    "Customer service is not answering my calls, I have been on hold for 30 minutes",
    "I am unable to make calls, the network signal is always weak in my area",
    "The 4G speed is very slow, even basic browsing takes forever",
    "I was charged extra on my bill this month and I don’t understand why",
    "Your technician promised to visit yesterday but no one showed up",
    "My WiFi keeps disconnecting whenever multiple devices are connected",
    "I paid my bill but the service is still showing as suspended",
    "The customer care agents keep transferring me without solving my issue",
    "I cannot send text messages, they always fail to deliver",
    "Every time there is bad weather, my internet goes completely down",
    "The landline phone is not working since last week",
    "I asked for fiber installation but the process is taking too long",
    "There are frequent network outages during the night",
    "Roaming charges were added to my bill even though I never traveled abroad",
    "My internet usage is always miscalculated, I get overcharged every time",
    "The mobile app is not showing my correct balance or data usage",
    "The service upgrade you promised has not been applied to my account",
    "My router gets very hot and the internet disconnects randomly",
    "I receive spam messages daily from your company which is very annoying",
    "The call quality is terrible, voices keep cutting in and out",
    "Why do I keep getting disconnected during online meetings?",
    "I tried resetting my modem but it didn’t solve the issue",
    "My account was deactivated without any notice, please fix it immediately",
    "The billing department never responds to emails, it’s very unprofessional",
    "Your website is down, I cannot log in to pay my bill",
    "I was promised unlimited data but my speed gets reduced after a few GB",
    "There is always congestion in the evenings, the network becomes unusable",
    "The technician replaced my router but the problem still exists",
    "I filed a complaint last week but no one has contacted me yet",
    "My SIM card stopped working suddenly and I can’t make calls",
    "Every time I call customer care, they just say 'we are working on it' but nothing changes",
    "The data packages are too expensive compared to other companies",
    "I am getting calls from unknown numbers ever since I joined your service",
    "Please cancel my subscription, I am not happy with your internet speed"
    ]

    texts = [
    "الإنترنت بطيء جدًا ومش ثابت",
    "السرعة كويسة لكن ساعات بتقطع",
    "الشبكة بتفصل كتير ومش بلاقي إشارة كويسة",
    "الإشارة ضعيفة جوه البيت",
    "خدمة العملاء مش بترد بسرعة",
    "الموظفين مش بيساعدوا كويس",
    "التعامل كان محترم وسريع",
    "اتحلت مشكلتي بسهولة",
    "الأسعار عالية بالنسبة للخدمة",
    "الباقة بتخلص بسرعة جدًا",
    "الفاتورة مش واضحة ومش مفهومة",
    "العروض حلوة ومناسبة",
    "الخدمة ضعيفة وقت الزحمة",
    "الإنترنت تمام ومش بلاقي مشاكل",
    "التغطية حلوة ومش بلاقي انقطاع"
    ]
    '''

    
    texts = [
    "I was charged extra on my bill this month and I don’t understand why",
    "Your technician promised to visit yesterday but no one showed up",
    "My WiFi keeps disconnecting whenever multiple devices are connected",
    "I paid my bill but the service is still showing as suspended"
    ]
    

    texts = [
    "لو فى حد قدم وجهة نظر لتحسين الخدمه والشركه قامت بيها مش كنت هلغى الاشتراك",
    "غير راضي",
    "راضي جدا",
    "انا راضي عن مستوى خدمة العملاء في الشركة",
    "انا راضي"
    ]

    

    all_keywords = []

    for text in texts:
        if not text.strip():
            continue

        if re.search(r'[\u0600-\u06FF]', text):
            keywords = extract_keywords_yake(text)
        else:  
            keywords = extract_keywords_keybert(text)

        all_keywords.extend(keywords)

    # Aggregate counts
    counts = Counter(all_keywords)
    output = [{"Keyword": kw, "Count": count} for kw, count in counts.items()]
    print(output)
    
    text = "ممتاز"
    print(get_sentiment_score(text))