// Global State
let state = {
    machines: [],
    operators: [],
    entries: [],
    analytics: {},
    activePage: 'dashboard',
    charts: {
        dashboardChart: null,
        machineChart: null
    },
    dashboardFilters: {
        start: null,
        end: null,
        machine: '',
        operator: ''
    },
    historyFilters: {
        start: null,
        end: null,
        machine: '',
        operator: ''
    },
    analysisFilters: {
        machine: '',
        start: null,
        end: null,
        operator: ''
    }
};

// DOM Elements
const pages = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item');
const alertBox = document.getElementById('global-alert');

// Active backend port, default fallback to global FLASK_PORT or 58269
let flaskPort = (typeof FLASK_PORT !== 'undefined') ? FLASK_PORT : 58269;

// Async Cache-Proof Port Config Loader
async function loadConfig() {
    try {
        const res = await fetch(`static/js/config.json?t=${new Date().getTime()}`);
        const config = await res.json();
        if (config && config.port) {
            flaskPort = config.port;
        }
    } catch (e) {
        console.log("Could not load config.json dynamically, defaulting to preferred port:", flaskPort);
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initNavigation();
    initTabHandlers();
    initFormHandlers();
    initPageFilters();
    initExportHandlers();
    loadAllData();
});

// Show alert message
function showAlert(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Navigation Logic
function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-page');
            switchPage(targetPage);
        });
    });
}

function switchPage(pageId) {
    state.activePage = pageId;
    
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    pages.forEach(page => {
        if (page.id === `${pageId}-page`) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });
    
    // Page load hooks
    if (pageId === 'dashboard') {
        renderDashboard();
    } else if (pageId === 'new-entry') {
        prepareEntryForm();
    } else if (pageId === 'master-panel') {
        renderMasterPanel();
    } else if (pageId === 'history') {
        renderHistoryTable();
    } else if (pageId === 'machine-analysis') {
        prepareMachineAnalysis();
    }
}

// Tab handlers for Master Panel
function initTabHandlers() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Get absolute API URL if running under file:/// protocol, otherwise use relative path
function getApiUrl(path) {
    if (window.location.protocol === 'file:') {
        return `http://127.0.0.1:${flaskPort}${path}`;
    }
    return path;
}

// Hybrid offline state tracking
let isOfflineMode = false;

// Fetch all initial data
async function loadAllData() {
    try {
        const [machinesRes, operatorsRes, entriesRes, analyticsRes] = await Promise.all([
            fetch(getApiUrl('/api/machines')),
            fetch(getApiUrl('/api/operators')),
            fetch(getApiUrl('/api/entries')),
            fetch(getApiUrl('/api/analytics'))
        ]);
        
        state.machines = await machinesRes.json();
        state.operators = await operatorsRes.json();
        state.entries = await entriesRes.json();
        state.analytics = await analyticsRes.json();
        isOfflineMode = false;
        
        // Setup custom select controls
        setupSelectControls();
        
        // Auto refresh current page view
        switchPage(state.activePage);
        
        // Render recent entries table on form page
        renderRecentEntries();
    } catch (err) {
        console.warn("Could not connect to Flask server. Switching to Offline LocalStorage Mode:", err);
        isOfflineMode = true;
        loadLocalStorageData();
    }
}

// Load data from LocalStorage fallback
function loadLocalStorageData() {
    // 1. Machines
    let machines = localStorage.getItem('wg_machines');
    if (!machines) {
        machines = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        localStorage.setItem('wg_machines', JSON.stringify(machines));
    } else {
        machines = JSON.parse(machines);
    }
    state.machines = machines;
    
    // 2. Operators
    let operators = localStorage.getItem('wg_operators');
    if (!operators) {
        operators = ["chetan", "munna", "ramesh", "sanjay"];
        localStorage.setItem('wg_operators', JSON.stringify(operators));
    } else {
        operators = JSON.parse(operators);
    }
    state.operators = operators;
    
    // 3. Entries
    let entries = localStorage.getItem('wg_entries');
    if (!entries) {
        entries = [];
        localStorage.setItem('wg_entries', JSON.stringify(entries));
    } else {
        entries = JSON.parse(entries);
    }
    state.entries = entries;
    
    // 4. Analytics
    calculateLocalAnalytics();
    
    // Setup and refresh
    setupSelectControls();
    switchPage(state.activePage);
    renderRecentEntries();
    
    showAlert("સોફ્ટવેર ઓફલાઇન મોડ (Browser Storage) માં ચાલુ છે. (EXE બંધ છે)", "info");
}

// Calculate suggestion analytics from entries
function calculateLocalAnalytics() {
    const mGroups = {};
    state.entries.forEach(e => {
        const m = e['મશીન નંબર'];
        const diff = parseFloat(e['ડીફરન્સ']) || 0;
        if (!mGroups[m]) {
            mGroups[m] = { sum: 0, count: 0 };
        }
        mGroups[m].sum += diff;
        mGroups[m].count += 1;
    });
    
    state.analytics = { machines: {} };
    Object.keys(mGroups).forEach(m => {
        state.analytics.machines[m] = {
            avg_diff: mGroups[m].sum / mGroups[m].count
        };
    });
}

// --- SETUP SEARCH / MULTI SELECT CONTROLS ---
function setupSelectControls() {
    // 1. Single Selects in New Entry Form
    setupSearchSelect(
        'machine_search_input', 
        'machine_select', 
        'machine_dropdown_list', 
        () => state.machines,
        (val) => showMachineSuggestion('machine_diff_suggestion', val)
    );
    setupSearchSelect(
        'operator_search_input', 
        'operator', 
        'operator_dropdown_list', 
        () => state.operators,
        null
    );
    
    // 2. Single Select for Machine Analysis Page
    setupSearchSelect(
        'analysis_machine_search', 
        'analysis_machine_select', 
        'analysis_machine_dropdown', 
        () => state.machines,
        (val) => {
            state.analysisFilters.machine = val;
            onMachineAnalysisChange();
        }
    );

    // 3. Single Selects in Edit Modal
    setupSearchSelect(
        'edit_machine_search', 
        'edit_machine_select', 
        'edit_machine_dropdown', 
        () => state.machines,
        (val) => showMachineSuggestion('edit_machine_diff_suggestion', val)
    );
    setupSearchSelect(
        'edit_operator_search', 
        'edit_operator', 
        'edit_operator_dropdown', 
        () => state.operators,
        null
    );

    // 4. MULTI-SELECT FILTERS
    setupMultiSearchSelect(
        'dash_filter_machine_container',
        'dash_filter_machine_search',
        'dash_filter_machine',
        'dash_filter_machine_dropdown',
        () => state.machines
    );
    setupMultiSearchSelect(
        'dash_filter_operator_container',
        'dash_filter_operator_search',
        'dash_filter_operator',
        'dash_filter_operator_dropdown',
        () => state.operators
    );
    
    setupMultiSearchSelect(
        'hist_filter_machine_container',
        'hist_filter_machine_search',
        'hist_filter_machine',
        'hist_filter_machine_dropdown',
        () => state.machines
    );
    setupMultiSearchSelect(
        'hist_filter_operator_container',
        'hist_filter_operator_search',
        'hist_filter_operator',
        'hist_filter_operator_dropdown',
        () => state.operators
    );

    setupMultiSearchSelect(
        'analysis_filter_operator_container',
        'analysis_filter_operator_search',
        'analysis_filter_operator',
        'analysis_filter_operator_dropdown',
        () => state.operators
    );
}

