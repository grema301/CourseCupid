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
  const insertedPapers = [];
  try {
    for (const paperCode in papers) {
      const paper = papers[paperCode];

      // Skip if any required fields are missing
      if (!paper.paper_code || !paper.title || !paper.subject || !paper.description) {
        console.log(`Skipping ${paperCode}, missing fields`);
        continue;
      }

      // Insert only what you have
      const result = await pool.query(
        `INSERT INTO hogka652.paper (paper_code, title, description, points, is_active)
         VALUES ($1, $2, $3, 18, true)
         ON CONFLICT (paper_code) DO NOTHING
         RETURNING paper_code`,
        [paper.paper_code, paper.title, paper.description]
      );

      if (result.rows.length > 0) {
        insertedPapers.push(paper);
        console.log(`Inserted ${paper.paper_code}`);
      }
    }
  } catch (err) {
    console.error("Error importing papers:", err);
  } finally {
    await pool.end();
    // Write inserted papers to a separate JSON file
    fs.writeFileSync("imported_papers.json", JSON.stringify(insertedPapers, null, 2), "utf-8");
    console.log("Import complete. Inserted papers written to imported_papers.json");
  }
}

importPapers();
