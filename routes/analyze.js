const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* ========================= SUBJECT KEYWORDS ========================= */
/* 10th + 12th ALL MAJOR SUBJECTS */
const SUBJECT_KEYWORDS = {
  Mathematics: [
    "algebra","trigonometry","calculus","geometry","integration","derivative",
    "limit","equation","matrix","vector","probability","statistics","mensuration",
    "logarithm","coordinate","function","graph"
  ],
  Physics: [
    "motion","force","work","energy","power","gravitation","laws of motion",
    "kinematics","thermodynamics","heat","optics","lens","mirror","ray",
    "current","electricity","magnetism","wave","oscillation","electrostatics"
  ],
  Chemistry: [
    "organic","inorganic","physical chemistry","acid","base","salt","reaction",
    "mole","stoichiometry","periodic","bond","electrochemistry",
    "oxidation","reduction","hydrocarbon","polymer"
  ],
  Biology: [
    "cell","genetics","dna","rna","photosynthesis","respiration","evolution",
    "ecology","reproduction","enzyme","protein","plant","animal","tissue"
  ],
  ComputerScience: [
    "algorithm","programming","python","java","c++","database","sql",
    "loop","function","array","stack","queue","binary","compiler"
  ],
  Commerce: [
    "business","account","accounting","profit","loss","balance sheet",
    "ledger","journal","economics","demand","supply","market","capital"
  ]
};

/* ========================= HELPERS ========================= */
const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/page \d+/g, "")              // page numbers
    .replace(/section [a-z]/g, "")
    .replace(/time:\s*\d+/g, "")
    .replace(/maximum marks:.+/g, "")
    .replace(/[^a-z0-9?.\n\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectSubject = (text) => {
  let scores = {};
  Object.keys(SUBJECT_KEYWORDS).forEach(s => scores[s] = 0);

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    keywords.forEach(k => {
      if (text.includes(k)) scores[subject]++;
    });
  }

  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return sorted[0][1] === 0 ? "General" : sorted[0][0];
};

/* ========================= QUESTION FILTER ========================= */
const isRealQuestion = (line) => {
  if (line.length < 30) return false;
  if (!line.includes("?")) return false;

  const badStarts = [
    "instructions","note","section","attempt","time","marks",
    "choose","internal choice"
  ];
  return !badStarts.some(b => line.startsWith(b));
};

const detectQuestionType = (q) => {
  if (
    q.includes("calculate") ||
    q.includes("find") ||
    q.includes("determine") ||
    q.includes("numerical")
  ) return "Numerical";

  if (
    q.includes("derive") ||
    q.includes("prove") ||
    q.includes("show that")
  ) return "Derivation";

  return "Theory";
};

/* ========================= MAIN ROUTE ========================= */
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

      lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (line.length < 20) return;

        /* ===== SUBJECT + TOPICS (UNCHANGED LOGIC) ===== */
        const subject = detectSubject(line);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keywords]) => {
          keywords.forEach(keyword => {
            if (line.includes(keyword)) {
              topicCount[keyword] = (topicCount[keyword] || 0) + 1;
            }
          });
        });

        /* ===== QUESTION DETECTION (NEW FIX) ===== */
        if (isRealQuestion(line)) {
          const normalized = line.replace(/\s+/g, " ").trim();
          if (!questionMap[normalized]) {
            questionMap[normalized] = {
              count: 1,
              type: detectQuestionType(normalized)
            };
          } else {
            questionMap[normalized].count++;
          }
        }
      });
    }

    /* ========================= SUBJECT FILTER (UNCHANGED) ========================= */
    const mainSubject =
      Object.entries(detectedSubjects).sort((a,b)=>b[1]-a[1])[0]?.[0] || "General";

    if (mainSubject !== "General") {
      Object.keys(topicCount).forEach(topic => {
        const valid = SUBJECT_KEYWORDS[mainSubject]?.some(k => topic.includes(k));
        if (!valid) delete topicCount[topic];
      });
    }

    /* ========================= TOPIC PROBABILITY (UNCHANGED) ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count/total)*100) : 0
      }))
      .filter(t => t.probability >= 5)
      .sort((a,b)=>b.probability - a.probability);

    const probSum = topics.reduce((a,b)=>a+b.probability,0);
    if (topics.length && probSum !== 100) {
      topics[0].probability += (100 - probSum);
    }

    /* ========================= REPEATED QUESTIONS (ONLY REPEATED) ========================= */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_, v]) => v.count > 1)
      .map(([q, v]) => ({
        question: q,
        repeated: v.count,
        type: v.type
      }))
      .sort((a,b)=>b.repeated - a.repeated)
      .slice(0, 25);

    /* ========================= FINAL RESPONSE ========================= */
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
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
