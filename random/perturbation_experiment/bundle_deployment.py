import os
import shutil
import re
from pathlib import Path

# Configuration
# Configuration
PROJECT_ROOT = Path(os.getcwd())
# We are currently IN the random/perturbation_experiment folder
SOURCE_DIR = PROJECT_ROOT
DEPLOY_DIR = PROJECT_ROOT / 'deploy'
STATIC_DIR = DEPLOY_DIR / 'static'

def setup_directories():
    """Create clean deploy directories."""
    if DEPLOY_DIR.exists():
        shutil.rmtree(DEPLOY_DIR)
    
    DEPLOY_DIR.mkdir()
    STATIC_DIR.mkdir()
    (DEPLOY_DIR / 'data').mkdir()
    print(f"Created deploy directory at: {DEPLOY_DIR}")

def bundle_server():
    """Copy and modify server.py for standalone deployment."""
    src_server = SOURCE_DIR / 'server.py'
    dst_server = DEPLOY_DIR / 'server.py'
    
    with open(src_server, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Modify Flask app init to use local static folder
    # Change: app = Flask(__name__, static_folder='../../', static_url_path='')
    # To:     app = Flask(__name__, static_folder='static', static_url_path='')
    content = re.sub(
        r"app = Flask\(__name__,.*?\)", 
        "app = Flask(__name__, static_folder='static', static_url_path='')", 
        content
    )
    
    # Remove the specific route for index since we will put index.html in templates or static
    # Actually, let's keep it simple: serve index.html from root
    
    # Modify index route
    # Change: return send_from_directory('../../random/perturbation_experiment', 'index.html')
    # To:     return send_from_directory('.', 'index.html')
    content = re.sub(
        r"return send_from_directory\('.*?', 'index.html'\)", 
        "return send_from_directory('.', 'index.html')", 
        content
    )
    
    # Modify static route
    # Change: return send_from_directory('../../', path)
    # To:     return send_from_directory('static', path)
    content = re.sub(
        r"return send_from_directory\('.*?', path\)", 
        "return send_from_directory('static', path)", 
        content
    )

    with open(dst_server, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Bundled server.py")

def bundle_html_and_assets():
    """Parse index.html, copy assets, and update references."""
    html_path = SOURCE_DIR / 'index.html'
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Regex to find script src and link href
    # We look for relative paths (starting with . or just names)
    # We ignore absolute URLs (http)
    
    assets = []
    
    def replace_asset(match):
        full_match = match.group(0)
        attr = match.group(1) # src or href
        quote = match.group(2)
        path_str = match.group(3)
        
        if path_str.startswith('http') or path_str.startswith('//'):
            return full_match
        
        # Resolve absolute path of the asset
        # content is relative to SOURCE_DIR
        # Try direct resolution first
        possible_path = (SOURCE_DIR / path_str).resolve()
        
        # Heuristic: The relative path might be one level too deep (../../.. vs ../..)
        # If path_str starts with ../../../, try ../../
        if not possible_path.exists():
             if path_str.startswith('../../../'):
                 new_path_str = path_str.replace('../../../', '../../', 1)
                 possible_path = (SOURCE_DIR / new_path_str).resolve()
                 print(f"Trying corrected path: {possible_path}")

        if not possible_path.exists():
            print(f"Warning: Asset not found: {possible_path}")
            return full_match
        
        filename = possible_path.name
        abs_path = possible_path
        # Handle duplicates (e.g. style.css in different folders? unlikely here but good practice)
        # For now, assume unique basenames or flatten them
        
        # Copy to static
        shutil.copy2(abs_path, STATIC_DIR / filename)
        print(f"Copied {filename}")
        
        return f'{attr}={quote}static/{filename}{quote}'

    # Replace script sources
    html_content = re.sub(
        r'(src)=("|\')([^"\']+)("|\')', 
        replace_asset, 
        html_content
    )
    
    # Replace link sources (css)
    html_content = re.sub(
        r'(href)=("|\')([^"\']+)("|\')', 
        replace_asset, 
        html_content
    )
    
    # Save modified HTML
    with open(DEPLOY_DIR / 'index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print("Bundled index.html and assets")

def main():
    try:
        setup_directories()
        bundle_server()
        bundle_html_and_assets()
        print("\nSUCCESS! Deployment package created in 'deploy' folder.")
        print("You can run it locally to test: cd deploy && python server.py")
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == '__main__':
    main()
