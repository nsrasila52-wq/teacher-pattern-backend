const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT KEYWORDS (CLEAN)
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
    "organic","inorganic","physical chemistry","acid","base","salt",
    "reaction","mole","stoichiometry","periodic","bond","electrochemistry",
    "oxidation","reduction"
  ],
  Biology: [
    "cell","genetics","dna","rna","photosynthesis","respiration",
    "evolution","ecology","reproduction","enzyme","protein"
  ],
  ComputerScience: [
    "algorithm","programming","python","java","c++","database",
    "sql","loop","function","array","stack","queue","binary"
  ],
  Commerce: [
    "business","account","accounting","profit","loss","balance sheet",
    "ledger","journal","economics","demand","supply","market"
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

const detectSubject = (text) => {
  let scores = {};
  Object.keys(SUBJECT_KEYWORDS).forEach(sub => scores[sub] = 0);

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

      const lines = text.split(/\n|\.|\?/);

      lines.forEach(line => {
        if (line.length < 25) return;

        const subject = detectSubject(line);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([sub, keywords]) => {
          keywords.forEach(keyword => {
            if (line.includes(keyword)) {
              topicCount[keyword] = (topicCount[keyword] || 0) + 1;

              questionMap[line] = (questionMap[line] || 0) + 1;
            }
          });
        });
      });
    }

    /* =========================
       SUBJECT FILTER FIX
       ========================= */
    const mainSubject = Object.entries(detectedSubjects)
      .sort((a,b) => b[1] - a[1])[0][0];

    if (mainSubject !== "General") {
      Object.keys(topicCount).forEach(topic => {
        const valid = SUBJECT_KEYWORDS[mainSubject]?.some(k => topic.includes(k));
        if (!valid) delete topicCount[topic];
      });
    }

    /* =========================
       PERCENTAGE NORMALIZATION
       ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 5)   // 🔥 LOW PROBABILITY HIDE
      .sort((a,b)=>b.probability - a.probability);

    const probabilitySum = topics.reduce((a,b)=>a+b.probability,0);
    if (probabilitySum !== 100 && topics.length) {
      const diff = 100 - probabilitySum;
      topics[0].probability += diff;
    }

    /* =========================
       REPEATED QUESTIONS
       ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,count]) => count > 1)
      .map(([question,count]) => ({
        question,
        repeated: count
      }))
      .slice(0,20);

    /* =========================
       FINAL RESPONSE
       ========================= */
    res.json({
      subject: mainSubject,
      prediction: topics[0]
        ? `Based on analysis of last ${req.files.length} papers, ${topics[0].topic} appeared ${topics[0].count} times and has a high probability (${topics[0].probability}%) of appearing again.`
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
