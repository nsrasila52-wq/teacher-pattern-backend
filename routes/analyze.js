const express = require("express");
const router = express.Router();
const multer = require("multer");

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");
const extractPaperDataFromPDF = require("../utils/extractPaperDataFromPDF");

/* ------------------------------
   Multer Setup (PDF Upload)
------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files allowed"));
  }
});

/* ------------------------------
   ANALYZE ROUTE
------------------------------ */

router.post("/analyze", upload.array("papers"), async (req, res) => {
  try {
    /* ---------------------------------
       INPUT NORMALIZATION (NEW)
       ⛔ LOGIC BELOW IS UNCHANGED
    ---------------------------------- */

    let uploadedPapers = [];

    // Case 1: PDFs from Framer
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const paperData = await extractPaperDataFromPDF(file.buffer);
        uploadedPapers.push(paperData);
      }
    }

    // Case 2: Old JSON support (safety)
    if (uploadedPapers.length === 0 && req.body.papers) {
      uploadedPapers = req.body.papers;
    }

    /* ==============================
       🔽 ORIGINAL LOGIC STARTS 🔽
       (NOT TOUCHED)
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
        prediction: {
          topic: "N/A",
          probability: 0,
          question_type: "General"
        },
        prediction_sentence:
          "No papers uploaded yet. Upload past papers to generate predictions.",
        prediction_reliability: 0,
        prediction_explanation: [],
        top_topics: [],
        focus_topics: [],
        repeated_question_types: {},
        question_type_frequency: [],
        top_question_patterns: [],
        topic_trends: [],
        topic_momentum: []
      });
    }

    /* ------------------------------
       Recent paper weighting
    ------------------------------ */

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

    const topicTrends = Object.entries(topicPaperMap).map(
      ([topic, paperSet]) => {
        const count = paperSet.size;
        let trend = "Weak";
        if (count >= 3) trend = "Strong";
        else if (count === 2) trend = "Moderate";

        return { topic, appeared_in_papers: count, trend };
      }
    );

    const topicRecentOld = {};

    papersData.forEach(paper => {
      const isRecent = recentPaperIds.includes(paper.paper_id);
      Object.entries(paper.topics).forEach(([topic, count]) => {
        if (!topicRecentOld[topic]) {
          topicRecentOld[topic] = { recent: 0, old: 0 };
        }
        if (isRecent) topicRecentOld[topic].recent += count;
        else topicRecentOld[topic].old += count;
      });
    });

    const topicMomentum = Object.entries(topicRecentOld).map(
      ([topic, c]) => {
        let momentum = "Stable";
        if (c.recent > c.old) momentum = "Rising";
        else if (c.recent < c.old) momentum = "Declining";

        return {
          topic,
          recent_count: c.recent,
          old_count: c.old,
          momentum
        };
      }
    );

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

    const questionTypeFrequency = Object.entries(categorizedQuestionTypes)
      .map(([category, questions]) => {
        const totalCount = questions.reduce(
          (sum, q) => sum + (combinedQuestionTypes[q] || 0),
          0
        );
        return { category, count: totalCount };
      })
      .sort((a, b) => b.count - a.count);

    const topQuestionPatterns = questionTypeFrequency.slice(0, 3);

    const topPrediction = sortedTopics[0];
    const dominantQuestionType =
      questionTypeFrequency[0]?.category || "General";

    const prediction = {
      topic: topPrediction.topic,
      probability: topPrediction.probability,
      question_type: dominantQuestionType
    };

    const prediction_sentence = generatePredictionSentence({
      topic: prediction.topic,
      appearedCount: Math.round(combinedTopics[prediction.topic]),
      totalPapers,
      probabilityPercent: prediction.probability
    });

    res.json({
      total_papers: totalPapers,
      prediction,
      prediction_sentence,
      top_topics: sortedTopics,
      focus_topics: sortedTopics.map(t => ({
        topic: t.topic,
        times_asked: Math.round(combinedTopics[t.topic]),
        probability: t.probability,
        strength: "High"
      })),
      repeated_question_types: categorizedQuestionTypes,
      question_type_frequency: questionTypeFrequency,
      top_question_patterns: topQuestionPatterns,
      topic_trends: topicTrends,
      topic_momentum: topicMomentum
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;
