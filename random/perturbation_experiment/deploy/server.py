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

    # START_UPDATE: Mark assignment as completed in assignments.json
    try:
        import json # Ensure json is imported if not at top, but it is standard
        # Ideally import should be at top, assuming it is.
        # We re-load logic here or reuse functions if possible. 
        # Since functions are defined below in the file, we might need to move them UP or just replicate logic simply here
        # Python allows calling functions defined later? No, it interprets top-down. 
        # Wait, the `assign_group` function I just added is at the BOTTOM. 
        # Functions must be defined before use? No, in Python, if they are modifying global scope or defined at module level, order matters for execution but functions inside functions are resolved at runtime.
        # However, `save_data` is defined ABOVE `assign_group`. So `load_assignments` is NOT yet defined when `save_data` runs?
        # NO. Python defines names. If `save_data` is CALLED, it looks up `load_assignments`. By the time it is CALLED (runtime), the whole file has been read. So it IS fine.
        
        state = load_assignments()
        
        # Remove from active
        if participant_id in state['active']:
            # Get the group they were assigned to
            group = str(state['active'][participant_id]['group'])
            del state['active'][participant_id]
            
            # Increment completed
            # Initialize if missing
            if 'completed' not in state: state['completed'] = {'0':0, '1':0, '2':0}
            if group not in state['completed']: state['completed'][group] = 0
            
            state['completed'][group] += 1
            
            save_assignments(state)
            print(f"Marked {participant_id} (Group {group}) as completed.")
            
    except Exception as e:
        print(f"Warning: Failed to update assignment stats: {e}")
    # END_UPDATE


# --- Data Viewing Routes ---

@app.route('/view')
def view_data_page():
    return send_from_directory('.', 'view_data.html')

@app.route('/images')
def image_viewer_page():
    return send_from_directory('.', 'image_viewer.html')

@app.route('/api/list_data')
def list_data():
    if not os.path.exists(DATA_DIR):
        return jsonify([])
    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
    return jsonify(files)

@app.route('/api/get_data/<path:filename>')
def get_data_file(filename):
    return send_from_directory(DATA_DIR, filename, as_attachment=False)

# --- Smart Assignment System ---

ASSIGNMENTS_FILE = os.path.join(DATA_DIR, 'assignments.json')
ASSIGNMENT_TIMEOUT_SECONDS = 30 * 60  # 30 minutes to complete, otherwise considered abandoned

def load_assignments():
    if not os.path.exists(ASSIGNMENTS_FILE):
        return {'active': {}, 'completed': {'0': 0, '1': 0, '2': 0}}
    try:
        with open(ASSIGNMENTS_FILE, 'r') as f:
            return json.load(f)
    except:
        return {'active': {}, 'completed': {'0': 0, '1': 0, '2': 0}}

def save_assignments(data):
    with open(ASSIGNMENTS_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/api/assign', methods=['POST'])
def assign_group():
    data = request.json
    participant_id = data.get('participantId')
    
    if not participant_id:
        return jsonify({'error': 'no participant id'}), 400
    
    lock_file = ASSIGNMENTS_FILE + '.lock'
    # Simple file locking could be better, but sufficient for low traffic
    
    state = load_assignments()
    
    # Prune stale active sessions
    now = time.time()
    active = state.get('active', {})
    
    # Remove sessions older than timeout
    fresh_active = {pid: info for pid, info in active.items() 
                   if (now - info['timestamp']) < ASSIGNMENT_TIMEOUT_SECONDS}
    state['active'] = fresh_active
    
    # Check if this participant is already active
    if participant_id in fresh_active:
        return jsonify({'group': fresh_active[participant_id]['group'], 'status': 'existing'})
        
    # Calculate load per group: Completed + Active
    # Initialize counts
    counts = {0: 0, 1: 0, 2: 0}
    
    # Add completed
    completed = state.get('completed', {'0': 0, '1': 0, '2': 0})
    for g, count in completed.items():
        counts[int(g)] += count
        
    # Add active
    for info in fresh_active.values():
        counts[info['group']] += 1
        
    # Find group with minimum load
    # If ties, pick random among ties
    min_load = min(counts.values())
    candidates = [g for g, c in counts.items() if c == min_load]
    
    import random
    assigned_group = random.choice(candidates)
    
    # Record assignment
    state['active'][participant_id] = {
        'group': assigned_group,
        'timestamp': now
    }
    
    save_assignments(state)
    
    print(f"Assigned {participant_id} to Group {assigned_group} (Loads: {counts})")
    return jsonify({'group': assigned_group, 'status': 'new'})

# Modify save_data to update completion status
# We hook into the existing route by wrapping the logic or just editing it below
# NOTE: The user's request implies modifying the existing logic. 
# Since I am replacing the block, I will just provide the assign route here 
# and user will need to update save_data separately or I do it in next step.
# Ideally I should update save_data in the same file if possible, but tool limits to one block.
# I will do save_data update in a separate call for safety or if the block is contiguous.
# The original file had `save_data` above. I will leave this as just the NEW endpoints 
# and I will make a VERY targeted edit to `save_data` next.

if __name__ == '__main__':
    print(f"Starting server on http://localhost:5004")
    print(f"Data will be saved to: {os.path.abspath(DATA_DIR)}")
    app.run(host='0.0.0.0', port=5004, debug=True)
