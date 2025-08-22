import pandas as pd
import json
import os
import datetime
import shutil

def save_to_json(data, output_path="public/this_weeks_stats.json"):
    """Save data to public/this_weeks_stats.json with backup"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if os.path.exists(output_path):
        archive_dir = "public/archive"
        os.makedirs(archive_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{archive_dir}/this_weeks_stats-backup-{timestamp}.json"
        shutil.copy(output_path, backup_path)
        print(f"Backed up existing file to {backup_path}")
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved data to {output_path}")

def csv_to_json(
    fight_stats_path="../scrape_ufc_stats/ufc_fight_stats.csv",
    fighter_details_path="../scrape_ufc_stats/ufc_fighter_details.csv",
    fighter_tott_path="../scrape_ufc_stats/ufc_fighter_tott.csv",
    output_path="public/this_weeks_stats.json"
):
    """Convert UFCStats CSVs to JSON for UFC 300"""
    try:
        fight_stats_df = pd.read_csv(fight_stats_path)
        fighter_details_df = pd.read_csv(fighter_details_path) if os.path.exists(fighter_details_path) else pd.DataFrame()
        fighter_tott_df = pd.read_csv(fighter_tott_path) if os.path.exists(fighter_tott_path) else pd.DataFrame()
        
        if not fighter_details_df.empty:
            fighter_details_df['FIGHTER'] = fighter_details_df['FIRST'] + ' ' + fighter_details_df['LAST']
        
        ufc_300_stats = fight_stats_df[fight_stats_df['EVENT'] == 'UFC 300: Pereira vs. Hill']
        if ufc_300_stats.empty:
            raise ValueError("No UFC 300 data found in ufc_fight_stats.csv")
        
        manual_records = {
            "Alex Pereira": "9-2-0",
            "Jamahal Hill": "12-1-0",
            "Holly Holm": "15-6-0",
            "Kayla Harrison": "16-1-0",
            "Jalin Turner": "14-7-0",
            "Renato Moicano": "17-5-1",
            "Weili Zhang": "24-3-0",
            "Yan Xiaonan": "17-3-0",
            "Bo Nickal": "5-0-0",
            "Cody Brundage": "10-5-0",
            "Bobby Green": "31-14-1",
            "Jim Miller": "37-17-0",
            "Calvin Kattar": "23-7-0",
            "Aljamain Sterling": "23-4-0",
            "Charles Oliveira": "34-9-0",
            "Arman Tsarukyan": "21-3-0",
            "Deiveson Figueiredo": "22-2-1",
            "Cody Garbrandt": "14-5-0",
            "Jessica Andrade": "24-12-0",
            "Marina Rodriguez": "17-3-2",
            "Jiri Prochazka": "29-4-1",
            "Aleksandar Rakic": "14-3-0",
            "Sodiq Yusuff": "13-3-0",
            "Diego Lopes": "23-6-0",
            "Justin Gaethje": "25-4-0",
            "Max Holloway": "25-7-0"
        }
        
        manual_outcomes = {
            "Alex Pereira vs. Jamahal Hill": [
                {"fighter": "Alex Pereira", "opponent": "Jamahal Hill", "result": "W", "date": "April 13, 2024", "round": "1", "time": "3:14"},
                {"fighter": "Jamahal Hill", "opponent": "Alex Pereira", "result": "L", "date": "April 13, 2024", "round": "1", "time": "3:14"}
            ],
            "Holly Holm vs. Kayla Harrison": [
                {"fighter": "Kayla Harrison", "opponent": "Holly Holm", "result": "W", "date": "April 13, 2024", "round": "2", "time": "1:47"},
                {"fighter": "Holly Holm", "opponent": "Kayla Harrison", "result": "L", "date": "April 13, 2024", "round": "2", "time": "1:47"}
            ],
            "Bo Nickal vs. Cody Brundage": [
                {"fighter": "Bo Nickal", "opponent": "Cody Brundage", "result": "W", "date": "April 13, 2024", "round": "2", "time": "3:38"},
                {"fighter": "Cody Brundage", "opponent": "Bo Nickal", "result": "L", "date": "April 13, 2024", "round": "2", "time": "3:38"}
            ],
            "Bobby Green vs. Jim Miller": [
                {"fighter": "Bobby Green", "opponent": "Jim Miller", "result": "W", "date": "April 13, 2024", "round": "3", "time": "5:00"},
                {"fighter": "Jim Miller", "opponent": "Bobby Green", "result": "L", "date": "April 13, 2024", "round": "3", "time": "5:00"}
            ],
            "Calvin Kattar vs. Aljamain Sterling": [
                {"fighter": "Aljamain Sterling", "opponent": "Calvin Kattar", "result": "W", "date": "April 13, 2024", "round": "3", "time": "5:00"},
                {"fighter": "Calvin Kattar", "opponent": "Aljamain Sterling", "result": "L", "date": "April 13, 2024", "round": "3", "time": "5:00"}
            ],
            "Charles Oliveira vs. Arman Tsarukyan": [
                {"fighter": "Arman Tsarukyan", "opponent": "Charles Oliveira", "result": "W", "date": "April 13, 2024", "round": "3", "time": "5:00"},
                {"fighter": "Charles Oliveira", "opponent": "Arman Tsarukyan", "result": "L", "date": "April 13, 2024", "round": "3", "time": "5:00"}
            ],
            "Deiveson Figueiredo vs. Cody Garbrandt": [
                {"fighter": "Deiveson Figueiredo", "opponent": "Cody Garbrandt", "result": "W", "date": "April 13, 2024", "round": "2", "time": "4:02"},
                {"fighter": "Cody Garbrandt", "opponent": "Deiveson Figueiredo", "result": "L", "date": "April 13, 2024", "round": "2", "time": "4:02"}
            ],
            "Jessica Andrade vs. Marina Rodriguez": [
                {"fighter": "Jessica Andrade", "opponent": "Marina Rodriguez", "result": "W", "date": "April 13, 2024", "round": "3", "time": "5:00"},
                {"fighter": "Marina Rodriguez", "opponent": "Jessica Andrade", "result": "L", "date": "April 13, 2024", "round": "3", "time": "5:00"}
            ],
            "Jiri Prochazka vs. Aleksandar Rakic": [
                {"fighter": "Jiri Prochazka", "opponent": "Aleksandar Rakic", "result": "W", "date": "April 13, 2024", "round": "2", "time": "3:17"},
                {"fighter": "Aleksandar Rakic", "opponent": "Jiri Prochazka", "result": "L", "date": "April 13, 2024", "round": "2", "time": "3:17"}
            ],
            "Sodiq Yusuff vs. Diego Lopes": [
                {"fighter": "Diego Lopes", "opponent": "Sodiq Yusuff", "result": "W", "date": "April 13, 2024", "round": "1", "time": "1:29"},
                {"fighter": "Sodiq Yusuff", "opponent": "Diego Lopes", "result": "L", "date": "April 13, 2024", "round": "1", "time": "1:29"}
            ],
            "Justin Gaethje vs. Max Holloway": [
                {"fighter": "Max Holloway", "opponent": "Justin Gaethje", "result": "W", "date": "April 13, 2024", "round": "5", "time": "4:59"},
                {"fighter": "Justin Gaethje", "opponent": "Max Holloway", "result": "L", "date": "April 13, 2024", "round": "5", "time": "4:59"}
            ],
            "Zhang Weili vs. Yan Xiaonan": [
                {"fighter": "Zhang Weili", "opponent": "Yan Xiaonan", "result": "W", "date": "April 13, 2024", "round": "5", "time": "5:00"},
                {"fighter": "Yan Xiaonan", "opponent": "Zhang Weili", "result": "L", "date": "April 13, 2024", "round": "5", "time": "5:00"}
            ]
        }
        
        fights = []
        for matchup, group in ufc_300_stats.groupby('BOUT'):
            # Deduplicate fighters
            unique_fighters = group.drop_duplicates(subset=['FIGHTER'])
            fighters = []
            for _, row in unique_fighters.iterrows():
                fighter_info = fighter_details_df[fighter_details_df['FIGHTER'] == row['FIGHTER']] if not fighter_details_df.empty else pd.DataFrame()
                tott_info = fighter_tott_df[fighter_tott_df['FIGHTER'] == row['FIGHTER']] if not fighter_tott_df.empty else pd.DataFrame()
                
                # Get manual outcome
                fight_outcome = [o for o in manual_outcomes.get(matchup, []) if o['fighter'] == row['FIGHTER']] or [{}]
                fight_outcome = fight_outcome[0]
                
                fighter_data = {
                    "name": row['FIGHTER'],
                    "nickname": fighter_info['NICKNAME'].iloc[0] if not fighter_info.empty and 'NICKNAME' in fighter_info.columns else 'N/A',
                    "record": manual_records.get(row['FIGHTER'], 'N/A'),
                    "height": tott_info['HEIGHT'].iloc[0] if not tott_info.empty and 'HEIGHT' in tott_info.columns else 'N/A',
                    "weight": tott_info['WEIGHT'].iloc[0] if not tott_info.empty and 'WEIGHT' in tott_info.columns else 'N/A',
                    "reach": tott_info['REACH'].iloc[0] if not tott_info.empty and 'REACH' in tott_info.columns else 'N/A',
                    "stance": tott_info['STANCE'].iloc[0] if not tott_info.empty and 'STANCE' in tott_info.columns else 'N/A',
                    "dob": tott_info['DOB'].iloc[0] if not tott_info.empty and 'DOB' in tott_info.columns else 'N/A',
                    "stats": {
                        "slpm": tott_info['slpm'].iloc[0] if not tott_info.empty and 'slpm' in tott_info.columns else 0,
                        "striking_accuracy": row.get('SIG.STR. %', 'N/A'),
                        "sapm": tott_info['sapm'].iloc[0] if not tott_info.empty and 'sapm' in tott_info.columns else 0,
                        "striking_defense": tott_info['str_def'].iloc[0] if not tott_info.empty and 'str_def' in tott_info.columns else 'N/A',
                        "td_avg": tott_info['td_avg'].iloc[0] if not tott_info.empty and 'td_avg' in tott_info.columns else 0,
                        "td_accuracy": row.get('TD %', 'N/A'),
                        "td_defense": tott_info['td_def'].iloc[0] if not tott_info.empty and 'td_def' in tott_info.columns else 'N/A',
                        "sub_avg": row.get('SUB.ATT', 0) or 0
                    },
                    "recent_fights": [
                        {
                            "opponent": fight_outcome.get('opponent', 'N/A'),
                            "result": fight_outcome.get('result', 'N/A'),
                            "date": fight_outcome.get('date', 'N/A'),
                            "round": fight_outcome.get('round', 'N/A'),
                            "time": fight_outcome.get('time', 'N/A')
                        }
                    ]
                }
                fighters.append(fighter_data)
            fights.append({
                "matchup": matchup,
                "weight_class": group['weight_class'].iloc[0] if 'weight_class' in group.columns else 'N/A',
                "fighters": fighters
            })
        data = {
            "event": {
                "name": "UFC 300: Pereira vs. Hill",
                "date": "April 13, 2024",
                "location": "Las Vegas, Nevada, USA"
            },
            "fights": fights
        }
        save_to_json(data, output_path)
    except Exception as e:
        print(f"Error processing CSVs: {e}")

if __name__ == "__main__":
    csv_to_json()