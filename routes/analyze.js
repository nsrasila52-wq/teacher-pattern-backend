const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ================= SUBJECT KEYWORDS ================= */

const SUBJECTS = {
    Physics: ["force", "velocity", "acceleration", "current", "voltage", "resistance", "ray", "lens", "mirror", "thermodynamics", "electric", "magnetic"],
    Chemistry: ["reaction", "mole", "acid", "base", "salt", "electrolysis", "oxidation", "reduction", "compound"],
    Biology: ["cell", "tissue", "photosynthesis", "respiration", "enzyme", "genetics", "organism"],
    Maths: ["equation", "theorem", "proof", "integral", "derivative", "matrix", "probability", "algebra", "geometry"],
    Accounts: ["debit", "credit", "balance sheet", "ledger", "journal", "profit", "loss", "assets"],
    Business: ["management", "planning", "organising", "staffing", "marketing", "finance"],
    Economics: ["demand", "supply", "elasticity", "inflation", "gdp", "market"],
    SST: ["history", "geography", "civics", "democracy", "constitution"],
    IT: ["algorithm", "database", "program", "software", "hardware", "network"]
};

/* ================= TOPIC KEYWORDS ================= */

const TOPICS = {
    Physics: {
        Mechanics: ["force", "motion", "velocity", "acceleration", "newton"],
        Optics: ["ray", "lens", "mirror", "reflection", "refraction"],
        Electricity: ["current", "voltage", "resistance", "ohm"],
        Thermodynamics: ["heat", "temperature", "energy"]
    },
    Maths: {
        Algebra: ["equation", "polynomial", "expression"],
        Calculus: ["derivative", "integral", "limit"],
        Probability: ["probability", "chance", "random"],
        Geometry: ["triangle", "circle", "theorem"]
    },
    Chemistry: {
        Electrochemistry: ["electrolysis", "electrode"],
        AcidsBases: ["acid", "base", "salt"],
        Reactions: ["reaction", "oxidation", "reduction"]
    }
};

/* ================= ANALYZE ROUTE ================= */

router.post("/analyze", upload.array("pdfs"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({ prediction_sentence: "Not enough data to generate prediction.", top_topics: [] });
        }

        let fullText = "";

        for (const file of req.files) {
            const data = await pdfParse(file.buffer);
            fullText += data.text.toLowerCase();
        }

        /* ===== SUBJECT DETECTION ===== */

        let subjectScores = {};

        for (const subject in SUBJECTS) {
            subjectScores[subject] = SUBJECTS[subject].filter(k => fullText.includes(k)).length;
        }

        const detectedSubject = Object.keys(subjectScores).reduce((a, b) =>
            subjectScores[a] > subjectScores[b] ? a : b
        );

        if (!TOPICS[detectedSubject]) {
            return res.json({
                prediction_sentence: "Not enough data to generate prediction.",
                top_topics: []
            });
        }

        /* ===== TOPIC COUNT ===== */

        let topicCounts = {};
        let total = 0;

        for (const topic in TOPICS[detectedSubject]) {
            const count = TOPICS[detectedSubject][topic].filter(k => fullText.includes(k)).length;
            if (count > 0) {
                topicCounts[topic] = count;
                total += count;
            }
        }

        if (total === 0) {
            return res.json({
                prediction_sentence: "Not enough data to generate prediction.",
                top_topics: []
            });
        }

        /* ===== NORMALIZE TO 100% ===== */

        let topTopics = Object.entries(topicCounts)
            .map(([topic, count]) => ({
                topic,
                probability: Math.round((count / total) * 100)
            }))
            .filter(t => t.probability >= 5)
            .sort((a, b) => b.probability - a.probability);

        const mainTopic = topTopics[0].topic;

        res.json({
            prediction_sentence: `${mainTopic} has high chances of appearing again.`,
            subject: detectedSubject,
            top_topics: topTopics
        });

    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err);
        res.status(500).json({ prediction_sentence: "PDF analysis failed", top_topics: [] });
    }
});

module.exports = router;
