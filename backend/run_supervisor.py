import os
import sys
import time
import socket
import subprocess
import psutil
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

PORT_DEFAULT = 8000
HOST = "127.0.0.1"

def log_info(msg: str):
    print(f"[SUPERVISOR] INFO: {msg}", flush=True)

def log_error(msg: str):
    print(f"[SUPERVISOR] ERROR: {msg}", file=sys.stderr, flush=True)

def run_preflight_checks() -> bool:
    """Validates imports, packages, and folders before execution."""
    log_info("Running preflight validation checks...")
    
    # 1. Check working directory
    cwd = os.getcwd()
    log_info(f"Current directory: {cwd}")
    
    # 2. Check imports
    try:
        import fastapi
        import uvicorn
        import supabase
        import jwt
        log_info("All package imports resolved successfully.")
    except ImportError as e:
        log_error(f"Missing dependency detected: {e}. Attempting recovery...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", "backend/requirements.txt"], check=True)
            log_info("Dependencies re-installed. Retrying imports...")
            import fastapi
            import uvicorn
            import supabase
            import jwt
        except Exception as install_err:
            log_error(f"Failed to install dependencies: {install_err}")
            return False

    # 3. Check environment
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        log_error("SUPABASE_URL is missing. Please set environment variables.")
        return False
        
    log_info("Preflight checks passed.")
    return True

def kill_process_on_port(port: int):
    """Locates and terminates any process currently bound to the target port."""
    log_info(f"Checking for existing processes on port {port}...")
    for conn in psutil.net_connections(kind="inet"):
        if conn.lport == port and conn.status == "LISTEN":
            pid = conn.pid
            if pid:
                try:
                    proc = psutil.Process(pid)
                    log_info(f"Found process '{proc.name()}' (PID: {pid}) using port {port}. Terminating...")
                    proc.kill()
                    proc.wait(timeout=3)
                    log_info(f"Process on port {port} successfully terminated.")
                    time.sleep(1)
                except Exception as e:
                    log_error(f"Error terminating process {pid}: {e}")

def get_safe_port(start_port: int) -> int:
    """Returns the first available port starting from start_port."""
    port = start_port
    while port < start_port + 10:
        # First try to kill any process holding this port
        kill_process_on_port(port)
        
        # Verify if port is now available
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                log_info(f"Successfully bound to port {port}.")
                return port
            except socket.error:
                log_info(f"Port {port} is still occupied. Trying next port...")
                port += 1
    raise RuntimeError("Could not find a free socket port.")

def launch_server(port: int):
    """Spawns the uvicorn process, restarting up to 3 times on crash."""
    attempts = 0
    max_attempts = 3
    
    cmd = [
        sys.executable, "-m", "uvicorn", 
        "backend.app.main:app", 
        "--host", HOST, 
        "--port", str(port)
    ]
    
    while attempts < max_attempts:
        attempts += 1
        log_info(f"Launching Uvicorn server (Attempt {attempts}/{max_attempts})...")
        
        try:
            # Start uvicorn as a subprocess and wait for it to exit
            process = subprocess.Popen(cmd)
            process.wait()
            
            # Check exit code
            if process.returncode == 0:
                log_info("Server stopped gracefully.")
                break
            else:
                log_error(f"Server crashed with exit code {process.returncode}.")
        except Exception as e:
            log_error(f"Error executing server process: {e}")
            
        if attempts < max_attempts:
            log_info("Sleeping 2 seconds before restart recovery...")
            time.sleep(2)
            
    if attempts >= max_attempts:
        log_error("Max server restart recovery attempts reached. Exiting.")
        sys.exit(1)

def main():
    if not run_preflight_checks():
        log_error("Preflight checks failed. Exiting.")
        sys.exit(1)
        
    try:
        active_port = get_safe_port(PORT_DEFAULT)
    except Exception as e:
        log_error(f"Port Guard initialization failed: {e}")
        sys.exit(1)
        
    launch_server(active_port)

if __name__ == "__main__":
    main()
