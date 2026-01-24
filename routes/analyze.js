const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    // 🔥 BULLETPROOF pdf-parse LOAD
    const pdfParse = (await import("pdf-parse")).default;

    const data = await pdfParse(req.file.buffer);

    res.json({
      prediction_sentence: "PDF parsed successfully 🎉",
      text_length: data.text.length,
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
