const express = require("express")
const router = express.Router()
const multer = require("multer")
const pdfParse = require("pdf-parse")

const upload = multer({
    storage: multer.memoryStorage(),
})

router.post(
    "/analyze",
    upload.array("pdfs"), // 👈 IMPORTANT
    async (req, res) => {
        try {
            const files = req.files

            if (!files || files.length === 0) {
                return res.status(400).json({
                    error: "No PDFs received",
                })
            }

            let combinedText = ""

            for (const file of files) {
                const parsed = await pdfParse(file.buffer)
                combinedText += "\n" + parsed.text
            }

            // 🔹 TEMP SIMPLE LOGIC (abhi same result aa sakta hai)
            const result = {
                total_papers: files.length,
                prediction_sentence: `Based on analysis of ${files.length} papers, Electrostatics has a high probability (50%) of appearing again.`,
                top_topics: [
                    { topic: "Electrostatics", probability: 50 },
                    { topic: "Optics", probability: 50 },
                ],
            }

            res.json(result)
        } catch (err) {
            console.error("PDF ANALYSIS ERROR:", err)
            res.status(500).json({ error: "PDF analysis failed" })
        }
    }
)

module.exports = router
