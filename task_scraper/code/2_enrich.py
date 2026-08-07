import json
import re

# ==========================
# Configuration
# ==========================

INPUT_JSON = "../output/equilibrium_league_tasks.json"
OUTPUT_JSON = "../output/equilibrium_league_tasks_enriched.json"


# ==========================
# Tagging rules
# ==========================

TAG_RULES = {
    "Attack": [
        r"attack level",
        r"attack xp",
        r"weapon",
        r"accuracy",
    ],
    "Constitution": [
        r"\bconstitution\b",
        r"hitpoints",
        r"hit points",
        r"hp level",
    ],
    "Mining": [
        r"\bmine\b",
        r"mining",
        r" ore",
        r" rock",
        r"geodes",
    ],
    "Strength": [
        r"\bstrength\b",
        r"strength level",
        r"melee damage",
    ],
    "Agility": [
        r"\bagility\b",
        r"agility course",
        r"lap",
    ],
    "Smithing": [
        r"smith",
        r"smithing",
        r"forge",
        r"anvil",
        r"Artisans' Workshop",
        r"Smelt",
    ],
    "Defence": [
        r"defence",
        r"armor",
        r"armour",
        r"equip",
    ],
    "Herblore": [
        r"herblore",
        r"potion",
        r"herb",
        r"grimy",
    ],
    "Fishing": [
        r"fish",
        r"fishing",
        r"catch",
    ],
    "Ranged": [
        r"ranged",
        r"bow",
        r"crossbow",
        r"arrow",
    ],
    "Thieving": [
        r"thiev",
        r"pickpocket",
        r"steal",
    ],
    "Cooking": [
        r"cook",
        r"cooking",
        r"food",
    ],
    "Prayer": [
        r"prayer",
        r"altar",
        r"bone",
        r"bury",
        r"Scatter",
        r"ashes",
    ],
    "Crafting": [
        r"craft",
        r"crafting",
        r"jewellery",
        r"jewelry",
        r"Spin",
    ],
    "Firemaking": [
        r"firemaking",
        r"light.*fire",
        r"log",
        r"Burn",
    ],
    "Magic": [
        r"magic",
        r"spell",
        r"teleport",
        r"rune",
    ],
    "Fletching": [
        r"fletch",
        r"arrow",
        r"bow",
    ],
    "Woodcutting": [
        r"woodcut",
        r"chop",
        r"Chop",
        r" log",
        r"cut.*tree",
    ],
    "Runecrafting": [
        r"runecraft",
        r"rune altar",
        r"rune",
    ],
    "Slayer": [
        r"slayer",
        r"slayer task",
        r"monster",
    ],
    "Farming": [
        r"farm",
        r"farming",
        r"patch",
        r"seed",
        r"beans",
    ],
    "Construction": [
        r"construction",
        r"plank",
    ],
    "Hunter": [
        r"hunter",
        r"trap",
        r"chinchompa",
    ],
    "Summoning": [
        r"summoning",
        r"familiar",
        r"pouch",
    ],
    "Dungeoneering": [
        r"dungeoneering",
        r"dungeon",
        r"Daemonheim",
    ],
    "Divination": [
        r"divination",
        r"wisp",
        r"memory",
        r"engram",
    ],
    "Invention": [
        r"invention",
        r"augment",
        r"perk",
    ],
    "Archaeology": [
        r"archaeology",
        r"artefact",
        r"artifact",
        r"excavate",
    ],
    "Necromancy": [
        r"necromancy",
        r"ritual",
        r"conjure",
    ],
    # ======================
    # Activity categories
    # ======================
    "Questing": [
        r"quest",
        r"complete.*story",
        r"achievement diary",
        r"Leagues tutorial",
        r"diary",
    ],
    "Combat": [
        r" kill",
        r"Kill a",
        r"defeat",
        r"boss",
        r"combat",
        r"enemy",
        r"monster",
        r"multicannon",
    ],
    "Exploration": [
        r"visit",
        r"travel",
        r"explore",
        r"discover",
        r"location",
        r"sail",
        r"enter",
        r"collect",
        r"climb",
        r"use the bank",
        r"talk to",
        r"Stronghold of Player Safety",
        r"oaken key",
        r"lodestone",
        r"crystal chest",
        r"Wilderness wall",
        r"Charter",
        r"ectophial",
        r"Pan for",
        r"Give Bill",
        r"Milk a cow",
        r"Ned make you some rope",
        r"Pick 5 flax",
        r"Eat a",
    ],
    "Minigame": [
        r"Temple Trek",
        r"Tears of Guthix",
        r"clue scroll",
        r"clues",
        r"Het's Oasis",
        r"Shattered Worlds",
    ],
}


# ==========================
# Tagging functions
# ==========================


def get_search_text(task):
    """
    Combine relevant fields into searchable text.
    """

    fields = [
        task.get("Task", ""),
        task.get("Information", ""),
        task.get("Requirements", ""),
    ]

    return " ".join(fields).lower()


def assign_tags(task):
    """
    Return all matching tags for a task.
    """

    text = get_search_text(task)

    tags = []

    for tag, patterns in TAG_RULES.items():

        for pattern in patterns:

            if re.search(pattern, text, flags=re.IGNORECASE):
                tags.append(tag)
                break

    return tags


def enrich_tasks(tasks):

    for task in tasks:
        task["Tags"] = assign_tags(task)

    return tasks


# ==========================
# Main
# ==========================

if __name__ == "__main__":

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        tasks = json.load(f)

    enriched = enrich_tasks(tasks)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)

    print(f"Enriched {len(enriched)} tasks.")
    print(f"Output: {OUTPUT_JSON}")
