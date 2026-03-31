import os
import json
import time
import subprocess
import sys
from datetime import datetime

# ANSI color codes
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"

def print_welcome():
    print(f"{GREEN}███████╗██╗   ██╗███╗   ███╗███████╗███████╗██████╗ ██╗   ██╗")
    print("██╔════╝██║   ██║████╗ ████║██╔════╝██╔════╝██╔══██╗██║   ██║")
    print("███████╗██║   ██║██╔████╔██║█████╗  ███████╗██████╔╝██║   ██║")
    print("╚════██║██║   ██║██║╚██╔╝██║██╔══╝  ╚════██║██╔══██╗██║   ██║")
    print("███████║╚██████╔╝██║ ╚═╝ ██║███████╗███████║██║  ██║╚██████╔╝")
    print("╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝")
    print(f"{RESET}UFC Admin Helper - {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

def confirm_action(prompt):
    while True:
        choice = input(f"{YELLOW}{prompt} (y/n): {RESET}").lower()
        if choice in ['y', 'n']:
            return choice == 'y'
        print(f"{RED}Please enter 'y' or 'n'{RESET}")

def run_full_update():
    dk_file = "DKSalaries.csv"
    if not os.path.exists(dk_file):
        print(f"{RED}Error: {dk_file} not found. Cannot proceed with update.{RESET}")
        return

    if not confirm_action("This will run aggregate_stats.py and calculate_combinations.py. Continue?"):
        return

    try:
        print(f"{GREEN}Running aggregate_stats.py...{RESET}")
        subprocess.run(["python3", "scripts/aggregate_stats.py"], check=True)
        
        print(f"{GREEN}Running calculate_combinations.py...{RESET}")
        subprocess.run(["python3", "scripts/calculate_combinations.py"], check=True)
        
        print(f"{GREEN}Full update completed successfully.{RESET}")
    except subprocess.CalledProcessError as e:
        print(f"{RED}Error during update: {e}{RESET}")

def check_site_health():
    issues = []
    
    # Check this_weeks_stats.json
    stats_file = "public/this_weeks_stats.json"
    if os.path.exists(stats_file):
        try:
            with open(stats_file, 'r') as f:
                data = json.load(f)
                for fight in data.get("fights", []):
                    for fighter in fight.get("fighters", []):
                        if fighter.get("salary", 0) <= 0:
                            issues.append(f"{RED}Fighter {fighter.get('name')} has 0 salary{RESET}")
                        if fighter.get("avgPointsPerGame", 0) < 5:
                            issues.append(f"{YELLOW}Fighter {fighter.get('name')} has low avgPointsPerGame: {fighter.get('avgPointsPerGame')}{RESET}")
        except Exception as e:
            issues.append(f"{RED}Error reading {stats_file}: {e}{RESET}")
    else:
        issues.append(f"{RED}File missing: {stats_file}{RESET}")

    # Check current_event.json
    event_file = "public/current_event.json"
    if not os.path.exists(event_file):
        issues.append(f"{RED}File missing: {event_file}{RESET}")
    else:
        try:
            with open(event_file, 'r') as f:
                data = json.load(f)
                if not data.get("title"):
                    issues.append(f"{RED}current_event.json has no title field{RESET}")
        except Exception as e:
            issues.append(f"{RED}Error reading {event_file}: {e}{RESET}")

    # Check alerts.json
    alerts_file = "scripts/alerts.json"
    active_alerts = 0
    if os.path.exists(alerts_file):
        try:
            with open(alerts_file, 'r') as f:
                data = json.load(f)
                active_alerts = sum(1 for alert in data if alert.get("active", False))
        except Exception as e:
            issues.append(f"{RED}Error reading {alerts_file}: {e}{RESET}")
    else:
        issues.append(f"{RED}File missing: {alerts_file}{RESET}")

    # Display results
    print(f"{GREEN}Site Health Check Results:{RESET}")
    if issues:
        for issue in issues:
            print(issue)
    else:
        print(f"{GREEN}No issues found.{RESET}")
    print(f"{YELLOW}Active alerts: {active_alerts}{RESET}")

def show_current_status():
    stats_file = "public/this_weeks_stats.json"
    event_file = "public/current_event.json"
    alerts_file = "scripts/alerts.json"
    
    # Get current event title
    event_title = "N/A"
    if os.path.exists(event_file):
        try:
            with open(event_file, 'r') as f:
                data = json.load(f)
                event_title = data.get("title", "N/A")
        except Exception as e:
            event_title = f"Error: {e}"
    
    # Get fighter count
    fighter_count = 0
    if os.path.exists(stats_file):
        try:
            with open(stats_file, 'r') as f:
                data = json.load(f)
                fighter_count = sum(len(fight["fighters"]) for fight in data.get("fights", []))
        except Exception as e:
            fighter_count = f"Error: {e}"
    
    # Get active alerts
    active_alerts = 0
    if os.path.exists(alerts_file):
        try:
            with open(alerts_file, 'r') as f:
                data = json.load(f)
                active_alerts = sum(1 for alert in data if alert.get("active", False))
        except Exception as e:
            active_alerts = f"Error: {e}"
    
    # Get last update time
    last_update = "N/A"
    if os.path.exists(stats_file):
        try:
            last_update = time.ctime(os.path.getmtime(stats_file))
        except Exception as e:
            last_update = f"Error: {e}"
    
    # Display status
    print(f"{GREEN}Current Status:{RESET}")
    print(f"  Last update: {last_update}")
    print(f"  Current event: {event_title}")
    print(f"  Fighter count: {fighter_count}")
    print(f"  Active alerts: {active_alerts}")

def run_check_odds_alerts():
    if not confirm_action("This will run check_odds_alerts.py. Continue?"):
        return

    try:
        print(f"{GREEN}Running check_odds_alerts.py...{RESET}")
        subprocess.run(["python3", "scripts/check_odds_alerts.py"], check=True)
        print(f"{GREEN}check_odds_alerts.py completed successfully.{RESET}")
    except subprocess.CalledProcessError as e:
        print(f"{RED}Error during check_odds_alerts.py: {e}{RESET}")

def main_menu():
    while True:
        print("\n" + "="*50)
        print("1. Run full weekly update")
        print("2. Run site health check")
        print("3. Show current status")
        print("4. Run check_odds_alerts.py")
        print("5. Exit")
        print("="*50)
        
        choice = input(f"{YELLOW}Select an option (1-5): {RESET}")
        
        if choice == "1":
            run_full_update()
        elif choice == "2":
            check_site_health()
        elif choice == "3":
            show_current_status()
        elif choice == "4":
            run_check_odds_alerts()
        elif choice == "5":
            print(f"{GREEN}Exiting UFC Admin Helper. Goodbye!{RESET}")
            break
        else:
            print(f"{RED}Invalid option. Please select 1-5.{RESET}")

if __name__ == "__main__":
    print_welcome()
    main_menu()
