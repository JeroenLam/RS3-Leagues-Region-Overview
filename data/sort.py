import json

# Load the JSON file
with open("thieving.json", "r", encoding="utf-8") as file:
    data = json.load(file)

# Sort elements by level_start.
# Python's sorted() is stable, so the original order is preserved
# when multiple elements have the same level_start value.
sorted_data = dict(sorted(data.items(), key=lambda item: item[1]["level_start"]))

# Save the sorted JSON
with open("thieving.json", "w", encoding="utf-8") as file:
    json.dump(sorted_data, file, indent=4, ensure_ascii=False)
