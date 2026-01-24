const express = require("express")
const multer = require("multer")
const pdfParse = require("pdf-parse")

const router = express.Router()

// Multer memory storage
const upload = multer({
    storage: multer.memoryStorage(),
})

// VERY SIMPLE topic extractor (abhi basic, improve baad me)
function extractTopics(text) {
    const TOPICS = [
        "Electrostatics",
        "Electrolysis",
        "Optics",
        "Current Electricity",
        "Magnetism",
        "Thermodynamics",
    ]

    const found = []

    TOPICS.forEach((topic) => {
        const regex = new RegExp(topic, "i")
        if (regex.test(text)) {
            found.push(topic)
        }
    })

    return found
}

router.post("/analyze", upload.array("pdfs"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No PDFs uploaded" })
        }

        let topicCount = {}
        let totalPapers = req.files.length

        // 🔁 LOOP ALL PDFs
        for (const file of req.files) {
            const data = await pdfParse(file.buffer)
            const text = data.text || ""

            const topics = extractTopics(text)

            topics.forEach((topic) => {
                topicCount[topic] = (topicCount[topic] || 0) + 1
            })
        }

        // 📊 Build result
        const topTopics = Object.entries(topicCount).map(
            ([topic, count]) => ({
                topic,
                probability: Math.round((count / totalPapers) * 100),
            })
        )

        // Sort high → low
        topTopics.sort((a, b) => b.probability - a.probability)

        const predictionSentence =
            topTopics.length > 0
                ? `Based on analysis of last ${totalPapers} papers, ${
                      topTopics[0].topic
                  } has a high probability (${topTopics[0].probability}%) of appearing again.`
                : "Not enough data to generate prediction."

        return res.json({
            total_papers: totalPapers,
            prediction_sentence: predictionSentence,
            top_topics: topTopics,
        })
    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err)
        res.status(500).json({ error: "PDF analysis failed" })
    }
})

module.exports = router
