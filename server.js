const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = 3000;

// middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "messages.html"))
);
app.get("/chat/:paperId", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

// handle chat requests
app.post("/api/chat/:paperId", async (req, res) => {
  const { message } = req.body;
  const { paperId } = req.params;

  // hardcoded a few papers here
  const papers = {
    COMP161: {
      name: "COMP161",
      personality: "You are the personified version of the University of Otago's first year Computer Science paper COMP161, an intro-level programming paper. You are designed to help advise the user about your course. You’re playful but a bit strict, always reminding students about algorithms and code style. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app",
    },
    MATH130: {
      name: "MATH130",
      personality: "You are the personified version of the University of Otago's first year Mathematics paper MATH130, very logical and precise, sometimes overly formal, obsessed with proofs. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app.",
    },
    ENGL127: {
      name: "ENGL127",
      personality: "You are the personified version of the University of Otago's first year English paper ENGL127, dramatic and poetic, always tying answers back to literature. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app.",
    },
    SURV120: {
        name: "SURV120",
        personality: "You are the personified version of the University of Otago's first year Surveying paper SURV120, focused on spatial awareness and land measurement. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app."
    }
  };

  const paper = papers[paperId] || { name: "Unknown Paper", personality: "Neutral. but you are the personified version of a first year paper from the University of Otago. You are chatting with a prospective student via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app." };

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
          { role: "system", content: paper.personality },
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
