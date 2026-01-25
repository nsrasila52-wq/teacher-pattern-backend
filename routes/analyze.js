const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const generatePredictionSentence = require("../utils/predictionGenerator");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ===============================
   TOPIC KEYWORDS
================================ */
const TOPIC_KEYWORDS = {
  Trigonometry: ["sin", "cos", "tan"],
  Algebra: ["quadratic", "polynomial", "matrix"],
  Calculus: ["derivative", "integral", "limit"],
  Probability: ["probability", "random"],
  Programming: ["function", "loop", "array"],
  Genetics: ["dna", "gene", "inheritance"]
};

/* ===============================
   QUESTION EXTRACTOR
================================ */
function extractQuestions(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l =>
      l.length > 25 &&
      (
        l.endsWith("?") ||
        l.toLowerCase().startsWith("find") ||
        l.toLowerCase().startsWith("calculate") ||
        l.toLowerCase().startsWith("derive") ||
        l.toLowerCase().startsWith("prove")
      )
    );
}

/* ===============================
   NORMALIZE QUESTION
================================ */
function normalizeQuestion(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ===============================
   ROUTE
================================ */
router.post("/analyze", upload.array("pdfs"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDFs uploaded" });
    }

    let topicCount = {};
    let questionMap = {};
    let totalPapers = req.files.length;

    /* ========== PDF LOOP ========== */
    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = data.text.toLowerCase();

      // topics
      Object.entries(TOPIC_KEYWORDS).forEach(([topic, keys]) => {
        keys.forEach(k => {
          if (text.includes(k)) {
            topicCount[topic] = (topicCount[topic] || 0) + 1;
          }
        });
      });

      // questions
      const questions = extractQuestions(data.text);
      questions.forEach(q => {
        const norm = normalizeQuestion(q);
        if (!questionMap[norm]) {
          questionMap[norm] = {
            original: q,
            count: 1
          };
        } else {
          questionMap[norm].count += 1;
        }
      });
    }

    /* ===============================
       REPEATED QUESTIONS
    ================================ */
    const repeatedQuestions = Object.values(questionMap)
      .filter(q => q.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(q => ({
        question: q.original,
        repeated: q.count
      }));

    /* ===============================
       TOPICS + PROBABILITY
    ================================ */
    const totalTopicHits = Object.values(topicCount).reduce((a, b) => a + b, 0);

    const topTopics = Object.entries(topicCount)
      .map(([topic, count]) => ({
        topic,
        probability: Math.round((count / totalTopicHits) * 100)
      }))
      .filter(t => t.probability >= 5)
      .sort((a, b) => b.probability - a.probability);

    const topPrediction = topTopics[0];

    const predictionSentence = generatePredictionSentence({
      topic: topPrediction.topic,
      appearedCount: topicCount[topPrediction.topic],
      totalPapers,
      probabilityPercent: topPrediction.probability
    });

    /* ===============================
       FINAL RESPONSE
    ================================ */
    res.json({
      total_papers: totalPapers,
      prediction_sentence: predictionSentence,
      prediction: topPrediction,
      top_topics: topTopics,
      repeated_questions: repeatedQuestions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