// --- STANDARD SINGLE SEARCHABLE SELECT WIDGET ---
function setupSearchSelect(inputId, hiddenId, dropdownId, getOptionsFn, onSelectChange) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !hidden || !dropdown) return;
    
    const filterAndShow = () => {
        const query = input.value.toLowerCase().trim();
        const options = getOptionsFn();
        const filtered = options.filter(opt => opt.toLowerCase().includes(query));
        
        dropdown.innerHTML = '';
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.9rem;">કોઈ પરિણામ મળ્યું નથી</div>';
        } else {
            filtered.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'search-select-item';
                if (hidden.value === opt) div.classList.add('selected');
                div.textContent = opt;
                div.addEventListener('mousedown', (e) => e.preventDefault());
                div.addEventListener('click', () => {
                    input.value = opt;
                    hidden.value = opt;
                    dropdown.classList.remove('show');
                    if (onSelectChange) onSelectChange(opt);
                });
                dropdown.appendChild(div);
            });
        }
        dropdown.classList.add('show');
    };
    
    input.addEventListener('focus', filterAndShow);
    input.addEventListener('input', filterAndShow);
    
    const handleBlur = () => {
        dropdown.classList.remove('show');
        const options = getOptionsFn();
        if (input.value && !options.includes(input.value)) {
            input.value = hidden.value;
        } else if (!input.value) {
            hidden.value = '';
            if (onSelectChange) onSelectChange('');
        }
    };
    input.addEventListener('blur', handleBlur);
}

// --- MULTI-SELECT SEARCHABLE CHECKBOX WIDGET ---
function setupMultiSearchSelect(containerId, inputId, hiddenId, dropdownId, getOptionsFn) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!container || !input || !hidden || !dropdown) return;
    
    let selectedValues = [];
    
    const updateHiddenInput = () => {
        hidden.value = selectedValues.join(',');
    };
    
    const renderPills = () => {
        const existingPills = container.querySelectorAll('.multi-select-pill');
        existingPills.forEach(p => p.remove());
        
        selectedValues.forEach(val => {
            const pill = document.createElement('span');
            pill.className = 'multi-select-pill';
            pill.innerHTML = `
                ${val}
                <span class="multi-select-pill-remove" data-val="${val}">&times;</span>
            `;
            
            pill.querySelector('.multi-select-pill-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeValue(val);
            });
            
            container.insertBefore(pill, input);
        });
        
        if (selectedValues.length > 0) {
            input.placeholder = '';
        } else {
            input.placeholder = 'પસંદ કરો...';
        }
    };
    
    const addValue = (val) => {
        if (!selectedValues.includes(val)) {
            selectedValues.push(val);
            updateHiddenInput();
            renderPills();
            filterAndShow();
        }
    };
    
    const removeValue = (val) => {
        selectedValues = selectedValues.filter(v => v !== val);
        updateHiddenInput();
        renderPills();
        filterAndShow();
    };
    
    // Expose reset handler
    container.clearSelection = () => {
        selectedValues = [];
        updateHiddenInput();
        renderPills();
    };
    
    const filterAndShow = () => {
        const query = input.value.toLowerCase().trim();
        const options = getOptionsFn();
        const filtered = options.filter(opt => opt.toLowerCase().includes(query));
        
        dropdown.innerHTML = '';
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.9rem;">કોઈ પરિણામ મળ્યું નથી</div>';
        } else {
            filtered.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'search-select-dropdown-item-check';
                
                const isChecked = selectedValues.includes(opt);
                div.innerHTML = `
                    <input type="checkbox" ${isChecked ? 'checked' : ''}>
                    <span>${opt}</span>
                `;
                
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (selectedValues.includes(opt)) {
                        removeValue(opt);
                    } else {
                        addValue(opt);
                    }
                });
                
                dropdown.appendChild(div);
            });
        }
        dropdown.classList.add('show');
    };
    
    container.addEventListener('click', () => {
        input.focus();
    });
    
    input.addEventListener('focus', filterAndShow);
    input.addEventListener('input', filterAndShow);
    
    const clickOutsideHandler = (e) => {
        if (!container.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            input.value = '';
        }
    };
    document.removeEventListener('click', clickOutsideHandler);
    document.addEventListener('click', clickOutsideHandler);
}

