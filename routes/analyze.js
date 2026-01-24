const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* ===============================
   MASTER TOPIC + QUESTION BANK
   (ALL subjects, teacher-pattern safe)
================================= */

const TOPIC_BANK = {
  // PHYSICS
  Electrostatics: ["coulomb", "electric field", "potential", "charge"],
  Current_Electricity: ["ohm", "current", "resistance", "kirchhoff"],
  Magnetism: ["magnetic", "flux", "lorentz"],
  Optics: ["reflection", "refraction", "lens", "mirror"],
  Thermodynamics: ["entropy", "heat engine", "first law"],
  Modern_Physics: ["photoelectric", "de broglie", "nuclear"],

  // CHEMISTRY
  Electrolysis: ["electrolysis", "faraday"],
  Chemical_Kinetics: ["rate of reaction", "order", "activation energy"],
  Organic_Chemistry: ["alkane", "alkene", "reaction mechanism"],
  Thermochemistry: ["enthalpy", "hess law"],

  // MATHS
  Calculus: ["derivative", "integration", "limit"],
  Algebra: ["matrix", "determinant", "quadratic"],
  Trigonometry: ["sin", "cos", "tan"],

  // BIOLOGY
  Cell_Biology: ["cell", "organelle"],
  Genetics: ["dna", "gene", "inheritance"],
  Photosynthesis: ["chlorophyll", "light reaction"],
};

/* ===============================
   QUESTION TYPE DETECTION
================================= */

function detectQuestionTypes(text) {
  const types = new Set();

  if (text.includes("mcq") || text.includes("choose the correct")) {
    types.add("MCQ");
  }
  if (text.match(/\bcalculate\b|\bfind the value\b/)) {
    types.add("Numerical");
  }
  if (text.match(/\bprove\b|\bderive\b/)) {
    types.add("Proof / Derivation");
  }
  if (text.match(/\bexplain\b|\bdefine\b/)) {
    types.add("Theory");
  }
  if (text.match(/\bdiagram\b|\bgraph\b/)) {
    types.add("Diagram / Graph");
  }

  return Array.from(types);
}

/* ===============================
   MAIN ANALYZE ROUTE
================================= */

router.post("/", upload.array("pdf"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDFs uploaded" });
    }

    let topicStats = {};
    let questionTypeStats = {};
    let totalPapers = req.files.length;

    for (const file of req.files) {
      const parsed = await pdfParse(file.buffer);
      const text = parsed.text.toLowerCase();

      // topic detection
      for (const topic in TOPIC_BANK) {
        for (const keyword of TOPIC_BANK[topic]) {
          if (text.includes(keyword)) {
            topicStats[topic] = (topicStats[topic] || 0) + 1;
            break;
          }
        }
      }

      // question type detection
      const detectedTypes = detectQuestionTypes(text);
      detectedTypes.forEach((t) => {
        questionTypeStats[t] = (questionTypeStats[t] || 0) + 1;
      });
    }

    /* ===============================
       BUILD OUTPUT STRUCTURE
    ================================= */

    const topTopics = Object.entries(topicStats)
      .map(([topic, count]) => ({
        topic: topic.replace("_", " "),
        probability: Math.round((count / totalPapers) * 100),
        appeared: count,
      }))
      .sort((a, b) => b.probability - a.probability);

    const repeatedQuestionTypes = Object.entries(questionTypeStats).map(
      ([type, count]) => ({
        type,
        appeared_in_papers: count,
      })
    );

    // SAFETY: never blank result
    if (topTopics.length === 0) {
      return res.json({
        prediction_sentence:
          "Not enough recognizable academic patterns found in uploaded papers.",
        top_topics: [],
        focus_topics: [],
        repeated_question_types: [],
        total_papers_analyzed: totalPapers,
      });
    }

    const mainTopic = topTopics[0];

    const predictionSentence = `Based on analysis of last ${totalPapers} papers, ${mainTopic.topic} appeared ${mainTopic.appeared} times and has a high probability (${mainTopic.probability}%) of appearing again.`;

    res.json({
      prediction_sentence: predictionSentence,
      top_topics: topTopics.slice(0, 5),
      focus_topics: topTopics.filter((t) => t.probability >= 40),
      repeated_question_types: repeatedQuestionTypes,
      total_papers_analyzed: totalPapers,
    });
  } catch (err) {
    console.error("PDF ANALYSIS ERROR:", err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
