const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const generatePredictionSentence = require("../utils/predictionGenerator");
const cleanQuestionTypes = require("../utils/cleanQuestionTypes");
const categorizeQuestionType = require("../utils/categorizeQuestionType");

// ==================
// Multer setup
// ==================
const upload = multer({ storage: multer.memoryStorage() });

// ==================
// In-memory last result store
// ==================
let LAST_RESULT = null;

// ==================
// DEBUG: PDF TEXT CHECK
// ==================
router.post("/debug-text", upload.array("papers"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No PDFs uploaded" });
        }

        const debug = [];

        for (let i = 0; i < req.files.length; i++) {
            const data = await pdfParse(req.files[i].buffer);

            debug.push({
                file: req.files[i].originalname,
                textLength: data.text.length,
                sample: data.text.slice(0, 800), // 👈 first 800 chars
            });
        }

        res.json({
            status: "ok",
            files: debug,
        });
    } catch (err) {
        console.error("DEBUG TEXT ERROR:", err);
        res.status(500).json({ error: "PDF debug failed" });
    }
});

// ==================
// MAIN ANALYSIS ROUTE
// ==================
router.post("/analyze", upload.array("papers"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No PDFs uploaded" });
        }

        let allQuestions = [];
        let topicCount = {};
        let questionTypeCount = {};
        let questionMap = {};

        for (let file of req.files) {
            const data = await pdfParse(file.buffer);
            const text = data.text;

            // split roughly by lines
            const lines = text
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 15);

            lines.forEach(line => {
                const topic = line.split(" ")[0].toLowerCase();
                topicCount[topic] = (topicCount[topic] || 0) + 1;

                const qType = categorizeQuestionType(line);
                questionTypeCount[qType] = (questionTypeCount[qType] || 0) + 1;

                const normalized = line.toLowerCase();
                if (!questionMap[normalized]) {
                    questionMap[normalized] = {
                        question: line,
                        repeated: 1,
                        type: qType,
                    };
                } else {
                    questionMap[normalized].repeated += 1;
                }
            });

            allQuestions.push(...lines);
        }

        // ==================
        // TOPICS %
        // ==================
        const totalTopics = Object.values(topicCount).reduce((a, b) => a + b, 0);

        const topTopics = Object.entries(topicCount)
            .map(([topic, count]) => ({
                topic,
                probability: Number(((count / totalTopics) * 100).toFixed(2)),
            }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 10);

        // ==================
        // REPEATED QUESTIONS
        // ==================
        const repeatedQuestions = Object.values(questionMap)
            .filter(q => q.repeated > 1)
            .sort((a, b) => b.repeated - a.repeated);

        // ==================
        // PREDICTION
        // ==================
        const prediction = generatePredictionSentence(topTopics);

        const finalResult = {
            prediction,
            topTopics,
            repeatedQuestions,
            meta: {
                totalPapers: req.files.length,
                totalQuestions: allQuestions.length,
            },
        };

        // 👇 store last result
        LAST_RESULT = finalResult;

        res.json(finalResult);
    } catch (err) {
        console.error("ANALYZE ERROR:", err);
        res.status(500).json({ error: "Analysis failed" });
    }
});

// ==================
// LAST RESULT ROUTE (🔥 VERY IMPORTANT)
// ==================
router.get("/last-result", (req, res) => {
    if (!LAST_RESULT) {
        return res.status(404).json({ error: "No analysis yet" });
    }
    res.json(LAST_RESULT);
});

module.exports = router;
