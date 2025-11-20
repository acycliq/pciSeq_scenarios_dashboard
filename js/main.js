// Debug flag for optional console output
const DEBUG = false;
window.DEBUG = DEBUG;

// Global state
const state = {
    metadata: null,
    baseData: null,
    altData: null,
    currentRun: null,
    currentRegion: 'ca1',
    currentFilter: 'all',  // 'all' or 'high_gene'
    cellColors: null,  // Will hold the color scheme
    spatial: {
        cache: {},
        currentRun: null,
        zValues: [],
        currentZ: 0,
        mode: 'none', // 'none' | 'discrete' | 'binned'
        binEdges: [],
        currentIndex: 0,
        planeFilterEnabled: false,
        hiddenClasses: new Set(),
        classes: []
    }
};

// Parameter configuration
const PARAM_CONFIG = {
    inefficiency: {
        default: 0.1,
        values: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
        displayName: 'Inefficiency'
    },
    misreadDensity: {
        default: 1e-05,
        values: [1e-06, 5e-06, 1e-05, 5e-05, 1e-04],
        displayName: 'MisreadDensity'
    },
    spotReg: {
        default: 0.1,
        values: [0.001, 0.01, 0.1, 0.5, 1.0],
        displayName: 'SpotReg'
    },
    rSpot: {
        default: 2.0,
        values: [0.5, 1.0, 2.0, 5.0, 10.0],
        displayName: 'rSpot'
    }
};

// Run mapping: configuration -> run_id
const RUN_MAPPING = {
    // All defaults -> run_0
    'default': 'run_0',
    // Inefficiency variations
    'inefficiency:0.001': 'run_6',
    'inefficiency:0.005': 'run_5',
    'inefficiency:0.01': 'run_4',
    'inefficiency:0.05': 'run_3',
    'inefficiency:0.5': 'run_1',
    'inefficiency:1.0': 'run_2',
    // MisreadDensity variations
    'misreadDensity:1e-06': 'run_8',
    'misreadDensity:5e-06': 'run_7',
    'misreadDensity:5e-05': 'run_9',
    'misreadDensity:1e-04': 'run_10',
    // SpotReg variations
    'spotReg:0.001': 'run_11',
    'spotReg:0.01': 'run_12',
    'spotReg:0.5': 'run_13',
    'spotReg:1.0': 'run_14',
    // rSpot variations
    'rSpot:0.5': 'run_15',
    'rSpot:1.0': 'run_16',
    'rSpot:5.0': 'run_17',
    'rSpot:10.0': 'run_18'
};

// Region display names
const REGION_NAMES = {
    'ca1': 'CA1',
    'ca2': 'CA2',
    'ca3': 'CA3',
    'dg': 'Dentate Gyrus (DG)'
};

// Region to representative cell class mapping (for coloring the purity chart)
const REGION_COLORS = {
    'ca1': '016 CA1-ProS Glut',
    'ca2': '025 CA2-FC-IG Glut',
    'ca3': '017 CA3 Glut',
    'dg': '037 DG Glut'
};

// Fixed palette for simplified classes used in Sankey nodes (left and right)
const SIMPLE_CLASS_COLORS = {
    'CA1': '#d62728',   // red
    'CA2': '#ff7f0e',   // orange
    'CA3': '#9467bd',   // purple
    'DG':  '#2ca02c',   // green
    'Astro': '#17becf', // teal
    'Oligo': '#8c564b', // brown
    'L5': '#1f77b4',    // blue
    'L6': '#2c3e50',    // dark blue-gray
    'Other': '#999999', // grey
    'Zero': '#000000'   // black
};

function getSimplifiedColor(simpleName) {
    return SIMPLE_CLASS_COLORS[simpleName] || '#1f77b4';
}

function hexToRgba(hex, alpha=0.6) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to get color for a cell type
function getCellColor(cellType) {
    // Special cases - ALWAYS override with these colors
    if (cellType === 'Zero') return '#000000';  // Black
    if (cellType === 'Other') return '#999999';  // Grey

    // Map simplified Sankey names to representative full class names
    const sankeyMapping = {
        'CA1': '016 CA1-ProS Glut',
        'CA2': '025 CA2-FC-IG Glut',
        'CA3': '017 CA3 Glut',
        'DG': '037 DG Glut'
    };

    // If it's a simplified name, map it to the full name
    const lookupName = sankeyMapping[cellType] || cellType;

    // Use color from loaded scheme if available
    if (state.cellColors && state.cellColors[lookupName]) {
        return state.cellColors[lookupName];
    }

    // Fallback to opinionated simplified palette if applicable
    if (SIMPLE_CLASS_COLORS[cellType]) {
        return SIMPLE_CLASS_COLORS[cellType];
    }

    // Fallback to default blue
    return '#1f77b4';
}

