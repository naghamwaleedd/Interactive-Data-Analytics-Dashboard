import tkinter as tk
from threading import Thread
import whisper
import pyaudio
import wave
import tempfile
import os
import time
import yake
import numpy as np
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import arabic_reshaper
from bidi.algorithm import get_display
import re
import nltk
from nltk.corpus import stopwords
from collections import Counter
from keybert import KeyBERT
from sklearn.feature_extraction.text import CountVectorizer
from langdetect import detect
from deep_translator import GoogleTranslator

class WhisperSpeechRecognizer:
    def __init__(self, model_size="small"):
        self.model = whisper.load_model(model_size)
        self.should_stop = False

    def record_and_transcribe(self, language):
        self.should_stop = False
        p = pyaudio.PyAudio()
        stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000,
                        input=True, frames_per_buffer=1024)

        frames = []
        print(f"Start speaking in {language}...")

        try:
            while not self.should_stop:
                data = stream.read(1024, exception_on_overflow=False)
                frames.append(data)
                time.sleep(0.01)
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()

        temp_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_file = f.name
                wf = wave.open(f.name, 'wb')
                wf.setnchannels(1)
                wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
                wf.setframerate(16000)
                wf.writeframes(b''.join(frames))
                wf.close()

            print("Starting Whisper transcription...")
            result = self.model.transcribe(temp_file, language=language)
            transcribed_text = result["text"]

            return {"text": transcribed_text, "audio_bytes": b''.join(frames)}

        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception as e:
                    print(f"Error removing temporary file {temp_file}: {e}")

#----- Clean the text--------
# Make sure you have stopwords downloaded once
#nltk.download('stopwords')

stop_words = set(stopwords.words("english"))

def clean_texts(texts):
    """
    Clean a list of texts.
    
    Steps:
      - Lowercase
      - Remove punctuation, numbers, special characters
      - Remove stopwords
    
    Args:
        texts (list[str]): List of text strings
    
    Returns:
        list[str]: A list of cleaned text strings.
    """
    results = []

    for text in texts:
        # Lowercase
        text = text.lower()

        # Remove punctuation, numbers, special chars (keep only letters & spaces)
        text = re.sub(r'[^a-z\s]', '', text)

        # Remove stopwords (do it word by word, then join back)
        text = " ".join([word for word in text.split() if word not in stop_words])

        results.append(text)

    return results

# ---- Add YAKE keyword extraction ----
def extract_keyword_yake(text, top_n=1, max_ngram_size=1):
    """Extract the most relevant keyword(s) using YAKE."""
    if not text.strip():
        return None
    
    # Initialize YAKE keyword extractor
    kw_extractor = yake.KeywordExtractor(n=max_ngram_size, top=top_n)
    keywords = kw_extractor.extract_keywords(text)
    
    if keywords:
        # keywords is a list of (keyword, score) → return best keyword(s)
        return [kw[0] for kw in keywords]
    return None

# ---- Advanced YAKE keyword extraction ----

def extract_keywords_yake_auto_aggregate(texts, max_ngram_size=1, score_threshold=0.1):
    """
    Extract keywords from a list of texts using YAKE and aggregate them.
    Returns a list of dicts with 'Keyword' and 'Count' keys.
    Case-insensitive: 'Internet' and 'internet' are counted together.
    """
    all_keywords = []

    for text in texts:
        if not text.strip():
            continue

        # Extract keywords
        kw_extractor = yake.KeywordExtractor(n=max_ngram_size, top=50)
        keywords = kw_extractor.extract_keywords(text)

        # Filter by score threshold and normalize to lowercase
        filtered = [kw[0].lower() for kw in keywords if kw[1] <= score_threshold]

        # Fallback: if nothing passed threshold, take best one (also lowercase)
        if not filtered and keywords:
            filtered = [keywords[0][0].lower()]

        all_keywords.extend(filtered)

    # Count occurrences of keywords
    counts = Counter(all_keywords)

    # Convert to list of dicts for JSON
    return [{"Keyword": kw, "Count": count} for kw, count in counts.items()]
'''
"Texts"= ["Internet connection is very bad", 
            "Customer service are not responding",
            "I have problems with internet"]
'''

# ---- Add KeyBert keyword extraction(fully dynamically EL MAFROOD) ----

# Initialize KeyBERT model once (can be reused)

kw_model = KeyBERT()

def extract_keywords_keybert_dynamic(texts, max_ngram_size=2, min_score=0.3):
    """
    Fully dynamic keyword extraction using KeyBERT.
    No top_n specified; KeyBERT decides the suitable keywords per text.
    
    Args:
        texts (list[str]): List of input text strings
        max_ngram_size (int): Maximum size of keyword phrases
        min_score (float): Minimum similarity score to keep a keyword (dynamic threshold)
    
    Returns:
        list of tuples: (keyword, count) across all texts
    """
    all_keywords = []

    for text in texts:
        if not text.strip():
            continue

        # Generate candidate n-grams for the text
        vectorizer = CountVectorizer(ngram_range=(1, max_ngram_size),
                                     stop_words='english').fit([text])
        candidates = list(vectorizer.get_feature_names_out())

        if not candidates:
            continue

        # Extract keywords with their semantic scores (similarity to whole text)
        keywords = kw_model.extract_keywords(text, keyphrases=candidates, use_maxsum=True, stop_words=None)

        # Filter by minimum score (dynamic relevance)
        filtered = [kw[0] for kw in keywords if kw[1] >= min_score]

        # Fallback: if nothing passed min_score, take top 1
        if not filtered and keywords:
            filtered = [keywords[0][0]]

        all_keywords.extend(filtered)

    # Aggregate counts
    counts = Counter(all_keywords)
    return list(counts.items())

