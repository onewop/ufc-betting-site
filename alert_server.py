from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)  # This fixes the CORS error

alerts_file = 'scripts/alerts.json'

@app.route('/api/save-alert', methods=['POST'])
def save_alert():
    try:
        alert = request.get_json()
        print("=== RECEIVED ALERT ===")
        print(json.dumps(alert, indent=2))
        
        # Load existing or create new
        if os.path.exists(alerts_file):
            with open(alerts_file, 'r') as f:
                alerts = json.load(f)
        else:
            alerts = []
        
        alerts.append(alert)
        
        # Save back
        with open(alerts_file, 'w') as f:
            json.dump(alerts, f, indent=2)
        
        print(f"Saved {len(alerts)} alert(s) to {alerts_file}")
        return jsonify({'status': 'success', 'count': len(alerts)}), 200
        
    except Exception as e:
        print("Error saving alert:", str(e))
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)

if __name__ == '__main__':
    app.run(port=3001)