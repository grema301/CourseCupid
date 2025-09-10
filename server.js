const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config();

const session = require("express-session"); 

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "frontend")));

// session middleware (add before mounting api routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
  })
);

// Mount API routes from api-server.js
const { router: apiRouter, pool } = require("./db/api-server");
app.use("/api", apiRouter);


app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "messages.html"))
);
app.get("/chat/:paperId", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

app.get("/quiz", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "quiz.html"))
);

app.post("/quiz-recommendations", async (req, res) => {
  console.log("Received a request for course recommendations."); // ADDED
  const { answers } = req.body;
  const userProfile = answers.join(" ");
  console.log("User profile string:", userProfile); // ADDED

  // We are going to execute the Python script as a separate child process
  const pythonProcess = spawn('python', ['course_matcher.py', userProfile]);
  let dataToSend = '';

  // Listen for data from the python script
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python script output: ${data.toString()}`); // ADDED
    dataToSend += data.toString();
  });

  // Listen for errors from the python script
  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  // When the Python process exits
  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`); // ADDED
    if (code === 0) {
      try {
        const recommendations = JSON.parse(dataToSend);
        console.log("Recommendations parsed successfully."); // ADDED
        res.json({ recommendedCourses: recommendations });
      } catch (e) {
        console.error("Failed to parse JSON from Python script:", e);
        res.status(500).json({ error: "Invalid response from the server." });
      }
    } else {
      console.error(`Python script exited with code ${code}`);
      res.status(500).json({ error: "Failed to get course recommendations." });
    }
  });
});

// handle chat requests
app.post("/api/chat/:paperId", async (req, res) => {
  const paperId = req.params.paperId;
  const message = req.body.message;

  console.log(`Chat request for paper ID: ${paperId} with message: ${message}`);

  const result = await pool.query('SELECT * FROM paper WHERE paper_code = $1', [paperId]);
  const paperData = result.rows[0];

  console.log("Fetched paper data:", paperData);

  if (!paperData) {
    return res.status(404).json({ reply: "Error: Paper not found." });
  }

  const prompt = `You are ${paperData.title} (${paperData.paper_code}), a first-year university paper from the University of Otago. Description: ${paperData.description}.
  You are on a dating app, trying to convince a prospective student to take you as a paper.
  You are playful and flirty, but also informative about your course content and structure.
  Answer the user's questions in short, engaging responses.`;

  console.log(`Generated prompt for paper ID ${paperId}: ${prompt}`);

  try {
    // groq API call
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct", // model
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Error: could not connect to AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
