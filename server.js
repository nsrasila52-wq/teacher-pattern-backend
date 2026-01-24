const express = require("express")
const cors = require("cors")

const analyzeRoute = require("./routes/analyze")

const app = express()
app.use(cors())

app.use("/api", analyzeRoute)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log("Server running on port", PORT)
})
