const express = require("express")
const multer = require("multer")
const pdfParse = require("pdf-parse")

const router = express.Router()

/* ================= MULTER SETUP ================= */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

/* ================= ANALYZE ROUTE ================= */
router.post("/analyze", upload.single("pdf"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No PDF uploaded" })
        }

        /* ✅ FIXED: buffer comes from req.file.buffer */
        const pdfData = await pdfParse(req.file.buffer)
        const text = pdfData.text || ""

        /* 🔹 SIMPLE DEMO ANALYSIS (real parsing later) */
        const topics = []
        if (text.toLowerCase().includes("electrostatics"))
            topics.push("Electrostatics")
        if (text.toLowerCase().includes("optics"))
            topics.push("Optics")

        const uniqueTopics = [...new Set(topics)]

        /* ================= RESPONSE ================= */
        const response = {
            total_papers: 1,
            prediction_sentence:
                "Based on analysis of last 1 papers, Electrostatics appeared 2 times and has a high probability (50%) of appearing again.",
            top_topics: uniqueTopics.map((t) => ({
                topic: t,
                probability: 50,
            })),
        }

        res.json(response)
    } catch (err) {
        console.error("PDF ANALYSIS ERROR:", err)
        res.status(500).json({ error: "PDF analysis failed" })
    }
})

module.exports = router
