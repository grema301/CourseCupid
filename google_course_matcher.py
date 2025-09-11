import sqlite3
import pickle
import sys
import json
import numpy as np
import os # For API key access
from dotenv import load_dotenv # To load .env file

from google import genai
from google.genai import types
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv() 

# ---------- CONFIG ----------
DB_PATH = "courses.db"
EMBEDDINGS_FILE = "course_embeddings.pkl"
TOP_K = 5
# ----------------------------

# Initialize the Gemini client. It's recommended to set your API key as an environment variable.
try:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    client = genai.Client(api_key=api_key)
except Exception as e:
    print(json.dumps({"error": f"Failed to configure Gemini API: {e}. Ensure GEMINI_API_KEY environment variable is set."}), file=sys.stderr)
    sys.exit(1)

def load_courses_from_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, code, name, description FROM courses")
    return cursor.fetchall()

def embed_courses(courses):
    """
    Generates and returns embeddings for all courses using the Gemini API.
    """
    print("Generating new embeddings with Gemini API...", file=sys.stderr)
    texts = [f"{code} - {name}: {desc}" for (_, code, name, desc) in courses]
    
    try:
        # Use the Gemini Embeddings API to get vectors for all courses
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
        )
        embeddings = np.array([e.values for e in result.embeddings])
        return embeddings
    except Exception as e:
        print(f"Error embedding courses with Gemini API: {e}", file=sys.stderr)
        return None

def save_embeddings(courses, embeddings):
    with open(EMBEDDINGS_FILE, "wb") as f:
        pickle.dump((courses, embeddings), f)
    print(f"Embeddings saved to {EMBEDDINGS_FILE}", file=sys.stderr)

def load_embeddings():
    with open(EMBEDDINGS_FILE, "rb") as f:
        return pickle.load(f)

def get_top_matches(user_input, courses, course_embeddings):
    """
    Gets the top course matches for a user query.
    """
    try:
        # Embed the user's query using the Gemini API
        user_embedding_result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=user_input,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        )
        # Convert the embedding to a numpy array
        input_embedding = np.array(user_embedding_result.embeddings[0].values).reshape(1, -1)
    except Exception as e:
        print(f"Error embedding user input with Gemini API: {e}", file=sys.stderr)
        return []

    similarities = cosine_similarity(input_embedding, course_embeddings)[0]
    top_indices = similarities.argsort()[-TOP_K:][::-1]
    matches = []
    for i in top_indices:
        _, code, name, desc = courses[i]
        matches.append({
            "code": code,
            "name": name,
            "description": desc,
            "similarity": float(similarities[i])
        })
    return matches

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
    else:
        print(json.dumps({"error": "No user input provided."}), file=sys.stderr)
        sys.exit(1)

    try:
        try:
            courses, course_embeddings = load_embeddings()
            print("Successfully loaded existing embeddings.", file=sys.stderr)
        except FileNotFoundError:
            print("Embeddings file not found. Generating new embeddings.", file=sys.stderr)
            courses = load_courses_from_db()
            course_embeddings = embed_courses(courses)
            if course_embeddings is not None:
                save_embeddings(courses, course_embeddings)
            else:
                sys.exit(1)
        
        top_matches = get_top_matches(user_input, courses, course_embeddings)
        print(json.dumps(top_matches))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)