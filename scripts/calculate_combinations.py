import json
import itertools

def load_fighters(file_path="../public/fighters.json"):
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: {file_path} not found")
        return []

def calculate_combinations(fighters, max_salary=50000, team_size=6):
    valid_combinations = []
    fight_ids = set(f["fight_id"] for f in fighters)

    for combo in itertools.combinations(fighters, team_size):
        if sum(f["salary"] for f in combo) <= max_salary:
            combo_fight_ids = set(f["fight_id"] for f in combo)
            if len(combo_fight_ids) == team_size:
                valid_combinations.append([f["id"] for f in combo])

    return valid_combinations

def save_combinations(combinations, output_file="../public/combinations.json"):
    with open(output_file, "w") as f:
        json.dump(combinations, f, indent=2)

if __name__ == "__main__":
    fighters = load_fighters()
    for i, f in enumerate(fighters, 1):
        f["id"] = i
    combinations = calculate_combinations(fighters)
    save_combinations(combinations)
    print(f"Generated {len(combinations)} valid combinations")