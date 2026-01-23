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
         PDF → papers BRIDGE (MINIMAL)
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

      const papersData = [];
      const topicPaperMap = {};

      /* ------------------------------
         STEP 6.1 – Paper-wise storage
      ------------------------------ */

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
          prediction: {
            topic: "N/A",
            probability: 0,
            question_type: "General",
          },
          prediction_sentence:
            "No papers uploaded yet. Upload past papers to generate predictions.",
          top_topics: [],
          focus_topics: [],
          repeated_question_types: {},
          question_type_frequency: [],
          top_question_patterns: [],
          topic_trends: [],
          topic_momentum: [],
        });
      }

      /* ------------------------------
         STEP 6.4 – Recent paper weighting
      ------------------------------ */

      const recentPaperCount = Math.max(1, Math.ceil(totalPapers * 0.4));
      const recentPaperIds = papersData
        .slice(-recentPaperCount)
        .map((p) => p.paper_id);

      let combinedTopics = {};
      let combinedQuestionTypes = {};

      papersData.forEach((paper) => {
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
          probability: Math.round((count / totalWeighted) * 100),
        }))
        .sort((a, b) => b.probability - a.probability);

      const rawQuestionTypes = Object.entries(combinedQuestionTypes)
        .sort((a, b) => b[1] - a[1])
        .map((q) => q[0]);

      const cleanedQuestionTypes = cleanQuestionTypes(rawQuestionTypes);

      const categorizedQuestionTypes = {};
      cleanedQuestionTypes.forEach((q) => {
        const category = categorizeQuestionType(q);
        if (!categorizedQuestionTypes[category])
          categorizedQuestionTypes[category] = [];
        categorizedQuestionTypes[category].push(q);
      });

      const questionTypeFrequency = Object.entries(categorizedQuestionTypes)
        .map(([category, questions]) => ({
          category,
          count: questions.reduce(
            (sum, q) => sum + (combinedQuestionTypes[q] || 0),
            0
          ),
        }))
        .sort((a, b) => b.count - a.count);

      const topPrediction = sortedTopics[0];
      const dominantQuestionType =
        questionTypeFrequency[0]?.category || "General";

      const prediction_sentence = generatePredictionSentence({
        topic: topPrediction.topic,
        appearedCount: Math.round(combinedTopics[topPrediction.topic]),
        totalPapers,
        probabilityPercent: topPrediction.probability,
      });

      res.json({
        total_papers: totalPapers,
        prediction_sentence,
        top_topics: sortedTopics,
        repeated_question_types: categorizedQuestionTypes,
        question_type_frequency: questionTypeFrequency,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Analysis failed" });
    }
  }
);

module.exports = router;