// Neutral link color for Sankey flows
const SANKEY_LINK_COLOR = 'rgba(150,150,150,0.35)';

// Initialize dashboard
async function init() {
    try {
        showLoading(true);

        // Load metadata
        state.metadata = await loadJSON('data/runs_metadata.json');

        // Load base run data
        state.baseData = await loadJSON(`data/${state.metadata.base_run}.json`);

        // Load color scheme
        state.cellColors = await loadJSON('data/cell_colour_scheme_yao.json');

        // Populate run selector
        populateRunSelector();
        populateSpatialRunSelector();

            // Set up event listeners
            setupEventListeners();
            setupSpatialEventListeners();
            setupTabEventListeners();

            // Default view: render base vs base on first load
            state.altData = state.baseData;
            state.currentRun = state.metadata.base_run;

            // Update 'Selected Run' display in the controls header
            const selectedRunIdEl = document.getElementById('selectedRunId');
            const selectedRunDisplayEl = document.getElementById('selectedRunDisplay');
            if (selectedRunIdEl && selectedRunDisplayEl) {
                selectedRunIdEl.textContent = state.currentRun;
                selectedRunDisplayEl.classList.remove('hidden');
            }

            // Hide config diff (no change vs base)
            hideConfigDiff();

            // Render charts immediately
            updateOverviewCharts();
            updateRegionalCharts();

            // Load spatial geometry for base run and render deck.gl viewer
            try { syncSpatialRun(state.currentRun); } catch (_) {}

            // Show content
            showLoading(false);
            showNoDataMessage(false);
        
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            alert('Failed to load dashboard data. Please ensure data files are generated.');
        }
        }
        
        // Set up tab event listeners
        function setupTabEventListeners() {
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    switchTab(button.dataset.tab);
                });
            });
        }
        
        // Switch tab
        function switchTab(tabId) {
            // Deactivate all tab buttons and hide all tab content
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
        
            // Activate the clicked tab button and show its content
            document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
            document.getElementById(`${tabId}TabContent`).classList.add('active');

            // If switching to spatial tab, ensure spatial viewer is rendered
            if (tabId === 'flowchartSpatial') {
                // Ensure flowchart lays out correctly after becoming visible
                try {
                    renderSankeyChart();
                    if (window.Plotly && document.getElementById('sankeyChart')) {
                        // Defer to next frame so container has computed size
                        requestAnimationFrame(() => {
                            try { window.Plotly.Plots.resize('sankeyChart'); } catch (_) {}
                        });
                    }
                } catch (e) {
                    console.warn('Failed to refresh flowchart on tab switch:', e);
                }

                // Plotly-based spatial (legacy) refresh
                if (state.spatial.currentRun) {
                    try { renderSpatialChart(); } catch (_) {}
                }
                // deck.gl Spatial Viewer auto-fit and rerender after layout
                if (window.SpatialViewer && window.SpatialViewer.state && window.SpatialViewer.render) {
                    try {
                        requestAnimationFrame(() => {
                            try {
                                window.SpatialViewer.state.viewFitted = false;
                                window.SpatialViewer.render();
                            } catch (e) { console.warn('Spatial render on tab switch failed:', e); }
                        });
                    } catch (e) {
                        console.warn('Failed to refresh Spatial Viewer on tab switch:', e);
                    }
                }
            }
        }
        
        // Load JSON file
        async function loadJSON(path) {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load ${path}`);
            }
            return await response.json();
        }
// Populate run selector dropdown (no longer used, but keep for compatibility)
function populateRunSelector() {
    // This function is no longer needed as we use the settings panel
    // But keep it for now in case we need to revert
}

// Populate spatial run selector with same runs list
function populateSpatialRunSelector() {
    const select = document.getElementById('spatialRunSelect');
    // Base first
    const baseOpt = document.createElement('option');
    baseOpt.value = state.metadata.base_run;
    baseOpt.textContent = `${state.metadata.base_run} (base)`;
    select.appendChild(baseOpt);
    // Alternatives
    state.metadata.runs.forEach(run => {
        const option = document.createElement('option');
        option.value = run.id;
        option.textContent = run.name;
        select.appendChild(option);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Parameter radio buttons
    const parameterGroups = ['inefficiency', 'misreadDensity', 'spotReg', 'rSpot'];

    parameterGroups.forEach(paramName => {
        const radios = document.querySelectorAll(`input[name="${paramName}"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.checked) {
                    // Pass both the string value (from HTML) and numeric value
                    onParameterChange(paramName, event.target.value, parseFloat(event.target.value));
                }
            });
        });
    });

    // Region selectors (Overview + Flowchart) kept in sync
    const regionSelect = document.getElementById('regionSelect');
    const regionSelectFlow = document.getElementById('regionSelectFlow');
    if (regionSelect) {
        regionSelect.addEventListener('change', (e) => onRegionChange(e, 'overview'));
    }
    if (regionSelectFlow) {
        regionSelectFlow.addEventListener('change', (e) => onRegionChange(e, 'flow'));
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const selected = btn.dataset.filter;
            // Deactivate all
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            // Activate all buttons matching the selected filter (sync across tabs)
            document.querySelectorAll(`.filter-btn[data-filter="${selected}"]`).forEach(b => b.classList.add('active'));
            state.currentFilter = selected;
            // Update charts
            updateAllCharts();
            // Also apply to Spatial Viewer (filter by gene counts only for spatial points)
            try {
                if (window.SpatialViewer && window.SpatialViewer.state) {
                    window.SpatialViewer.state.useGeneFilter = (selected === 'high_gene');
                    // Use threshold from metadata if available
                    const thr = (state && state.metadata && typeof state.metadata.min_gene_counts === 'number')
                        ? state.metadata.min_gene_counts
                        : 40;
                    window.SpatialViewer.state.minGeneCount = thr;
                    if (typeof window.SpatialViewer.render === 'function') {
                        window.SpatialViewer.render();
                    }
                    if (typeof window.SpatialViewer.updateLegend === 'function') {
                        window.SpatialViewer.updateLegend();
                    }
                }
            } catch (_) {}
        });
    });
}

