const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   CLASS 10 SUBJECT KEYWORDS
========================= */
const SUBJECT_KEYWORDS = {
  Physics: ["force","energy","current","electric","magnetic","field","ray","lens","mirror","semiconductor","pn junction","capacitor","resistance"],
  Chemistry: ["acid","base","salt","reaction","oxidation","reduction","carbon","compound","metal"],
  Biology: ["life process","respiration","reproduction","heredity","evolution","environment"],
  Mathematics: ["equation","prove","calculate","graph","triangle","circle","probability","statistics"],
  History: ["movement","revolution","colonial","nationalism"],
  Geography: ["resources","agriculture","industry","climate"],
  Civics: ["democracy","constitution","rights","government"],
  Economics: ["development","poverty","unemployment","globalisation"]
};

/* =========================
   CLEANERS
========================= */
const normalize = (t) =>
  t
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9().]/g, " ")
    .trim();

/* =========================
   REMOVE INSTRUCTIONS
========================= */
const stripInstructions = (text) => {
  const idx = text.search(/section\s+a/i);
  return idx !== -1 ? text.slice(idx) : text;
};

/* =========================
   REAL QUESTION EXTRACTOR
========================= */
const extractQuestions = (text) => {
  const cleaned = stripInstructions(text);

  const raw = cleaned.split(/\n(?=\d{1,2}[\.\)]|\(?\d{1,2}[a-z]?\))/i);

  return raw
    .map(q => q.replace(/\n/g, " ").trim())
    .filter(q =>
      q.length > 60 &&
      /[a-z]/i.test(q) &&
      !q.match(/page \d|time allowed|general instructions/i)
    );
};

const detectSubject = (q) => {
  let best = { subject: "General", score: 0 };

  for (const [subject, keys] of Object.entries(SUBJECT_KEYWORDS)) {
    let score = 0;
    keys.forEach(k => {
      if (q.includes(k)) score++;
    });
    if (score > best.score) best = { subject, score };
  }
  return best.subject;
};

/* =========================
   ROUTE
========================= */
router.post("/analyze", upload.array("pdfs"), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: "No PDFs uploaded" });
    }

    let topicCount = {};
    let questionMap = {};
    let subjectCount = {};

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = normalize(data.text);
      const questions = extractQuestions(text);

      questions.forEach(q => {
        const subject = detectSubject(q);
        subjectCount[subject] = (subjectCount[subject] || 0) + 1;

        Object.entries(SUBJECT_KEYWORDS).forEach(([_, keys]) => {
          keys.forEach(k => {
            if (q.includes(k)) {
              topicCount[k] = (topicCount[k] || 0) + 1;
              questionMap[q] = (questionMap[q] || 0) + 1;
            }
          });
        });
      });
    }

    /* TOPICS */
    const total = Object.values(topicCount).reduce((a,b)=>a+b,0);

    let topics = Object.entries(topicCount)
      .map(([topic,count]) => ({
        topic,
        probability: Math.round((count / total) * 100)
      }))
      .filter(t => t.probability >= 15)
      .sort((a,b)=>b.probability-a.probability);

    if (topics.length) {
      const sum = topics.reduce((a,b)=>a+b.probability,0);
      topics[0].probability += (100 - sum);
    }

    /* REPEATED QUESTIONS */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_,c]) => c > 1)
      .map(([question,c]) => ({
        question,
        repeated: c
      }))
      .slice(0, 10);

    res.json({
      prediction: topics[0]
        ? `"${topics[0].topic}" has high chances (${topics[0].probability}%) based on previous papers.`
        : "Not enough structured data for prediction.",
      topTopics: topics,
      repeatedQuestions
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
