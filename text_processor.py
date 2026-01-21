# text_processor.py
import re
from collections import defaultdict

QUESTION_STARTERS = (
    "state","define","prove","find","determine",
    "solve","show","explain","write","calculate"
)

SUBJECT_KEYWORDS = {
    "Maths": ["set","subset","matrix","integral","derivative"],
    "Physics": ["force","motion","velocity","acceleration","energy"],
    "Chemistry": ["mole","reaction","acid","base"]
}

TOPIC_MAP = {
    "Maths": {
        "Set Theory": ["set","subset"],
        "Calculus": ["limit","integral","derivative"]
    },
    "Physics": {
        "Mechanics": ["force","motion","velocity","acceleration"]
    }
}

def is_valid_question(line: str) -> bool:
    if len(line) < 12:
        return False

    lower = line.lower()

    # question verbs anywhere in line (OCR safe)
    if not any(v in lower for v in QUESTION_STARTERS):
        return False

    # maths / physics indicators
    if any(x in lower for x in ["=", " if ", " value", "law", "motion", "x", "y"]):
        return True

    # theory questions
    if any(x in lower for x in ["define", "state", "explain", "prove"]):
        return True

    return False



def process_extracted_text(raw_text: str):
    lines = raw_text.split("\n")
    bucket = defaultdict(list)

    for line in lines:
        clean = re.sub(r"\s+"," ",line).strip()
        if not is_valid_question(clean):
            continue

        subject = "Unknown"
        for s, kws in SUBJECT_KEYWORDS.items():
            if any(k in clean.lower() for k in kws):
                subject = s
                break

        topic = "General"
        if subject in TOPIC_MAP:
            for t, kws in TOPIC_MAP[subject].items():
                if any(k in clean.lower() for k in kws):
                    topic = t
                    break

        bucket[(subject, topic)].append(clean)

    result = []
    for (s,t), qs in bucket.items():
        result.append({
            "subject": s,
            "topic": t,
            "appeared_in_papers": 1,
            "total_questions": len(qs),
            "probability": 100,
            "questions": qs
        })

    return result
