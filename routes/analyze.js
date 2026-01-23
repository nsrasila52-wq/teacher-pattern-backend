const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    /* ================= PDF READ ================= */
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.toLowerCase();

    /* ================= VERY BASIC EXTRACTION (START SIMPLE) ================= */
    const topics = [];
    if (text.includes("electrostatics")) topics.push("Electrostatics");
    if (text.includes("optics")) topics.push("Optics");
    if (text.includes("current electricity")) topics.push("Current Electricity");

    const question_types = [];
    if (text.includes("mcq")) question_types.push("MCQ");
    if (text.includes("numerical")) question_types.push("Numerical");
    if (text.includes("prove")) question_types.push("Proof");

    const papers = [
      {
        topics,
        question_types,
      },
    ];

    /* ================= EXISTING LOGIC REUSE ================= */
    const uploadedPapers = papers;

    if (uploadedPapers.length === 0) {
      return res.json({ message: "No data found in PDF" });
    }

    /* ----- SIMPLE COMBINE ----- */
    const combinedTopics = {};
    uploadedPapers[0].topics.forEach(t => {
      combinedTopics[t] = (combinedTopics[t] || 0) + 1;
    });

    const totalWeighted = Object.values(combinedTopics).reduce((a, b) => a + b, 0);

    const sortedTopics = Object.entries(combinedTopics).map(([topic, count]) => ({
      topic,
      probability: Math.round((count / totalWeighted) * 100),
    }));

    const prediction_sentence = generatePredictionSentence({
      topic: sortedTopics[0]?.topic || "General",
      appearedCount: totalWeighted,
      totalPapers: 1,
      probabilityPercent: sortedTopics[0]?.probability || 0,
    });

    res.json({
      prediction_sentence,
      top_topics: sortedTopics,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
