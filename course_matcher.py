import sqlite3
import pickle
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import sys
import json
import numpy as np

# ---------- CONFIG ----------
DB_PATH = "courses.db"
MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDINGS_FILE = "course_embeddings.pkl"
TOP_K = 5
# ----------------------------

def load_courses_from_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, code, name, description FROM courses")
    return cursor.fetchall()

def embed_courses(courses, model):
    texts = [f"{code} - {name}: {desc}" for (_, code, name, desc) in courses]
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings

def save_embeddings(courses, embeddings):
    with open(EMBEDDINGS_FILE, "wb") as f:
        pickle.dump((courses, embeddings), f)

def load_embeddings():
    with open(EMBEDDINGS_FILE, "rb") as f:
        return pickle.load(f)

def get_top_matches(user_input, model, courses, course_embeddings):
    input_embedding = model.encode([user_input], normalize_embeddings=True)
    similarities = cosine_similarity(input_embedding, course_embeddings)[0]
    top_indices = similarities.argsort()[-TOP_K:][::-1]
    matches = []
    for i in top_indices:
        id, code, name, desc = courses[i]
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
        print(json.dumps([]))
        sys.exit(1)

    try:
        model = SentenceTransformer(MODEL_NAME)
        try:
            courses, course_embeddings = load_embeddings()
        except:
            courses = load_courses_from_db()
            course_embeddings = embed_courses(courses, model)
            save_embeddings(courses, course_embeddings)
        
        top_matches = get_top_matches(user_input, model, courses, course_embeddings)
        print(json.dumps(top_matches))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
