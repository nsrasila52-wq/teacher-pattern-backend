const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors()); // 🔥 VERY IMPORTANT
app.use(express.json());

const analyzeRoute = require("./routes/analyze");
app.use("/api", analyzeRoute);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
