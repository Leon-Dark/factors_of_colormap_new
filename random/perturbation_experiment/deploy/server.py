from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS # Need to install: pip install flask-cors
import os
import time

app = Flask(__name__, static_folder='static')
CORS(app) # Enable CORS for all routes

# Configuration
DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

@app.route('/')
def index():
    # Helper to serve the main experiment file from the repo root path
    return send_from_directory('.', 'index.html')


@app.route('/api/save_data', methods=['POST'])
def save_data():
    try:
        data = request.json
        participant_id = data.get('participantId', 'unknown')
        csv_content = data.get('csvData', '')
        
        if not csv_content:
            return jsonify({'status': 'error', 'message': 'No CSV data provided'}), 400

        timestamp = int(time.time())
        filename = f"{participant_id}_{timestamp}.csv"
        filepath = os.path.join(DATA_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        print(f"Saved data for participant {participant_id} to {filepath}")
        return jsonify({'status': 'success', 'filename': filename})

    except Exception as e:
        print(f"Error saving data: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- Data Viewing Routes ---

@app.route('/view')
def view_data_page():
    return send_from_directory('.', 'view_data.html')

@app.route('/api/list_data')
def list_data():
    if not os.path.exists(DATA_DIR):
        return jsonify([])
    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
    return jsonify(files)

@app.route('/api/get_data/<path:filename>')
def get_data_file(filename):
    return send_from_directory(DATA_DIR, filename, as_attachment=False)

if __name__ == '__main__':
    print(f"Starting server on http://localhost:5004")
    print(f"Data will be saved to: {os.path.abspath(DATA_DIR)}")
    app.run(host='0.0.0.0', port=5004, debug=True)