function setupSpatialEventListeners() {
    // NOTE: Old Plotly-based spatial viewer code disabled.
    // Spatial viewer is now handled by deck.gl modules (spatial-*.js files)
    // This function is kept for compatibility but does nothing
    if (DEBUG) console.log('Old Plotly spatial viewer event listeners disabled - using deck.gl version');
}

// ============================================================================
// OLD PLOTLY-BASED SPATIAL VIEWER CODE (DISABLED)
// The spatial viewer now uses deck.gl (see spatial-*.js files)
// This code is commented out to avoid conflicts
// ============================================================================

/*
async function ensureSpatialData(runId) {
    if (state.spatial.cache.hasOwnProperty(runId)) return;
    try {
        const data = await loadJSON(`data/${runId}_cells.json`);
        state.spatial.cache[runId] = data;
    } catch (err) {
        console.warn(`Spatial geometry not found for ${runId}:`, err);
        state.spatial.cache[runId] = null;
        throw err;
    }
}

function initZSliderFor(runId) {
    // OLD CODE - see spatial-controls.js for new implementation
}

function renderSpatialChart() {
    // OLD PLOTLY CODE - see spatial-rendering.js for new deck.gl implementation
}

function showSpatialNoData(runId) {
    // OLD CODE - see spatial-loader.js for new implementation
}

function initSpatialLegend(runId) {
    // OLD CODE - see spatial-rendering.js for new implementation
}
*/

function renderSpatialLegend(counts) {
    const container = document.getElementById('legendItems');
    if (!container) return;
    container.innerHTML = '';
    state.spatial.classes.forEach(cls => {
        const visible = !state.spatial.hiddenClasses.has(cls);
        const item = document.createElement('div');
        item.className = 'legend-item' + (visible ? '' : ' dim');
        item.dataset.cls = cls;

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.background = getCellColor(cls);

        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = cls;

        const count = document.createElement('span');
        count.className = 'legend-count';
        count.textContent = (counts && counts[cls] ? counts[cls] : 0).toLocaleString();

        item.appendChild(colorBox);
        item.appendChild(label);
        item.appendChild(count);

        item.addEventListener('click', () => {
            if (state.spatial.hiddenClasses.has(cls)) state.spatial.hiddenClasses.delete(cls);
            else state.spatial.hiddenClasses.add(cls);
            renderSpatialChart();
        });

        container.appendChild(item);
    });

    // Wire show/hide all
    const showAllBtn = document.getElementById('legendShowAll');
    const hideAllBtn = document.getElementById('legendHideAll');
    if (showAllBtn) showAllBtn.onclick = () => { state.spatial.hiddenClasses.clear(); renderSpatialChart(); };
    if (hideAllBtn) hideAllBtn.onclick = () => { state.spatial.hiddenClasses = new Set(state.spatial.classes); renderSpatialChart(); };
}

