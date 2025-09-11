import requests
from bs4 import BeautifulSoup
import json

BASE_URL = "https://www.otago.ac.nz/courses/papers?papercode="

def scrape_paper_info(code):
    url = BASE_URL + code
    response = requests.get(url)
    if response.status_code != 200:
        print(f"❌ Failed to fetch {code} ({response.status_code})")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    # Corrected selectors
    title_tag = soup.select_one("td.papertitle")
    subject_tag = soup.select_one("tr.subject_code td a")
    overview_tag = soup.select_one("p.prescription")

    title = title_tag.get_text(strip=True) if title_tag else None
    subject = subject_tag.get_text(strip=True) if subject_tag else None
    overview = overview_tag.get_text(strip=True) if overview_tag else None

    return {
        "code": code,
        "title": title,
        "subject": subject,
        "overview": overview,
    }

def main():
    # Read only 100-level papers for now
    with open("webscrappers/paper_codes_100.txt", "r") as f:
        codes = [line.strip() for line in f if line.strip()]

    all_data = {}
    for i, code in enumerate(codes, 1):
        print(f"[{i}/{len(codes)}] Scraping {code}...")
        info = scrape_paper_info(code)
        if info:
            all_data[code] = info

    # Save to JSON
    with open("webscrappers/papers_data.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(all_data)} papers to papers_data.json")

if __name__ == "__main__":
    main()
