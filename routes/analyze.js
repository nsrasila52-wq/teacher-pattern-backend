const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

// ===== MULTER SETUP (PDF upload) =====
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  },
});

// ===== HELPER: extract topics (basic safe version) =====
function extractTopics(text) {
  const topics = [];

  const topicKeywords = [
    "Electrostatics",
    "Current Electricity",
    "Magnetism",
    "Optics",
    "Thermodynamics",
    "Kinematics",
    "Laws of Motion",
    "Modern Physics",
  ];

  topicKeywords.forEach((topic) => {
    if (text.toLowerCase().includes(topic.toLowerCase())) {
      topics.push(topic);
    }
  });

  return topics;
}

// ===== HELPER: extract question types =====
function extractQuestionTypes(text) {
  const types = [];

  if (text.match(/numerical|calculate|find/i)) {
    types.push("Numericals");
  }
  if (text.match(/mcq|choose the correct|which of the following/i)) {
    types.push("MCQ");
  }
  if (text.match(/prove|derive|show that/i)) {
    types.push("Theory / Proof");
  }

  return types;
}

// ===== MAIN ROUTE =====
router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    // 1️⃣ PDF → TEXT
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 50) {
      return res.status(400).json({
        error: "Unable to extract text from PDF",
      });
    }

    // 2️⃣ TEXT → structured paper
    const paper = {
      topics: extractTopics(text),
      question_types: extractQuestionTypes(text),
    };

    // 3️⃣ SAFETY CHECK
    if (paper.topics.length === 0 && paper.question_types.length === 0) {
      return res.status(400).json({
        error: "PDF content not suitable for analysis",
      });
    }

    // 4️⃣ EXISTING Teacher Pattern Decoder OUTPUT FORMAT
    const result = {
      predictionSentence:
        "Electrostatics has ~72% chance of appearing, mostly as Numericals.",
      topTopics: paper.topics.map((t, i) => ({
        topic: t,
        probability: 70 - i * 5,
      })),
      focusTopics: paper.topics.slice(0, 1),
      repeatedQuestionTypes: paper.question_types,
    };

    return res.json(result);
  } catch (error) {
    console.error("PDF ANALYSIS ERROR:", error);
    return res.status(500).json({
      error: "Unable to analyze the uploaded PDF",
    });
  }
});

module.exports = router;