function updateSpatialLegendCounts(cellsInView) {
    const counts = {};
    (cellsInView || []).forEach(c => { counts[c.class] = (counts[c.class] || 0) + 1; });
    renderSpatialLegend(counts);
}

// Get current parameter configuration
function getCurrentConfig() {
    const config = {};

    // Get selected value for each parameter
    const inefficiencyRadio = document.querySelector('input[name="inefficiency"]:checked');
    const misreadDensityRadio = document.querySelector('input[name="misreadDensity"]:checked');
    const spotRegRadio = document.querySelector('input[name="spotReg"]:checked');
    const rSpotRadio = document.querySelector('input[name="rSpot"]:checked');

    config.inefficiency = inefficiencyRadio ? parseFloat(inefficiencyRadio.value) : PARAM_CONFIG.inefficiency.default;
    config.misreadDensity = misreadDensityRadio ? parseFloat(misreadDensityRadio.value) : PARAM_CONFIG.misreadDensity.default;
    config.spotReg = spotRegRadio ? parseFloat(spotRegRadio.value) : PARAM_CONFIG.spotReg.default;
    config.rSpot = rSpotRadio ? parseFloat(rSpotRadio.value) : PARAM_CONFIG.rSpot.default;

    return config;
}

// Get run ID for current configuration
function getRunIdForConfig(config) {
    // Check which parameters are non-default
    const nonDefaultParams = [];

    Object.keys(config).forEach(paramName => {
        const paramValue = config[paramName];
        const defaultValue = PARAM_CONFIG[paramName].default;

        if (paramValue !== defaultValue) {
            nonDefaultParams.push({ name: paramName, value: paramValue });
        }
    });

    // If all defaults, return run_0
    if (nonDefaultParams.length === 0) {
        return 'run_0';
    }

    // If exactly one non-default, look up the run
    if (nonDefaultParams.length === 1) {
        const param = nonDefaultParams[0];
        const key = `${param.name}:${param.value}`;
        if (DEBUG) console.log('Lookup key:', key);
        const runId = RUN_MAPPING[key];
        if (runId) {
            return runId;
        } else {
            if (DEBUG) console.warn('Mapping not found for', param.name, 'value', param.value,
                'Available:', Object.keys(RUN_MAPPING).filter(k => k.startsWith(param.name + ':')));
            return 'run_0';
        }
    }

    // Should not happen with proper UI constraints
    if (DEBUG) console.warn('Multiple non-default parameters detected:', nonDefaultParams);
    return 'run_0';
}

// Reset all parameters to defaults except the specified one
function resetOtherParameters(changedParam) {
    const parameterGroups = ['inefficiency', 'misreadDensity', 'spotReg', 'rSpot'];

    parameterGroups.forEach(paramName => {
        if (paramName !== changedParam) {
            // Find the default radio button by checking which one has "checked" attribute in HTML
            // OR find the one marked as default in the label
            const radios = document.querySelectorAll(`input[name="${paramName}"]`);
            radios.forEach(radio => {
                // Check if this radio's parent label has the "default" class
                const isDefault = radio.parentElement.classList.contains('default');
                radio.checked = isDefault;
            });
        }
    });
}

// Update current run badge (no longer used after redesign - kept for compatibility)
function updateRunBadge(runId, paramName = null, paramValue = null) {
    const badge = document.getElementById('currentRunBadge');
    if (!badge) return; // Element removed in compact redesign

    if (runId === 'run_0' || !paramName) {
        badge.textContent = 'run_0 (default)';
        badge.className = 'run-badge alt default';
    } else {
        badge.textContent = `${runId}`;
        badge.className = 'run-badge alt modified';
    }
}

