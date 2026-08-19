import os
import sys
import socket
import threading
import webbrowser
import logging
import io
from datetime import datetime
import pandas as pd
from flask import Flask, render_template, jsonify, request, send_file
import customtkinter as ctk

# Local imports
import db_helper
from flask_cors import CORS

# Disable Flask logging in console
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Setup Base Path for PyInstaller freezing
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
    exe_dir = os.path.dirname(sys.executable)
    os.chdir(exe_dir)
    db_helper.EXCEL_FILE = os.path.join(exe_dir, "data.xlsx")
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_helper.EXCEL_FILE = os.path.join(base_dir, "data.xlsx")

# Initialize Flask app
app = Flask(
    __name__,
    template_folder=base_dir,
    static_folder=os.path.join(base_dir, 'static')
)

# Initialize database
db_helper.init_db()

# Enable CORS for all API endpoints
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- FLASK API ROUTES ---

@app.route('/')
def index():
    return render_template('index.html')

# --- DYNAMIC EXCEL DOWNLOAD ENDPOINT ---
@app.route('/api/download/excel', methods=['GET'])
def download_excel():
    try:
        # Get query parameters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        machine_no = request.args.get('machine_no', '')
        operator = request.args.get('operator', '')
        
        if not os.path.exists(db_helper.EXCEL_FILE):
            return jsonify({"success": False, "message": "ડેટાબેઝ ફાઇલ મળી નથી."}), 404
            
        # Read Excel Data
        df = pd.read_excel(db_helper.EXCEL_FILE, sheet_name="Data")
        
        # Apply filters in Pandas if data exists
        if not df.empty:
            df = df.fillna("")
            df["મશીન નંબર"] = df["મશીન નંબર"].astype(str).str.replace(".0", "", regex=False)
            
            # Helper to parse dates (format DD.MM.YYYY HH:MM:SS or DD.MM.YYYY)
            def parse_date_only(d_str):
                d_part = str(d_str).split(' ')[0]
                try:
                    return datetime.strptime(d_part, "%d.%m.%Y")
                except ValueError:
                    try:
                        return datetime.strptime(d_part, "%Y-%m-%d")
                    except Exception:
                        return None
            
            # Apply Date range filter
            if start_date:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                df = df[df["તારીખ"].apply(lambda d: parse_date_only(d) is not None and parse_date_only(d) >= start_dt)]
                
            if end_date:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                df = df[df["તારીખ"].apply(lambda d: parse_date_only(d) is not None and parse_date_only(d) <= end_dt)]
                
            # Apply Machine filter (supports comma-separated multi-select)
            if machine_no:
                selected_machines = [m.strip() for m in str(machine_no).split(',') if m.strip()]
                if selected_machines:
                    df = df[df["મશીન નંબર"].astype(str).str.strip().isin(selected_machines)]
                
            # Apply Operator filter (supports comma-separated multi-select)
            if operator:
                selected_operators = [op.strip().lower() for op in str(operator).split(',') if op.strip()]
                if selected_operators:
                    df = df[df["ઓપરેટર"].astype(str).str.strip().str.lower().isin(selected_operators)]
                
        # Generate temporary Excel file in-memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name="Data", index=False)
            
            # Preserve Machines & Operators sheets in download
            try:
                machines_df = pd.read_excel(db_helper.EXCEL_FILE, sheet_name="Machines")
                machines_df.to_excel(writer, sheet_name="Machines", index=False)
            except Exception:
                pass
            try:
                operators_df = pd.read_excel(db_helper.EXCEL_FILE, sheet_name="Operators")
                operators_df.to_excel(writer, sheet_name="Operators", index=False)
            except Exception:
                pass
                
        output.seek(0)
        
        # Build file download name based on filter criteria
        download_name = "data.xlsx"
        if start_date or end_date or machine_no or operator:
            download_name = f"data_filtered_{datetime.now().strftime('%d_%m_%H%M%S')}.xlsx"
            
        return send_file(
            output,
            as_attachment=True,
            download_name=download_name,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"success": False, "message": f"ડાઉનલોડમાં ભૂલ આવી: {str(e)}"}), 500

