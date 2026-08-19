import os
import pandas as pd
from datetime import datetime

EXCEL_FILE = "data.xlsx"

def init_db():
    """Initialize the Excel database if it doesn't exist."""
    import uuid
    if not os.path.exists(EXCEL_FILE):
        # Create empty Data sheet
        data_df = pd.DataFrame(columns=[
            "તારીખ", 
            "કાપણ", 
            "લોટ નંબર", 
            "કાચું વજન", 
            "પ્રિન્ટ વજન", 
            "NAG", 
            "ડીફરન્સ", 
            "મશીન નંબર", 
            "ઓપરેટર",
            "UUID"
        ])
        
        # Create Machines sheet with default machine list
        default_machines = ["1", "2", "3", "4", "10", "18", "24", "25", "26", "27", "50"]
        machines_df = pd.DataFrame({
            "મશીન નંબર": default_machines
        })
        
        # Create Operators sheet with default operator list
        default_operators = ["munna", "chetan", "navin r", "sandip", "ritesh", "jagan", "nevala", "fenil", "shubham", "deepesh", "dhruv"]
        operators_df = pd.DataFrame({
            "ઓપરેટર": default_operators
        })
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl") as writer:
            data_df.to_excel(writer, sheet_name="Data", index=False)
            machines_df.to_excel(writer, sheet_name="Machines", index=False)
            operators_df.to_excel(writer, sheet_name="Operators", index=False)
    else:
        # Check if sheets exist, create them if missing
        try:
            with pd.ExcelFile(EXCEL_FILE) as xls:
                sheets = xls.sheet_names
            
            # First, handle adding UUID column to Data sheet if it exists but is missing UUID
            if "Data" in sheets:
                try:
                    df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
                    if "UUID" not in df.columns:
                        df["UUID"] = [str(uuid.uuid4()) for _ in range(len(df))]
                        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                            df.to_excel(writer, sheet_name="Data", index=False)
                except Exception as ex:
                    print(f"Error migrating Data sheet to include UUID: {ex}")

            writer = pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace")
            
            if "Data" not in sheets:
                data_df = pd.DataFrame(columns=[
                    "તારીખ", "કાપણ", "લોટ નંબર", "કાચું વજન", "પ્રિન્ટ વજન", "NAG", "ડીફરન્સ", "મશીન નંબર", "ઓપરેટર", "UUID"
                ])
                data_df.to_excel(writer, sheet_name="Data", index=False)
                
            if "Machines" not in sheets:
                default_machines = ["1", "2", "3", "4", "10", "18", "24", "25", "26", "27", "50"]
                machines_df = pd.DataFrame({"મશીન નંબર": default_machines})
                machines_df.to_excel(writer, sheet_name="Machines", index=False)
                
            if "Operators" not in sheets:
                default_operators = ["munna", "chetan", "navin r", "sandip", "ritesh", "jagan", "nevala", "fenil", "shubham", "deepesh", "dhruv"]
                operators_df = pd.DataFrame({"ઓપરેટર": default_operators})
                operators_df.to_excel(writer, sheet_name="Operators", index=False)
                
            writer.close()
        except Exception as e:
            print(f"Error initializing sheets: {e}")

def get_machines():
    """Retrieve all machine numbers from the database."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Machines")
        machines = df["મશીન નંબર"].astype(str).str.strip().tolist()
        machines = [m for m in machines if m and m != "nan"]
        try:
            machines = sorted(machines, key=lambda x: float(x) if x.replace('.', '', 1).isdigit() else 0)
        except Exception:
            machines = sorted(machines)
        return machines
    except Exception as e:
        print(f"Error reading machines: {e}")
        return []

def add_machine(machine_no):
    """Add a new machine number to the database."""
    init_db()
    machine_no = str(machine_no).strip()
    if not machine_no:
        return False, "મશીન નંબર ખાલી ન હોવો જોઈએ."
    
    machines = get_machines()
    if machine_no in machines:
        return False, "આ મશીન નંબર પહેલેથી જ અસ્તિત્વમાં છે."
    
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Machines")
        new_row = pd.DataFrame([{"મશીન નંબર": machine_no}])
        df = pd.concat([df, new_row], ignore_index=True)
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Machines", index=False)
        trigger_bg_sync()
        return True, "મશીન નંબર સફળતાપૂર્વક ઉમેરવામાં આવ્યો."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def delete_machine(machine_no):
    """Delete a machine number from the database."""
    init_db()
    machine_no = str(machine_no).strip()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Machines")
        df["મશીન નંબર"] = df["મશીન નંબર"].astype(str).str.strip()
        
        if machine_no not in df["મશીન નંબર"].values:
            return False, "મશીન નંબર મળ્યો નથી."
        
        df = df[df["મશીન નંબર"] != machine_no]
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Machines", index=False)
        trigger_bg_sync()
        return True, "મશીન નંબર સફળતાપૂર્વક કાઢી નાખવામાં આવ્યો."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

# --- OPERATOR MASTER FUNCTIONS ---

def get_operators():
    """Retrieve all operator names from the database."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Operators")
        operators = df["ઓપરેટર"].astype(str).str.strip().tolist()
        operators = [op for op in operators if op and op != "nan"]
        return sorted(operators)
    except Exception as e:
        print(f"Error reading operators: {e}")
        return []

