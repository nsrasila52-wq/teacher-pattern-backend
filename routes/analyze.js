const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse/lib/pdf-parse");


const generatePredictionSentence = require("../utils/predictionGenerator");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF received" });
    }

    console.log("FILE RECEIVED:", req.file.originalname);

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.toLowerCase();

    /* -------- SIMPLE REAL EXTRACTION -------- */
    const topics = [];

    if (text.includes("electrostatics")) topics.push("Electrostatics");
    if (text.includes("optics")) topics.push("Optics");
    if (text.includes("current electricity")) topics.push("Current Electricity");
    if (text.includes("magnetism")) topics.push("Magnetism");

    if (topics.length === 0) topics.push("General");

    const total = topics.length;

    const top_topics = topics.map(t => ({
      topic: t,
      probability: Math.round(100 / total),
    }));

    const prediction_sentence = generatePredictionSentence({
      topic: top_topics[0].topic,
      appearedCount: total,
      totalPapers: 1,
      probabilityPercent: top_topics[0].probability,
    });

    res.json({
      prediction_sentence,
      top_topics,
    });

  } catch (err) {
    console.error("PDF ANALYSIS ERROR:", err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
