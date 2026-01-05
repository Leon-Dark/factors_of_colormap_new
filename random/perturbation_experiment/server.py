from flask import Flask, request, jsonify, send_from_directory
import os
import time

app = Flask(__name__, static_folder='../../', static_url_path='')

# Configuration
DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

@app.route('/')
def index():
    # Helper to serve the main experiment file from the repo root path
    return send_from_directory('../../random/perturbation_experiment', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../../', path)


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

if __name__ == '__main__':
    print(f"Starting server on http://localhost:5000")
    print(f"Data will be saved to: {os.path.abspath(DATA_DIR)}")
    app.run(host='0.0.0.0', port=5000, debug=True)
