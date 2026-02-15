import requests
from bs4 import BeautifulSoup

url = "https://en.wikivoyage.org/wiki/Lisbon"
response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
soup = BeautifulSoup(response.text, 'html.parser')

# Find all headings
print("="*60)
print("HEADINGS FOUND:")
print("="*60)

for heading in soup.find_all(['h2', 'h3', 'h4']):
    headline = heading.find('span', {'class': 'mw-headline'})
    if headline:
        print(f"{heading.name}: {headline.get_text(strip=True)}")

# Check for "Stay safe" section specifically
print("\n" + "="*60)
print("SEARCHING FOR 'Stay safe' SECTION:")
print("="*60)

stay_safe = soup.find(id='Stay_safe')
if stay_safe:
    print("✅ Found 'Stay safe' section via ID")
    parent = stay_safe.parent
    print(f"Parent tag: {parent.name}")
    
    # Get next siblings
    content = parent.find_next_sibling()
    count = 0
    while content and content.name not in ['h2'] and count < 5:
        print(f"\nSibling {count}: {content.name}")
        if content.name == 'p':
            print(f"  Text: {content.get_text(strip=True)[:100]}...")
        count += 1
        content = content.find_next_sibling()
else:
    print("❌ 'Stay safe' section not found via ID")
    
    # Try finding by text
    for h2 in soup.find_all('h2'):
        span = h2.find('span', {'class': 'mw-headline'})
        if span and 'safe' in span.get_text().lower():
            print(f"✅ Found by text search: {span.get_text()}")
