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
    "algebra","trigonometry","geometry","calculus","integration",
    "derivative","equation","matrix","vector","probability",
    "statistics","mensuration","logarithm","coordinate","graph"
  ],
  Physics: [
    "motion","force","work","energy","power","gravitation",
    "current","electricity","magnetism","optics","lens","mirror",
    "wave","ray","thermodynamics","heat"
  ],
  Chemistry: [
    "acid","base","salt","reaction","mole","stoichiometry",
    "organic","inorganic","periodic","bond","electrochemistry",
    "oxidation","reduction"
  ],
  Biology: [
    "cell","dna","rna","genetics","photosynthesis","respiration",
    "evolution","ecology","reproduction","enzyme","protein"
  ],
  ComputerScience: [
    "algorithm","program","loop","function","array","stack",
    "queue","binary","sql","database","python","java","c++"
  ],
  Commerce: [
    "account","accounting","ledger","journal","balance sheet",
    "profit","loss","business","economics","demand","supply","market"
  ],
  Economics: [
    "microeconomics","macroeconomics","inflation","gdp",
    "national income","demand","supply","elasticity"
  ],
  Psychology: [
    "learning","memory","intelligence","emotion",
    "personality","motivation","behavior","stress"
  ]
};

/* =========================
   HELPERS
========================= */

const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/\r/g, "\n")
    .replace(/[^\w\s?.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isInstructionLine = (line) => {
  return (
    line.length < 40 ||
    line.includes("answer any") ||
    line.includes("attempt any") ||
    line.includes("all questions") ||
    line.includes("section") ||
    line.includes("time allowed") ||
    line.includes("maximum marks") ||
    line.includes("choose the correct")
  );
};

const looksLikeQuestion = (line) => {
  return (
    line.endsWith("?") ||
    line.startsWith("what ") ||
    line.startsWith("why ") ||
    line.startsWith("how ") ||
    line.startsWith("define ") ||
    line.startsWith("explain ") ||
    line.startsWith("derive ") ||
    line.match(/^\d+\./)
  );
};

const normalizeQuestion = (q) =>
  q
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const detectQuestionType = (q) => {
  if (q.includes("calculate") || q.includes("find the value"))
    return "Numerical";
  if (q.includes("derive") || q.includes("prove"))
    return "Derivation";
  return "Theory";
};

const detectSubject = (text) => {
  let scores = {};
  Object.keys(SUBJECT_KEYWORDS).forEach(s => (scores[s] = 0));

  Object.entries(SUBJECT_KEYWORDS).forEach(([subject, keywords]) => {
    keywords.forEach(k => {
      if (text.includes(k)) scores[subject]++;
    });
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
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
    let detectedSubjects = {};
    let questionMap = {};
    let questionTypeMap = {};

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = cleanText(data.text);

      console.log("📄 PDF TEXT SAMPLE:", text.slice(0, 300));

      const lines = text.split(/\n|\?/);

      lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (isInstructionLine(line)) return;
        if (!looksLikeQuestion(line)) return;

        const subject = detectSubject(line);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keywords]) => {
          keywords.forEach(k => {
            if (line.includes(k)) {
              topicCount[k] = (topicCount[k] || 0) + 1;
            }
          });
        });

        const normalized = normalizeQuestion(line);
        questionMap[normalized] = (questionMap[normalized] || 0) + 1;

        const qType = detectQuestionType(line);
        questionTypeMap[qType] = (questionTypeMap[qType] || 0) + 1;
      });
    }

    /* =========================
       SUBJECT FILTER (UNCHANGED)
    ========================= */
    const mainSubject = Object.entries(detectedSubjects)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "General";

    if (mainSubject !== "General") {
      Object.keys(topicCount).forEach(topic => {
        const valid = SUBJECT_KEYWORDS[mainSubject]?.some(k =>
          topic.includes(k)
        );
        if (!valid) delete topicCount[topic];
      });
    }

    /* =========================
       TOPICS PROBABILITY (UNCHANGED)
    ========================= */
    const total = Object.values(topicCount).reduce((a, b) => a + b, 0);

    let topics = Object.entries(topicCount)
      .map(([topic, count]) => ({
        topic,
        count,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 15)
      .sort((a, b) => b.probability - a.probability);

    const probSum = topics.reduce((a, b) => a + b.probability, 0);
    if (topics.length && probSum !== 100) {
      topics[0].probability += 100 - probSum;
    }

    /* =========================
       REPEATED QUESTIONS (FIXED)
    ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_, count]) => count > 1)
      .map(([question, count]) => ({
        question,
        repeated: count
      }));

    /* =========================
       FINAL RESPONSE
    ========================= */
    res.json({
      subject: mainSubject,
      prediction: topics[0]
        ? `Based on analysis of last ${req.files.length} papers, ${topics[0].topic} has ${topics[0].probability}% probability of appearing again.`
        : "Not enough structured data for prediction.",
      topTopics: topics,
      repeatedQuestions,
      questionTypes: questionTypeMap,
      disclaimer: "Prediction is probability-based, not guaranteed."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
