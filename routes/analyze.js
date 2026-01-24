const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   SUBJECT TOPIC MAP
========================= */

const SUBJECT_TOPICS = {
  Physics: [
    "Mechanics",
    "Kinematics",
    "Laws of Motion",
    "Work Energy Power",
    "Thermodynamics",
    "Electrostatics",
    "Current Electricity",
    "Magnetism",
    "Optics",
    "Modern Physics",
  ],

  Chemistry: [
    "Organic Chemistry",
    "Inorganic Chemistry",
    "Physical Chemistry",
    "Chemical Bonding",
    "Thermochemistry",
    "Electrochemistry",
    "Solutions",
    "Atomic Structure",
  ],

  Maths: [
    "Calculus",
    "Differentiation",
    "Integration",
    "Probability",
    "Trigonometry",
    "Matrices",
    "Determinants",
    "Vectors",
  ],

  Biology: [
    "Genetics",
    "Cell Biology",
    "Human Physiology",
    "Plant Physiology",
    "Ecology",
    "Evolution",
    "Biotechnology",
  ],

  SST: [
    "History",
    "Geography",
    "Civics",
    "Economics",
    "Political Science",
  ],

  Commerce: [
    "Accounting",
    "Partnership",
    "Company Accounts",
    "Economics",
    "Business Studies",
    "Statistics",
  ],
};

/* =========================
   HELPERS
========================= */

function detectSubject(text) {
  for (const subject in SUBJECT_TOPICS) {
    for (const topic of SUBJECT_TOPICS[subject]) {
      if (text.includes(topic.toLowerCase())) {
        return subject;
      }
    }
  }
  return "General";
}

function analyzeTopics(text, topics) {
  const counts = {};
  topics.forEach((t) => (counts[t] = 0));

  topics.forEach((topic) => {
    const regex = new RegExp(topic, "gi");
    const matches = text.match(regex);
    if (matches) counts[topic] += matches.length;
  });

  return counts;
}

/* =========================
   ROUTE
========================= */

router.post("/analyze", upload.array("pdfs"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({
        prediction_sentence: "Not enough data to generate prediction.",
        top_topics: [],
      });
    }

    let combinedText = "";

    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      combinedText += data.text.toLowerCase();
    }

    const subject = detectSubject(combinedText);
    const topics =
      SUBJECT_TOPICS[subject] || Object.values(SUBJECT_TOPICS).flat();

    const topicCounts = analyzeTopics(combinedText, topics);
    const total = Object.values(topicCounts).reduce((a, b) => a + b, 0);

    if (total < 3) {
      return res.json({
        prediction_sentence: "Not enough data to generate prediction.",
        top_topics: [],
      });
    }

    const sorted = Object.entries(topicCounts)
      .filter(([_, c]) => c > 0)
      .sort((a, b) => b[1] - a[1]);

    const topTopics = sorted.map(([topic, count]) => ({
      topic,
      probability: Math.round((count / total) * 100),
    }));

    const prediction_sentence = `${topTopics[0].topic} has high chances of appearing again.`;

    res.json({
      subject,
      prediction_sentence,
      top_topics: topTopics,
    });
  } catch (err) {
    console.error("PDF ANALYSIS ERROR:", err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
