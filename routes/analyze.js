const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    // ✅ THIS IS THE FIX
    const data = await pdfParse(req.file.buffer);
    const text = data.text || "";

    // ⚠️ TEMP DEMO LOGIC (real extraction baad me)
    const papers = [
      {
        topics: ["Electrostatics", "Optics"],
        question_types: ["MCQ", "Numerical"],
      },
    ];

    // ===== EXISTING LOGIC =====
    const totalPapers = papers.length;

    const prediction_sentence =
      "Based on analysis of last 1 papers, Electrostatics appeared 2 times and has a high probability (50%) of appearing again.";

    res.json({
      total_papers: totalPapers,
      prediction_sentence,
      top_topics: [
        { topic: "Electrostatics", probability: 50 },
        { topic: "Optics", probability: 50 },
      ],
    });
  } catch (err) {
    console.error("PDF ANALYSIS ERROR:", err);
    res.status(500).json({ error: "PDF analysis failed" });
  }
});

module.exports = router;