// Machine suggestion engine
function showMachineSuggestion(boxId, machineNo) {
    const box = document.getElementById(boxId);
    if (!box) return;
    
    if (machineNo && state.analytics.machines && state.analytics.machines[machineNo]) {
        const avg = state.analytics.machines[machineNo].avg_diff;
        box.innerHTML = `💡 આ મશીન પર સામાન્ય રીતે <b>${avg.toFixed(2)}%</b> સરેરાશ ડીફરન્સ રહે છે.`;
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
}

// --- DYNAMIC PAGE FILTERS INITIATION ---
function initPageFilters() {
    // 1. Dashboard Filters
    const btnApplyDash = document.getElementById('btn_apply_dash_filter');
    const btnResetDash = document.getElementById('btn_reset_dash_filter');
    
    if (btnApplyDash) {
        btnApplyDash.addEventListener('click', () => {
            const start = document.getElementById('dash_filter_start').value;
            const end = document.getElementById('dash_filter_end').value;
            
            state.dashboardFilters.start = start ? new Date(start) : null;
            state.dashboardFilters.end = end ? new Date(end) : null;
            state.dashboardFilters.machine = document.getElementById('dash_filter_machine').value;
            state.dashboardFilters.operator = document.getElementById('dash_filter_operator').value;
            
            if (state.dashboardFilters.start && state.dashboardFilters.end && state.dashboardFilters.start > state.dashboardFilters.end) {
                showAlert("શરૂઆતની તારીખ અંતિમ તારીખ કરતાં મોટી ન હોવી જોઈએ.", "danger");
                return;
            }
            renderDashboard();
            showAlert("ડેશબોર્ડ ફિલ્ટર લાગુ કરવામાં આવ્યું.");
        });
    }
    
    if (btnResetDash) {
        btnResetDash.addEventListener('click', () => {
            document.getElementById('dash_filter_start').value = '';
            document.getElementById('dash_filter_end').value = '';
            
            const mContainer = document.getElementById('dash_filter_machine_container');
            if (mContainer && mContainer.clearSelection) mContainer.clearSelection();
            
            const opContainer = document.getElementById('dash_filter_operator_container');
            if (opContainer && opContainer.clearSelection) opContainer.clearSelection();
            
            state.dashboardFilters = { start: null, end: null, machine: '', operator: '' };
            renderDashboard();
        });
    }
    
    // 2. History Filters
    const btnApplyHist = document.getElementById('btn_apply_hist_filter');
    const btnResetHist = document.getElementById('btn_reset_hist_filter');
    
    if (btnApplyHist) {
        btnApplyHist.addEventListener('click', () => {
            const start = document.getElementById('hist_filter_start').value;
            const end = document.getElementById('hist_filter_end').value;
            
            state.historyFilters.start = start ? new Date(start) : null;
            state.historyFilters.end = end ? new Date(end) : null;
            state.historyFilters.machine = document.getElementById('hist_filter_machine').value;
            state.historyFilters.operator = document.getElementById('hist_filter_operator').value;
            
            if (state.historyFilters.start && state.historyFilters.end && state.historyFilters.start > state.historyFilters.end) {
                showAlert("શરૂઆતની તારીખ અંતિમ તારીખ કરતાં મોટી ન હોવી જોઈએ.", "danger");
                return;
            }
            renderHistoryTable();
            showAlert("ઇતિહાસ ફિલ્ટર લાગુ કરવામાં આવ્યો.");
        });
    }
    
    if (btnResetHist) {
        btnResetHist.addEventListener('click', () => {
            document.getElementById('hist_filter_start').value = '';
            document.getElementById('hist_filter_end').value = '';
            document.getElementById('search-entries').value = '';
            
            const mContainer = document.getElementById('hist_filter_machine_container');
            if (mContainer && mContainer.clearSelection) mContainer.clearSelection();
            
            const opContainer = document.getElementById('hist_filter_operator_container');
            if (opContainer && opContainer.clearSelection) opContainer.clearSelection();
            
            state.historyFilters = { start: null, end: null, machine: '', operator: '' };
            renderHistoryTable();
        });
    }
    
    // 3. Machine Analysis Filters
    const btnApplyAnalysis = document.getElementById('btn_apply_analysis_filter');
    const btnResetAnalysis = document.getElementById('btn_reset_analysis_filter');
    
    if (btnApplyAnalysis) {
        btnApplyAnalysis.addEventListener('click', () => {
            const start = document.getElementById('analysis_filter_start').value;
            const end = document.getElementById('analysis_filter_end').value;
            const machine = document.getElementById('analysis_machine_select').value;
            
            if (!machine) {
                showAlert("મહેરબાની કરીને પહેલા મશીન પસંદ કરો.", "danger");
                return;
            }
            
            state.analysisFilters.start = start ? new Date(start) : null;
            state.analysisFilters.end = end ? new Date(end) : null;
            state.analysisFilters.operator = document.getElementById('analysis_filter_operator').value;
            
            if (state.analysisFilters.start && state.analysisFilters.end && state.analysisFilters.start > state.analysisFilters.end) {
                showAlert("શરૂઆતની તારીખ અંતિમ તારીખ કરતાં મોટી ન હોવી જોઈએ.", "danger");
                return;
            }
            onMachineAnalysisChange();
            showAlert("વિશ્લેષણ ફિલ્ટર લાગુ કરવામાં આવ્યો.");
        });
    }
    
    if (btnResetAnalysis) {
        btnResetAnalysis.addEventListener('click', () => {
            document.getElementById('analysis_filter_start').value = '';
            document.getElementById('analysis_filter_end').value = '';
            
            const opContainer = document.getElementById('analysis_filter_operator_container');
            if (opContainer && opContainer.clearSelection) opContainer.clearSelection();
            
            state.analysisFilters.start = null;
            state.analysisFilters.end = null;
            state.analysisFilters.operator = '';
            
            if (state.analysisFilters.machine) {
                onMachineAnalysisChange();
            }
        });
    }
}

// --- DYNAMIC EXCEL & PDF EXPORTS ---
function initExportHandlers() {
    const pdfButtons = ['btn_dash_pdf', 'btn_hist_pdf', 'btn_analysis_pdf'];
    pdfButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => window.print());
    });
    
    const excelButtons = [
        { id: 'btn_dash_excel', getFilters: () => state.dashboardFilters },
        { id: 'btn_hist_excel', getFilters: () => state.historyFilters },
        { id: 'btn_analysis_excel', getFilters: () => state.analysisFilters }
    ];
    
    excelButtons.forEach(cfg => {
        const btn = document.getElementById(cfg.id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (isOfflineMode) {
                    downloadExcelOffline(cfg.getFilters());
                    return;
                }
                const filters = cfg.getFilters();
                const startStr = filters.start ? formatDateToYMDString(filters.start) : '';
                const endStr = filters.end ? formatDateToYMDString(filters.end) : '';
                
                const url = getApiUrl(`/api/download/excel?start_date=${startStr}&end_date=${endStr}&machine_no=${filters.machine || ''}&operator=${filters.operator || ''}`);
                window.location.href = url;
            });
        }
    });

    // Manual Backup Download (Unfiltered excel)
    const btnBackup = document.getElementById('btn_manual_backup_download');
    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            if (isOfflineMode) {
                downloadExcelOffline(null);
                return;
            }
            window.location.href = getApiUrl('/api/download/excel');
        });
    }

    // Backup Upload Form
    const backupForm = document.getElementById('backup-upload-form');
    if (backupForm) {
        backupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (confirm("શું તમે ખરેખર બેકઅપ ફાઇલ રીસ્ટોર કરવા માંગો છો? આ કરવાથી અત્યારનો બધો જ ડેટા ઓવરરાઇટ થઈ જશે.")) {
                const fileInput = document.getElementById('backup_file_input');
                if (fileInput.files.length === 0) {
                    showAlert("મહેરબાની કરીને પહેલા ફાઇલ પસંદ કરો.", "danger");
                    return;
                }
                
                // Client-side Excel Reader for Offline LocalStorage Mode
                if (isOfflineMode) {
                    const file = fileInput.files[0];
                    const reader = new FileReader();
                    
                    reader.onload = (evt) => {
                        try {
                            const data = new Uint8Array(evt.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            
                            const sheets = workbook.SheetNames;
                            const required = ["Data", "Machines", "Operators"];
                            for (let r of required) {
                                if (!sheets.includes(r)) {
                                    showAlert(`ભૂલ: ફાઇલમાં '${r}' શીટ મળતી નથી. આ સાચી બેકઅપ ફાઇલ નથી.`, "danger");
                                    return;
                                }
                            }
                            
                            // 1. Read Data
                            const wsData = workbook.Sheets["Data"];
                            const rawEntries = XLSX.utils.sheet_to_json(wsData);
                            const entries = rawEntries.map((row, idx) => ({
                                id: idx,
                                "તારીખ": row["તારીખ"] || "",
                                "કાપણ": row["કાપણ"] || "",
                                "લોટ નંબર": row["લોટ નંબર"] || "",
                                "કાચું વજન": parseFloat(row["કાચું વજન"]) || 0,
                                "પ્રિન્ટ વજન": parseFloat(row["પ્રિન્ટ વજન"]) || 0,
                                "NAG": parseInt(row["NAG"]) || 0,
                                "ડીફરન્સ": parseFloat(row["ડીફરન્સ"]) || 0,
                                "મશીન નંબર": row["મશીન નંબર"] ? row["મશીન નંબર"].toString() : "",
                                "ઓપરેટર": row["ઓપરેટર"] || ""
                            }));
                            
                            // 2. Read Machines
                            const wsMachines = workbook.Sheets["Machines"];
                            const rawMachines = XLSX.utils.sheet_to_json(wsMachines);
                            const machines = rawMachines.map(row => (row["મશીન નંબર"] || "").toString()).filter(m => m);
                            
                            // 3. Read Operators
                            const wsOperators = workbook.Sheets["Operators"];
                            const rawOperators = XLSX.utils.sheet_to_json(wsOperators);
                            const operators = rawOperators.map(row => row["ઓપરેટર"] || "").filter(op => op);
                            
                            // Save to LocalStorage
                            localStorage.setItem('wg_entries', JSON.stringify(entries));
                            localStorage.setItem('wg_machines', JSON.stringify(machines));
                            localStorage.setItem('wg_operators', JSON.stringify(operators));
                            
                            showAlert("બેકઅપ ફાઇલ સફળતાપૂર્વક અપલોડ અને રીસ્ટોર થઈ ગઈ છે!");
                            backupForm.reset();
                            loadAllData();
                        } catch (err) {
                            showAlert("એક્સેલ ફાઇલ રીડ કરવામાં ભૂલ આવી: " + err.message, "danger");
                        }
                    };
                    
                    reader.readAsArrayBuffer(file);
                    return;
                }
                
                // Server-side Upload fallback
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                try {
                    const res = await fetch(getApiUrl('/api/backup/upload'), {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        showAlert(data.message);
                        backupForm.reset();
                        loadAllData();
                    } else {
                        showAlert(data.message, "danger");
                    }
                } catch (err) {
                    showAlert("બેકઅપ અપલોડ દરમિયાન નેટવર્ક ભૂલ આવી.", "danger");
                }
            }
        });
    }
}

// Client-side Excel Generator using SheetJS
function downloadExcelOffline(filters) {
    let filtered = state.entries;
    if (filters) {
        filtered = applyFiltersToArray(state.entries, filters);
    }
    
    const wb = XLSX.utils.book_new();
    
    // 1. Data Sheet mapping
    const dataRows = filtered.map(e => ({
        "તારીખ": e["તારીખ"],
        "કાપણ": e["કાપણ"],
        "લોટ નંબર": e["લોટ નંબર"],
        "કાચું વજન": e["કાચું વજન"],
        "પ્રિન્ટ વજન": e["પ્રિન્ટ વજન"],
        "NAG": e["NAG"],
        "ડીફરન્સ": e["ડીફરન્સ"],
        "મશીન નંબર": e["મશીન નંબર"],
        "ઓપરેટર": e["ઓપરેટર"]
    }));
    const wsData = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, wsData, "Data");
    
    // 2. Machines Sheet mapping
    const machineRows = state.machines.map(m => ({ "મશીન નંબર": m }));
    const wsMachines = XLSX.utils.json_to_sheet(machineRows);
    XLSX.utils.book_append_sheet(wb, wsMachines, "Machines");
    
    // 3. Operators Sheet mapping
    const operatorRows = state.operators.map(op => ({ "ઓપરેટર": op }));
    const wsOperators = XLSX.utils.json_to_sheet(operatorRows);
    XLSX.utils.book_append_sheet(wb, wsOperators, "Operators");
    
    let filename = "data.xlsx";
    if (filters && (filters.start || filters.end || filters.machine || filters.operator)) {
        const time = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        filename = `data_filtered_${time}.xlsx`;
    }
    XLSX.writeFile(wb, filename);
    showAlert("ઓફલાઇન એક્સેલ ફાઇલ ડાઉનલોડ થઈ ગઈ છે.");
}

