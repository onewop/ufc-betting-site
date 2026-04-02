import subprocess
import json
import os
import time

# ANSI color codes
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"

def print_colored(text, color):
    print(f"{color}{text}{RESET}")

def run_full_weekly_update():
    print_colored("⚠️  WARNING: This will run the full weekly update.", YELLOW)
    confirmation = input("Are you sure? (y/n): ").lower()
    if confirmation != "y":
        print_colored("Operation cancelled.", GREEN)
        return

    print_colored("🔄 Running full weekly update...", YELLOW)
    try:
        print_colored("→ Running aggregate_stats.py...", YELLOW)
        subprocess.run(["python3", "scripts/aggregate_stats.py"], check=True)
        
        print_colored("→ Running calculate_combinations.py...", YELLOW)
        subprocess.run(["python3", "scripts/calculate_combinations.py"], check=True)
        
        print_colored("✅ Full weekly update completed successfully!", GREEN)
    except subprocess.CalledProcessError as e:
        print_colored(f"❌ Error during update: {e}", RED)

def run_site_health_check():
    print_colored("🔍 Running site health check...", YELLOW)
    issues = []

    # Check this_weeks_stats.json
    stats_path = "public/this_weeks_stats.json"
    if not os.path.exists(stats_path):
        issues.append(("ERROR", f"Missing {stats_path}"))
    else:
        try:
            with open(stats_path) as f:
                data = json.load(f)
            print_colored(f"✅ {stats_path} looks valid", GREEN)
        except Exception as e:
            issues.append(("ERROR", f"Invalid JSON in {stats_path}: {e}"))

    # Check current_event.json
    event_path = "public/current_event.json"
    if not os.path.exists(event_path):
        issues.append(("WARNING", f"Missing {event_path}"))
    else:
        print_colored(f"✅ {event_path} exists", GREEN)

    if issues:
        for level, msg in issues:
            color = RED if level == "ERROR" else YELLOW
            print_colored(f"{level}: {msg}", color)
    else:
        print_colored("✅ No major issues found!", GREEN)

def show_current_status():
    print_colored("📊 Current Status:", GREEN)
    print(f"  Last updated: {time.ctime(os.path.getmtime('public/this_weeks_stats.json')) if os.path.exists('public/this_weeks_stats.json') else 'Unknown'}")
    print(f"  Current event: {open('public/current_event.json').read() if os.path.exists('public/current_event.json') else 'Unknown'}")

def run_check_odds_alerts():
    print_colored("🔄 Running odds alert checker...", YELLOW)
    confirmation = input("Are you sure? (y/n): ").lower()
    if confirmation != "y":
        return
    try:
        subprocess.run(["python3", "scripts/check_odds_alerts.py"], check=True)
        print_colored("✅ Alert check completed.", GREEN)
    except Exception as e:
        print_colored(f"❌ Error: {e}", RED)

def main():
    while True:
        print("\n" + "="*60)
        print("                  ADMIN HELPER")
        print("="*60)
        print("1. Run full weekly update")
        print("2. Run site health check")
        print("3. Show current status")
        print("4. Run check_odds_alerts.py")
        print("5. Exit")
        print("="*60)

        choice = input("Choose an option (1-5): ").strip()

        if choice == "1":
            run_full_weekly_update()
        elif choice == "2":
            run_site_health_check()
        elif choice == "3":
            show_current_status()
        elif choice == "4":
            run_check_odds_alerts()
        elif choice == "5":
            print_colored("👋 Goodbye!", GREEN)
            break
        else:
            print_colored("Invalid option. Please choose 1-5.", RED)

        input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()
