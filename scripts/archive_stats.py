import os
import datetime

def archive_stats():
  current_file = "public/this-weeks-stats.json"
  if os.path.exists(current_file):
    archive_dir = "public/archive"
    os.makedirs(archive_dir, exist_ok=True)
    event_date = datetime.date(2025, 8, 16).strftime("%Y-%m-%d")
    archive_file = f"{archive_dir}/ufc-319-{event_date}.json"
    os.rename(current_file, archive_file)
    print(f"Archived to {archive_file}")

if __name__ == "__main__":
  archive_stats()