# --- BACKUP UPLOAD ENDPOINT ---
@app.route('/api/backup/upload', methods=['POST'])
def upload_backup():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "message": "કોઈ ફાઇલ મળી નથી."}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "message": "ફાઇલ પસંદ કરેલી નથી."}), 400
            
        if not file.filename.endswith('.xlsx'):
            return jsonify({"success": False, "message": "ફક્ત એક્સેલ ફાઇલ (.xlsx) જ અપલોડ કરી શકાશે."}), 400
            
        # Validate Excel sheets
        temp_path = "temp_backup.xlsx"
        file.save(temp_path)
        
        try:
            with pd.ExcelFile(temp_path) as xls:
                sheets = xls.sheet_names
            
            required = ["Data", "Machines", "Operators"]
            for r in required:
                if r not in sheets:
                    os.remove(temp_path)
                    return jsonify({"success": False, "message": f"ભૂલ: ફાઇલમાં '{r}' શીટ મળતી નથી. આ સાચી બેકઅપ ફાઇલ નથી."}), 400
            
            # Make a safety copy of current file
            if os.path.exists(db_helper.EXCEL_FILE):
                import shutil
                shutil.copy(db_helper.EXCEL_FILE, "data_prev_backup.xlsx")
                os.remove(db_helper.EXCEL_FILE)
                
            os.rename(temp_path, db_helper.EXCEL_FILE)
            
            # Re-initialize DB helper
            db_helper.init_db()
            
            return jsonify({"success": True, "message": "બેકઅપ ફાઇલ સફળતાપૂર્વક અપલોડ અને રીસ્ટોર થઈ ગઈ છે!"})
        except Exception as ex:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({"success": False, "message": f"ફાઇલ રીડ કરવામાં ભૂલ આવી: {str(ex)}"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "message": f"અપલોડ દરમિયાન ભૂલ આવી: {str(e)}"}), 500

# --- MACHINE ENDPOINTS ---
@app.route('/api/machines', methods=['GET'])
def get_machines():
    machines = db_helper.get_machines()
    return jsonify(machines)

@app.route('/api/machines', methods=['POST'])
def add_machine():
    data = request.json or {}
    machine_no = data.get("machine_no", "")
    success, msg = db_helper.add_machine(machine_no)
    return jsonify({"success": success, "message": msg})

@app.route('/api/machines/<machine_no>', methods=['DELETE'])
def delete_machine(machine_no):
    success, msg = db_helper.delete_machine(machine_no)
    return jsonify({"success": success, "message": msg})

# --- OPERATOR ENDPOINTS ---
@app.route('/api/operators', methods=['GET'])
def get_operators():
    operators = db_helper.get_operators()
    return jsonify(operators)

@app.route('/api/operators', methods=['POST'])
def add_operator():
    data = request.json or {}
    operator_name = data.get("operator", "")
    success, msg = db_helper.add_operator(operator_name)
    return jsonify({"success": success, "message": msg})

@app.route('/api/operators/<operator_name>', methods=['DELETE'])
def delete_operator(operator_name):
    success, msg = db_helper.delete_operator(operator_name)
    return jsonify({"success": success, "message": msg})

# --- ENTRY ENDPOINTS ---
@app.route('/api/entries', methods=['GET'])
def get_entries():
    entries = db_helper.get_entries()
    return jsonify(entries)

@app.route('/api/entries', methods=['POST'])
def add_entry():
    data = request.json or {}
    success, msg = db_helper.add_entry(
        date=data.get("date"),
        kapan=data.get("kapan"),
        lot_no=data.get("lot_no"),
        raw_weight=data.get("raw_weight"),
        print_weight=data.get("print_weight"),
        nag=data.get("nag"),
        difference=data.get("difference"),
        machine_no=data.get("machine_no"),
        operator=data.get("operator")
    )
    return jsonify({"success": success, "message": msg})

@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    data = request.json or {}
    success, msg = db_helper.update_entry(
        idx=entry_id,
        date=data.get("date"),
        kapan=data.get("kapan"),
        lot_no=data.get("lot_no"),
        raw_weight=data.get("raw_weight"),
        print_weight=data.get("print_weight"),
        nag=data.get("nag"),
        difference=data.get("difference"),
        machine_no=data.get("machine_no"),
        operator=data.get("operator")
    )
    return jsonify({"success": success, "message": msg})

@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    success, msg = db_helper.delete_entry(entry_id)
    return jsonify({"success": success, "message": msg})

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    stats = db_helper.get_analytics()
    return jsonify(stats)

# --- CLOUD SYNC CONFIG & ACTION ENDPOINTS ---
@app.route('/api/sync/config', methods=['GET'])
def get_sync_config():
    config = db_helper.get_sync_config()
    return jsonify(config)

