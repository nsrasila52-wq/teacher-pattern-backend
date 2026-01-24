const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

/* ================================
   🔑 MASTER SUBJECT KEYWORDS
================================ */

const SUBJECT_KEYWORDS = {
    // 🔢 MATHS
    Mathematics: [
        "solve", "calculate", "find", "prove", "equation", "value",
        "derivative", "integration", "limit", "matrix", "determinant",
        "probability", "statistics", "mean", "median", "mode",
        "vector", "algebra", "trigonometry", "geometry"
    ],

    // ⚡ PHYSICS
    Physics: [
        "force", "motion", "velocity", "acceleration", "current",
        "voltage", "resistance", "power", "energy", "work",
        "ray", "mirror", "lens", "refraction", "reflection",
        "mechanics", "electrostatics", "magnetism",
        "thermodynamics", "heat", "wave", "frequency"
    ],

    // 🧪 CHEMISTRY
    Chemistry: [
        "reaction", "chemical", "equation", "mole", "molar",
        "oxidation", "reduction", "electrolysis",
        "acid", "base", "salt", "ph", "compound", "mixture",
        "organic", "inorganic", "carbon", "hydrocarbon"
    ],

    // 🌱 BIOLOGY
    Biology: [
        "cell", "tissue", "organ", "respiration",
        "photosynthesis", "enzyme", "genetics",
        "reproduction", "plant", "animal", "ecosystem",
        "nutrition", "digestion", "circulation"
    ],

    // 📊 BUSINESS STUDIES
    Business: [
        "management", "planning", "organising", "staffing",
        "directing", "controlling", "marketing", "finance",
        "business", "entrepreneur", "enterprise"
    ],

    // 💰 ACCOUNTANCY
    Accountancy: [
        "debit", "credit", "journal", "ledger", "balance",
        "trial", "profit", "loss", "capital", "assets",
        "liabilities", "depreciation", "goodwill"
    ],

    // 📈 ECONOMICS
    Economics: [
        "demand", "supply", "elasticity", "market",
        "inflation", "gdp", "national income",
        "production", "consumption", "utility"
    ],

    // 🌍 SST
    SST: [
        "history", "geography", "civics", "constitution",
        "democracy", "parliament", "resources", "climate",
        "population", "industry", "agriculture"
    ],

    // 💻 IT / CS
    IT: [
        "algorithm", "program", "code", "software",
        "hardware", "database", "network", "internet",
        "python", "java", "html", "css", "computer"
    ]
};

/* ================================
   🧠 HELPER FUNCTIONS
================================ */

function normalize(text) {
    return text.toLowerCase();
}

function countKeywords(text) {
    const scores = {};
    const cleanText = normalize(text);

    for (const subject in SUBJECT_KEYWORDS) {
        scores[subject] = 0;

        SUBJECT_KEYWORDS[subject].forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, "g");
            const matches = cleanText.match(regex);
            if (matches) scores[subject] += matches.length;
        });
    }

    return scores;
}

/* ================================
   🚀 ANALYZE ROUTE
================================ */

router.post("/analyze", upload.array("pdfs"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({
                prediction_sentence: "Please upload at least one PDF.",
                top_topics: []
            });
        }

        let combinedText = "";

        for (const file of req.files) {
            const parsed = await pdfParse(file.buffer);
            combinedText += " " + parsed.text;
        }

        const scores = countKeywords(combinedText);
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        if (totalScore === 0) {
            return res.json({
                prediction_sentence:
                    "Analysis based on theory-heavy papers. Prediction confidence is low.",
                top_topics: []
            });
        }

        // 🔥 convert to probabilities
        let topics = Object.entries(scores).map(([topic, count]) => ({
            topic,
            probability: Math.round((count / totalScore) * 100)
        }));

        // ❌ remove very low probability topics (<=2%)
        topics = topics.filter(t => t.probability > 2);

        // 🔝 sort descending
        topics.sort((a, b) => b.probability - a.probability);

        const topTopic = topics[0];

        return res.json({
            prediction_sentence: topTopic
                ? `${topTopic.topic} has high chances of appearing again.`
                : "Prediction could not be determined confidently.",
            top_topics: topics
        });

    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err);
        res.json({
            prediction_sentence:
                "PDF analysis failed due to unreadable content.",
            top_topics: []
        });
    }
});

module.exports = router;
