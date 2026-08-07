# Where to save the extracted data
OUTPUT_CSV = "../output/equilibrium_league_tasks.csv"
OUTPUT_JSON = "../output/equilibrium_league_tasks.json"

import io
import re
import json
import requests
import pandas as pd
from bs4 import BeautifulSoup

URL = "https://runescape.wiki/w/Equilibrium_League/Tasks"

REGION_MAP = {
    "misthalin": "Misthalin",
    "havenhythe": "Havenhythe",
    "kharid": "Desert",
    "karamja": "Karamja",
    "asgarnia": "Asgarnia",
    "kandarin": "Kandarin",
    "fremennik": "Fremennik",
    "desert": "Desert",
    "morytania": "Morytania",
    "wilderness": "Wilderness",
    "tirannwn": "Tirannwn",
    "anac": "Anachronia",
    "anachronia": "Anachronia",
    "global": "Global",
}


def classify_region(filename):
    """
    Convert an image filename into a region name.

    Example:
        'Misthalin_map.png' -> 'Misthalin'
        'Kandarin.png' -> 'Kandarin'
    """

    filename = filename.lower()

    for key, value in REGION_MAP.items():
        if key in filename:
            return value

    return "Global"


def extract_region_from_cell(cell):
    """
    Extract the region image name from the HTML cell.
    """

    if not cell:
        return "Global"

    img = cell.find("img")

    if img:
        # Wiki images usually have the useful name in src/title/alt
        for attr in ["alt", "title", "src"]:
            value = img.get(attr)

            if value:
                return classify_region(value)

    # Fallback if the cell contains text
    return classify_region(cell.get_text())


def scrape_tasks():

    headers = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")}

    response = requests.get(URL, headers=headers, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    target_table = None

    # Find ONLY the table with these headers
    for table in soup.find_all("table"):

        try:
            df = pd.read_html(io.StringIO(str(table)))[0]

        except ValueError:
            continue

        columns = [str(c).strip().lower() for c in df.columns]

        required = {"region", "task", "information", "requirements", "pts"}

        if required.issubset(set(columns)):
            target_table = table
            break

    if target_table is None:
        raise RuntimeError("Could not find the task table.")

    # Extract rows manually so Region images are preserved
    rows = []

    for tr in target_table.find_all("tr"):

        cells = tr.find_all(["td", "th"])

        if len(cells) != 5:
            continue

        region = extract_region_from_cell(cells[0])

        rows.append(
            {
                "Region": region,
                "Task": cells[1].get_text(" ", strip=True),
                "Information": cells[2].get_text(" ", strip=True),
                "Requirements": cells[3].get_text(" ", strip=True),
                "Pts": cells[4].get_text(" ", strip=True),
            }
        )

    return rows


if __name__ == "__main__":

    tasks = scrape_tasks()

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)

    pd.DataFrame(tasks).to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")

    print(f"Saved {len(tasks)} tasks.")
