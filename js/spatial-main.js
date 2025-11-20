/**
 * Main initialization for Spatial Viewer
 * Coordinates all modules and initializes the deck.gl viewer
 */

(function() {
    'use strict';

    // Initialize spatial viewer when DOM is ready
    function initializeSpatialViewer() {
        console.log('=== Initializing deck.gl Spatial Viewer ===');

        // Initialize deck.gl
        window.SpatialViewer.rendering.initializeDeck();

        // Initialize UI controls
        window.SpatialViewer.uiControls.initializeControls();

        // Setup run selector
        setupRunSelector();

        console.log('✓ Spatial viewer initialized');
    }

    // Setup run selector dropdown
    function setupRunSelector() {
        const runSelect = document.getElementById('spatialRunSelect');
        if (!runSelect) return;

        runSelect.addEventListener('change', async (e) => {
            const runId = e.target.value;
            if (!runId) return;

            console.log(`User selected run: ${runId}`);
            await window.SpatialViewer.loader.loadRunData(runId);
        });
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSpatialViewer);
    } else {
        initializeSpatialViewer();
    }

})();