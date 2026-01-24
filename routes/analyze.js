const pdfParse = require("pdf-parse")

module.exports = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No PDF uploaded" })
        }

        const data = await pdfParse(req.file.buffer)
        const text = data.text || ""

        console.log("PDF parsed successfully")

        // 🔥 TEMP TOPIC EXTRACTION (SAFE)
        const topics = []

        if (text.toLowerCase().includes("electrolysis")) {
            topics.push({ topic: "Electrolysis", probability: 50 })
        }

        if (text.toLowerCase().includes("current")) {
            topics.push({ topic: "Current Electricity", probability: 35 })
        }

        // 🔥 FINAL SAFETY NET
        const finalTopics =
            topics.length > 0
                ? topics
                : [{ topic: "General Physics", probability: 25 }]

        return res.json({
            prediction_sentence: `${finalTopics[0].topic} — ${finalTopics[0].probability}% chance`,
            top_topics: finalTopics
        })
    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err)
        res.status(500).json({ error: "PDF analysis failed" })
    }
}
