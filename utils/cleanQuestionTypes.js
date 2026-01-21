/**
 * STEP 9.2 – Clean + Merge Question Types
 * Goal:
 * 1. OCR noise remove
 * 2. Very short / broken lines remove
 * 3. Similar questions merge
 * 4. Limit questions per category (UX friendly)
 */

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "") // symbols remove
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningfulQuestion(text) {
  if (!text) return false;

  // remove very short / broken OCR outputs
  if (text.length < 15) return false;

  // must contain at least 3 real words
  const words = text.split(" ").filter(w => w.length > 2);
  if (words.length < 3) return false;

  return true;
}

function cleanQuestionTypes(rawQuestions = []) {
  const seen = new Set();
  const cleaned = [];

  for (let q of rawQuestions) {
    if (typeof q !== "string") continue;

    const trimmed = q.trim();
    if (!isMeaningfulQuestion(trimmed)) continue;

    const normalized = normalizeText(trimmed);

    // similarity check (merge near-duplicate questions)
    let isDuplicate = false;
    for (let seenQ of seen) {
      if (
        normalized.includes(seenQ.slice(0, 30)) ||
        seenQ.includes(normalized.slice(0, 30))
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) continue;

    seen.add(normalized);
    cleaned.push(trimmed);
  }

  // UX safety: limit questions shown
  return cleaned.slice(0, 10);
}

module.exports = cleanQuestionTypes;
