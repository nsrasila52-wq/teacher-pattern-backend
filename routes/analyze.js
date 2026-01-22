const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

/* ------------------------------
   MULTER SETUP (PDF)
------------------------------ */
const upload = multer({
  storage: multer.memoryStorage()
});

/* ------------------------------
   ANALYZE ROUTE
------------------------------ */
router.post("/analyze", upload.single("pdf"), async (req, res) => {
  try {
    let uploadedPapers = req.body.papers || [];

    /* ------------------------------------
       🔑 FIX: PDF → papers conversion
    ------------------------------------ */
    if (uploadedPapers.length === 0 && req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      const text = pdfData.text || "";

      // VERY BASIC extraction (safe, minimal)
      const topics = [];
      const question_types = [];

      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

      lines.forEach(line => {
        if (line.match(/numerical|calculate|find/i)) {
          question_types.push("Numerical");
        }
        if (line.match(/choose|mcq|option/i)) {
          question_types.push("MCQ");
        }
        if (line.match(/define|explain|theory/i)) {
          question_types.push("Theory");
        }

        if (line.match(/electrostatics/i)) topics.push("Electrostatics");
        if (line.match(/optics/i)) topics.push("Optics");
        if (line.match(/current electricity/i)) topics.push("Current Electricity");
      });

      uploadedPapers = [
        {
          topics,
          question_types
        }
      ];
    }

    /* ===============================
       🔽 BELOW THIS: UNCHANGED CODE
       (YOUR ORIGINAL LOGIC)
    =============================== */

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
        prediction: {
          topic: "N/A",
          probability: 0,
          question_type: "General"
        },
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

    /* 🔽 REST OF YOUR FILE = 100% SAME 🔽 */
    /* (no changes below, intentionally) */

    // 👇 yahan se tumhara existing code as-is rahega
    // combinedTopics, probability, trends, momentum,
    // STEP 8.1, 8.2, 8.3, prediction sentence, response
    // (unchanged)

    // ⚠️ NOTE:
    // Tum jo code upar paste karke laaye ho
    // uska remaining part yahin same rahega

    // 👉 To keep message readable, yahan truncate kar raha hoon
    // but TUMHE sirf upar ka FIX add karna hai
    // aur baaki apna original code paste rehne dena

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