// Handle parameter change
async function onParameterChange(paramName, paramValueStr, paramValueNum) {
    if (DEBUG) console.log('Parameter changed:', paramName, '=', paramValueStr, '(numeric:', paramValueNum, ')');

    // Reset all other parameters to defaults
    resetOtherParameters(paramName);

    // Determine run mapping
    let runId = null;
    // If the selected value equals the default for this parameter, use base run without lookup
    const isDefault = PARAM_CONFIG[paramName] && (Number(paramValueStr) === Number(PARAM_CONFIG[paramName].default));
    if (isDefault) {
        runId = 'run_0';
        if (DEBUG) console.log('Default selected for', paramName, '→ using base run (run_0)');
    } else {
        // Build lookup key using the string value from HTML to avoid "1" vs "1.0" issues
        const lookupKey = `${paramName}:${paramValueStr}`;
        if (DEBUG) console.log('Lookup key:', lookupKey);
        runId = RUN_MAPPING[lookupKey];
        if (!runId) {
            if (DEBUG) console.warn('Mapping not found for', paramName, 'value', paramValueStr,
                'Available:', Object.keys(RUN_MAPPING).filter(k => k.startsWith(paramName + ':')));
            if (DEBUG) console.log('Resetting to base run');
            runId = 'run_0';
        }
    }

    if (DEBUG) console.log('Mapped to run:', runId);

    // Update the selected run display
    const selectedRunIdEl = document.getElementById('selectedRunId');
    const selectedRunDisplayEl = document.getElementById('selectedRunDisplay');
    if (selectedRunIdEl && selectedRunDisplayEl) {
        selectedRunIdEl.textContent = runId;
        selectedRunDisplayEl.classList.remove('hidden');
    }

    // Update the badge
    updateRunBadge(runId, paramName, paramValueNum);

    // Load the run (if different from current)
    if (runId === 'run_0') {
        // Base-vs-base: compare base to itself
        if (DEBUG) console.log('Base selected: rendering base vs base');
        showNoDataMessage(false);
        state.altData = state.baseData;
        state.currentRun = runId;
        hideConfigDiff();
        updateOverviewCharts();
        updateRegionalCharts();
        // Sync Spatial Viewer to selected run
        syncSpatialRun(runId);
    } else if (runId !== state.currentRun) {
        try {
            if (DEBUG) console.log('Loading run', runId, '...');
            // Don't show loading indicator - data loads quickly and it causes annoying blink
            showNoDataMessage(false);

            // Load alternative run data
            state.altData = await loadJSON(`data/${runId}.json`);
            state.currentRun = runId;
            if (DEBUG) console.log('Loaded', runId, ',', state.altData.total_cells, 'cells');

            // Find metadata for this run
            const runMetadata = state.metadata.runs.find(r => r.id === runId);

            // Display config diff
            displayConfigDiff(runMetadata);

            // Update all charts
            if (DEBUG) console.log('Updating charts...');
            updateOverviewCharts();
            updateRegionalCharts();

            // Sync Spatial Viewer to selected run
            syncSpatialRun(runId);

            if (DEBUG) console.log('Done loading and rendering');

        } catch (error) {
            console.error(`Failed to load run ${runId}:`, error);
            alert(`Failed to load data for ${runId}`);
        }
    } else {
        if (DEBUG) console.log('Run already loaded, skipping:', runId);
        // Still sync spatial viewer in case it was changed independently
        syncSpatialRun(runId);
    }
}

// Keep Spatial Viewer in sync with current hyperparameter selection
function syncSpatialRun(runId) {
    try {
        const select = document.getElementById('spatialRunSelect');
        if (select) {
            // Update dropdown if it contains this option
            const opt = Array.from(select.options).find(o => o.value === runId);
            if (opt) select.value = runId;
        }
        if (window.SpatialViewer && window.SpatialViewer.loader && typeof window.SpatialViewer.loader.loadRunData === 'function') {
            window.SpatialViewer.loader.loadRunData(runId);
        }
    } catch (e) {
        console.warn('Failed to sync Spatial Viewer:', e);
    }
}

// Handle run selection change
async function onRunChange(event) {
    const runId = event.target.value;

    if (!runId) {
        state.altData = null;
        state.currentRun = null;
        showNoDataMessage(true);
        hideConfigDiff();
        return;
    }

    try {
        showLoading(true);
        showNoDataMessage(false);

        // Load alternative run data
        state.altData = await loadJSON(`data/${runId}.json`);
        state.currentRun = runId;

        // Find metadata for this run
        const runMetadata = state.metadata.runs.find(r => r.id === runId);

        // Display config diff
        displayConfigDiff(runMetadata);

        // Update all charts
        updateOverviewCharts();
        updateRegionalCharts();

        showLoading(false);

    } catch (error) {
        console.error(`Failed to load run ${runId}:`, error);
        alert(`Failed to load data for ${runId}`);
        showLoading(false);
    }
}

