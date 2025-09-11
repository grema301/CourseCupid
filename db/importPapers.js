const fs = require("fs");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c search_path=hogka652"
});

const rawData = fs.readFileSync("webscrappers/papers_data.json", "utf-8");
const papers = JSON.parse(rawData);

async function importPapers() {
  try {
    for (const paperCode in papers) {
      const paper = papers[paperCode];

      // Skip if any required fields are missing
      if (!paper.paper_code || !paper.title || !paper.subject || !paper.description) {
        console.log(`Skipping ${paperCode}, missing fields`);
        continue;
      }

      // Insert only what you have
      await pool.query(
        `INSERT INTO hogka652.paper (paper_code, title, description, points, is_active)
         VALUES ($1, $2, $3, 18, true)
         ON CONFLICT (paper_code) DO NOTHING`,
        [paper.paper_code, paper.title, paper.description]
      );

      console.log(`Inserted ${paper.paper_code}`);
    }
  } catch (err) {
    console.error("Error importing papers:", err);
  } finally {
    await pool.end();
    console.log("Import complete.");
  }
}

importPapers();
