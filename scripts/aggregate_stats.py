import json

fighters = [
    {"name": "Max Holloway", "salary": 9200, "fight_id": 1, "striking_accuracy": 49.2, "strikes_per_min": 7.1, "takedown_success": 36.0, "takedown_defense": 84.0, "wins": 25, "losses": 7, "draws": 0},
    {"name": "Dustin Poirier", "salary": 7000, "fight_id": 1, "striking_accuracy": 50.1, "strikes_per_min": 5.6, "takedown_success": 38.0, "takedown_defense": 61.0, "wins": 30, "losses": 8, "draws": 0},
    {"name": "Marvin Vettori", "salary": 8600, "fight_id": 2, "striking_accuracy": 42.3, "strikes_per_min": 4.2, "takedown_success": 33.0, "takedown_defense": 65.0, "wins": 19, "losses": 7, "draws": 1},
    {"name": "Brendan Allen", "salary": 7600, "fight_id": 2, "striking_accuracy": 44.7, "strikes_per_min": 3.9, "takedown_success": 47.0, "takedown_defense": 58.0, "wins": 23, "losses": 5, "draws": 0},
    {"name": "Paulo Costa", "salary": 8400, "fight_id": 3, "striking_accuracy": 50.5, "strikes_per_min": 4.8, "takedown_success": 20.0, "takedown_defense": 70.0, "wins": 14, "losses": 3, "draws": 0},
    {"name": "Roman Kopylov", "salary": 7800, "fight_id": 3, "striking_accuracy": 48.1, "strikes_per_min": 4.5, "takedown_success": 25.0, "takedown_defense": 67.0, "wins": 12, "losses": 2, "draws": 0},
    {"name": "Kevin Holland", "salary": 8800, "fight_id": 4, "striking_accuracy": 51.2, "strikes_per_min": 5.2, "takedown_success": 28.0, "takedown_defense": 53.0, "wins": 25, "losses": 10, "draws": 0},
    {"name": "Daniel Rodriguez", "salary": 7400, "fight_id": 4, "striking_accuracy": 47.8, "strikes_per_min": 4.9, "takedown_success": 30.0, "takedown_defense": 60.0, "wins": 17, "losses": 4, "draws": 0},
    {"name": "Kyler Phillips", "salary": 9000, "fight_id": 5, "striking_accuracy": 53.4, "strikes_per_min": 5.8, "takedown_success": 40.0, "takedown_defense": 75.0, "wins": 12, "losses": 2, "draws": 0},
    {"name": "Vinicius Oliveira", "salary": 7200, "fight_id": 5, "striking_accuracy": 46.7, "strikes_per_min": 4.3, "takedown_success": 22.0, "takedown_defense": 62.0, "wins": 20, "losses": 3, "draws": 0},
    {"name": "Dan Ige", "salary": 8500, "fight_id": 6, "striking_accuracy": 46.9, "strikes_per_min": 5.0, "takedown_success": 34.0, "takedown_defense": 68.0, "wins": 18, "losses": 7, "draws": 0},
    {"name": "Joanderson Brito", "salary": 7700, "fight_id": 6, "striking_accuracy": 49.0, "strikes_per_min": 4.7, "takedown_success": 45.0, "takedown_defense": 64.0, "wins": 16, "losses": 3, "draws": 1},
    {"name": "Shara Magomedov", "salary": 8900, "fight_id": 7, "striking_accuracy": 54.1, "strikes_per_min": 5.9, "takedown_success": 15.0, "takedown_defense": 72.0, "wins": 13, "losses": 0, "draws": 0},
    {"name": "Armen Petrosyan", "salary": 7300, "fight_id": 7, "striking_accuracy": 47.5, "strikes_per_min": 4.4, "takedown_success": 20.0, "takedown_defense": 66.0, "wins": 10, "losses": 3, "draws": 0},
    {"name": "Don’Tale Mayes", "salary": 8200, "fight_id": 8, "striking_accuracy": 43.2, "strikes_per_min": 3.7, "takedown_success": 28.0, "takedown_defense": 55.0, "wins": 10, "losses": 6, "draws": 0},
    {"name": "Waldo Cortes Acosta", "salary": 8000, "fight_id": 8, "striking_accuracy": 45.8, "strikes_per_min": 4.0, "takedown_success": 30.0, "takedown_defense": 60.0, "wins": 11, "losses": 2, "draws": 0},
    {"name": "Norma Dumont", "salary": 8700, "fight_id": 9, "striking_accuracy": 48.3, "strikes_per_min": 4.1, "takedown_success": 35.0, "takedown_defense": 70.0, "wins": 11, "losses": 2, "draws": 0},
    {"name": "Germaine de Randamie", "salary": 7500, "fight_id": 9, "striking_accuracy": 46.0, "strikes_per_min": 3.8, "takedown_success": 25.0, "takedown_defense": 68.0, "wins": 10, "losses": 5, "draws": 0},
    {"name": "Ignacio Bahamondes", "salary": 8300, "fight_id": 10, "striking_accuracy": 49.7, "strikes_per_min": 4.6, "takedown_success": 22.0, "takedown_defense": 65.0, "wins": 15, "losses": 5, "draws": 0},
    {"name": "Manuel Torres", "salary": 7900, "fight_id": 10, "striking_accuracy": 48.2, "strikes_per_min": 4.8, "takedown_success": 38.0, "takedown_defense": 62.0, "wins": 14, "losses": 2, "draws": 0}
]

def aggregate_stats(fighters, output_file="../public/fighters.json"):
    for i, fighter in enumerate(fighters, 1):
        fighter["id"] = i
    with open(output_file, "w") as f:
        json.dump(fighters, f, indent=2)

if __name__ == "__main__":
    output_file = "../public/fighters.json"
    aggregate_stats(fighters, output_file)
    print(f"Enhanced fighter data saved to {output_file}")