function formatDateToYMDString(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Apply multi-select checks locally
function applyFiltersToArray(entriesList, filters) {
    return entriesList.filter(e => {
        // 1. Date Range
        const entryDate = parseDateStr(e['તારીખ']);
        if (entryDate) {
            if (filters.start) {
                const start = new Date(filters.start);
                start.setHours(0,0,0,0);
                if (entryDate < start) return false;
            }
            if (filters.end) {
                const end = new Date(filters.end);
                end.setHours(23,59,59,999);
                if (entryDate > end) return false;
            }
        }
        
        // 2. Machine Number (Multi-Select supports list check)
        if (filters.machine) {
            const selected = filters.machine.split(',').map(m => m.trim()).filter(m => m);
            if (selected.length > 0 && !selected.includes(e['મશીન નંબર'].toString().trim())) {
                return false;
            }
        }
        
        // 3. Operator (Multi-Select supports list check)
        if (filters.operator) {
            const selected = filters.operator.split(',').map(op => op.trim().toLowerCase()).filter(op => op);
            if (selected.length > 0 && !selected.includes(e['ઓપરેટર'].toString().trim().toLowerCase())) {
                return false;
            }
        }
        
        return true;
    });
}

// String polyfill helper
String.prototype.strip = function() {
    return this.replace(/^\s+|\s+$/g, '');
};

// Parse Date string (DD.MM.YYYY HH:MM:SS)
function parseDateStr(dateStr) {
    if (!dateStr) return null;
    const datePart = dateStr.toString().split(' ')[0];
    const parts = datePart.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(datePart);
}

// --- FORM CALCULATIONS & SAVE ---
function initFormHandlers() {
    const rawInput = document.getElementById('raw_weight');
    const printInput = document.getElementById('print_weight');
    const diffInput = document.getElementById('difference');
    
    const calculateDifference = () => {
        const raw = parseFloat(rawInput.value) || 0;
        const print = parseFloat(printInput.value) || 0;
        if (print > 0) {
            const diff = ((print - raw) * 100) / print;
            diffInput.value = diff.toFixed(2);
        } else {
            diffInput.value = "0.00";
        }
    };
    
    rawInput.addEventListener('input', calculateDifference);
    printInput.addEventListener('input', calculateDifference);
    
    const editRaw = document.getElementById('edit_raw_weight');
    const editPrint = document.getElementById('edit_print_weight');
    const editDiff = document.getElementById('edit_difference');
    
    const calculateEditDifference = () => {
        const raw = parseFloat(editRaw.value) || 0;
        const print = parseFloat(editPrint.value) || 0;
        if (print > 0) {
            const diff = ((editPrint.value - editRaw.value) * 100) / editPrint.value;
            editDiff.value = diff.toFixed(2);
        } else {
            editDiff.value = "0.00";
        }
    };
    
    editRaw.addEventListener('input', calculateEditDifference);
    editPrint.addEventListener('input', calculateEditDifference);

    // New Entry Submission
    const entryForm = document.getElementById('add-entry-form');
    if (entryForm) {
        entryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const kapanVal = document.getElementById('kapan').value;
            const payload = {
                date: formatDateToDMY(document.getElementById('entry_date').value),
                kapan: kapanVal,
                lot_no: document.getElementById('lot_no').value,
                raw_weight: document.getElementById('raw_weight').value,
                print_weight: document.getElementById('print_weight').value,
                nag: document.getElementById('nag').value,
                difference: document.getElementById('difference').value,
                machine_no: document.getElementById('machine_select').value,
                operator: document.getElementById('operator').value
            };
            
            if (isOfflineMode) {
                const nextId = state.entries.length > 0 ? Math.max(...state.entries.map(ent => ent.id)) + 1 : 0;
                
                const now = new Date();
                const dd = String(now.getDate()).padStart(2, '0');
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const yyyy = now.getFullYear();
                const timeStr = now.toTimeString().split(' ')[0];
                const dateVal = `${dd}.${mm}.${yyyy} ${timeStr}`;
                
                const newRow = {
                    id: nextId,
                    "તારીખ": dateVal,
                    "કાપણ": kapanVal,
                    "લોટ નંબર": payload.lot_no,
                    "કાચું વજન": parseFloat(payload.raw_weight) || 0,
                    "પ્રિન્ટ વજન": parseFloat(payload.print_weight) || 0,
                    "NAG": parseInt(payload.nag) || 0,
                    "ડીફરન્સ": parseFloat(payload.difference) || 0,
                    "મશીન નંબર": payload.machine_no,
                    "ઓપરેટર": payload.operator
                };
                
                state.entries.push(newRow);
                localStorage.setItem('wg_entries', JSON.stringify(state.entries));
                calculateLocalAnalytics();
                
                showAlert("એન્ટ્રી સફળતાપૂર્વક સાચવવામાં આવી (ઓફલાઇન).");
                localStorage.setItem('default_kapan', kapanVal);
                entryForm.reset();
                setDefaultDate();
                document.getElementById('kapan').value = kapanVal;
                document.getElementById('machine_diff_suggestion').style.display = 'none';
                
                loadAllData();
                return;
            }
            
            try {
                const res = await fetch(getApiUrl('/api/entries'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.success) {
                    showAlert(data.message);
                    
                    localStorage.setItem('default_kapan', kapanVal);
                    
                    entryForm.reset();
                    setDefaultDate();
                    
                    document.getElementById('kapan').value = kapanVal;
                    document.getElementById('machine_diff_suggestion').style.display = 'none';
                    
                    loadAllData();
                } else {
                    showAlert(data.message, "danger");
                }
            } catch (err) {
                showAlert("એન્ટ્રી સેવ કરવામાં ભૂલ થઈ.", "danger");
            }
        });
    }

    // Machine Addition
    const machineForm = document.getElementById('add-machine-form');
    if (machineForm) {
        machineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new_machine_no');
            const machineNo = input.value.trim();
            
            if (isOfflineMode) {
                if (state.machines.includes(machineNo)) {
                    showAlert("આ મશીન પહેલેથી જ ઉમેરેલું છે.", "danger");
                    return;
                }
                state.machines.push(machineNo);
                localStorage.setItem('wg_machines', JSON.stringify(state.machines));
                showAlert("મશીન સફળતાપૂર્વક ઉમેરવામાં આવ્યું.");
                input.value = '';
                renderMasterPanel();
                return;
            }
            
            try {
                const res = await fetch(getApiUrl('/api/machines'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ machine_no: machineNo })
                });
                const data = await res.json();
                
                if (data.success) {
                    showAlert(data.message);
                    input.value = '';
                    loadAllData();
                } else {
                    showAlert(data.message, "danger");
                }
            } catch (err) {
                showAlert("મશીન ઉમેરવામાં ભૂલ આવી.", "danger");
            }
        });
    }

    // Operator Addition
    const operatorForm = document.getElementById('add-operator-form');
    if (operatorForm) {
        operatorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new_operator_name');
            const name = input.value.trim();
            
            if (isOfflineMode) {
                if (state.operators.includes(name)) {
                    showAlert("આ ઓપરેટર પહેલેથી જ ઉમેરેલો છે.", "danger");
                    return;
                }
                state.operators.push(name);
                localStorage.setItem('wg_operators', JSON.stringify(state.operators));
                showAlert("ઓપરેટર સફળતાપૂર્વક ઉમેરવામાં આવ્યો.");
                input.value = '';
                renderMasterPanel();
                return;
            }
            
            try {
                const res = await fetch(getApiUrl('/api/operators'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operator: name })
                });
                const data = await res.json();
                
                if (data.success) {
                    showAlert(data.message);
                    input.value = '';
                    loadAllData();
                } else {
                    showAlert(data.message, "danger");
                }
            } catch (err) {
                showAlert("ઓપરેટર ઉમેરવામાં ભૂલ આવી.", "danger");
            }
        });
    }

    // Edit Modal Submission
    const editForm = document.getElementById('edit-entry-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit_id').value;
            const payload = {
                date: formatDateToDMY(document.getElementById('edit_date').value),
                kapan: document.getElementById('edit_kapan').value,
                lot_no: document.getElementById('edit_lot_no').value,
                raw_weight: document.getElementById('edit_raw_weight').value,
                print_weight: document.getElementById('edit_print_weight').value,
                nag: document.getElementById('edit_nag').value,
                difference: document.getElementById('edit_difference').value,
                machine_no: document.getElementById('edit_machine_select').value,
                operator: document.getElementById('edit_operator').value
            };
            
            if (isOfflineMode) {
                const idx = state.entries.findIndex(ent => ent.id == id);
                if (idx !== -1) {
                    const oldEntry = state.entries[idx];
                    const newDateOnly = payload.date;
                    const oldDateOnly = oldEntry['તારીખ'].split(' ')[0];
                    
                    let finalDate = oldEntry['તારીખ'];
                    if (newDateOnly !== oldDateOnly) {
                        finalDate = `${newDateOnly} ${oldEntry['તારીખ'].split(' ')[1] || '00:00:00'}`;
                    }
                    
                    state.entries[idx] = {
                        id: parseInt(id),
                        "તારીખ": finalDate,
                        "કાપણ": payload.kapan,
                        "લોટ નંબર": payload.lot_no,
                        "કાચું વજન": parseFloat(payload.raw_weight) || 0,
                        "પ્રિન્ટ વજન": parseFloat(payload.print_weight) || 0,
                        "NAG": parseInt(payload.nag) || 0,
                        "ડીફરન્સ": parseFloat(payload.difference) || 0,
                        "મશીન નંબર": payload.machine_no,
                        "ઓપરેટર": payload.operator
                    };
                    
                    localStorage.setItem('wg_entries', JSON.stringify(state.entries));
                    calculateLocalAnalytics();
                    showAlert("એન્ટ્રી સફળતાપૂર્વક અપડેટ થઈ.");
                    closeEditModal();
                    loadAllData();
                }
                return;
            }
            
            try {
                const res = await fetch(getApiUrl(`/api/entries/${id}`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.success) {
                    showAlert(data.message);
                    closeEditModal();
                    loadAllData();
                } else {
                    showAlert(data.message, "danger");
                }
            } catch (err) {
                showAlert("ફેરફાર સેવ કરવામાં નેટવર્ક ભૂલ આવી.", "danger");
            }
        });
    }

    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
}

