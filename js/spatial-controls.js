/**
 * UI Controls for Spatial Viewer
 * Handles user interface interactions, buttons, sliders
 * Adapted from pciSeq realtime_viewer
 */

(function() {
    'use strict';

    window.SpatialViewer = window.SpatialViewer || {};
    const state = window.SpatialViewer.state;

    // Initialize UI controls
    function initializeControls() {
        setupShowHideButtons();
        setupPlaneControls();
        setupLegendFilter();
        setupWindowResize();
    }

    // Setup Show/Hide All buttons
    function setupShowHideButtons() {
        const showAllBtn = document.getElementById('spatialShowAll');
        const hideAllBtn = document.getElementById('spatialHideAll');

        if (showAllBtn) {
            showAllBtn.addEventListener('click', window.SpatialViewer.rendering.showAllClasses);
        }

        if (hideAllBtn) {
            hideAllBtn.addEventListener('click', window.SpatialViewer.rendering.hideAllClasses);
        }
    }

    // Setup plane controls for 3D filtering
    function setupPlaneControls() {
        const planeToggleBtn = document.getElementById('spatialPlaneToggle');
        const planeSlider = document.getElementById('spatialPlaneSlider');
        const planeLabel = document.getElementById('spatialPlaneLabel');

        function setPlaneFilter(enabled) {
            state.planeFilterEnabled = !!enabled;
            if (planeToggleBtn) planeToggleBtn.classList.toggle('active', state.planeFilterEnabled);

            if (state.planeFilterEnabled) {
                const zValues = state.geom.zValues || [];
                if (zValues.length === 0) {
                    window.SpatialViewer.showUserNotice('No plane data available for this run.');
                    state.planeFilterEnabled = false;
                    if (planeToggleBtn) planeToggleBtn.classList.remove('active');
                    return;
                }

                const minP = Math.min(...zValues);
                const maxP = Math.max(...zValues);

                if (planeSlider) {
                    planeSlider.min = String(minP);
                    planeSlider.max = String(maxP);
                    planeSlider.disabled = false;
                    if (state.selectedPlane === null) {
                        // Default to middle plane when enabling
                        state.selectedPlane = Math.floor((minP + maxP) / 2);
                    }
                    planeSlider.value = String(state.selectedPlane);
                }
                if (planeLabel) planeLabel.textContent = `Plane: ${state.selectedPlane}`;
            } else {
                state.selectedPlane = null;
                if (planeSlider) planeSlider.disabled = true;
                if (planeLabel) planeLabel.textContent = 'Plane: all';
            }

            window.SpatialViewer.render();
        }

        if (planeToggleBtn) {
            planeToggleBtn.addEventListener('click', () => {
                if (!state.geom.is3D || !state.geom.zValues || state.geom.zValues.length === 0) {
                    window.SpatialViewer.showUserNotice('Plane filter is available only for 3D data.');
                    return;
                }
                setPlaneFilter(!state.planeFilterEnabled);
            });
        }

        if (planeSlider) {
            planeSlider.addEventListener('input', (e) => {
                state.selectedPlane = parseInt(e.target.value, 10);
                if (planeLabel) planeLabel.textContent = `Plane: ${state.selectedPlane}`;
                window.SpatialViewer.render();
            });
        }
    }

    // Setup legend filter
    function setupLegendFilter() {
        const legendFilterInput = document.getElementById('spatialLegendFilter');

        // Shortcut: '/' focuses the filter input
        window.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                if (legendFilterInput) {
                    legendFilterInput.focus();
                    legendFilterInput.select();
                }
            }
        });

        if (legendFilterInput) {
            legendFilterInput.addEventListener('input', () => {
                state.legendFilter = legendFilterInput.value;
                window.SpatialViewer.updateLegend();
            });
            legendFilterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    legendFilterInput.value = '';
                    state.legendFilter = '';
                    window.SpatialViewer.updateLegend();
                }
            });
        }
    }

    // Setup window resize handler
    function setupWindowResize() {
        window.addEventListener('resize', () => {
            if (state.deckgl) {
                state.deckgl.setProps({
                    width: '100%',
                    height: '100%'
                });
            }
        });
    }

    // Export initialization function
    window.SpatialViewer.uiControls = {
        initializeControls: initializeControls
    };

})();