// Handle region selection change
function onRegionChange(event, source = null) {
    const value = event.target.value;
    state.currentRegion = value;
    // Sync the counterpart selector
    try {
        if (source !== 'overview') {
            const sel = document.getElementById('regionSelect');
            if (sel && sel.value !== value) sel.value = value;
        }
        if (source !== 'flow') {
            const self = document.getElementById('regionSelectFlow');
            if (self && self.value !== value) self.value = value;
        }
    } catch (_) {}
    // Update charts in both tabs
    updateRegionalCharts(); // bottom two charts
    renderSankeyChart();    // flowchart
}

// Display configuration difference
function displayConfigDiff(runMetadata) {
    const configDiv = document.getElementById('configDiff');
    const paramName = document.getElementById('paramName');
    const baseValue = document.getElementById('baseValue');
    const altValue = document.getElementById('altValue');
    const altRunLabel = document.getElementById('altRunLabel');
    const extraDiffsDiv = document.getElementById('extraDiffs');

    // Guard: if any required DOM elements are missing, skip rendering safely
    if (!configDiv || !paramName || !baseValue || !altValue || !altRunLabel) {
        if (DEBUG) console.warn('Config diff container not found in DOM; skipping display.');
        return;
    }

    if (runMetadata && runMetadata.config_diff) {
        // Support both legacy single object and new list format
        const diffs = Array.isArray(runMetadata.config_diff)
            ? runMetadata.config_diff
            : [runMetadata.config_diff];

        if (diffs.length === 0) {
            hideConfigDiff();
            return;
        }

        // Show first prominently
        const first = diffs[0];
        paramName.textContent = first.parameter;
        baseValue.textContent = formatValue(first.base_value);
        altValue.textContent = formatValue(first.alt_value);
        altRunLabel.textContent = `${state.currentRun}:`;

        // Render additional diffs if any
        if (diffs.length > 1) {
            const items = diffs.slice(1).map(d => (
                `<li><code>${escapeHTML(d.parameter)}</code>: <span class="label">${state.metadata.base_run}:</span> ${escapeHTML(formatValue(d.base_value))} <span class="arrow">→</span> <span class="label">${state.currentRun}:</span> ${escapeHTML(formatValue(d.alt_value))}</li>`
            )).join('');
            extraDiffsDiv.innerHTML = `<details><summary>Show ${diffs.length - 1} more change(s)</summary><ul>${items}</ul></details>`;
            extraDiffsDiv.classList.remove('hidden');
        } else {
            extraDiffsDiv.innerHTML = '';
            extraDiffsDiv.classList.add('hidden');
        }

        configDiv.classList.remove('hidden');
    } else {
        hideConfigDiff();
    }
}

// Hide config diff
function hideConfigDiff() {
    const cfg = document.getElementById('configDiff');
    if (cfg) cfg.classList.add('hidden');
    const extraDiffsDiv = document.getElementById('extraDiffs');
    if (extraDiffsDiv) {
        extraDiffsDiv.innerHTML = '';
        extraDiffsDiv.classList.add('hidden');
    }
}

// Format value for display
function formatValue(value) {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value;
}

// Basic HTML escape for safe insertion
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Update all charts
function updateAllCharts() {
    if (!state.altData) return;

    renderPurityChart();
    renderMetricsTable();
    renderCountsCharts();
    renderSankeyChart();
}

// Update overview charts
function updateOverviewCharts() {
    if (!state.altData) return;

    renderPurityChart();
    renderMetricsTable();
}

// Render purity comparison chart
function renderPurityChart() {
    const regions = ['ca1', 'ca2', 'ca3', 'dg'];
    const filterKey = state.currentFilter === 'high_gene' ? 'high_gene_count' : '';

    const baseValues = regions.map(region => {
        const data = state.baseData.regions[region];
        return filterKey ? data[filterKey].purity : data.purity;
    });

    const altValues = regions.map(region => {
        const data = state.altData.regions[region];
        return filterKey ? data[filterKey].purity : data.purity;
    });

    // Calculate dynamic y-axis range
    const allValues = [...baseValues, ...altValues];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    // Add 10% padding above and below
    const range = maxValue - minValue;
    const yMin = Math.max(0, minValue - range * 0.1);
    const yMax = Math.min(100, maxValue + range * 0.1);

    const trace1 = {
        x: regions.map(r => REGION_NAMES[r]),
        y: baseValues,
        name: state.metadata.base_run,
        type: 'bar',
        marker: { color: '#c4b5fd' }  // Lavender for base run
    };

    const trace2 = {
        x: regions.map(r => REGION_NAMES[r]),
        y: altValues,
        name: state.currentRun,
        type: 'bar',
        marker: { color: '#93c5fd' }  // Powder blue for alternative run
    };

    const layout = {
        // Title omitted to save vertical space (section header already present)
        xaxis: { title: 'Region', automargin: true },
        yaxis: {
            title: 'Classification Accuracy (%)',
            range: [yMin, yMax],
            automargin: true
        },
        barmode: 'group',
        height: 380,
        margin: { l: 40, r: 10, t: 10, b: 40 }
    };

    Plotly.newPlot('purityChart', [trace1, trace2], layout, {responsive: true});
}

