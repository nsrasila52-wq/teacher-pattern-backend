const express = require("express");
const router = express.Router();

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

router.post("/analyze", async (req, res) => {
  try {
    const uploadedPapers = req.body;

    if (!uploadedPapers || uploadedPapers.length === 0) {
      return res.status(400).json({ error: "No data received" });
    }

    // ----------------------------
    // STEP 1: Count topics + map questions
    // ----------------------------
    const topicCount = {};
    const questionMap = {};

    uploadedPapers.forEach((paper) => {
      paper.questions.forEach((q) => {
        const topic = q.topic || "General";
        const questionText = q.question?.trim();

        if (!questionText) return;

        topicCount[topic] = (topicCount[topic] || 0) + 1;

        if (!questionMap[questionText]) {
          questionMap[questionText] = {
            count: 1,
            topic
          };
        } else {
          questionMap[questionText].count += 1;
        }
      });
    });

    // ----------------------------
    // STEP 2: Top Topics
    // ----------------------------
    const totalQuestions = Object.values(topicCount).reduce(
      (a, b) => a + b,
      0
    );

    const topTopics = Object.entries(topicCount)
      .map(([topic, count]) => ({
        topic,
        percentage: Number(((count / totalQuestions) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const topTopicNames = topTopics.slice(0, 3).map(t => t.topic);

    // ----------------------------
    // STEP 3: Repeated Questions (ONLY top topics)
    // ----------------------------
    const repeatedQuestions = Object.entries(questionMap)
      .filter(([_, data]) => data.count > 1)
      .filter(([_, data]) => topTopicNames.includes(data.topic))
      .map(([question, data]) => ({
        question,
        timesAsked: data.count,
        topic: data.topic
      }));

    // ----------------------------
    // STEP 4: Question Types (existing logic)
    // ----------------------------
    const rawTypes = uploadedPapers.flatMap(p =>
      p.questions.map(q => categorizeQuestionType(q.question))
    );

    const questionTypes = cleanQuestionTypes(rawTypes);

    // ----------------------------
    // STEP 5: Prediction
    // ----------------------------
    const prediction = generatePredictionSentence(topTopics);

    // ----------------------------
    // FINAL RESPONSE
    // ----------------------------
    res.json({
      prediction,
      topTopics,
      repeatedQuestions,
      questionTypes
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
