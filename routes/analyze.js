const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT KEYWORDS (10 + 12)
========================= */
const SUBJECT_KEYWORDS = {
  Mathematics: [
    "algebra","trigonometry","calculus","geometry","integration",
    "derivative","limit","equation","matrix","vector","probability",
    "statistics","mensuration","logarithm","coordinate"
  ],
  Physics: [
    "current","electricity","magnetism","optics","ray","wave",
    "energy","work","force","motion","gravitation","thermodynamics",
    "heat","mirror","lens"
  ],
  Chemistry: [
    "organic","inorganic","physical","acid","base","salt",
    "reaction","mole","stoichiometry","bond","electrochemistry",
    "oxidation","reduction"
  ],
  Biology: [
    "cell","genetics","dna","rna","photosynthesis","respiration",
    "evolution","ecology","reproduction","enzyme","protein"
  ],
  ComputerScience: [
    "algorithm","programming","python","java","c++",
    "database","sql","loop","array","stack","queue"
  ],
  Commerce: [
    "account","accounting","profit","loss","balance",
    "ledger","journal","economics","demand","supply","market"
  ]
};

/* =========================
   HELPERS
========================= */
const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s?.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isInstructionLine = (line) => {
  return (
    line.includes("section") ||
    line.includes("instructions") ||
    line.includes("time") ||
    line.includes("marks") ||
    line.includes("attempt") ||
    line.length < 35
  );
};

const isRealQuestion = (line) => {
  return (
    line.includes("?") ||
    line.match(/\b(find|calculate|derive|explain|prove|show)\b/)
  );
};

const detectQuestionType = (line) => {
  if (line.match(/\bcalculate|find|value|numerical\b/)) return "Numerical";
  if (line.match(/\bderive|prove\b/)) return "Derivation";
  return "Theory";
};

const detectSubject = (line) => {
  let score = {};
  Object.keys(SUBJECT_KEYWORDS).forEach(s => score[s] = 0);

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    keywords.forEach(k => {
      if (line.includes(k)) score[subject]++;
    });
  }

  const sorted = Object.entries(score).sort((a,b)=>b[1]-a[1]);
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

      console.log("📄 RAW TEXT LENGTH:", data.text.length);

      const text = cleanText(data.text);
      const lines = text.split(/\n|\./);

      lines.forEach(line => {
        if (isInstructionLine(line)) return;
        if (!isRealQuestion(line)) return;

        const subject = detectSubject(line);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keywords]) => {
          keywords.forEach(keyword => {
            if (line.includes(keyword)) {
              topicCount[keyword] = (topicCount[keyword] || 0) + 1;
            }
          });
        });

        questionMap[line] = (questionMap[line] || 0) + 1;
      });
    }

    /* =========================
       MAIN SUBJECT
    ========================= */
    const mainSubject =
      Object.entries(detectedSubjects).sort((a,b)=>b[1]-a[1])[0]?.[0] || "General";

    /* =========================
       TOPICS (UNCHANGED LOGIC)
    ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 5)
      .sort((a,b)=>b.probability - a.probability);

    const sum = topics.reduce((a,b)=>a+b.probability,0);
    if (sum !== 100 && topics.length) {
      topics[0].probability += (100 - sum);
    }

    /* =========================
       REPEATED QUESTIONS ONLY
    ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,count]) => count > 1)
      .map(([question,count]) => ({
        question,
        repeated: count,
        type: detectQuestionType(question)
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
      disclaimer: "Prediction is probability-based, not guaranteed."
    });

  } catch (err) {
    console.error("❌ PDF ANALYZE ERROR:", err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
