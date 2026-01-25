const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT KEYWORDS
========================= */
const SUBJECT_KEYWORDS = {
  Mathematics: [
    "algebra","trigonometry","calculus","geometry","integration",
    "derivative","limit","equation","matrix","vector","probability",
    "statistics","mensuration","logarithm","coordinate"
  ],
  Physics: [
    "mechanics","motion","force","work","energy","power","gravitation",
    "kinematics","thermodynamics","heat","optics","lens","mirror",
    "current","electricity","magnetism","wave"
  ],
  Chemistry: [
    "organic","inorganic","acid","base","salt",
    "reaction","mole","stoichiometry","periodic","bond",
    "electrochemistry","oxidation","reduction"
  ],
  Biology: [
    "cell","genetics","dna","rna","photosynthesis","respiration",
    "evolution","ecology","reproduction","enzyme","protein"
  ]
};

/* =========================
   HELPERS
========================= */
const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* 🔥 REAL QUESTION EXTRACTOR */
const extractQuestions = (text) => {
  return text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l =>
      l.length > 30 &&
      (
        /^q\d+/i.test(l) ||                 // Q1, Q2
        /^\d+[\).\s]/.test(l) ||            // 1. 2)
        /(explain|define|calculate|prove|derive|find|why|how)/i.test(l)
      )
    );
};

const detectSubject = (text) => {
  let scores = {};
  Object.keys(SUBJECT_KEYWORDS).forEach(s => scores[s] = 0);

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    keywords.forEach(k => {
      if (text.includes(k)) scores[subject]++;
    });
  }

  const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
  return sorted[0][1] === 0 ? "General" : sorted[0][0];
};

/* =========================
   MAIN ROUTE
========================= */
router.post("/analyze", upload.array("pdfs"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDFs uploaded" });
    }

    let topicCount = {};
    let questionMap = {};
    let detectedSubjects = {};

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = cleanText(data.text);

      const questions = extractQuestions(text);

      questions.forEach(question => {
        const subject = detectSubject(question);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([sub, keywords]) => {
          keywords.forEach(keyword => {
            if (question.includes(keyword)) {
              topicCount[keyword] = (topicCount[keyword] || 0) + 1;
              questionMap[question] = (questionMap[question] || 0) + 1;
            }
          });
        });
      });
    }

    /* MAIN SUBJECT */
    const mainSubject =
      Object.entries(detectedSubjects).sort((a,b)=>b[1]-a[1])[0]?.[0] || "General";

    /* TOPICS */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topTopics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 5)
      .sort((a,b)=>b.probability - a.probability);

    const sum = topTopics.reduce((a,b)=>a+b.probability,0);
    if (sum !== 100 && topTopics.length) {
      topTopics[0].probability += (100 - sum);
    }

    /* 🔁 REPEATED QUESTIONS (CORE FEATURE) */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,count]) => count > 1)
      .map(([question,count]) => ({
        question,
        repeated: count
      }))
      .slice(0,15);

    res.json({
      subject: mainSubject,
      prediction: topTopics[0]
        ? `Based on previous papers, "${topTopics[0].topic}" has high chances (${topTopics[0].probability}%) of appearing again.`
        : "Not enough data for prediction.",
      topTopics,
      repeatedQuestions,
      disclaimer: "Prediction is probability-based, not guaranteed."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
