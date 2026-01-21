import os
import re
import uuid
from typing import List

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfReader
import easyocr

# ===============================
# APP INIT
# ===============================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ocr_reader = easyocr.Reader(["en"], gpu=False)

MIN_QUESTION_LENGTH = 10

# ===============================
# NOISE FILTER
# ===============================
NOISE_PHRASES = [
    "department of education",
    "florida department",
    "national assessment",
    "naep grade",
    "sample questions",
    "introduction",
    "framework",
    "data explorer",
    "office of assessment",
    "score descriptors",
    "for more information",
    "nqt is an interactive tool"
]

def is_noise_line(line: str) -> bool:
    return any(p in line.lower() for p in NOISE_PHRASES)

# ===============================
# QUESTION TYPE DETECTOR
# ===============================
def detect_question_type(question: str) -> str:
    q = question.lower()

    if any(k in q for k in ["prove", "justify", "show that", "verify", "give reason"]):
        return "Proof / Reasoning"

    if any(k in q for k in ["graph", "draw", "plot", "diagram", "histogram"]):
        return "Graph / Diagram"

    if any(k in q for k in [
        "calculate", "find", "determine", "solve",
        "compute", "evaluate", "estimate"
    ]):
        return "Calculation"

    if any(k in q for k in ["define", "state", "explain", "describe", "what is"]):
        return "Theory / Definition"

    if "%" in q or "=" in q:
        return "Calculation"

    return "General"

# ===============================
# HELPERS
# ===============================
def is_probable_question(line: str) -> bool:
    q = line.lower()
    if "?" in q:
        return True

    keywords = [
        "find", "calculate", "determine", "solve",
        "prove", "show", "evaluate", "draw",
        "define", "explain"
    ]
    return any(k in q for k in keywords)

# ===============================
# PREDICTION (STEP 4)
# ===============================
def generate_prediction(topic: str, probability: float):
    if probability >= 60:
        level = "Very High"
        text = f"Very high chances that {topic} based questions will appear again."
    elif probability >= 40:
        level = "High"
        text = f"High chances that {topic} based questions may appear in the exam."
    elif probability >= 20:
        level = "Moderate"
        text = f"Moderate chances of {topic} based questions appearing."
    else:
        level = "Low"
        text = f"Low chances of {topic} based questions."

    return level, text

# ===============================
# CORE ANALYSIS
# ===============================
def analyze_text(lines):
    bucket = {}
    total_papers = set()

    for item in lines:
        line = item["text"].strip()
        paper_id = item["paper_id"]

        total_papers.add(paper_id)

        if len(line) < MIN_QUESTION_LENGTH:
            continue

        if is_noise_line(line):
            continue

        if not is_probable_question(line):
            continue

        qtype = detect_question_type(line)

        if qtype not in bucket:
            bucket[qtype] = {
                "questions": [],
                "papers": set()
            }

        bucket[qtype]["questions"].append(line)
        bucket[qtype]["papers"].add(paper_id)

    # ===============================
    # 🔥 STEP 4.2 – SMART SCORING
    # ===============================
    scored = []

    for qtype, data in bucket.items():
        appeared = len(data["papers"])
        freq = len(data["questions"])

        # 🔻 General penalty
        weight = 0.3 if qtype == "General" else 1.0

        score = appeared * freq * weight

        scored.append({
            "topic": qtype,
            "appeared_in_papers": appeared,
            "total_questions": freq,
            "raw_score": score,
            "questions": data["questions"][:15]
        })

    if not scored:
        return {
            "analysis": [],
            "insight": "No clear pattern detected."
        }

    max_score = max(item["raw_score"] for item in scored)

    analysis = []

    for item in scored:
        probability = round((item["raw_score"] / max_score) * 100, 2)

        level, text = generate_prediction(item["topic"], probability)

        analysis.append({
            "topic": item["topic"],
            "appeared_in_papers": item["appeared_in_papers"],
            "total_questions": item["total_questions"],
            "probability": probability,
            "prediction_level": level,
            "prediction_text": text,
            "questions": item["questions"]
        })

    # 🔥 Best exam insight (non-General preferred)
    insight_source = sorted(
        analysis,
        key=lambda x: (x["topic"] != "General", x["probability"]),
        reverse=True
    )[0]

    return {
        "analysis": analysis,
        "insight": insight_source["prediction_text"]
    }


# ===============================
# PDF UPLOAD
# ===============================
@app.post("/upload")
async def upload_pdfs(files: List[UploadFile] = File(...)):
    all_lines = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue

        paper_id = str(uuid.uuid4())  # ✅ EACH PDF = UNIQUE PAPER

        path = os.path.join(UPLOAD_DIR, file.filename)
        with open(path, "wb") as f:
            f.write(await file.read())

        reader = PdfReader(path)
        for page in reader.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                all_lines.append({
                    "text": line,
                    "paper_id": paper_id
                })

    result = analyze_text(all_lines)

    return {
        "status": "success",
        **result
    }

# ===============================
# IMAGE UPLOAD
# ===============================
@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        return {"status": "error", "message": "Invalid image"}

    paper_id = str(uuid.uuid4())

    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    ocr_lines = ocr_reader.readtext(path, detail=0)

    formatted = [
        {"text": line, "paper_id": paper_id}
        for line in ocr_lines
    ]

    result = analyze_text(formatted)

    return {
        "status": "success",
        **result
    }
