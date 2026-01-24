const express = require("express")
const cors = require("cors")

const analyzeRoute = require("./routes/analyze")

const app = express()

/* ================= MIDDLEWARE ================= */
app.use(cors())

/* ================= ROUTES ================= */
app.use("/api", analyzeRoute)

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
    res.send("Teacher Pattern Decoder Backend Running")
})

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log("🚀 Backend running on port", PORT)
})
