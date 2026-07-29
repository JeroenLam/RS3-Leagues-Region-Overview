#!/usr/bin/env python3

import json
import sys


def remove_keys(data):
    """Recursively remove level_end and link keys from JSON data."""
    if isinstance(data, dict):
        return {
            key: remove_keys(value)
            for key, value in data.items()
            if key not in {"level_end", "link"}
        }

    if isinstance(data, list):
        return [remove_keys(item) for item in data]

    return data


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <json_file>")
        sys.exit(1)

    filename = sys.argv[1]

    try:
        # Read the JSON file
        with open(filename, "r", encoding="utf-8") as file:
            data = json.load(file)

        # Remove the unwanted keys
        filtered_data = remove_keys(data)

        # Write the result back to the original file
        with open(filename, "w", encoding="utf-8") as file:
            json.dump(filtered_data, file, indent=4, ensure_ascii=False)
            file.write("\n")

        print(f"Successfully filtered: {filename}")

    except FileNotFoundError:
        print(f"Error: File not found: {filename}")
        sys.exit(1)

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {filename}")
        print(e)
        sys.exit(1)

    except OSError as e:
        print(f"Error accessing file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