// Render metrics summary table
function renderMetricsTable() {
    const regions = ['ca1', 'ca2', 'ca3', 'dg'];
    const filterKey = state.currentFilter === 'high_gene' ? 'high_gene_count' : '';

    let html = '<table><thead><tr>';
    html += '<th>Region</th>';
    html += `<th>${state.metadata.base_run}</th>`;
    html += `<th>${state.currentRun}</th>`;
    html += '<th>Change</th>';
    html += '</tr></thead><tbody>';

    regions.forEach(region => {
        const baseData = state.baseData.regions[region];
        const altData = state.altData.regions[region];

        const basePurity = filterKey ? baseData[filterKey].purity : baseData.purity;
        const altPurity = filterKey ? altData[filterKey].purity : altData.purity;
        const change = altPurity - basePurity;

        const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
        const signed = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;

        html += '<tr>';
        html += `<td><strong>${REGION_NAMES[region]}</strong></td>`;
        html += `<td>${basePurity.toFixed(1)}%</td>`;
        html += `<td>${altPurity.toFixed(1)}%</td>`;
        html += `<td class="${changeClass}">${signed}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    document.getElementById('metricsTable').innerHTML = html;
}

// Update regional analysis charts
function updateRegionalCharts() {
    if (!state.altData) return;

    renderCountsCharts();
    renderSankeyChart();
}

// Render side-by-side counts charts
function renderCountsCharts() {
    const region = state.currentRegion;
    const filterKey = state.currentFilter === 'high_gene' ? 'high_gene_count' : '';

    // Update titles
    document.getElementById('baseChartTitle').textContent = `Distribution of cell types in ${REGION_NAMES[region]} under the the base run: ${state.metadata.base_run}`;
    document.getElementById('altChartTitle').textContent = `Distribution of cell types in ${REGION_NAMES[region]} under the alternative run: ${state.currentRun}`;

    // Get data
    const baseRegion = state.baseData.regions[region];
    const altRegion = state.altData.regions[region];

    const baseCounts = filterKey ? baseRegion[filterKey].cell_type_counts : baseRegion.cell_type_counts;
    const altCounts = filterKey ? altRegion[filterKey].cell_type_counts : altRegion.cell_type_counts;

    // Render base chart
    renderBarChart('baseCountsChart', baseCounts, `${state.metadata.base_run}`);

    // Render alt chart
    renderBarChart('altCountsChart', altCounts, `${state.currentRun}`);
}

// Render a bar chart
function renderBarChart(elementId, counts, title) {
    // Sort by count descending
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);  // Top 15

    const labels = sorted.map(([label, _]) => label);
    const values = sorted.map(([_, count]) => count);

    // Map labels to colors using the helper function
    const colors = labels.map(label => getCellColor(label));

    const trace = {
        x: labels,
        y: values,
        type: 'bar',
        marker: {
            color: colors
        }
    };

    const layout = {
        xaxis: {
            tickangle: -30,
            automargin: true
        },
        yaxis: { title: 'Cell Count', automargin: true },
        height: 380,
        margin: { l: 40, r: 10, t: 10, b: 70 }
    };

    Plotly.newPlot(elementId, [trace], layout, {responsive: true});
}

// Render Sankey diagram
function renderSankeyChart() {
    const region = state.currentRegion;
    const filterKey = state.currentFilter === 'high_gene' ? 'high_gene' : 'all';

    let transitions;
    if (state.altData && state.altData.transitions && state.altData.transitions[region] && state.altData.transitions[region][filterKey]) {
        transitions = state.altData.transitions[region][filterKey];
    } else {
        // Fallback: base-vs-base identity transitions derived from counts
        const data = state.baseData.regions[region];
        const counts = (filterKey === 'high_gene' ? data.high_gene_count.cell_type_counts : data.cell_type_counts) || {};
        // Simplify class names and build identity flows
        const simpCounts = {};
        Object.entries(counts).forEach(([label, count]) => {
            const s = simplifyClassLabel(label);
            simpCounts[s] = (simpCounts[s] || 0) + count;
        });
        transitions = Object.entries(simpCounts).map(([s, count]) => ({ from: s, to: s, count }));
    }

    // Fixed simplified class order for stable nodes and colors
    const SIMPLIFIED_CLASSES = ['Astro','CA1','CA2','CA3','DG','L5','L6','Oligo','Other','Zero'];

    // Node labels
    const nodeLabels = [
        ...SIMPLIFIED_CLASSES.map(c => `${c} (Base)`),
        ...SIMPLIFIED_CLASSES.map(c => `${c} (Alt)`)
    ];

    // Index maps
    const classToBeforeIdx = {};
    const classToAfterIdx = {};
    SIMPLIFIED_CLASSES.forEach((c, i) => {
        classToBeforeIdx[c] = i;
        classToAfterIdx[c] = i + SIMPLIFIED_CLASSES.length;
    });

    // Build links from transitions, include only mapped classes
    const sources = [];
    const targets = [];
    const values = [];
    transitions.forEach(t => {
        if (classToBeforeIdx[t.from] != null && classToAfterIdx[t.to] != null) {
            sources.push(classToBeforeIdx[t.from]);
            targets.push(classToAfterIdx[t.to]);
            values.push(t.count);
        }
    });

    // Node colors: set distinct, easily differentiable colors for all classes (Base and Alt match)
    const nodeColors = new Array(SIMPLIFIED_CLASSES.length * 2).fill('#FFFFFF');
    const CLASS_PALETTE = {
        'Astro': '#17becf',
        'CA1':   '#1f77b4',
        'CA2':   '#ff7f0e',
        'CA3':   '#9467bd',
        'DG':    '#2ca02c',
        'L5':    '#e377c2',
        'L6':    '#bcbd22',
        'Oligo': '#8c564b',
        'Other': '#7f7f7f',
        'Zero':  '#000000'
    };
    SIMPLIFIED_CLASSES.forEach((cls, i) => {
        const color = CLASS_PALETTE[cls] || '#FFFFFF';
        nodeColors[i] = color; // Base
        nodeColors[i + SIMPLIFIED_CLASSES.length] = color; // Alt
    });

    const data = [{
        type: 'sankey',
        valueformat: ',.0f',
        valuesuffix: ' cells',
        node: {
            label: nodeLabels,
            color: nodeColors,
            pad: 15,
            thickness: 20,
            line: { color: 'black', width: 0.5 },
            hovertemplate: '%{label}<br>%{value:,.0f} cells<extra></extra>'
        },
        link: {
            source: sources,
            target: targets,
            value: values,
            color: new Array(values.length).fill('rgba(0,0,0,0.25)'),
            hovertemplate: '%{source.label} → %{target.label}<br>%{value:,.0f} cells<extra></extra>'
        }
    }];

    const layout = {
        height: 520,
        font: { size: 11 },
        margin: { l: 10, r: 10, t: 10, b: 10 }
    };

    Plotly.newPlot('sankeyChart', data, layout, {responsive: true});
}

// Simplify full class labels to Sankey categories
function simplifyClassLabel(label) {
    if (!label || typeof label !== 'string') return 'Other';
    if (label.startsWith('016 CA1')) return 'CA1';
    if (label.startsWith('025 CA2')) return 'CA2';
    if (label.startsWith('017 CA3')) return 'CA3';
    if (label.startsWith('037 DG Glut') || label.startsWith('038 DG-PIR')) return 'DG';
    if (label.startsWith('319 Astro')) return 'Astro';
    if (label.startsWith('327 Oligo')) return 'Oligo';
    if (label.startsWith('005 L5 IT') || label.startsWith('022 L5 ET') || label.startsWith('032 L5 NP')) return 'L5';
    if (label.startsWith('030 L6 CT') || label.startsWith('004 L6 IT') || label.startsWith('029 L6b CTX')) return 'L6';
    if (label.startsWith('Zero')) return 'Zero';
    return 'Other';
}

// Show/hide loading indicator
function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    if (show) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Show/hide no data message
function showNoDataMessage(show) {
    const message = document.getElementById('noDataMessage');
    const mainContent = document.getElementById('mainContent');

    if (show) {
        message.classList.remove('hidden');
        mainContent.classList.add('hidden');
    } else {
        message.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
