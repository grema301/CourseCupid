# filter_first_year.py

# Read all paper codes from the existing file
with open("webscrappers/paper_codes.txt", "r") as f:
    paper_codes = [line.strip() for line in f if line.strip()]

# Filter only 100-level papers (5th character == '1')
first_year_papers = [code for code in paper_codes if len(code) >= 5 and code[4] == "1"]

# Save to new file
with open("webscrappers/paper_codes_100.txt", "w") as f:
    for code in first_year_papers:
        f.write(code + "\n")

print(f"✅ Filtered {len(first_year_papers)} first-year papers into paper_codes_100.txt")