def add_operator(name):
    """Add a new operator name to the database."""
    init_db()
    name = str(name).strip()
    if not name:
        return False, "ઓપરેટર નામ ખાલી ન હોવું જોઈએ."
    
    operators = get_operators()
    if name in operators:
        return False, "આ ઓપરેટર પહેલેથી જ અસ્તિત્વમાં છે."
    
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Operators")
        new_row = pd.DataFrame([{"ઓપરેટર": name}])
        df = pd.concat([df, new_row], ignore_index=True)
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Operators", index=False)
        trigger_bg_sync()
        return True, "ઓપરેટર સફળતાપૂર્વક ઉમેરવામાં આવ્યો."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def delete_operator(name):
    """Delete an operator name from the database."""
    init_db()
    name = str(name).strip()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Operators")
        df["ઓપરેટર"] = df["ઓપરેટર"].astype(str).str.strip()
        
        if name not in df["ઓપરેટર"].values:
            return False, "ઓપરેટર મળ્યો નથી."
        
        df = df[df["ઓપરેટર"] != name]
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Operators", index=False)
        trigger_bg_sync()
        return True, "ઓપરેટર સફળતાપૂર્વક કાઢી નાખવામાં આવ્યો."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

# --- ENTRY DATA FUNCTIONS ---

def get_entries():
    """Retrieve all data entries from the database."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        df = df.fillna("")
        df["મશીન નંબર"] = df["મશીન નંબર"].astype(str).str.replace(".0", "", regex=False)
        entries = df.to_dict(orient="records")
        for idx, entry in enumerate(entries):
            entry["id"] = idx
        return entries
    except Exception as e:
        print(f"Error reading entries: {e}")
        return []

def add_entry(date, kapan, lot_no, raw_weight, print_weight, nag, difference, machine_no, operator):
    """Add a data entry to the database, appending current time."""
    init_db()
    import uuid
    try:
        if not date or not kapan or not lot_no or not machine_no or not operator:
            return False, "બધી જરૂરી ફિલ્ડ્સ ભરો."
        
        try:
            lot_no = int(lot_no)
            raw_weight = float(raw_weight)
            print_weight = float(print_weight)
            nag = int(nag)
            difference = float(difference)
        except ValueError:
            return False, "નંબર અને વજનવાળી ફિલ્ડ્સમાં સાચો આંકડો લખો."

        # Append current time if not already present
        date_str = str(date).strip()
        if " " not in date_str:
            current_time = datetime.now().strftime("%H:%M:%S")
            date_str = f"{date_str} {current_time}"

        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        
        new_row = pd.DataFrame([{
            "તારીખ": date_str,
            "કાપણ": str(kapan),
            "લોટ નંબર": lot_no,
            "કાચું વજન": raw_weight,
            "પ્રિન્ટ વજન": print_weight,
            "NAG": nag,
            "ડીફરન્સ": difference,
            "મશીન નંબર": str(machine_no),
            "ઓપરેટર": str(operator),
            "UUID": str(uuid.uuid4())
        }])
        
        df = pd.concat([df, new_row], ignore_index=True)
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Data", index=False)
            
        trigger_bg_sync()
        return True, "એન્ટ્રી સફળતાપૂર્વક સાચવવામાં આવી."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def update_entry(idx, date, kapan, lot_no, raw_weight, print_weight, nag, difference, machine_no, operator):
    """Update an existing data entry in the database by index, preserving time if possible."""
    init_db()
    import uuid
    try:
        if not date or not kapan or not lot_no or not machine_no or not operator:
            return False, "બધી જરૂરી ફિલ્ડ્સ ભરો."
        
        try:
            lot_no = int(lot_no)
            raw_weight = float(raw_weight)
            print_weight = float(print_weight)
            nag = int(nag)
            difference = float(difference)
        except ValueError:
            return False, "નંબર અને વજનવાળી ફિલ્ડ્સમાં સાચો આંકડો લખો."

        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        
        if idx < 0 or idx >= len(df):
            return False, "ખોટો ઇન્ડેક્સ."
            
        # Check if we can preserve original time
        original_date_str = str(df.at[idx, "તારીખ"])
        original_parts = original_date_str.split(' ')
        
        input_date_only = str(date).split(' ')[0]
        original_date_only = original_parts[0]
        
        if input_date_only == original_date_only and len(original_parts) > 1:
            # Date hasn't changed; keep original time
            final_date = f"{input_date_only} {original_parts[1]}"
        else:
            # Date changed; append new current time
            current_time = datetime.now().strftime("%H:%M:%S")
            final_date = f"{input_date_only} {current_time}"
            
        # Get or generate UUID
        orig_uuid = df.at[idx, "UUID"] if "UUID" in df.columns and not pd.isna(df.at[idx, "UUID"]) else ""
        if not orig_uuid or orig_uuid == "":
            orig_uuid = str(uuid.uuid4())

        df.at[idx, "તારીખ"] = final_date
        df.at[idx, "કાપણ"] = str(kapan)
        df.at[idx, "લોટ નંબર"] = lot_no
        df.at[idx, "કાચું વજન"] = raw_weight
        df.at[idx, "પ્રિન્ટ વજન"] = print_weight
        df.at[idx, "NAG"] = nag
        df.at[idx, "ડીફરન્સ"] = difference
        df.at[idx, "મશીન નંબર"] = str(machine_no)
        df.at[idx, "ઓપરેટર"] = str(operator)
        df.at[idx, "UUID"] = orig_uuid
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Data", index=False)
            
        trigger_bg_sync()
        return True, "એન્ટ્રી સફળતાપૂર્વક સેવ કરવામાં આવી."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def delete_entry(idx):
    """Delete a data entry from the database by index."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        if idx < 0 or idx >= len(df):
            return False, "ખોટો ઇન્ડેક્સ."
        
        # Get the UUID of the deleted item
        deleted_uuid = df.at[idx, "UUID"] if "UUID" in df.columns else None
        
        df = df.drop(df.index[idx]).reset_index(drop=True)
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Data", index=False)
            
        # Handle deletion in Firebase if enabled
        if deleted_uuid:
            trigger_delete_sync(deleted_uuid)
        else:
            trigger_bg_sync()
            
        return True, "એન્ટ્રી સફળતાપૂર્વક કાઢી નાખવામાં આવી."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def get_analytics():
    """Calculate overall and machine-wise statistics."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        if df.empty:
            return {
                "overall": {
                    "total_entries": 0,
                    "total_nag": 0,
                    "avg_raw_weight": 0,
                    "avg_print_weight": 0,
                    "avg_diff": 0,
                    "highest_diff": {"value": 0, "machine": "-", "operator": "-", "date": "-"},
                    "lowest_diff": {"value": 0, "machine": "-", "operator": "-", "date": "-"},
                    "last_entry": {"machine": "-", "operator": "-", "date": "-"}
                },
                "machines": {}
            }
        
        # Data preparation
        df["ડીફરન્સ"] = pd.to_numeric(df["ડીફરન્સ"], errors="coerce").fillna(0)
        df["કાચું વજન"] = pd.to_numeric(df["કાચું વજન"], errors="coerce").fillna(0)
        df["પ્રિન્ટ વજન"] = pd.to_numeric(df["પ્રિન્ટ વજન"], errors="coerce").fillna(0)
        df["NAG"] = pd.to_numeric(df["NAG"], errors="coerce").fillna(0)
        df["મશીન નંબર"] = df["મશીન નંબર"].astype(str).str.replace(".0", "", regex=False)
        
        total_entries = len(df)
        total_nag = int(df["NAG"].sum())
        avg_raw_weight = round(df["કાચું વજન"].mean(), 3) if total_entries > 0 else 0
        avg_print_weight = round(df["પ્રિન્ટ વજન"].mean(), 3) if total_entries > 0 else 0
        avg_diff = round(df["ડીફરન્સ"].mean(), 2) if total_entries > 0 else 0
        
        # Highest Difference
        high_idx = df["ડીફરન્સ"].idxmax() if total_entries > 0 else None
        if high_idx is not None and not pd.isna(high_idx):
            high_row = df.loc[high_idx]
            highest_diff = {
                "value": round(float(high_row["ડીફરન્સ"]), 2),
                "machine": str(high_row["મશીન નંબર"]),
                "operator": str(high_row["ઓપરેટર"]),
                "date": str(high_row["તારીખ"])
            }
        else:
            highest_diff = {"value": 0, "machine": "-", "operator": "-", "date": "-"}
            
        # Lowest Difference
        low_idx = df["ડીફરન્સ"].idxmin() if total_entries > 0 else None
        if low_idx is not None and not pd.isna(low_idx):
            low_row = df.loc[low_idx]
            lowest_diff = {
                "value": round(float(low_row["ડીફરન્સ"]), 2),
                "machine": str(low_row["મશીન નંબર"]),
                "operator": str(low_row["ઓપરેટર"]),
                "date": str(low_row["તારીખ"])
            }
        else:
            lowest_diff = {"value": 0, "machine": "-", "operator": "-", "date": "-"}
            
        # Last Entry
        last_row = df.iloc[-1] if total_entries > 0 else None
        if last_row is not None:
            last_entry = {
                "machine": str(last_row["મશીન નંબર"]),
                "operator": str(last_row["ઓપરેટર"]),
                "date": str(last_row["તારીખ"])
            }
        else:
            last_entry = {"machine": "-", "operator": "-", "date": "-"}
            
        # Machine-wise calculations
        machine_stats = {}
        for m_name, m_group in df.groupby("મશીન નંબર"):
            m_len = len(m_group)
            m_avg_raw = round(m_group["કાચું વજન"].mean(), 3)
            m_avg_print = round(m_group["પ્રિન્ટ વજન"].mean(), 3)
            m_avg_diff = round(m_group["ડીફરન્સ"].mean(), 2)
            m_total_nag = int(m_group["NAG"].sum())
            
            m_high_idx = m_group["ડીફરન્સ"].idxmax()
            m_high_row = m_group.loc[m_high_idx]
            m_high = {
                "value": round(float(m_high_row["ડીફરન્સ"]), 2),
                "operator": str(m_high_row["ઓપરેટર"]),
                "date": str(m_high_row["તારીખ"])
            }
            
            m_low_idx = m_group["ડીફરન્સ"].idxmin()
            m_low_row = m_group.loc[m_low_idx]
            m_low = {
                "value": round(float(m_low_row["ડીફરન્સ"]), 2),
                "operator": str(m_low_row["ઓપરેટર"]),
                "date": str(m_low_row["તારીખ"])
            }
            
            m_last_row = m_group.iloc[-1]
            m_last = {
                "operator": str(m_last_row["ઓપરેટર"]),
                "date": str(m_last_row["તારીખ"]),
                "raw_weight": float(m_last_row["કાચું વજન"]),
                "print_weight": float(m_last_row["પ્રિન્ટ વજન"]),
                "nag": int(m_last_row["NAG"]),
                "kapan": str(m_last_row["કાપણ"]),
                "lot_no": int(m_last_row["લોટ નંબર"]),
                "diff": float(m_last_row["ડીફરન્સ"])
            }
            
            m_history = []
            for _, row in m_group.iterrows():
                m_history.append({
                    "date": str(row["તારીખ"]),
                    "kapan": str(row["કાપણ"]),
                    "lot_no": int(row["લોટ નંબર"]),
                    "raw_weight": float(row["કાચું વજન"]),
                    "print_weight": float(row["પ્રિન્ટ વજન"]),
                    "nag": int(row["NAG"]),
                    "diff": float(row["ડીફરન્સ"]),
                    "operator": str(row["ઓપરેટર"])
                })

            machine_stats[str(m_name)] = {
                "total_entries": m_len,
                "total_nag": m_total_nag,
                "avg_raw_weight": m_avg_raw,
                "avg_print_weight": m_avg_print,
                "avg_diff": m_avg_diff,
                "highest_diff": m_high,
                "lowest_diff": m_low,
                "last_entry": m_last,
                "history": m_history
            }
            
        return {
            "overall": {
                "total_entries": total_entries,
                "total_nag": total_nag,
                "avg_raw_weight": avg_raw_weight,
                "avg_print_weight": avg_print_weight,
                "avg_diff": avg_diff,
                "highest_diff": highest_diff,
                "lowest_diff": lowest_diff,
                "last_entry": last_entry
            },
            "machines": machine_stats
        }
    except Exception as e:
        print(f"Error calculating analytics: {e}")
        return {"overall": {}, "machines": {}}

# --- FIREBASE CLOUD SYNC CONFIG & IMPLEMENTATION ---

import json
import requests
import threading

SYNC_CONFIG_FILE = os.path.join(os.path.dirname(EXCEL_FILE) if os.path.dirname(EXCEL_FILE) else ".", "sync_config.json")

def get_sync_config():
    if not os.path.exists(SYNC_CONFIG_FILE):
        return {
            "enabled": False,
            "db_url": "",
            "secret": "",
            "last_sync": "",
            "backup_folder": ""
        }
    try:
        with open(SYNC_CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            if "backup_folder" not in cfg:
                cfg["backup_folder"] = ""
            return cfg
    except Exception:
        return {
            "enabled": False,
            "db_url": "",
            "secret": "",
            "last_sync": "",
            "backup_folder": ""
        }

def save_sync_config(config):
    try:
        with open(SYNC_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
        return True, "સેટિંગ્સ સફળતાપૂર્વક સાચવવામાં આવી."
    except Exception as e:
        return False, f"ભૂલ: {str(e)}"

def trigger_local_backup():
    config = get_sync_config()
    folder = config.get("backup_folder", "").strip()
    if not folder:
        folder = os.path.join(os.path.dirname(os.path.abspath(EXCEL_FILE)), "backups")
    
    try:
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
            
        from datetime import datetime
        date_str = datetime.now().strftime("%Y_%m_%d")
        backup_path = os.path.join(folder, f"data_backup_{date_str}.xlsx")
        
        import shutil
        if os.path.exists(EXCEL_FILE):
            shutil.copy2(EXCEL_FILE, backup_path)
            print(f"Local date backup saved: {backup_path}")
    except Exception as e:
        print(f"Error creating local date backup: {e}")

def save_machines_locally(machines_list):
    try:
        df = pd.DataFrame({"મશીન નંબર": machines_list})
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Machines", index=False)
        trigger_local_backup()
    except Exception as e:
        print(f"Error saving machines locally: {e}")

def save_operators_locally(operators_list):
    try:
        df = pd.DataFrame({"ઓપરેટર": operators_list})
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Operators", index=False)
        trigger_local_backup()
    except Exception as e:
        print(f"Error saving operators locally: {e}")

def get_entries_list_raw():
    """Retrieve raw entries list preserving all columns including UUID."""
    init_db()
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name="Data")
        df = df.fillna("")
        df["મશીન નંબર"] = df["મશીન નંબર"].astype(str).str.replace(".0", "", regex=False)
        entries = df.to_dict(orient="records")
        return entries
    except Exception as e:
        print(f"Error reading raw entries: {e}")
        return []

def save_entries_locally(entries_list):
    try:
        columns = ["તારીખ", "કાપણ", "લોટ નંબર", "કાચું વજન", "પ્રિન્ટ વજન", "NAG", "ડીફરન્સ", "મશીન નંબર", "ઓપરેટર", "UUID"]
        rows = []
        for e in entries_list:
            rows.append({col: e.get(col, "") for col in columns})
            
        df = pd.DataFrame(rows, columns=columns)
        df["લોટ નંબર"] = pd.to_numeric(df["લોટ નંબર"], errors="coerce").fillna(0).astype(int)
        df["કાચું વજન"] = pd.to_numeric(df["કાચું વજન"], errors="coerce").fillna(0.0)
        df["પ્રિન્ટ વજન"] = pd.to_numeric(df["પ્રિન્ટ વજન"], errors="coerce").fillna(0.0)
        df["NAG"] = pd.to_numeric(df["NAG"], errors="coerce").fillna(0).astype(int)
        df["ડીફરન્સ"] = pd.to_numeric(df["ડીફરન્સ"], errors="coerce").fillna(0.0)
        
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Data", index=False)
        trigger_local_backup()
    except Exception as e:
        print(f"Error saving entries locally: {e}")

def sync_with_firebase():
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    config = get_sync_config()
    if not config.get("enabled") or not config.get("db_url"):
        return False, "Cloud sync is disabled or URL is missing."
    
    db_url = config["db_url"].strip().rstrip("/")
    auth_param = ""
    if config.get("secret"):
        auth_param = f"?auth={config['secret']}"
        
    try:
        # 1. Sync Machines
        local_machines = get_machines()
        machines_url = f"{db_url}/machines.json{auth_param}"
        res = requests.get(machines_url, timeout=10, verify=False)
        fb_machines = []
        if res.status_code == 200:
            fb_data = res.json()
            if isinstance(fb_data, list):
                fb_machines = [str(x) for x in fb_data if x]
            elif isinstance(fb_data, dict):
                fb_machines = [str(x) for x in fb_data.values() if x]
        
        merged_machines = sorted(list(set(local_machines + fb_machines)))
        save_machines_locally(merged_machines)
        requests.put(machines_url, json=merged_machines, timeout=10, verify=False)
        
        # 2. Sync Operators
        local_operators = get_operators()
        operators_url = f"{db_url}/operators.json{auth_param}"
        res = requests.get(operators_url, timeout=10, verify=False)
        fb_operators = []
        if res.status_code == 200:
            fb_data = res.json()
            if isinstance(fb_data, list):
                fb_operators = [str(x) for x in fb_data if x]
            elif isinstance(fb_data, dict):
                fb_operators = [str(x) for x in fb_data.values() if x]
                
        merged_operators = sorted(list(set(local_operators + fb_operators)))
        save_operators_locally(merged_operators)
        requests.put(operators_url, json=merged_operators, timeout=10, verify=False)

        # 3. Sync Entries
        local_entries = get_entries_list_raw()
        local_dict = {e["UUID"]: e for e in local_entries if e.get("UUID")}
        
        entries_url = f"{db_url}/entries.json{auth_param}"
        res = requests.get(entries_url, timeout=10, verify=False)
        fb_entries_dict = {}
        if res.status_code == 200:
            fb_data = res.json()
            if isinstance(fb_data, dict):
                fb_entries_dict = fb_data
            elif isinstance(fb_data, list):
                for e in fb_data:
                    if e and isinstance(e, dict) and e.get("UUID"):
                        fb_entries_dict[e["UUID"]] = e
        
        all_uuids = set(list(local_dict.keys()) + list(fb_entries_dict.keys()))
        merged_entries = []
        
        for uid in all_uuids:
            local_item = local_dict.get(uid)
            fb_item = fb_entries_dict.get(uid)
            
            if local_item and not fb_item:
                merged_entries.append(local_item)
            elif fb_item and not local_item:
                merged_entries.append(fb_item)
            else:
                merged_entries.append(local_item)
        
        def parse_date(d_str):
            try:
                return datetime.strptime(str(d_str), "%d.%m.%Y %H:%M:%S")
            except Exception:
                try:
                    return datetime.strptime(str(d_str).split(' ')[0], "%d.%m.%Y")
                except Exception:
                    return datetime.min

        merged_entries.sort(key=lambda x: parse_date(x.get("તારીખ", "")))
        save_entries_locally(merged_entries)
        
        fb_push_dict = {e["UUID"]: e for e in merged_entries if e.get("UUID")}
        requests.put(entries_url, json=fb_push_dict, timeout=10, verify=False)
        
        config["last_sync"] = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        save_sync_config(config)
        
        return True, "સિંક સફળતાપૂર્વક પૂર્ણ થયું."
        
    except Exception as e:
        return False, f"સિંક કરવામાં ભૂલ આવી: {str(e)}"

def trigger_bg_sync():
    config = get_sync_config()
    if config.get("enabled") and config.get("db_url"):
        t = threading.Thread(target=sync_with_firebase)
        t.daemon = True
        t.start()

def delete_from_firebase(deleted_uuid):
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    config = get_sync_config()
    if not config.get("enabled") or not config.get("db_url"):
        return
    db_url = config["db_url"].strip().rstrip("/")
    auth_param = ""
    if config.get("secret"):
        auth_param = f"?auth={config['secret']}"
    try:
        delete_url = f"{db_url}/entries/{deleted_uuid}.json{auth_param}"
        requests.delete(delete_url, timeout=10, verify=False)
    except Exception as e:
        print(f"Error deleting entry from Firebase: {e}")

def trigger_delete_sync(deleted_uuid):
    config = get_sync_config()
    if config.get("enabled") and config.get("db_url"):
        t = threading.Thread(target=delete_from_firebase, args=(deleted_uuid,))
        t.daemon = True
        t.start()
