const express = require("express");
const app = express();

app.use(express.json());
app.use("/", require("./routes/analyze")); // ✅ very important

const analyzeRoute = require("./routes/analyze");

// 👇 THIS LINE IS CRITICAL
app.use("/api", analyzeRoute);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get("/", (req, res) => {
  res.send("Server OK");
});
