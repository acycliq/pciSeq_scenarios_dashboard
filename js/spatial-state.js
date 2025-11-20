/**
 * Spatial Viewer State Management
 * Simplified state for static deck.gl-based spatial viewer
 * Adapted from pciSeq realtime_viewer for dashboard use
 */

(function() {
    'use strict';

    // Initialize global namespace
    window.SpatialViewer = window.SpatialViewer || {};

    // Application state
    const state = {
        cells: [],  // Array of {x, y, z, r, class, id}
        numCells: 0,
        currentRun: null,
        cellClassColors: {},
        cellClassCounts: {},
        cellClassVisible: {},  // Maps class name to visibility (true/false)

        // deck.gl instance
        deckgl: null,

        // Geometry metadata
        geom: {
            ready: false,
            is3D: false,
            zValues: [],  // Available Z-planes
            defaultRadius: 6.0
        },

        // Has the view been auto-fitted once?
        viewFitted: false,

        // Plane filter (3D)
        planeFilterEnabled: false,
        selectedPlane: null,

        // Gene count filter (from dashboard toggle)
        useGeneFilter: false,
        minGeneCount: 40,

        // Legend filter
        legendFilter: ''
    };

    // Export state and helper functions
    window.SpatialViewer.state = state;

    // Update cell class counts
    window.SpatialViewer.updateCellClassCounts = function() {
        if (!state.cells || state.cells.length === 0) return;

        // Count cells per class
        state.cellClassCounts = {};
        state.cells.forEach(cell => {
            const className = cell.class;
            state.cellClassCounts[className] = (state.cellClassCounts[className] || 0) + 1;

            // Initialize visibility to true for new classes
            if (!(className in state.cellClassVisible)) {
                state.cellClassVisible[className] = true;
            }
        });
    };

    // Simple user-facing notice
    window.SpatialViewer.showUserNotice = function(message) {
        let el = document.getElementById('spatial-user-notice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'spatial-user-notice';
            el.style.position = 'fixed';
            el.style.bottom = '20px';
            el.style.left = '20px';
            el.style.maxWidth = '420px';
            el.style.padding = '10px 12px';
            el.style.background = '#2a2a2a';
            el.style.color = '#e0e0e0';
            el.style.border = '1px solid #00ff00';
            el.style.borderRadius = '4px';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            el.style.fontSize = '12px';
            el.style.zIndex = 2000;
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.style.display = 'block';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 7000);
    };

})();
