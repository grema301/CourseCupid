import requests
from bs4 import BeautifulSoup

# Target URL
url = "https://search.otago.ac.nz/s/search.html?collection=uoot-prod~sp-otago-search&query=&f.Points%7CpaperPoints=18+points&f.Paper+location%7CpaperLocation=Dunedin&f.Tabs%7Cuoot-prod~ds-otago-papers%2Cuoot-prod~ds-university-of-otago-papers=Course+Papers&num_ranks=1201&sort=url"

# Send GET request
response = requests.get(url)
response.raise_for_status()  # Raise error if request fails

# Parse with BeautifulSoup
soup = BeautifulSoup(response.text, "html.parser")

# Find all h3s with class 'listing-item__title'
paper_elements = soup.select("h3.listing-item__title")

# Extract paper codes (text content)
paper_codes = [el.get_text(strip=True) for el in paper_elements]

# Print results
print(f"Found {len(paper_codes)} paper codes:")
for code in paper_codes[:20]:  # just preview first 20
    print(code)

#save to a file
with open("webscrappers/paper_codes.txt", "w") as f:
    for code in paper_codes:
        f.write(code + "\n")