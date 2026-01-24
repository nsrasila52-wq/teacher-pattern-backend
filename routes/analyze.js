const express = require("express")
const multer = require("multer")
const pdfParse = require("pdf-parse")

const router = express.Router()

// =======================
// MULTER CONFIG
// =======================
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

// =======================
// SUBJECT KEYWORDS (LOCKED)
// =======================
const SUBJECT_KEYWORDS = {
    Electrochemistry: ["electrolysis", "electrode", "faraday", "electrochemical"],
    Thermodynamics: ["enthalpy", "entropy", "gibbs", "heat"],
    Optics: ["lens", "mirror", "refraction", "diffraction"],
    Mechanics: ["force", "motion", "velocity", "acceleration"],
    CurrentElectricity: ["current", "ohm", "resistance", "circuit"],
    Magnetism: ["magnetic", "flux", "induction"],
    General: [],
}

// =======================
// ANALYZE ROUTE
// =======================
router.post("/analyze", upload.array("pdfs"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No PDFs uploaded" })
        }

        let combinedText = ""

        // 🔹 Parse all PDFs
        for (const file of req.files) {
            const parsed = await pdfParse(file.buffer)
            combinedText += " " + parsed.text.toLowerCase()
        }

        // =======================
        // TOPIC COUNTING
        // =======================
        const topicCount = {}
        let totalHits = 0

        for (const topic in SUBJECT_KEYWORDS) {
            let count = 0
            SUBJECT_KEYWORDS[topic].forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, "g")
                const matches = combinedText.match(regex)
                if (matches) count += matches.length
            })

            if (count > 0) {
                topicCount[topic] = count
                totalHits += count
            }
        }

        // =======================
        // SAFETY: NO DATA
        // =======================
        if (totalHits === 0) {
            return res.json({
                prediction_sentence: "Not enough data to generate prediction.",
                top_topics: [],
            })
        }

        // =======================
        // CALCULATE PROBABILITY
        // =======================
        const topTopics = Object.entries(topicCount)
            .map(([topic, count]) => ({
                topic,
                probability: Math.round((count / totalHits) * 100),
            }))
            .sort((a, b) => b.probability - a.probability)

        const main = topTopics[0]

        // =======================
        // FINAL RESPONSE
        // =======================
        res.json({
            prediction_sentence: `${main.topic} has high chances of appearing again.`,
            top_topics: topTopics,
        })
    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err)
        res.status(500).json({ error: "PDF analysis failed" })
    }
})

module.exports = router
