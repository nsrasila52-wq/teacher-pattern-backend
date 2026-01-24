const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

/* ------------------------------
   Multer setup (Framer)
------------------------------ */
const upload = multer({ storage: multer.memoryStorage() });

/* ------------------------------
   Helper: PDF → Paper Object
   (ONLY INPUT, NOT LOGIC)
------------------------------ */
async function extractPaperFromPDF(buffer) {
  const parsed = await pdfParse(buffer);
  const text = parsed.text.toLowerCase();

  const topics = [];
  const question_types = [];

  if (text.includes("electrostatics")) topics.push("Electrostatics");
  if (text.includes("optics")) topics.push("Optics");
  if (text.includes("current")) topics.push("Current Electricity");
  if (text.includes("magnetic")) topics.push("Magnetism");
  if (text.includes("thermo")) topics.push("Thermodynamics");

  if (text.includes("mcq")) question_types.push("MCQ");
  if (text.match(/\bcalculate\b|\bfind\b/)) question_types.push("Numerical");
  if (text.match(/\bprove\b|\bderive\b/))
    question_types.push("Proof / Derivation");
  if (text.match(/\bexplain\b|\bdefine\b/)) question_types.push("Theory");
  if (text.match(/\bdiagram\b|\bgraph\b/))
    question_types.push("Diagram / Graph");

  return {
    topics,
    question_types
  };
}

/* ------------------------------
   ANALYZE (FINAL)
------------------------------ */
router.post("/analyze", upload.array("papers"), async (req, res) => {
  try {
    let uploadedPapers = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const paper = await extractPaperFromPDF(file.buffer);
        uploadedPapers.push(paper);
      }
    }

    /* ==============================
       🔽 ORIGINAL LOGIC (UNTOUCHED)
    ============================== */

    const papersData = [];
    const topicPaperMap = {};

    uploadedPapers.forEach((paper, index) => {
      const paperTopics = paper?.topics || [];
      const paperQuestionTypes = paper?.question_types || [];

      const paperId = `paper_${index + 1}`;

      const paperResult = {
        paper_id: paperId,
        topics: {},
        question_types: {}
      };

      paperTopics.forEach(t => {
        paperResult.topics[t] = (paperResult.topics[t] || 0) + 1;
        if (!topicPaperMap[t]) topicPaperMap[t] = new Set();
        topicPaperMap[t].add(paperId);
      });

      paperQuestionTypes.forEach(q => {
        paperResult.question_types[q] =
          (paperResult.question_types[q] || 0) + 1;
      });

      papersData.push(paperResult);
    });

    const totalPapers = papersData.length;

    if (totalPapers === 0) {
      return res.json({
        total_papers: 0,
        prediction_sentence:
          "No papers uploaded yet. Upload past papers to generate predictions.",
        top_topics: [],
        focus_topics: [],
        repeated_question_types: {},
        question_type_frequency: [],
        top_question_patterns: [],
        topic_trends: [],
        topic_momentum: []
      });
    }

    const recentPaperCount = Math.max(1, Math.ceil(totalPapers * 0.4));
    const recentPaperIds = papersData
      .slice(-recentPaperCount)
      .map(p => p.paper_id);

    let combinedTopics = {};
    let combinedQuestionTypes = {};

    papersData.forEach(paper => {
      const isRecent = recentPaperIds.includes(paper.paper_id);
      const weight = isRecent ? 1.5 : 1;

      Object.entries(paper.topics).forEach(([topic, count]) => {
        combinedTopics[topic] =
          (combinedTopics[topic] || 0) + count * weight;
      });

      Object.entries(paper.question_types).forEach(([qt, count]) => {
        combinedQuestionTypes[qt] =
          (combinedQuestionTypes[qt] || 0) + count * weight;
      });
    });

    const totalWeighted = Object.values(combinedTopics).reduce(
      (a, b) => a + b,
      0
    );

    const sortedTopics = Object.entries(combinedTopics)
      .map(([topic, count]) => ({
        topic,
        probability: Math.round((count / totalWeighted) * 100)
      }))
      .sort((a, b) => b.probability - a.probability);

    const rawQuestionTypes = Object.entries(combinedQuestionTypes)
      .sort((a, b) => b[1] - a[1])
      .map(q => q[0]);

    const cleanedQuestionTypes = cleanQuestionTypes(rawQuestionTypes);

    const categorizedQuestionTypes = {};
    cleanedQuestionTypes.forEach(q => {
      const category = categorizeQuestionType(q);
      if (!categorizedQuestionTypes[category]) {
        categorizedQuestionTypes[category] = [];
      }
      categorizedQuestionTypes[category].push(q);
    });

    res.json({
      total_papers: totalPapers,
      prediction: {
        topic: sortedTopics[0].topic,
        probability: sortedTopics[0].probability
      },
      prediction_sentence: generatePredictionSentence({
        topic: sortedTopics[0].topic,
        appearedCount: Math.round(combinedTopics[sortedTopics[0].topic]),
        totalPapers,
        probabilityPercent: sortedTopics[0].probability
      }),
      top_topics: sortedTopics,
      repeated_question_types: categorizedQuestionTypes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
