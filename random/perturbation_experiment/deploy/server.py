from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS # Need to install: pip install flask-cors
import os
import time
import json
import re

app = Flask(__name__, static_folder='static')
CORS(app) # Enable CORS for all routes

# Configuration
DATA_DIR = 'data'
IMAGES_DIR = 'perturbation_images'

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

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

@app.route('/api/list_images')
def list_images():
    """
    Scan perturbation_images directory and return metadata for all image pairs
    Supports new naming convention with _rep{n} suffix and images/ subdirectory
    """
    try:
        if not os.path.exists(IMAGES_DIR):
            return jsonify({'images': [], 'error': 'Images directory not found'})
        
        images = []
        
        # Check for images in subdirectories (new structure)
        images_subdir = os.path.join(IMAGES_DIR, 'images')
        search_dirs = [images_subdir] if os.path.exists(images_subdir) else []
        
        # Also check root directory for backward compatibility
        search_dirs.append(IMAGES_DIR)
        
        for search_dir in search_dirs:
            if not os.path.exists(search_dir):
                continue
                
            # Scan for all metadata files
            for filename in os.listdir(search_dir):
                if filename.endswith('_metadata.json'):
                    metadata_path = os.path.join(search_dir, filename)
                    
                    # Extract prefix from filename
                    # New format: "0001_low_ssim_0.99500_rep1_metadata.json" -> "0001_low_ssim_0.99500_rep1"
                    prefix = filename.replace('_metadata.json', '')
                    
                    # Read metadata
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                        
                        # Determine relative path based on search directory
                        if search_dir == images_subdir:
                            # Images in subdirectory
                            rel_prefix = f'images/{prefix}'
                        else:
                            # Images in root directory
                            rel_prefix = prefix
                        
                        # Construct image paths
                        original_path = f'/perturbation_images/{rel_prefix}_original.png'
                        perturbed_path = f'/perturbation_images/{rel_prefix}_perturbed.png'
                        
                        # Check if image files exist
                        original_file = os.path.join(search_dir, f'{prefix}_original.png')
                        perturbed_file = os.path.join(search_dir, f'{prefix}_perturbed.png')
                        
                        if os.path.exists(original_file) and os.path.exists(perturbed_file):
                            images.append({
                                'prefix': prefix,
                                'frequency': metadata.get('frequency'),
                                'frequencyName': metadata.get('frequencyName'),
                                'targetValue': metadata.get('targetValue'),
                                'repetition': metadata.get('repetition', 1),
                                'mode': metadata.get('mode'),
                                'magnitude': metadata.get('magnitude'),
                                'ssim': metadata.get('ssim'),
                                'kl': metadata.get('kl'),
                                'originalPath': original_path,
                                'perturbedPath': perturbed_path
                            })
                    except Exception as e:
                        print(f"Error reading metadata {filename}: {str(e)}")
                        continue
        
        print(f"Loaded {len(images)} image pairs from library")
        return jsonify({'images': images, 'count': len(images)})
    
    except Exception as e:
        print(f"Error listing images: {str(e)}")
        return jsonify({'images': [], 'error': str(e)}), 500

@app.route('/perturbation_images/<path:filename>')
def serve_image(filename):
    """Serve images from perturbation_images directory"""
    return send_from_directory(IMAGES_DIR, filename)

if __name__ == '__main__':
    print(f"Starting server on http://localhost:5004")
    print(f"Data will be saved to: {os.path.abspath(DATA_DIR)}")
    app.run(host='0.0.0.0', port=5004, debug=True)
