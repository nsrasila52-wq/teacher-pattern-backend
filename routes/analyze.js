const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ======================================================
   MASSIVE SUBJECT + TOPIC KEYWORDS (REALISTIC MAX)
====================================================== */
const TOPIC_KEYWORDS = {
  // PHYSICS
  Mechanics: ["force", "motion", "newton", "velocity", "acceleration", "momentum"],
  Thermodynamics: ["heat", "temperature", "entropy", "laws of thermodynamics"],
  Electrostatics: ["charge", "electric field", "coulomb"],
  CurrentElectricity: ["current", "resistance", "ohm", "voltage"],
  Magnetism: ["magnetic", "flux", "lorentz"],
  Optics: ["lens", "mirror", "refraction", "diffraction"],
  ModernPhysics: ["photoelectric", "quantum", "nuclear"],

  // CHEMISTRY
  OrganicChemistry: ["alkane", "alkene", "reaction", "carbon"],
  InorganicChemistry: ["periodic", "salt", "acid", "base"],
  PhysicalChemistry: ["mole", "equilibrium", "electrolysis", "enthalpy"],

  // MATHS
  Algebra: ["polynomial", "quadratic", "factor", "matrix"],
  Calculus: ["derivative", "integral", "limit"],
  Trigonometry: ["sin", "cos", "tan"],
  Probability: ["probability", "random", "event"],
  Statistics: ["mean", "median", "standard deviation"],

  // BIOLOGY
  Genetics: ["gene", "dna", "inheritance"],
  HumanPhysiology: ["heart", "blood", "respiration"],
  Ecology: ["ecosystem", "environment"],

  // COMMERCE
  Accounts: ["debit", "credit", "ledger", "balance sheet", "journal"],
  Economics: ["demand", "supply", "elasticity", "inflation"],
  BusinessStudies: ["management", "marketing", "planning"],

  // SST
  History: ["revolution", "empire", "colonial"],
  Geography: ["climate", "soil", "resources"],
  Civics: ["constitution", "democracy", "rights"],

  // IT / CS
  ComputerScience: ["algorithm", "data structure", "program", "database"],
  Programming: ["function", "loop", "variable", "array"],

  // GENERAL
  English: ["essay", "poem", "summary", "grammar"],
  Hindi: ["निबंध", "व्याकरण", "कविता"]
};

/* ======================================================
   QUESTION TYPE KEYWORDS
====================================================== */
const QUESTION_TYPE_KEYWORDS = {
  Numerical: ["calculate", "find", "solve"],
  MCQ: ["which of the following"],
  "Assertion–Reason": ["assertion", "reason"],
  "Short Answer": ["define", "explain"],
  "Long Answer": ["describe", "discuss", "derive"],
  Diagram: ["draw", "label"]
};

/* ======================================================
   HELPER: extract probable questions (line based)
====================================================== */
function extractQuestions(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l =>
      l.length > 20 &&
      (l.endsWith("?") ||
        l.toLowerCase().startsWith("explain") ||
        l.toLowerCase().startsWith("define") ||
        l.toLowerCase().startsWith("calculate") ||
        l.toLowerCase().startsWith("derive"))
    );
}

/* ======================================================
   ROUTE
====================================================== */
router.post("/analyze", upload.array("pdfs"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({ error: "Please upload at least one PDF" });
    }

    const papers = [];

    /* =====================
       STEP 1 – PDF PARSE
    ===================== */
    for (const file of req.files) {
      const data = await pdfParse(file.buffer);
      const text = data.text.toLowerCase();

      const topics = [];
      const question_types = [];
      const questions = extractQuestions(data.text);

      Object.entries(TOPIC_KEYWORDS).forEach(([topic, keys]) => {
        keys.forEach(k => {
          if (text.includes(k)) topics.push(topic);
        });
      });

      Object.entries(QUESTION_TYPE_KEYWORDS).forEach(([qt, keys]) => {
        keys.forEach(k => {
          if (text.includes(k)) question_types.push(qt);
        });
      });

      papers.push({ topics, question_types, questions });
    }

    /* =====================
       STEP 2 – PAPER MAP
    ===================== */
    const papersData = [];
    const topicPaperMap = {};
    const questionMap = {};

    papers.forEach((paper, index) => {
      const paperId = `paper_${index + 1}`;
      const paperResult = {
        paper_id: paperId,
        topics: {},
        question_types: {}
      };

      paper.topics.forEach(t => {
        paperResult.topics[t] = (paperResult.topics[t] || 0) + 1;
        if (!topicPaperMap[t]) topicPaperMap[t] = new Set();
        topicPaperMap[t].add(paperId);
      });

      paper.question_types.forEach(q => {
        paperResult.question_types[q] =
          (paperResult.question_types[q] || 0) + 1;
      });

      paper.questions.forEach(q => {
        questionMap[q] = (questionMap[q] || 0) + 1;
      });

      papersData.push(paperResult);
    });

    const totalPapers = papersData.length;

    /* =====================
       REPEATED ACTUAL QUESTIONS ✅
    ===================== */
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([, count]) => count > 1)
      .map(([question, count]) => ({
        question,
        repeated: count
      }))
      .sort((a, b) => b.repeated - a.repeated)
      .slice(0, 10);

    /* =====================
       COMBINE + PROBABILITY
    ===================== */
    let combinedTopics = {};
    let combinedQuestionTypes = {};

    papersData.forEach(p => {
      Object.entries(p.topics).forEach(([t, c]) => {
        combinedTopics[t] = (combinedTopics[t] || 0) + c;
      });
      Object.entries(p.question_types).forEach(([q, c]) => {
        combinedQuestionTypes[q] = (combinedQuestionTypes[q] || 0) + c;
      });
    });

    const totalWeighted = Object.values(combinedTopics).reduce((a, b) => a + b, 0);

    const sortedTopics = Object.entries(combinedTopics)
      .map(([topic, count]) => ({
        topic,
        probability: Math.round((count / totalWeighted) * 100)
      }))
      .filter(t => t.probability >= 5) // ❌ 1–2% remove
      .sort((a, b) => b.probability - a.probability);

    const topPrediction = sortedTopics[0];

    const prediction_sentence = generatePredictionSentence({
      topic: topPrediction.topic,
      appearedCount: combinedTopics[topPrediction.topic],
      totalPapers,
      probabilityPercent: topPrediction.probability
    });

    /* =====================
       FINAL RESPONSE
    ===================== */
    res.json({
      total_papers: totalPapers,
      prediction: {
        topic: topPrediction.topic,
        probability: topPrediction.probability,
        question_type: "Mixed"
      },
      prediction_sentence,
      top_topics: sortedTopics,
      focus_topics: sortedTopics.map(t => ({
        topic: t.topic,
        times_asked: combinedTopics[t.topic],
        probability: t.probability,
        strength: "High"
      })),
      repeated_questions: repeatedQuestions, // 🔥 NEW
      repeated_question_types: combinedQuestionTypes
    });

  } catch (err) {
    console.error("PDF ANALYSIS ERROR:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
