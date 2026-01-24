const express = require("express")
const router = express.Router()
const multer = require("multer")
const pdfParse = require("pdf-parse")

/* -------------------- FILE UPLOAD -------------------- */
const upload = multer({ storage: multer.memoryStorage() })

/* -------------------- SUBJECT KEYWORDS -------------------- */
const SUBJECT_KEYWORDS = {
  science: [
    "physics", "chemistry", "biology", "force", "energy", "reaction",
    "current", "voltage", "acid", "base", "cell", "motion", "heat"
  ],
  maths: [
    "equation", "theorem", "triangle", "algebra", "geometry",
    "calculus", "integral", "derivative", "probability"
  ],
  accounts: [
    "ledger", "debit", "credit", "journal", "balance sheet",
    "trial balance", "capital", "liability", "asset"
  ],
  business: [
    "management", "planning", "organising", "marketing",
    "business", "enterprise", "staffing"
  ],
  sst: [
    "history", "geography", "civics", "democracy",
    "constitution", "parliament", "resources"
  ],
  it: [
    "computer", "algorithm", "database", "programming",
    "software", "hardware", "network"
  ]
}

/* -------------------- TOPICS BY SUBJECT -------------------- */
const TOPICS_BY_SUBJECT = {
  science: {
    Mechanics: ["force", "motion", "newton"],
    Thermodynamics: ["heat", "temperature", "thermodynamics"],
    Electrostatics: ["charge", "electric", "electrostatic"],
    CurrentElectricity: ["current", "voltage", "resistance"],
    Chemistry: ["reaction", "acid", "base", "salt"],
    Biology: ["cell", "tissue", "plant", "animal"]
  },
  maths: {
    Algebra: ["algebra", "equation", "polynomial"],
    Geometry: ["triangle", "circle", "angle"],
    Calculus: ["derivative", "integral", "limit"],
    Probability: ["probability", "chance"]
  },
  accounts: {
    Ledger: ["ledger"],
    Journal: ["journal"],
    TrialBalance: ["trial balance"],
    BalanceSheet: ["balance sheet"],
    Depreciation: ["depreciation"]
  },
  business: {
    Management: ["management"],
    Marketing: ["marketing"],
    Planning: ["planning"],
    Staffing: ["staffing"]
  },
  sst: {
    History: ["history"],
    Geography: ["geography"],
    Civics: ["democracy", "constitution"]
  },
  it: {
    Programming: ["programming", "code"],
    Database: ["database"],
    Networking: ["network"]
  }
}

/* -------------------- SUBJECT DETECTION -------------------- */
function detectSubject(text) {
  let scores = {}

  for (const subject in SUBJECT_KEYWORDS) {
    scores[subject] = 0
    SUBJECT_KEYWORDS[subject].forEach(word => {
      if (text.includes(word)) scores[subject]++
    })
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  return sorted[0][1] === 0 ? null : sorted[0][0]
}

/* -------------------- ANALYZE ROUTE -------------------- */
router.post(
  "/analyze",
  upload.array("pdfs"),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.json({
          prediction_sentence: "Not enough data to generate prediction.",
          top_topics: []
        })
      }

      /* ---- Read all PDFs ---- */
      let fullText = ""
      for (const file of req.files) {
        const data = await pdfParse(file.buffer)
        fullText += " " + data.text.toLowerCase()
      }

      /* ---- Detect subject ---- */
      const subject = detectSubject(fullText)
      if (!subject) {
        return res.json({
          prediction_sentence: "Not enough data to generate prediction.",
          top_topics: []
        })
      }

      /* ---- Topic analysis ---- */
      const topics = TOPICS_BY_SUBJECT[subject]
      let topicCounts = {}
      let totalHits = 0

      for (const topic in topics) {
        topicCounts[topic] = 0
        topics[topic].forEach(word => {
          if (fullText.includes(word)) {
            topicCounts[topic]++
            totalHits++
          }
        })
      }

      if (totalHits === 0) {
        return res.json({
          prediction_sentence: "Not enough data to generate prediction.",
          top_topics: []
        })
      }

      /* ---- Calculate probability ---- */
      let topTopics = Object.entries(topicCounts)
        .map(([topic, count]) => ({
          topic,
          probability: Math.round((count / totalHits) * 100)
        }))
        .filter(t => t.probability >= 10) // 🚫 remove low % noise
        .sort((a, b) => b.probability - a.probability)

      if (topTopics.length === 0) {
        return res.json({
          prediction_sentence: "Not enough data to generate prediction.",
          top_topics: []
        })
      }

      /* ---- Prediction sentence ---- */
      const mainTopic = topTopics[0].topic
      const prediction_sentence =
        `${mainTopic} has high chances of appearing again.`

      res.json({
        prediction_sentence,
        top_topics: topTopics
      })
    } catch (err) {
      console.error("PDF ANALYSIS ERROR:", err)
      res.status(500).json({
        prediction_sentence: "PDF analysis failed.",
        top_topics: []
      })
    }
  }
)

module.exports = router
