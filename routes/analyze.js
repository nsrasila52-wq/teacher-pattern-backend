const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   CLASS 10 SUBJECT KEYWORDS
========================= */
const SUBJECT_KEYWORDS = {
  Mathematics: [
    "algebra","trigonometry","calculus","geometry","integration",
    "derivative","equation","matrix","probability","statistics",
    "mensuration","coordinate","polynomial","linear","quadratic"
  ],
  Physics: [
    "motion","force","laws of motion","work","energy","power",
    "gravitation","electricity","magnetism","reflection","refraction",
    "optics","current","resistance"
  ],
  Chemistry: [
    "acid","base","salt","reaction","oxidation","reduction",
    "periodic table","carbon","compound","metal","non metal",
    "electrolysis"
  ],
  Biology: [
    "life processes","nutrition","respiration","transportation",
    "reproduction","heredity","evolution","environment","ecosystem",
    "resources"
  ],
  History: [
    "nationalism","revolution","colonialism","movement","gandhi",
    "freedom","war","civil disobedience"
  ],
  Geography: [
    "resources","agriculture","industries","minerals","climate",
    "soil","water","manufacturing"
  ],
  Civics: [
    "democracy","constitution","rights","duties","election",
    "government","parliament","judiciary"
  ],
  Economics: [
    "development","poverty","unemployment","globalisation",
    "sectors of economy","money","credit","income"
  ],
  Business: [
    "business","entrepreneur","management","organisation",
    "marketing","planning","directing"
  ],
  Accountancy: [
    "account","journal","ledger","trial balance","profit",
    "loss","balance sheet","depreciation"
  ],
  Psychology: [
    "behaviour","learning","memory","emotion","motivation",
    "intelligence","personality"
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

/* 🔥 QUESTION EXTRACTOR */
const extractQuestions = (text) => {
  return text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l =>
      l.length > 35 &&
      (
        /^q\d+/i.test(l) ||
        /^\d+[\).\s]/.test(l) ||
        /(explain|define|calculate|prove|derive|find|why|how|what)/i.test(l)
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

      questions.forEach(q => {
        const subject = detectSubject(q);
        detectedSubjects[subject] = (detectedSubjects[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keywords]) => {
          keywords.forEach(k => {
            if (q.includes(k)) {
              topicCount[k] = (topicCount[k] || 0) + 1;
              questionMap[q] = (questionMap[q] || 0) + 1;
            }
          });
        });
      });
    }

    /* MAIN SUBJECT */
    const mainSubject =
      Object.entries(detectedSubjects).sort((a,b)=>b[1]-a[1])[0]?.[0] || "General";

    /* TOPICS + PROBABILITY */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        probability: total ? Math.round((count / total) * 100) : 0
      }))
      .filter(t => t.probability >= 15)
      .sort((a,b)=>b.probability - a.probability);

    const sum = topics.reduce((a,b)=>a+b.probability,0);
    if (sum !== 100 && topics.length) {
      topics[0].probability += (100 - sum);
    }

    /* REPEATED QUESTIONS */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,count]) => count > 1)
      .map(([question,count]) => ({
        question,
        repeated: count
      }))
      .slice(0, 15);

    res.json({
      subject: mainSubject,
      prediction: topics[0]
        ? `Based on previous papers, "${topics[0].topic}" has high chances (${topics[0].probability}%) of appearing again.`
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
