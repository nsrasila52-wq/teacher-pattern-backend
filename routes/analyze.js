const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT KEYWORDS (10th + 12th)
   ⚠️ UNCHANGED TOPIC LOGIC
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
    "current","electricity","magnetism","wave","ray","refraction"
  ],
  Chemistry: [
    "organic","inorganic","physical chemistry","acid","base","salt",
    "reaction","mole","stoichiometry","periodic","bond",
    "electrochemistry","oxidation","reduction"
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
   HELPERS (TOPIC – SAME AS YOURS)
========================= */
const cleanText = (text) =>
  text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
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

/* =========================
   QUESTION-SPECIFIC HELPERS
========================= */

// ❌ instructions / headers ignore
const isInstructionLine = (line) => {
  return (
    line.includes("time allowed") ||
    line.includes("maximum marks") ||
    line.includes("note") ||
    line.includes("section") ||
    line.includes("page") ||
    line.includes("roll no") ||
    line.includes("question paper") ||
    line.length < 40
  );
};

// ✅ question detection
const isQuestion = (line) => {
  return (
    /\?$/.test(line) ||
    line.startsWith("explain") ||
    line.startsWith("define") ||
    line.startsWith("derive") ||
    line.startsWith("calculate") ||
    line.startsWith("find") ||
    line.startsWith("state") ||
    line.startsWith("prove") ||
    line.startsWith("why") ||
    line.startsWith("how")
  );
};

// 🔑 normalize for repeat detection
const normalizeQuestion = (q) =>
  q.replace(/\d+/g,"")
   .replace(/\s+/g," ")
   .trim()
   .split(" ")
   .slice(0,14)
   .join(" ");

// 🧠 question type
const detectQuestionType = (q) => {
  if (q.includes("calculate") || q.includes("find")) return "Numerical";
  if (q.includes("derive") || q.includes("prove")) return "Derivation";
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
    let questionMap = {};

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = cleanText(data.text);

      const lines = text.split(/\n|\./);

      lines.forEach(raw => {
        const line = raw.trim();
        if (isInstructionLine(line)) return;
        if (!isQuestion(line)) return;

        // SUBJECT (same as before)
        const subject = detectSubject(line);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        // TOPIC COUNT (unchanged logic)
        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keywords]) => {
          keywords.forEach(k => {
            if (line.includes(k)) {
              topicCount[k] = (topicCount[k] || 0) + 1;
            }
          });
        });

        // 🔥 QUESTION MAP (FIXED)
        const key = normalizeQuestion(line);
        if (!questionMap[key]) {
          questionMap[key] = {
            question: line,
            count: 1,
            type: detectQuestionType(line)
          };
        } else {
          questionMap[key].count++;
        }
      });
    }

    /* =========================
       SUBJECT FILTER (UNCHANGED)
    ========================= */
    const mainSubject = Object.entries(detectedSubjects)
      .sort((a,b)=>b[1]-a[1])[0]?.[0] || "General";

    if (mainSubject !== "General") {
      Object.keys(topicCount).forEach(topic => {
        const valid = SUBJECT_KEYWORDS[mainSubject]?.some(k => topic.includes(k));
        if (!valid) delete topicCount[topic];
      });
    }

    /* =========================
       TOPICS % (UNCHANGED)
    ========================= */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);
    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        count,
        probability: total ? Math.round((count/total)*100) : 0
      }))
      .filter(t => t.probability >= 5)
      .sort((a,b)=>b.probability-a.probability);

    const sum = topics.reduce((a,b)=>a+b.probability,0);
    if (topics.length && sum !== 100) {
      topics[0].probability += (100 - sum);
    }

    /* =========================
       🔥 REPEATED QUESTIONS ONLY
    ========================= */
    const repeatedQuestions = Object.values(questionMap)
      .filter(q => q.count > 1)
      .map(q => ({
        question: q.question,
        repeated: q.count,
        type: q.type
      }))
      .sort((a,b)=>b.repeated-a.repeated);

    res.json({
      subject: mainSubject,
      prediction: topics[0]
        ? `Based on analysis of last ${req.files.length} papers, "${topics[0].topic}" has high probability (${topics[0].probability}%).`
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
