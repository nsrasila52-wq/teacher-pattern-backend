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
    "algebra","trigonometry","calculus","geometry","integration","derivative",
    "limit","equation","matrix","vector","probability","statistics","mensuration",
    "logarithm","coordinate","graph"
  ],
  Physics: [
    "current","electric","electricity","ohm","resistance","circuit",
    "force","motion","energy","work","power","gravitation",
    "wave","optics","ray","mirror","lens","magnet","field"
  ],
  Chemistry: [
    "acid","base","salt","reaction","mole","stoichiometry","periodic",
    "bond","organic","inorganic","oxidation","reduction"
  ],
  Biology: [
    "cell","tissue","dna","rna","genetics","evolution","photosynthesis",
    "respiration","enzyme","protein","hormone"
  ],
  ComputerScience: [
    "algorithm","program","loop","array","stack","queue","binary",
    "function","database","sql","python","java"
  ],
  Commerce: [
    "account","accounting","journal","ledger","profit","loss",
    "balance","economics","demand","supply","market"
  ],
  Economics: [
    "demand","supply","elasticity","cost","revenue","market","inflation"
  ],
  Psychology: [
    "behavior","learning","memory","intelligence","emotion","motivation"
  ]
};

/* =========================
   HELPERS
========================= */
const cleanText = (text) =>
  text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const isInstructionLine = (line) => {
  return (
    line.length < 40 ||
    line.includes("answer any") ||
    line.includes("attempt any") ||
    line.includes("all questions") ||
    line.includes("time allowed") ||
    line.includes("maximum marks") ||
    line.includes("section")
  );
};

const looksLikeQuestion = (line) => {
  return (
    line.endsWith("?") ||
    line.match(/^\d+[\).]/) ||
    line.startsWith("what ") ||
    line.startsWith("why ") ||
    line.startsWith("how ") ||
    line.startsWith("define ") ||
    line.startsWith("explain ") ||
    line.startsWith("derive ")
  );
};

const normalizeQuestion = (q) =>
  q
    .replace(/\d+[\).]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
      const rawText = cleanText(data.text);

      const lines = rawText.split(/[\n\.]/);

      lines.forEach(line => {
        if (isInstructionLine(line)) return;
        if (!looksLikeQuestion(line)) return;

        const normalizedQ = normalizeQuestion(line);
        if (normalizedQ.split(" ").length < 6) return;

        questionMap[normalizedQ] =
          (questionMap[normalizedQ] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([subject, keywords]) => {
          keywords.forEach(k => {
            if (normalizedQ.includes(k)) {
              topicCount[k] = (topicCount[k] || 0) + 1;
              detectedSubjects[subject] =
                (detectedSubjects[subject] || 0) + 1;
            }
          });
        });
      });
    }

    /* =========================
       TOPICS (UNCHANGED LOGIC)
    ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count/total)*100) : 0
      }))
      .filter(t => t.probability >= 15)
      .sort((a,b)=>b.probability - a.probability);

    const sum = topics.reduce((a,b)=>a+b.probability,0);
    if (topics.length && sum !== 100) {
      topics[0].probability += (100 - sum);
    }

    /* =========================
       REPEATED QUESTIONS ONLY
    ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,count]) => count > 1)
      .map(([q,count]) => ({
        question: q,
        repeated: count
      }))
      .slice(0,15);

    res.json({
      prediction: topics[0]
        ? `Based on analysis of last ${req.files.length} papers, ${topics[0].topic} has ${topics[0].probability}% probability of appearing again.`
        : "Not enough structured data for prediction.",
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
