# White Gold Machine Data Analyzer

આ એક ગુજરાતી ભાષા આધારિત એડવાન્સ વેબ-ડેસ્કટોપ એપ્લિકેશન છે જે વાઇટ ગોલ્ડ ડાયમંડ/જ્વેલરી વ્યવસાયમાં મશીન વાઈઝ ડેટા એન્ટ્રી, રીયલ-ટાઇમ ડીફરન્સ કેલ્ક્યુલેશન, લીડરબોર્ડ રેન્કિંગ્સ, એનાલિસિસ ચાર્ટ્સ, તેમજ એક્સેલ/પીડીએફ રીપોર્ટ જનરેટ કરવા માટે બનાવવામાં આવી છે.

This is a premium, Python-Flask powered desktop application with a CustomTkinter window controller and an interactive HTML5/CSS3/JS web dashboard for managing and analyzing machine data entries synced directly with an Excel database.

---

## 📂 Project Structure (પ્રોજેક્ટ ફાઈલો)

આ પ્રોજેક્ટ ગીટહબ (GitHub) પર અપલોડ કરવા માટે સંપૂર્ણ સેટઅપ કરેલ છે. તેની ફાઈલો નીચે મુજબ છે:

- `app.py`: મુખ્ય સર્વર અને જીયુઆઈ કંટ્રોલર ફાઈલ (Flask Server & CustomTkinter UI Launcher).
- `db_helper.py`: એક્સેલ ડેટાબેઝ ઓપરેશન્સ અને સ્ટેટિસ્ટિકલ ક્વેરીઝ (Excel database operations & calculations).
- `build.py`: પાયઈન્સ્ટોલર દ્વારા EXE બનાવવાની સ્ક્રિપ્ટ (PyInstaller executable builder).
- `.gitignore`: બિનજરૂરી બિલ્ડ ફાઈલો અને લોકલ ડેટાબેઝને ગીટમાં અપલોડ થતા રોકે છે.
- `templates/index.html`: એપ્લિકેશનનું મુખ્ય એચટીએમએલ લેઆઉટ (Main HTML template structure).
- `static/css/style.css`: પ્રીમિયમ થીમ અને પ્રિન્ટ લેઆઉટ સ્ટાઇલશીટ (Vanila CSS design tokens & print stylesheets).
- `static/js/app.js`: સર્ચેબલ સિલેક્ટ, ફિલ્ટર્સ અને ચાર્ટ્સનું જાવાસ્ક્રિપ્ટ કંટ્રોલર (Frontend MVC controller & Chart.js binders).
- `static/js/chart.min.js`: ઓફલાઇન કામ કરવા માટે ચાર્ટ એન્જીન (Local offline Chart.js engine).

---

## 🛠️ Prerequisites (જરૂરી સોફ્ટવેર)

પ્રોજેક્ટને રન કરવા માટે તમારા કમ્પ્યુટરમાં Python ઇન્સ્ટોલ હોવું જોઈએ અને નીચેની લાયબ્રેરી હોવી જોઈએ:

```bash
pip install flask pandas openpyxl customtkinter pyinstaller
```

---

## 🚀 How to Run & Build (રન અને બિલ્ડ કમાન્ડ્સ)

### 1. લોકલ રન કરો (Run Locally)
કોડમાં ફેરફાર કરવા માટે સીધું રન કરવા માટે:
```bash
python app.py
```

### 2. EXE ફાઇલ બનાવો (Build Executable)
વિન્ડોઝ માટે સિંગલ-ફાઈલ `.exe` કમ્પાઇલ કરવા માટે નીચેનો કમાન્ડ રન કરો (આ આપમેળે customtkinter અને Flask ના સ્ટેટિક અસેટ્સને બંડલ કરી દેશે):
```bash
python build.py
```
કમ્પાઇલ થયા પછી કંટ્રોલર ફાઇલ `dist/White_Gold_Analyzer.exe` માં જોવા મળશે જેને તમે બહાર કોપી કરીને વાપરી શકો છો.

---

## 📤 Upload to GitHub (ગીટહબ પર કેવી રીતે અપલોડ કરવું)

આ પ્રોજેક્ટ ફોલ્ડરને તમારા ગીટહબ એકાઉન્ટમાં અપલોડ કરવા માટે તમારા ટર્મિનલ/પાવરશેલમાં નીચેના કમાન્ડ્સ રન કરો:

1. ગીટ રીપોઝીટરી ચાલુ કરો:
   ```bash
   git init
   ```
2. બધી ફાઈલો ગીટ સ્ટેજીંગમાં ઉમેરો (આ `.gitignore` મુજબ વધારાની ફાઈલો છોડી દેશે):
   ```bash
   git add .
   ```
3. કમીટ સેવ કરો:
   ```bash
   git commit -m "Initial commit - White Gold Machine Analyzer"
   ```
4. મેઈન બ્રાન્ચ સેટ કરો:
   ```bash
   git branch -M main
   ```
5. તમારા ગીટહબ રીપોઝીટરી લિંક સાથે જોડો:
   ```bash
   git remote add origin <તમારી_ગીટહબ_રીપોઝીટરી_લિંક>
   ```
6. કોડને ગીટહબ પર પુશ કરો:
   ```bash
   git push -u origin main
   ```
