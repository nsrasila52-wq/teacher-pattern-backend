const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

router.post(
  "/analyze",
  upload.single("file"), // ✅ VERY IMPORTANT
  async (req, res) => {
    try {
      let uploadedPapers = [];

      /* ------------------------------
         PDF → papers (MINIMAL)
      ------------------------------ */
      if (req.file) {
        const pdfData = await pdfParse(req.file.buffer);
        const text = pdfData.text || "";

        uploadedPapers = [
          {
            topics:
              text.match(
                /Electrostatics|Optics|Current Electricity|Magnetism|Waves|Thermodynamics/gi
              ) || [],
            question_types:
              text.match(/numerical|calculate|derive|explain|mcq/gi) || [],
          },
        ];
      } else {
        uploadedPapers = req.body.papers || [];
      }

      /* ------------------------------
         ORIGINAL LOGIC (UNCHANGED)
      ------------------------------ */

      const papersData = [];
      const topicPaperMap = {};

      uploadedPapers.forEach((paper, index) => {
        const paperTopics = paper?.topics || [];
        const paperQuestionTypes = paper?.question_types || [];
        const paperId = `paper_${index + 1}`;

        const paperResult = {
          paper_id: paperId,
          topics: {},
          question_types: {},
        };

        paperTopics.forEach((t) => {
          paperResult.topics[t] = (paperResult.topics[t] || 0) + 1;
          if (!topicPaperMap[t]) topicPaperMap[t] = new Set();
          topicPaperMap[t].add(paperId);
        });

        paperQuestionTypes.forEach((q) => {
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
          repeated_question_types: [],
        });
      }

      const combinedTopics = {};
      const combinedQuestionTypes = {};

      papersData.forEach((paper) => {
        Object.entries(paper.topics).forEach(([topic, count]) => {
          combinedTopics[topic] =
            (combinedTopics[topic] || 0) + count;
        });

        Object.entries(paper.question_types).forEach(([qt, count]) => {
          combinedQuestionTypes[qt] =
            (combinedQuestionTypes[qt] || 0) + count;
        });
      });

      const totalWeighted = Object.values(combinedTopics).reduce(
        (a, b) => a + b,
        0
      );

      const sortedTopics = Object.entries(combinedTopics)
        .map(([topic, count]) => ({
          topic,
          probability: Math.round((count / totalWeighted) * 100),
        }))
        .sort((a, b) => b.probability - a.probability);

      const rawQuestionTypes = Object.keys(combinedQuestionTypes);
      const cleanedQuestionTypes = cleanQuestionTypes(rawQuestionTypes);

      const categorizedQuestionTypes = {};
      cleanedQuestionTypes.forEach((q) => {
        const cat = categorizeQuestionType(q);
        if (!categorizedQuestionTypes[cat]) {
          categorizedQuestionTypes[cat] = [];
        }
        categorizedQuestionTypes[cat].push(q);
      });

      const topPrediction = sortedTopics[0];

      const prediction_sentence = generatePredictionSentence({
        topic: topPrediction.topic,
        appearedCount: combinedTopics[topPrediction.topic],
        totalPapers,
        probabilityPercent: topPrediction.probability,
      });

      res.json({
        total_papers: totalPapers,
        predictionSentence: prediction_sentence,
        topTopics: sortedTopics,
        focusTopics: sortedTopics.map((t) => t.topic),
        repeatedQuestionTypes: cleanedQuestionTypes,
      });
    } catch (err) {
      console.error("ANALYZE ERROR:", err);
      res.status(500).json({ error: "Analysis failed" });
    }
  }
);

module.exports = router;
