/**
 * Data Loader for Spatial Viewer
 * Loads cell data from JSON files
 */

(function() {
    'use strict';

    window.SpatialViewer = window.SpatialViewer || {};
    const state = window.SpatialViewer.state;

    // Load spatial data for a run
    async function loadRunData(runId) {
        const DEBUG = !!window.DEBUG;
        if (DEBUG) console.log('Loading spatial data for', runId, '...');

        try {
            const response = await fetch(`data/${runId}_cells.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${runId}_cells.json: ${response.statusText}`);
            }

            const data = await response.json();

            // Update state
            state.currentRun = runId;
            state.cells = data.cells || [];
            state.numCells = state.cells.length;
            state.geom.ready = true;
            state.geom.zValues = data.z_values || [];
            state.geom.defaultRadius = data.default_radius || 6.0;
            state.geom.is3D = state.geom.zValues.length > 1;
            state.viewFitted = false;

            // Reset plane filter when loading new run
            state.planeFilterEnabled = false;
            state.selectedPlane = null;

            // Extract unique class names
            const classNames = [...new Set(state.cells.map(c => c.class))].sort();

            // Generate color palette (MUST await because it loads Yao scheme)
            await window.SpatialViewer.colors.generateColorPalette(classNames);

            // Update cell class counts
            window.SpatialViewer.updateCellClassCounts();

            // Initialize legend
            window.SpatialViewer.updateLegend();

            // Render
            window.SpatialViewer.render();

            if (DEBUG) {
                console.log('Loaded', state.numCells, 'cells from', runId);
                console.log('  - Is 3D:', state.geom.is3D);
                console.log('  - Z-planes:', state.geom.zValues.length);
                console.log('  - Classes:', classNames.length);
            }

            return true;

        } catch (error) {
            console.error(`Failed to load spatial data for ${runId}:`, error);
            showNoDataMessage(runId);
            return false;
        }
    }

    // Show message when no data is available
    function showNoDataMessage(runId) {
        const container = document.getElementById('spatialDeckContainer');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #718096; text-align: center; padding: 20px;">
                <div>
                    <p style="margin-bottom: 10px;">No spatial geometry found for <strong>${runId}</strong>.</p>
                    <p style="font-size: 12px;">Generate it with <code>python3 generate_dashboard_data.py</code></p>
                    <p style="font-size: 11px; margin-top: 8px; color: #4a5568;">(creates <code>dashboard/data/${runId}_cells.json</code>)</p>
                </div>
            </div>
        `;
    }

    // Export functions
    window.SpatialViewer.loader = {
        loadRunData: loadRunData
    };

})();
