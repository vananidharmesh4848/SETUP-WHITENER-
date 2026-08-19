import os
import sys
import subprocess
import shutil

def build_app():
    print("Preparing to build White Gold Machine Analyzer...")
    
    # 1. Resolve customtkinter directory
    try:
        import customtkinter
        ctk_path = os.path.dirname(customtkinter.__file__)
        print(f"Found CustomTkinter at: {ctk_path}")
    except ImportError:
        print("Error: customtkinter is not installed! Please run 'pip install customtkinter'")
        sys.exit(1)
        
    # 2. Define build parameters
    entry_script = "app.py"
    app_name = "White_Gold_Analyzer"
    
    # Semicolon separator for Windows
    sep = ";"
    
    # Bundle folders and files
    add_data_index = f"index.html{sep}."
    add_data_static = f"static{sep}static"
    add_data_ctk = f"{ctk_path}{sep}customtkinter"
    
    # 3. Assemble PyInstaller command
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--noconsole",
        "--name", app_name,
        "--add-data", add_data_index,
        "--add-data", add_data_static,
        "--add-data", add_data_ctk,
        entry_script
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    
    try:
        # Run compilation
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("PyInstaller output:")
        print(result.stdout)
        print("\nBuild completed successfully!")
        print(f"The executable is located in: {os.path.abspath('dist/' + app_name + '.exe')}")
    except subprocess.CalledProcessError as e:
        print("\nError during compilation:")
        print(e.stderr)
        sys.exit(1)

if __name__ == "__main__":
    build_app()
