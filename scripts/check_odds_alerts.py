"""
check_odds_alerts.py
--------------------
Reads alerts.json, fetches current UFC odds from The Odds API,
fires Gmail emails when a fighter's line crosses the user's target,
then removes triggered alerts from the file.

Cron suggestion (every 6 hours):
    0 */6 * * * /path/to/python3 /home/onewop/ufc-betting-site-main/ufc-betting-site-main/scripts/check_odds_alerts.py >> /tmp/odds_alerts.log 2>&1
"""

import json
import os
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────

ODDS_API_KEY = "19e3b51e05c1833728f22361f5996f72"
ODDS_API_URL = (
    "https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds"
    "?apiKey={key}&regions=us&markets=h2h&oddsFormat=american"
).format(key=ODDS_API_KEY)

# Gmail SMTP — create an App Password at https://myaccount.google.com/apppasswords
GMAIL_USER = "toscott4321@gmail.com"        # ← replace
GMAIL_APP_PASSWORD = "yckv lpvm dlll fyjg"  # ← replace with 16-char app password
EMAIL_FROM_NAME = "Combat Vault Odds Alerts"

ALERTS_FILE = Path(__file__).parent / "alerts.json"

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_alerts():
    if not ALERTS_FILE.exists():
        return []
    with open(ALERTS_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            print("WARNING: alerts.json is malformed — treating as empty.")
            return []


def save_alerts(alerts):
    with open(ALERTS_FILE, "w") as f:
        json.dump(alerts, f, indent=2)


def fetch_odds():
    """Returns list of event dicts from The Odds API, or None on failure."""
    try:
        resp = requests.get(ODDS_API_URL, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"ERROR: Failed to fetch odds — {e}")
        return None


def best_moneyline(event, fighter_name):
    """
    Find the highest (most favorable) American moneyline for a fighter
    across all bookmakers in a single event dict.
    Returns int or None.
    """
    best = None
    name_lower = fighter_name.strip().lower()
    for bm in event.get("bookmakers", []):
        for market in bm.get("markets", []):
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []):
                if outcome.get("name", "").strip().lower() == name_lower:
                    price = outcome.get("price")
                    if price is not None and (best is None or price > best):
                        best = price
    return best


def find_fighter_in_odds(odds_data, fighter_name):
    """
    Search all events for a fighter (case-insensitive full name match).
    Returns (event, best_price) or (None, None).
    """
    name_lower = fighter_name.strip().lower()
    for event in odds_data:
        home = event.get("home_team", "").strip().lower()
        away = event.get("away_team", "").strip().lower()
        if name_lower in (home, away):
            price = best_moneyline(event, fighter_name)
            return event, price
    return None, None


def should_trigger(current_odds, direction, target_odds):
    """
    American odds are a single number line: -500 ... -100 ... +100 ... +500
    "better"  → line moved right (higher number = better payout)
                trigger when current > target  (e.g. -150 > -200, +220 > +180)
    "worse"   → line moved left (lower number)
                trigger when current < target  (e.g. -200 < -150, +120 < +180)
    """
    try:
        current = int(current_odds)
        target = int(target_odds)
    except (ValueError, TypeError):
        return False

    if direction == "better":
        return current > target
    if direction == "worse":
        return current < target
    return False


def fmt_odds(price):
    if price is None:
        return "N/A"
    return f"+{price}" if price > 0 else str(price)


def send_email(to_address, fighter_name, direction, target_odds, current_odds):
    direction_phrase = (
        "better than expected (line improved)" if direction == "better"
        else "worse than your threshold (line moved against you)"
    )
    subject = f"[Combat Vault] Odds Alert: {fighter_name} is now {fmt_odds(current_odds)}"
    body = f"""\
Hi,

Your odds alert for {fighter_name} has triggered.

  Fighter:      {fighter_name}
  Alert type:   {direction.capitalize()} than {fmt_odds(int(target_odds))}
  Current line: {fmt_odds(current_odds)}
  Status:       {direction_phrase}

Log in to Combat Vault to review the full odds board before lines move.

---
21+ only. Gambling problem? Call 1-800-GAMBLER.
You requested this alert on Combat Vault. Reply STOP to unsubscribe.
"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{EMAIL_FROM_NAME} <{GMAIL_USER}>"
    msg["To"] = to_address
    msg.set_content(body)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
        print(f"  ✓ Email sent to {to_address} re: {fighter_name} ({fmt_odds(current_odds)})")
        return True
    except smtplib.SMTPException as e:
        print(f"  ✗ SMTP error sending to {to_address}: {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    alerts = load_alerts()
    if not alerts:
        print("No alerts on file. Nothing to check.")
        return

    print(f"Loaded {len(alerts)} alert(s). Fetching odds...")
    odds_data = fetch_odds()
    if odds_data is None:
        print("Aborting — could not fetch odds.")
        sys.exit(1)

    print(f"Fetched odds for {len(odds_data)} event(s).")

    emails_sent = 0
    triggered_indices = []

    for i, alert in enumerate(alerts):
        fighter = alert.get("fighter_name", "").strip()
        direction = alert.get("direction", "better")
        target = alert.get("target_odds")
        email = alert.get("email", "").strip()

        if not fighter or not email or target is None:
            print(f"  SKIP alert #{i}: missing required fields — {alert}")
            continue

        _event, current = find_fighter_in_odds(odds_data, fighter)

        if current is None:
            print(f"  SKIP {fighter}: not found in current odds data.")
            continue

        print(f"  Checking {fighter}: current={fmt_odds(current)}, target={fmt_odds(int(target))}, direction={direction}")

        if should_trigger(current, direction, target):
            success = send_email(email, fighter, direction, target, current)
            if success:
                emails_sent += 1
                triggered_indices.append(i)
        else:
            print(f"    → not triggered yet.")

    # Remove triggered alerts (reverse order to preserve indices)
    for i in reversed(triggered_indices):
        removed = alerts.pop(i)
        print(f"  Removed triggered alert for {removed.get('fighter_name')} ({removed.get('email')})")

    save_alerts(alerts)
    remaining = len(alerts)
    print(f"\nDone. Checked {len(alerts) + len(triggered_indices)} alert(s), sent {emails_sent} email(s), {remaining} alert(s) remaining.")


if __name__ == "__main__":
    main()