# ---- Sentiment Analysis ----

# Text sentiment

def get_sentiment_score(text):
    language = detect(text)
    if language == "ar":
        text = GoogleTranslator(source='ar', target='en').translate(text)
    analyzer = SentimentIntensityAnalyzer()
    score = analyzer.polarity_scores(text)['compound']
    sentiment_score = int((score + 1) * 4.5)  # Transforming from -1..1 to 0..9
    sentiment_text = ""
    if sentiment_score in range(0, 3):
        sentiment_text = "Bad"
    elif sentiment_score in range(3, 7):
        sentiment_text = "Neutral"
    else:
        sentiment_text = "Good"
    
    # Return dict instead of tuple
    return {
        "Score": sentiment_score,
        "Sentiment": sentiment_text
    }

'''
def analyze_sentiment(text, audio_data):
    """Combine text polarity and tone (energy-based) into sentiment label."""
    if not text:
        return "Neutral"
    
    blob = TextBlob(text)
    text_sentiment = blob.sentiment.polarity  # -1 to +1

    # Tone sentiment (volume)
    audio_array = np.frombuffer(audio_data, dtype=np.int16)
    energy = np.mean(np.abs(audio_array)) / 32768
    tone_score = energy * 2 - 1  # -1 to +1

    # Weighted combination
    total_score = 0.8 * text_sentiment + 0.2 * tone_score
    if -1 < total_score <= -0.8:
        return "0, Negative"
    elif -0.8 < total_score <= -0.6:
        return "1, Negative"
    elif -0.6 < total_score <= -0.4:
        return "2, Negative"
    elif -0.4 < total_score <= -0.2:
        return "3, Negative"
    elif -0.2 < total_score <= 0:
        return "4, Neutral"
    elif 0 < total_score <= 0.2:
        return "5, Neutral"
    elif 0.2 < total_score <= 0.4:
        return "6, Positive"
    elif 0.4 < total_score <= 0.6:
        return "7, Positive"
    elif 0.6 < total_score <= 0.8:
        return "8, Positive"
    elif 0.8 < total_score <= 1:
        return "9, Positive"
'''
# ---- GUI Functions ----
def start_recording():
    def run():
        lang = selected_lang.get()
        result = recognizer.record_and_transcribe(language=lang)
        raw_text = result["text"]       
        audio_data = result["audio_bytes"]

        keyword = extract_keyword_yake(raw_text)  # use RAW text for YAKE
        sentiment = get_sentiment_score(raw_text) #calculated using library
        #sentiment = analyze_sentiment(raw_text, audio_data) #Manual implementation

        if lang == "ar":
            text = combine_arabic(raw_text)        # reshape transcription
            keyword_text = combine_arabic(keyword[0])  # reshape keyword
        else:
            text = raw_text
            keyword_text = keyword

        # Console print
        print(f"Whisper transcription ({lang}):", text)
        print("Keyword:", keyword_text)
        print("Sentiment:", sentiment)

        # Update GUI
        result_label.config(text=text)

    Thread(target=run).start()


def combine_arabic(text):
    # Step 1: Join letters of each word (preserve spaces between words)
    words = text.split()
    fixed_text = " ".join(["".join(list(word)) for word in words])

    # Step 2: Reshape (fixes letter forms: isolated, start, middle, end)
    reshaped_text = arabic_reshaper.reshape(fixed_text)

    # Step 3: Apply BiDi algorithm (fixes left-to-right reversal issue)
    bidi_text = get_display(reshaped_text)

    return bidi_text

def stop_recording():
    recognizer.should_stop = True

# ---- Tkinter GUI ----
if __name__ == "__main__":
    print("Loading Whisper model...")
    recognizer = WhisperSpeechRecognizer()
    root = tk.Tk()
    root.title("Whisper Speech Recognizer")
    root.geometry("500x400")
    root.configure(bg="white")

    # Language selector
    selected_lang = tk.StringVar(value="en")  # default English
    lang_dropdown = tk.OptionMenu(root, selected_lang, "en", "ar")
    lang_dropdown.config(font=("Arial", 12))
    lang_dropdown.pack(pady=10)

    # Start button
    start_canvas = tk.Canvas(root, width=200, height=120, bg="white", highlightthickness=0)
    start_circle = start_canvas.create_oval(10, 10, 110, 110, fill="green", outline="")
    start_text = start_canvas.create_text(60, 60, text="Start\nRecording", fill="white",
                                        font=("Arial", 10, "bold"), justify="center")
    start_canvas.pack(side="left", padx=40, pady=20)
    start_canvas.tag_bind(start_circle, "<Button-1>", lambda e: start_recording())
    start_canvas.tag_bind(start_text, "<Button-1>", lambda e: start_recording())

    # Stop button
    stop_canvas = tk.Canvas(root, width=200, height=120, bg="white", highlightthickness=0)
    stop_circle = stop_canvas.create_oval(10, 10, 110, 110, fill="red", outline="")
    stop_text = stop_canvas.create_text(60, 60, text="Stop\nRecording", fill="white",
                                        font=("Arial", 10, "bold"), justify="center")
    stop_canvas.pack(side="right", padx=40, pady=20)
    stop_canvas.tag_bind(stop_circle, "<Button-1>", lambda e: stop_recording())
    stop_canvas.tag_bind(stop_text, "<Button-1>", lambda e: stop_recording())

    # Result label
    result_label = tk.Label(root, text="", wraplength=450, justify="left",
                            font=("Arial", 12), bg="white")
    result_label.pack(pady=20)

    root.mainloop()
