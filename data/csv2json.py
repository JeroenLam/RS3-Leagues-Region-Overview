import csv
import json
import argparse
from pathlib import Path


def parse_regions(region_text):
    """
    Convert a comma-separated region string into a list.

    Example:
        "Kandarin, Asgarnia"
        -> ["Kandarin", "Asgarnia"]
    """
    if not region_text:
        return []

    return [region.strip() for region in region_text.split(",") if region.strip()]


def convert_csv_to_json(
    input_file, output_file, image_prefix="", default_hover_text=""
):
    output = {}

    with open(input_file, "r", encoding="utf-8", newline="") as csv_file:
        reader = csv.reader(csv_file, delimiter=";")

        for row_number, row in enumerate(reader, start=1):
            # Skip completely empty rows
            if not row or not any(field.strip() for field in row):
                continue

            # Remove whitespace from every field
            row = [field.strip() for field in row]

            # Expected format:
            # Name; Level; Region(s); Image
            if len(row) < 4:
                print(
                    f"Warning: Skipping row {row_number}: "
                    f"expected at least 4 fields, got {len(row)}"
                )
                continue

            name = row[0]
            level_text = row[1]
            region_text = row[2]

            # The image may be empty, so combine everything after
            # the third field in case there are accidental extra semicolons.
            image = row[3]

            # Skip header rows if present
            if name.lower() in ("name", "item", "activity"):
                continue

            try:
                level_start = int(level_text)
            except ValueError:
                print(
                    f"Warning: Skipping row {row_number}: "
                    f"invalid level '{level_text}'"
                )
                continue

            regions = parse_regions(region_text)

            # Build the JSON object
            entry = {
                "level_start": level_start,
                "sort_weight": 1,
                "region": {"anyOf": regions},
                "image": (
                    f"{image_prefix}/{image}" if image_prefix and image else image
                ),
                "hover_text": default_hover_text,
            }

            output[name] = entry

    with open(output_file, "w", encoding="utf-8") as json_file:
        json.dump(output, json_file, indent=4, ensure_ascii=False)

    print(f"Converted {len(output)} entries.")
    print(f"Output written to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Convert a semicolon-separated CSV to JSON."
    )

    parser.add_argument("input", help="Path to the input CSV file")

    parser.add_argument("output", help="Path to the output JSON file")

    parser.add_argument(
        "--image-prefix",
        default="",
        help="Optional prefix for image paths, e.g. 'item/mining'",
    )

    parser.add_argument(
        "--hover-text", default="", help="Default hover text for every entry"
    )

    args = parser.parse_args()

    convert_csv_to_json(
        input_file=args.input,
        output_file=args.output,
        image_prefix=args.image_prefix,
        default_hover_text=args.hover_text,
    )


if __name__ == "__main__":
    main()