@app.route('/api/sync/config', methods=['POST'])
def save_sync_config():
    data = request.json or {}
    config = db_helper.get_sync_config()
    
    if "enabled" in data:
        config["enabled"] = bool(data["enabled"])
    if "db_url" in data:
        config["db_url"] = str(data["db_url"])
    if "secret" in data:
        config["secret"] = str(data["secret"])
    if "last_sync" in data:
        config["last_sync"] = str(data["last_sync"])
    if "backup_folder" in data:
        config["backup_folder"] = str(data["backup_folder"])
        
    success, msg = db_helper.save_sync_config(config)
    # Trigger sync in background if enabled
    if success and config.get("enabled"):
        db_helper.trigger_bg_sync()
    return jsonify({"success": success, "message": msg})

@app.route('/api/sync/trigger', methods=['POST'])
def trigger_sync():
    success, msg = db_helper.sync_with_firebase()
    return jsonify({"success": success, "message": msg})

# --- PORT CONFIGURATION ---
def find_free_port():
    preferred_port = 58269
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('', preferred_port))
        s.close()
        return preferred_port
    except Exception:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('', 0))
        port = s.getsockname()[1]
        s.close()
        return port

# --- GUI APPLICATION ---
class ControlApp(ctk.CTk):
    def __init__(self, port):
        super().__init__()
        self.port = port
        self.url = f"http://127.0.0.1:{port}"
        
        # Window setup
        self.title("White Gold Analyzer - Control Panel")
        self.geometry("450x350")
        self.resizable(False, False)
        
        # Themes
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        # Widgets
        self.title_label = ctk.CTkLabel(
            self, 
            text="White Gold Machine Entry & Analysis", 
            font=ctk.CTkFont(size=20, weight="bold")
        )
        self.title_label.pack(pady=(30, 10))

        self.subtitle_label = ctk.CTkLabel(
            self, 
            text="વાઈટ ગોલ્ડ મશીન ડેટા એન્ટ્રી અને વિશ્લેષણ સિસ્ટમ", 
            font=ctk.CTkFont(family="Arial", size=14)
        )
        self.subtitle_label.pack(pady=(0, 20))
        
        # Info Panel
        self.info_frame = ctk.CTkFrame(self, width=380, height=80)
        self.info_frame.pack_propagate(False)
        self.info_frame.pack(pady=10)
        
        self.status_label = ctk.CTkLabel(
            self.info_frame, 
            text="સર્વર સ્ટેટસ: ચાલુ છે (Running)", 
            text_color="#4CAF50",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.status_label.pack(pady=(12, 4))
        
        self.url_label = ctk.CTkLabel(
            self.info_frame, 
            text=self.url, 
            text_color="#1E90FF",
            font=ctk.CTkFont(size=12, underline=True),
            cursor="hand2"
        )
        self.url_label.pack()
        self.url_label.bind("<Button-1>", lambda e: self.open_browser())
        
        # Open Dashboard Button
        self.btn_open = ctk.CTkButton(
            self, 
            text="ડેશબોર્ડ ઓપન કરો (Open Dashboard)", 
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self.open_browser,
            height=45,
            width=280
        )
        self.btn_open.pack(pady=20)

        # Excel File Location Indicator
        db_path = os.path.abspath(db_helper.EXCEL_FILE)
        self.db_label = ctk.CTkLabel(
            self,
            text=f"ડેટા ફાઈલ: {os.path.basename(db_path)}\n({os.path.dirname(db_path)})",
            font=ctk.CTkFont(size=10),
            text_color="#888888"
        )
        self.db_label.pack(pady=(10, 5))
        
        # Open browser immediately on start
        self.after(800, self.open_browser)
        
    def open_browser(self):
        webbrowser.open(self.url)

def run_flask(port):
    app.run(port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    port = find_free_port()
    
    # Write dynamic port config to static/js/config.json and config.js for offline HTML CORS viewing
    target_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else base_dir
    config_dir = os.path.join(target_dir, "static", "js")
    try:
        os.makedirs(config_dir, exist_ok=True)
        # Write config.js
        with open(os.path.join(config_dir, "config.js"), "w", encoding="utf-8") as f:
            f.write(f"const FLASK_PORT = {port};\n")
        # Write config.json
        with open(os.path.join(config_dir, "config.json"), "w", encoding="utf-8") as f:
            f.write(f'{{"port": {port}}}\n')
    except Exception as e:
        print(f"Error writing port config files: {e}")
        
    # Start Flask in daemon thread
    flask_thread = threading.Thread(target=run_flask, args=(port,), daemon=True)
    flask_thread.start()
    
    # Trigger Firebase Cloud Sync on startup if enabled
    db_helper.trigger_bg_sync()
    
    # Start GUI Control Panel
    gui_app = ControlApp(port)
    gui_app.mainloop()
