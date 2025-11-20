/**
 * Rendering Module for Spatial Viewer
 * deck.gl-based rendering for static cell visualization
 * Adapted from pciSeq realtime_viewer
 */

(function() {
    'use strict';

    window.SpatialViewer = window.SpatialViewer || {};
    const state = window.SpatialViewer.state;

    // Initialize deck.gl
    function initializeDeck() {
        const {DeckGL, ScatterplotLayer, OrthographicView} = deck;

        state.deckgl = new DeckGL({
            container: 'spatialDeckContainer',
            views: [new OrthographicView({id: 'ortho', controller: true})],
            initialViewState: {
                target: [3200, 2200, 0],  // Center of typical image
                zoom: -1  // Start zoomed out
            },
            controller: true,
            layers: [],
            getTooltip: ({object}) => {
                if (!object) return null;
                const id = (typeof object.id === 'number') ? object.id : 'N/A';
                const gc = (typeof object.gene_counts === 'number') ? object.gene_counts : 'N/A';
                const pos = `(${Math.round(object.x)}, ${Math.round(object.y)}${(object.z !== undefined && object.z !== null) ? ', ' + object.z : ''})`;
                return {
                    html: `<div style="font-size: 12px;">
                        ID: ${id}<br/>
                        Class: ${object.class}<br/>
                        Total Gene Counts: ${gc}<br/>
                        Position: ${pos}
                    </div>`,
                    style: {
                        backgroundColor: '#1b1b1b',
                        color: '#e5e5e5',
                        padding: '8px',
                        borderRadius: '4px'
                    }
                };
            }
        });

        render();
    }

    // Main render function
    function render() {
        if (!state.deckgl || state.cells.length === 0) {
            console.warn(`render() skipped: deckgl=${!!state.deckgl}, cells.length=${state.cells.length}`);
            return;
        }

        // Filter cells based on visibility
        let visibleCells = state.cells.filter(cell => state.cellClassVisible[cell.class]);

        // Further filter by plane if enabled
        if (state.planeFilterEnabled && state.geom.is3D && state.selectedPlane !== null) {
            visibleCells = visibleCells.filter(cell => {
                const cellZ = (typeof cell.z === 'number') ? cell.z : 0;
                return cellZ === state.selectedPlane;
            });
        }

        // Apply gene count filter if enabled
        if (state.useGeneFilter) {
            const thr = Number(state.minGeneCount) || 0;
            visibleCells = visibleCells.filter(cell => (typeof cell.gene_counts === 'number') && cell.gene_counts >= thr);
        }

        if (window.DEBUG) console.log(`Rendering ${visibleCells.length}/${state.cells.length} cells`);

        const {ScatterplotLayer} = deck;

        // Create scatterplot layer with visible cells only
        const layer = new ScatterplotLayer({
            id: 'cells-layer',
            data: visibleCells,
            pickable: true,
            opacity: 1.0,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 2,
            radiusMaxPixels: 100,
            lineWidthMinPixels: 1,
            getPosition: d => [d.x, d.y],
            getRadius: d => d.r || state.geom.defaultRadius,
            getFillColor: d => {
                const color = window.SpatialViewer.colors.getColorForClass(d.class);
                // Fixed alpha for static view
                return [color[0], color[1], color[2], 230];
            },
            getLineColor: [255, 255, 255, 60],
            updateTriggers: {
                getFillColor: [state.currentRun],
                data: [Object.values(state.cellClassVisible)]
            }
        });

        if (window.DEBUG) console.log(`Created layer with ${visibleCells.length} visible data points`);

        // Update deck.gl with new layer
        state.deckgl.setProps({
            layers: [layer]
        });

        // Auto-fit view on the very first render if it hasn't been fitted yet
        if (!state.viewFitted) {
            if (window.DEBUG) console.log('Auto-fitting view on first render');
            autoFitView();
            state.viewFitted = true;
        }
    }

    // Auto-fit view to show all cells
    function autoFitView() {
        if (!state.cells || state.cells.length === 0) return;

        if (window.DEBUG) console.log('=== AUTO FIT VIEW ===');

        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        state.cells.forEach(cell => {
            minX = Math.min(minX, cell.x);
            minY = Math.min(minY, cell.y);
            maxX = Math.max(maxX, cell.x);
            maxY = Math.max(maxY, cell.y);
        });

        console.log(`Bounds: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);

        // Add 10% padding
        const width = maxX - minX;
        const height = maxY - minY;
        const paddedMinX = minX - width * 0.1;
        const paddedMinY = minY - height * 0.1;
        const paddedMaxX = maxX + width * 0.1;
        const paddedMaxY = maxY + height * 0.1;

        // Calculate center
        const centerX = (paddedMinX + paddedMaxX) / 2;
        const centerY = (paddedMinY + paddedMaxY) / 2;

        // Calculate zoom to fit
        const container = document.getElementById('spatialDeckContainer');
        const containerWidth = container ? container.clientWidth : 0;
        const containerHeight = container ? container.clientHeight : 0;

        const dataWidth = paddedMaxX - paddedMinX;
        const dataHeight = paddedMaxY - paddedMinY;

        let zoom;
        let transitionDuration = 0;
        if (containerWidth > 0 && containerHeight > 0 && dataWidth > 0 && dataHeight > 0) {
            const zoomX = Math.log2(containerWidth / dataWidth);
            const zoomY = Math.log2(containerHeight / dataHeight);
            zoom = Math.min(zoomX, zoomY);
            transitionDuration = 1000;
        } else {
            // Fallback when container is hidden or zero-sized (e.g., inactive tab)
            zoom = -1;
        }

        if (window.DEBUG) console.log(`Calculated view: center=[${centerX}, ${centerY}], zoom=${zoom}`);

        // Update view to fit all cells
        state.deckgl.setProps({
            initialViewState: {
                target: [centerX, centerY, 0],
                zoom: zoom,
                transitionDuration
            }
        });
    }

    // Compute cells used for legend counts (apply plane and gene-count filters)
    function getLegendFilteredCells() {
        let cells = state.cells;
        // Plane filter
        if (state.planeFilterEnabled && state.geom.is3D && state.selectedPlane !== null) {
            cells = cells.filter(cell => {
                const cellZ = (typeof cell.z === 'number') ? cell.z : 0;
                return cellZ === state.selectedPlane;
            });
        }
        // Gene-count filter
        if (state.useGeneFilter) {
            const thr = Number(state.minGeneCount) || 0;
            cells = cells.filter(cell => (typeof cell.gene_counts === 'number') && cell.gene_counts >= thr);
        }
        return cells;
    }

    // Update legend with current cell class counts
    window.SpatialViewer.updateLegend = function() {
        const legendItems = document.getElementById('spatialLegendItems');
        if (!legendItems) return;

        legendItems.innerHTML = '';

        // Recompute counts based on current plane/gene filters
        const counts = {};
        getLegendFilteredCells().forEach(cell => {
            counts[cell.class] = (counts[cell.class] || 0) + 1;
        });

        // Filter and sort classes
        let entries = Object.entries(counts);
        const filterText = (state.legendFilter || '').trim().toLowerCase();
        if (filterText) {
            entries = entries.filter(([className]) => {
                return String(className).toLowerCase().includes(filterText);
            });
        }
        const sortedClasses = entries.sort((a, b) => b[1] - a[1]);

        sortedClasses.forEach(([className, count]) => {
            const item = document.createElement('div');
            item.className = 'spatial-legend-chip';
            const isVisible = state.cellClassVisible[className];
            if (!isVisible) item.classList.add('dim');

            // Color swatch
            const colorBox = document.createElement('div');
            colorBox.className = 'spatial-legend-color';
            const color = window.SpatialViewer.colors.getColorForClass(className);
            colorBox.style.background = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

            // Label
            const label = document.createElement('span');
            label.className = 'spatial-legend-label';
            label.textContent = className;

            // Count
            const countSpan = document.createElement('span');
            countSpan.className = 'spatial-legend-count';
            countSpan.textContent = count.toLocaleString();
            item.title = `${className}: ${count.toLocaleString()} cells`;

            // Eye icon
            const eyeWrap = document.createElement('span');
            eyeWrap.className = 'spatial-chip-eye';
            const eyeOpenSvg = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7z" fill="none" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>`;
            const eyeOffSvg = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7z" fill="none" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                  <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>
                </svg>`;
            eyeWrap.innerHTML = isVisible ? eyeOpenSvg : eyeOffSvg;

            // Assemble
            item.appendChild(colorBox);
            item.appendChild(label);
            item.appendChild(countSpan);
            item.appendChild(eyeWrap);

            // Click toggles visibility
            item.addEventListener('click', () => toggleClassVisibility(className));

            legendItems.appendChild(item);
        });
    };

    // Toggle class visibility
    function toggleClassVisibility(className) {
        state.cellClassVisible[className] = !state.cellClassVisible[className];
        window.SpatialViewer.updateLegend();
        render();
    }

    // Show all classes
    function showAllClasses() {
        Object.keys(state.cellClassVisible).forEach(className => {
            state.cellClassVisible[className] = true;
        });
        window.SpatialViewer.updateLegend();
        render();
    }

    // Hide all classes
    function hideAllClasses() {
        Object.keys(state.cellClassVisible).forEach(className => {
            state.cellClassVisible[className] = false;
        });
        window.SpatialViewer.updateLegend();
        render();
    }

    // Export functions
    window.SpatialViewer.render = render;
    window.SpatialViewer.rendering = {
        initializeDeck: initializeDeck,
        autoFitView: autoFitView,
        showAllClasses: showAllClasses,
        hideAllClasses: hideAllClasses
    };

})();