function prepareEntryForm() {
    setDefaultDate();
    const savedKapan = localStorage.getItem('default_kapan');
    if (savedKapan) {
        document.getElementById('kapan').value = savedKapan;
    }
    document.getElementById('machine_search_input').value = '';
    document.getElementById('machine_select').value = '';
    document.getElementById('operator_search_input').value = '';
    document.getElementById('operator').value = '';
    document.getElementById('machine_diff_suggestion').style.display = 'none';
    renderRecentEntries();
}

function setDefaultDate() {
    const dateInput = document.getElementById('entry_date');
    if (dateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

function formatDateToDMY(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

function formatDateToYMD(dateStr) {
    if (!dateStr) return '';
    const datePart = dateStr.toString().split(' ')[0];
    const parts = datePart.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// --- RENDER DASHBOARD PAGE ---
function renderDashboard() {
    const filteredEntries = applyFiltersToArray(state.entries, state.dashboardFilters);
    const overall = calculateStatsForEntries(filteredEntries);
    
    document.getElementById('total-entries').textContent = overall.total_entries;
    document.getElementById('total-nag').textContent = overall.total_nag.toLocaleString();
    document.getElementById('avg-raw').textContent = overall.avg_raw_weight.toFixed(3) + " Cts";
    document.getElementById('avg-print').textContent = overall.avg_print_weight.toFixed(3) + " Cts";
    document.getElementById('avg-diff').textContent = overall.avg_diff.toFixed(2) + "%";
    
    document.getElementById('high-diff-val').textContent = overall.highest_diff.value.toFixed(2) + "%";
    document.getElementById('high-diff-detail').textContent = overall.highest_diff.machine !== '-' ?
        `મશીન: ${overall.highest_diff.machine} | ${overall.highest_diff.operator} (${overall.highest_diff.date.split(' ')[0]})` : '-';
        
    document.getElementById('low-diff-val').textContent = overall.lowest_diff.value.toFixed(2) + "%";
    document.getElementById('low-diff-detail').textContent = overall.lowest_diff.machine !== '-' ?
        `મશીન: ${overall.lowest_diff.machine} | ${overall.lowest_diff.operator} (${overall.lowest_diff.date.split(' ')[0]})` : '-';
        
    document.getElementById('last-entry-detail').textContent = overall.last_entry.machine !== '-' ?
        `મશીન: ${overall.last_entry.machine} | ${overall.last_entry.operator}` : '-';
    document.getElementById('last-entry-date').textContent = overall.last_entry.date;
    
    renderDashboardChart(filteredEntries);
    renderLeaderboards();
}

function calculateStatsForEntries(entriesList) {
    if (entriesList.length === 0) {
        return {
            total_entries: 0,
            total_nag: 0,
            avg_raw_weight: 0,
            avg_print_weight: 0,
            avg_diff: 0,
            highest_diff: { value: 0, machine: '-', operator: '-', date: '-' },
            lowest_diff: { value: 0, machine: '-', operator: '-', date: '-' },
            last_entry: { machine: '-', operator: '-', date: '-' }
        };
    }
    
    let totalNag = 0;
    let sumRaw = 0;
    let sumPrint = 0;
    let sumDiff = 0;
    
    let highest = { value: -999999, machine: '-', operator: '-', date: '-' };
    let lowest = { value: 999999, machine: '-', operator: '-', date: '-' };
    
    entriesList.forEach(e => {
        const raw = parseFloat(e['કાચું વજન']) || 0;
        const print = parseFloat(e['પ્રિન્ટ વજન']) || 0;
        const nag = parseInt(e['NAG']) || 0;
        const diff = parseFloat(e['ડીફરન્સ']) || 0;
        
        totalNag += nag;
        sumRaw += raw;
        sumPrint += print;
        sumDiff += diff;
        
        if (diff > highest.value) {
            highest = { value: diff, machine: e['મશીન નંબર'], operator: e['ઓપરેટર'], date: e['તારીખ'] };
        }
        if (diff < lowest.value) {
            lowest = { value: diff, machine: e['મશીન નંબર'], operator: e['ઓપરેટર'], date: e['તારીખ'] };
        }
    });
    
    const last = entriesList[entriesList.length - 1];
    
    return {
        total_entries: entriesList.length,
        total_nag: totalNag,
        avg_raw_weight: sumRaw / entriesList.length,
        avg_print_weight: sumPrint / entriesList.length,
        avg_diff: sumDiff / entriesList.length,
        highest_diff: highest,
        lowest_diff: lowest,
        last_entry: { machine: last['મશીન નંબર'], operator: last['ઓપરેટર'], date: last['તારીખ'] }
    };
}

function renderDashboardChart(filteredEntries) {
    const chartEl = document.getElementById('dashboardChart');
    if (!chartEl) return;
    const ctx = chartEl.getContext('2d');
    
    const machinesData = {};
    filteredEntries.forEach(e => {
        const m = e['મશીન નંબર'];
        const diff = parseFloat(e['ડીફરન્સ']) || 0;
        if (!machinesData[m]) {
            machinesData[m] = { sum: 0, count: 0 };
        }
        machinesData[m].sum += diff;
        machinesData[m].count += 1;
    });
    
    const labels = Object.keys(machinesData).sort((a,b) => {
        return parseFloat(a) - parseFloat(b) || a.localeCompare(b);
    });
    const dataValues = labels.map(l => machinesData[l].sum / machinesData[l].count);
    
    if (state.charts.dashboardChart) {
        state.charts.dashboardChart.destroy();
    }
    
    if (labels.length === 0) return;
    
    state.charts.dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => `Machine ${l}`),
            datasets: [{
                label: 'સરેરાશ ડીફરન્સ %',
                data: dataValues,
                backgroundColor: 'rgba(30, 144, 255, 0.65)',
                borderColor: 'rgba(30, 144, 255, 1)',
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'ડીફરન્સ (%)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- RENDER MACHINE & OPERATOR LEADERBOARDS ---
function renderLeaderboards() {
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    const entries24h = [];
    const entries30d = [];
    
    state.entries.forEach(e => {
        const entryDate = parseDateStr(e['તારીખ']);
        if (!entryDate) return;
        
        const ageMs = now - entryDate;
        if (ageMs >= 0 && ageMs <= oneDayMs) {
            entries24h.push(e);
        }
        if (ageMs >= 0 && ageMs <= thirtyDaysMs) {
            entries30d.push(e);
        }
    });
    
    // 1. Machine Rankings calculations
    const getMachineAverages = (entriesList) => {
        const mGroups = {};
        entriesList.forEach(e => {
            const m = e['મશીન નંબર'];
            const diff = parseFloat(e['ડીફરન્સ']) || 0;
            if (!mGroups[m]) {
                mGroups[m] = { sum: 0, count: 0 };
            }
            mGroups[m].sum += diff;
            mGroups[m].count += 1;
        });
        
        return Object.keys(mGroups).map(m => ({
            machine: m,
            avg: mGroups[m].sum / mGroups[m].count
        }));
    };
    
    const m24h = getMachineAverages(entries24h);
    const m30d = getMachineAverages(entries30d);
    
    // Render Machine list widgets (Note: Monthly ranks show monthly average explicitly)
    renderList('rank-24h-highest', [...m24h].sort((a,b) => b.avg - a.avg).slice(0, 10), 'highest', false, false);
    renderList('rank-24h-lowest', [...m24h].sort((a,b) => a.avg - b.avg).slice(0, 10), 'lowest', false, false);
    
    renderList('rank-30d-highest', [...m30d].sort((a,b) => b.avg - a.avg).slice(0, 5), 'highest', false, true);
    renderList('rank-30d-lowest', [...m30d].sort((a,b) => a.avg - b.avg).slice(0, 5), 'lowest', false, true);

    // 2. Operator Rankings calculations
    const getOperatorAverages = (entriesList) => {
        const opGroups = {};
        entriesList.forEach(e => {
            const op = e['ઓપરેટર'];
            const diff = parseFloat(e['ડીફરન્સ']) || 0;
            if (!opGroups[op]) {
                opGroups[op] = { sum: 0, count: 0 };
            }
            opGroups[op].sum += diff;
            opGroups[op].count += 1;
        });
        
        return Object.keys(opGroups).map(op => ({
            operator: op,
            avg: opGroups[op].sum / opGroups[op].count
        }));
    };

    const op24h = getOperatorAverages(entries24h);
    const op30d = getOperatorAverages(entries30d);

    // Render Operator list widgets
    renderList('rank-op-24h-highest', [...op24h].sort((a,b) => b.avg - a.avg).slice(0, 5), 'highest', true, false);
    renderList('rank-op-24h-lowest', [...op24h].sort((a,b) => a.avg - b.avg).slice(0, 5), 'lowest', true, false);
    
    renderList('rank-op-30d-highest', [...op30d].sort((a,b) => b.avg - a.avg).slice(0, 5), 'highest', true, true);
    renderList('rank-op-30d-lowest', [...op30d].sort((a,b) => a.avg - b.avg).slice(0, 5), 'lowest', true, true);
}

function renderList(elementId, items, type, isOperator = false, isMonthly = false) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    ul.innerHTML = '';
    
    if (items.length === 0) {
        ul.innerHTML = '<li style="padding: 10px; text-align: center; color: var(--text-secondary); font-size: 0.8rem;">કોઈ એન્ટ્રી મળી નથી</li>';
        return;
    }
    
    items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = `ranking-item ${type}`;
        
        let displayName = '';
        if (isOperator) {
            displayName = `👤 ${item.operator}`;
        } else {
            displayName = `મશીન ${item.machine}`;
        }
        
        if (isMonthly) {
            displayName += ` <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">(સરેરાશ: ${item.avg.toFixed(2)}%)</span>`;
        }
        
        li.innerHTML = `
            <div>
                <span class="rank-badge">#${idx + 1}</span>
                <span>${displayName}</span>
            </div>
            <span class="rank-value">${item.avg.toFixed(2)}%</span>
        `;
        ul.appendChild(li);
    });
}

// --- COMBINED MASTER PANEL PAGE ---
function renderMasterPanel() {
    const mContainer = document.getElementById('machine-tags');
    if (mContainer) {
        mContainer.innerHTML = '';
        if (state.machines.length === 0) {
            mContainer.innerHTML = '<div style="color: var(--text-secondary); padding: 10px; width: 100%; text-align: center;">કોઈ મશીન રજીસ્ટર નથી.</div>';
        } else {
            state.machines.forEach(m => {
                const tag = document.createElement('div');
                tag.className = 'master-tag';
                tag.innerHTML = `
                    <span>મશીન ${m}</span>
                    <button onclick="confirmDeleteMachine('${m}')">&times;</button>
                `;
                mContainer.appendChild(tag);
            });
        }
    }
    
    const opContainer = document.getElementById('operator-tags');
    if (opContainer) {
        opContainer.innerHTML = '';
        if (state.operators.length === 0) {
            opContainer.innerHTML = '<div style="color: var(--text-secondary); padding: 10px; width: 100%; text-align: center;">કોઈ ઓપરેટર રજીસ્ટર નથી.</div>';
        } else {
            state.operators.forEach(op => {
                const tag = document.createElement('div');
                tag.className = 'master-tag';
                tag.innerHTML = `
                    <span>${op}</span>
                    <button onclick="confirmDeleteOperator('${op}')">&times;</button>
                `;
                opContainer.appendChild(tag);
            });
        }
    }
}

async function confirmDeleteMachine(machineNo) {
    if (confirm(`શું તમે મશીન ${machineNo} ને કાઢી નાખવા માંગો છો?`)) {
        if (isOfflineMode) {
            state.machines = state.machines.filter(m => m !== machineNo);
            localStorage.setItem('wg_machines', JSON.stringify(state.machines));
            showAlert("મશીન સફળતાપૂર્વક કાઢી નાખવામાં આવ્યું.");
            renderMasterPanel();
            return;
        }
        
        try {
            const res = await fetch(getApiUrl(`/api/machines/${machineNo}`), { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showAlert(data.message);
                loadAllData();
            } else {
                showAlert(data.message, "danger");
            }
        } catch (err) {
            showAlert("ભૂલ થઈ છે.", "danger");
        }
    }
}

async function confirmDeleteOperator(name) {
    if (confirm(`શું તમે ઓપરેટર ${name} ને કાઢી નાખવા માંગો છો?`)) {
        if (isOfflineMode) {
            state.operators = state.operators.filter(op => op !== name);
            localStorage.setItem('wg_operators', JSON.stringify(state.operators));
            showAlert("ઓપરેટર સફળતાપૂર્વક કાઢી નાખવામાં આવ્યો.");
            renderMasterPanel();
            return;
        }
        
        try {
            const res = await fetch(getApiUrl(`/api/operators/${name}`), { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showAlert(data.message);
                loadAllData();
            } else {
                showAlert(data.message, "danger");
            }
        } catch (err) {
            showAlert("ભૂલ થઈ છે.", "danger");
        }
    }
}

// --- DATA HISTORY TABLE PAGE ---
function renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const searchInput = document.getElementById('search-entries');
    
    const filterAndRender = () => {
        const query = searchInput.value.toLowerCase().trim();
        tbody.innerHTML = '';
        
        let filtered = applyFiltersToArray(state.entries, state.historyFilters);
        
        if (query) {
            filtered = filtered.filter(e => {
                return (
                    e['મશીન નંબર'].toString().toLowerCase().includes(query) ||
                    e['ઓપરેટર'].toString().toLowerCase().includes(query) ||
                    e['કાપણ'].toString().toLowerCase().includes(query) ||
                    e['લોટ નંબર'].toString().toLowerCase().includes(query) ||
                    e['તારીખ'].toString().toLowerCase().includes(query)
                );
            });
        }
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 20px;">કોઈ એન્ટ્રી મળી નથી.</td></tr>';
            return;
        }
        
        [...filtered].reverse().forEach(e => {
            const tr = document.createElement('tr');
            
            const rawWeight = parseFloat(e['કાચું વજન']) || 0;
            const printWeight = parseFloat(e['પ્રિન્ટ વજન']) || 0;
            const diff = parseFloat(e['ડીફરન્સ']) || 0;
            
            let diffClass = '';
            let rowClass = '';
            if (diff >= 1.00 && diff <= 1.50) {
                rowClass = 'diff-lvl-1';
                diffClass = 'diff-val-lvl-1';
            } else if (diff > 1.50 && diff <= 2.00) {
                rowClass = 'diff-lvl-2';
                diffClass = 'diff-val-lvl-2';
            } else if (diff > 2.00) {
                rowClass = 'diff-lvl-3';
                diffClass = 'diff-val-lvl-3';
            }
            
            if (rowClass) tr.className = rowClass;
            
            const dateParts = e['તારીખ'].toString().split(' ');
            const dateVal = dateParts[0];
            const timeVal = dateParts[1] || '';
            
            tr.innerHTML = `
                <td>
                    <div><b>${dateVal}</b></div>
                    ${timeVal ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${timeVal}</div>` : ''}
                </td>
                <td>${e['કાપણ']}</td>
                <td><span class="badge badge-info">${e['લોટ નંબર']}</span></td>
                <td>${rawWeight.toFixed(3)} Cts</td>
                <td>${printWeight.toFixed(3)} Cts</td>
                <td>${e['NAG']}</td>
                <td class="${diffClass}">${diff.toFixed(2)}%</td>
                <td><b>મશીન ${e['મશીન નંબર']}</b></td>
                <td>${e['ઓપરેટર']}</td>
                <td>
                    <button class="action-btn edit" onclick="openEditModal(${e.id})" title="એડિટ કરો">✏️</button>
                    <button class="action-btn delete" onclick="confirmDeleteEntry(${e.id})" title="કાઢી નાખો">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };
    
    searchInput.removeEventListener('input', filterAndRender);
    searchInput.addEventListener('input', filterAndRender);
    
    filterAndRender();
}

async function confirmDeleteEntry(id) {
    if (confirm("શું તમે આ એન્ટ્રી કાઢી નાખવા માંગો છો?")) {
        if (isOfflineMode) {
            state.entries = state.entries.filter(ent => ent.id != id);
            localStorage.setItem('wg_entries', JSON.stringify(state.entries));
            calculateLocalAnalytics();
            showAlert("એન્ટ્રી સફળતાપૂર્વક કાઢી નાખવામાં આવી (ઓફલાઇન).");
            loadAllData();
            return;
        }
        
        try {
            const res = await fetch(getApiUrl(`/api/entries/${id}`), { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showAlert(data.message);
                loadAllData();
            } else {
                showAlert(data.message, "danger");
            }
        } catch (err) {
            showAlert("એન્ટ્રી ડીલીટ કરવામાં ભૂલ થઈ.", "danger");
        }
    }
}

// --- EDIT MODAL WINDOW LOGIC ---
function openEditModal(id) {
    const entry = state.entries[id];
    if (!entry) return;
    
    const dateOnly = entry['તારીખ'].toString().split(' ')[0];
    
    document.getElementById('edit_id').value = id;
    document.getElementById('edit_date').value = formatDateToYMD(dateOnly);
    document.getElementById('edit_kapan').value = entry['કાપણ'];
    document.getElementById('edit_lot_no').value = entry['લોટ નંબર'];
    document.getElementById('edit_nag').value = entry['NAG'];
    document.getElementById('edit_raw_weight').value = entry['કાચું વજન'];
    document.getElementById('edit_print_weight').value = entry['પ્રિન્ટ વજન'];
    document.getElementById('edit_difference').value = parseFloat(entry['ડીફરન્સ']).toFixed(2);
    
    document.getElementById('edit_machine_select').value = entry['મશીન નંબર'];
    document.getElementById('edit_machine_search').value = entry['મશીન નંબર'];
    
    document.getElementById('edit_operator').value = entry['ઓપરેટર'];
    document.getElementById('edit_operator_search').value = entry['ઓપરેટર'];
    
    showMachineSuggestion('edit_machine_diff_suggestion', entry['મશીન નંબર']);
    
    document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
}

// --- RENDER MACHINE ANALYSIS PAGE ---
function prepareMachineAnalysis() {
    document.getElementById('analysis_machine_search').value = '';
    document.getElementById('analysis_machine_select').value = '';
    
    const opContainer = document.getElementById('analysis_filter_operator_container');
    if (opContainer && opContainer.clearSelection) opContainer.clearSelection();
    
    document.getElementById('analysis_filter_start').value = '';
    document.getElementById('analysis_filter_end').value = '';
    
    state.analysisFilters = { machine: '', start: null, end: null, operator: '' };
    document.getElementById('analysis-content').style.display = 'none';
}

function onMachineAnalysisChange() {
    const machineNo = state.analysisFilters.machine;
    const content = document.getElementById('analysis-content');
    
    if (!machineNo) {
        content.style.display = 'none';
        return;
    }
    
    let mEntries = [];
    if (machineNo === "બધા મશીન") {
        mEntries = state.entries;
    } else {
        mEntries = state.entries.filter(e => e['મશીન નંબર'].toString().strip() === machineNo.toString().strip());
    }
    
    if (mEntries.length === 0) {
        content.style.display = 'none';
        showAlert("આ મશીન માટે કોઈ એન્ટ્રી નથી.", "danger");
        return;
    }
    
    mEntries = applyFiltersToArray(mEntries, state.analysisFilters);
    
    if (mEntries.length === 0) {
        const tbody = document.getElementById('m-history-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-secondary);">ફિલ્ટર પ્રમાણે કોઈ ડેટા મળ્યો નથી.</td></tr>';
        showAlert("ફિલ્ટર મુજબ કોઈ એન્ટ્રીઓ મળી નથી.", "danger");
        return;
    }
    
    content.style.display = 'block';
    
    let totalNag = 0;
    let sumRaw = 0;
    let sumPrint = 0;
    let sumDiff = 0;
    let highest = { value: -999999, operator: '-', date: '-', machine: '-' };
    let lowest = { value: 999999, operator: '-', date: '-', machine: '-' };
    
    mEntries.forEach(row => {
        const raw = parseFloat(row['કાચું વજન']) || 0;
        const print = parseFloat(row['પ્રિન્ટ વજન']) || 0;
        const nag = parseInt(row['NAG']) || 0;
        const diff = parseFloat(row['ડીફરન્સ']) || 0;
        
        totalNag += nag;
        sumRaw += raw;
        sumPrint += print;
        sumDiff += diff;
        
        if (diff > highest.value) {
            highest = { value: diff, operator: row['ઓપરેટર'], date: row['તારીખ'], machine: row['મશીન નંબર'] };
        }
        if (diff < lowest.value) {
            lowest = { value: diff, operator: row['ઓપરેટર'], date: row['તારીખ'], machine: row['મશીન નંબર'] };
        }
    });
    
    const last = mEntries[mEntries.length - 1];
    const mLen = mEntries.length;
    
    document.getElementById('m-total-entries').textContent = mLen;
    document.getElementById('m-total-nag').textContent = totalNag.toLocaleString();
    document.getElementById('m-avg-raw').textContent = (sumRaw / mLen).toFixed(3) + " Cts";
    document.getElementById('m-avg-print').textContent = (sumPrint / mLen).toFixed(3) + " Cts";
    document.getElementById('m-avg-diff').textContent = (sumDiff / mLen).toFixed(2) + "%";
    
    document.getElementById('m-high-diff').textContent = highest.value.toFixed(2) + "%";
    document.getElementById('m-low-diff').textContent = lowest.value.toFixed(2) + "%";
    document.getElementById('m-last-diff').textContent = parseFloat(last['ડીફરન્સ']).toFixed(2) + "%";
    
    if (machineNo === "બધા મશીન") {
        document.getElementById('m-high-detail').textContent = `મશીન: ${highest.machine} | ઓપરેટર: ${highest.operator} (${highest.date.split(' ')[0]})`;
        document.getElementById('m-low-detail').textContent = `મશીન: ${lowest.machine} | ઓપરેટર: ${lowest.operator} (${lowest.date.split(' ')[0]})`;
        document.getElementById('m-last-detail').textContent = `મશીન: ${last['મશીન નંબર']} | ઓપરેટર: ${last['ઓપરેટર']} (${last['તારીખ'].split(' ')[0]})`;
    } else {
        document.getElementById('m-high-detail').textContent = `ઓપરેટર: ${highest.operator} (${highest.date.split(' ')[0]})`;
        document.getElementById('m-low-detail').textContent = `ઓપરેટર: ${lowest.operator} (${lowest.date.split(' ')[0]})`;
        document.getElementById('m-last-detail').textContent = `ઓપરેટર: ${last['ઓપરેટર']} (${last['તારીખ'].split(' ')[0]})`;
    }
    
    document.getElementById('m-last-specs').textContent = `કાપણ: ${last['કાપણ']} | લોટ: ${last['લોટ નંબર']} | વજન: ${parseFloat(last['કાચું વજન']).toFixed(3)} / ${parseFloat(last['પ્રિન્ટ વજન']).toFixed(3)} Cts | NAG: ${last['NAG']}`;
    
    const tableHeader = document.querySelector('#analysis-content .card-header h3');
    if (tableHeader) {
        tableHeader.textContent = (machineNo === "બધા મશીન") ? "તમામ મશીનોની ફિલ્ટર કરેલી એન્ટ્રીઓની યાદી" : "આ મશીનની ફિલ્ટર કરેલી તમામ એન્ટ્રીઓની યાદી";
    }

    const tbody = document.getElementById('m-history-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        
        [...mEntries].reverse().forEach(row => {
            const tr = document.createElement('tr');
            
            let diffClass = '';
            let rowClass = '';
            const diff = parseFloat(row['ડીફરન્સ']) || 0;
            if (diff >= 1.00 && diff <= 1.50) {
                rowClass = 'diff-lvl-1';
                diffClass = 'diff-val-lvl-1';
            } else if (diff > 1.50 && diff <= 2.00) {
                rowClass = 'diff-lvl-2';
                diffClass = 'diff-val-lvl-2';
            } else if (diff > 2.00) {
                rowClass = 'diff-lvl-3';
                diffClass = 'diff-val-lvl-3';
            }
            
            if (rowClass) tr.className = rowClass;
            
            const dateParts = row['તારીખ'].toString().split(' ');
            const dateVal = dateParts[0];
            const timeVal = dateParts[1] || '';
            const operatorDisplay = (machineNo === "બધા મશીન") ? `${row['ઓપરેટર']} (મશીન ${row['મશીન નંબર']})` : row['ઓપરેટર'];
            
            tr.innerHTML = `
                <td>
                    <div><b>${dateVal}</b></div>
                    ${timeVal ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${timeVal}</div>` : ''}
                </td>
                <td>${row['કાપણ']}</td>
                <td><span class="badge badge-info">${row['લોટ નંબર']}</span></td>
                <td>${parseFloat(row['કાચું વજન']).toFixed(3)} Cts</td>
                <td>${parseFloat(row['પ્રિન્ટ વજન']).toFixed(3)} Cts</td>
                <td>${row['NAG']}</td>
                <td class="${diffClass}">${diff.toFixed(2)}%</td>
                <td>${operatorDisplay}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    renderMachineTrendChart(mEntries);
}

function renderMachineTrendChart(history) {
    const chartEl = document.getElementById('machineChart');
    if (!chartEl) return;
    const ctx = chartEl.getContext('2d');
    const recent = history.slice(-15);
    const labels = recent.map(row => `${row.date.split(' ')[0]}\n(લોટ: ${row.lot_no})`);
    const diffValues = recent.map(row => row.diff || row['ડીફરન્સ']);
    
    if (state.charts.machineChart) {
        state.charts.machineChart.destroy();
    }
    
    state.charts.machineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ડીફરન્સ ટ્રેન્ડ %',
                data: diffValues,
                backgroundColor: 'rgba(46, 204, 113, 0.15)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 2.5,
                tension: 0.35,
                pointBackgroundColor: 'rgba(46, 204, 113, 1)',
                pointRadius: 4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'ડીફરન્સ (%)' }
                },
                x: { grid: { color: 'rgba(0, 0, 0, 0.05)' } }
            }
        }
    });
}

// --- RENDER RECENT 20 ENTRIES TABLE (NEW ENTRY TAB) ---
function renderRecentEntries() {
    const tbody = document.getElementById('new-entry-recent-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const recent = [...state.entries].reverse().slice(0, 20);
    
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 15px;">કોઈ તાજેતરની એન્ટ્રીઓ નથી.</td></tr>';
        return;
    }
    
    recent.forEach(e => {
        const tr = document.createElement('tr');
        
        const rawWeight = parseFloat(e['કાચું વજન']) || 0;
        const printWeight = parseFloat(e['પ્રિન્ટ વજન']) || 0;
        const diff = parseFloat(e['ડીફરન્સ']) || 0;
        
        let diffClass = '';
        let rowClass = '';
        if (diff >= 1.00 && diff <= 1.50) {
            rowClass = 'diff-lvl-1';
            diffClass = 'diff-val-lvl-1';
        } else if (diff > 1.50 && diff <= 2.00) {
            rowClass = 'diff-lvl-2';
            diffClass = 'diff-val-lvl-2';
        } else if (diff > 2.00) {
            rowClass = 'diff-lvl-3';
            diffClass = 'diff-val-lvl-3';
        }
        
        if (rowClass) tr.className = rowClass;
        
        const dateParts = e['તારીખ'].toString().split(' ');
        const dateVal = dateParts[0];
        const timeVal = dateParts[1] || '';
        
        tr.innerHTML = `
            <td>
                <div><b>${dateVal}</b></div>
                ${timeVal ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${timeVal}</div>` : ''}
            </td>
            <td>${e['કાપણ']}</td>
            <td><span class="badge badge-info">${e['લોટ નંબર']}</span></td>
            <td>${rawWeight.toFixed(3)} Cts</td>
            <td>${printWeight.toFixed(3)} Cts</td>
            <td>${e['NAG']}</td>
            <td class="${diffClass}">${diff.toFixed(2)}%</td>
            <td><b>મશીન ${e['મશીન નંબર']}</b></td>
            <td>${e['ઓપરેટર']}</td>
            <td>
                <button class="action-btn edit" onclick="openEditModal(${e.id})" title="એડિટ કરો">✏️</button>
                <button class="action-btn delete" onclick="confirmDeleteEntry(${e.id})" title="કાઢી નાખો">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
