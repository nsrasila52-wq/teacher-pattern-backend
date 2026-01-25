const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT KEYWORDS (10th + 12th)
   ========================= */
const SUBJECT_KEYWORDS = {
  Mathematics: [
    "algebra","trigonometry","calculus","geometry","integration",
    "derivative","limit","equation","matrix","vector","probability",
    "statistics","mensuration","logarithm","coordinate"
  ],
  Physics: [
    "motion","force","laws","work","energy","power","gravitation",
    "kinematics","thermodynamics","heat","optics","lens","mirror",
    "electricity","current","magnetism","wave","ray","numerical"
  ],
  Chemistry: [
    "organic","inorganic","physical","acid","base","salt","reaction",
    "mole","stoichiometry","periodic","bond","electrochemistry",
    "oxidation","reduction"
  ],
  Biology: [
    "cell","genetics","dna","rna","photosynthesis","respiration",
    "evolution","ecology","reproduction","enzyme","protein"
  ],
  Economics: [
    "demand","supply","elasticity","market","cost","revenue",
    "national income","gdp","inflation","economy"
  ],
  Accountancy: [
    "ledger","journal","balance sheet","trial balance",
    "profit","loss","depreciation","capital","liability"
  ],
  BusinessStudies: [
    "management","planning","organising","staffing",
    "directing","controlling","marketing","finance"
  ],
  History: [
    "revolt","movement","dynasty","empire","british",
    "freedom","war","civilization"
  ],
  Geography: [
    "climate","monsoon","soil","river","resources",
    "population","agriculture","industry"
  ],
  PoliticalScience: [
    "constitution","democracy","parliament",
    "election","rights","government"
  ],
  Psychology: [
    "behavior","learning","memory","emotion",
    "personality","intelligence","stress"
  ]
};

/* =========================
   HELPERS
   ========================= */
const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9?\.\n\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ignore instructions / headers */
const isInstructionLine = (line) => {
  return (
    line.includes("section") ||
    line.includes("attempt") ||
    line.includes("instructions") ||
    line.includes("time allowed") ||
    line.length < 30
  );
};

/* real question detection */
const isQuestion = (line) => {
  return (
    line.endsWith("?") ||
    line.startsWith("define") ||
    line.startsWith("explain") ||
    line.startsWith("calculate") ||
    line.startsWith("derive") ||
    line.startsWith("prove") ||
    line.startsWith("what") ||
    line.startsWith("why") ||
    line.startsWith("how")
  );
};

/* question type */
const detectQuestionType = (q) => {
  if (q.includes("calculate") || q.includes("find") || q.includes("numerical"))
    return "Numerical";
  if (q.includes("derive") || q.includes("prove"))
    return "Derivation";
  return "Theory";
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
    let detectedSubjects = {};
    let questionMap = {}; // ONLY questions

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = cleanText(data.text);
      const lines = text.split(/\n|\./);

      lines.forEach(line => {
        line = line.trim();
        if (isInstructionLine(line)) return;

        /* SUBJECT + TOPIC LOGIC (UNCHANGED) */
        Object.entries(SUBJECT_KEYWORDS).forEach(([sub, keywords]) => {
          keywords.forEach(keyword => {
            if (line.includes(keyword)) {
              topicCount[keyword] = (topicCount[keyword] || 0) + 1;
              detectedSubjects[sub] = (detectedSubjects[sub] || 0) + 1;
            }
          });
        });

        /* QUESTION LOGIC (FIXED) */
        if (isQuestion(line)) {
          const normalized = line.replace(/\s+/g, " ").trim();
          if (!questionMap[normalized]) {
            questionMap[normalized] = {
              count: 1,
              type: detectQuestionType(normalized)
            };
          } else {
            questionMap[normalized].count += 1;
          }
        }
      });
    }

    /* =========================
       TOPICS (SAME AS BEFORE)
       ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 15)
      .sort((a,b)=>b.probability - a.probability);

    const probSum = topics.reduce((a,b)=>a+b.probability,0);
    if (probSum !== 100 && topics.length) {
      topics[0].probability += (100 - probSum);
    }

    /* =========================
       REPEATED QUESTIONS ONLY
       ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_, q]) => q.count > 1)
      .map(([question, q]) => ({
        question,
        repeated: q.count,
        type: q.type
      }))
      .slice(0, 20);

    res.json({
      prediction: topics[0]
        ? `Based on analysis of ${req.files.length} papers, ${topics[0].topic} has a high probability (${topics[0].probability}%) of appearing again.`
        : "Not enough data for prediction.",
      topTopics: topics,
      repeatedQuestions,
      disclaimer: "Prediction is probability-based, not guaranteed."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
