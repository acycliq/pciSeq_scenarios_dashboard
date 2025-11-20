/**
 * Color Management for Spatial Viewer
 * Uses the Yao color scheme from cell_colour_scheme_yao.json
 * Adapted from pciSeq realtime_viewer
 */

(function() {
    'use strict';

    window.SpatialViewer = window.SpatialViewer || {};
    const state = window.SpatialViewer.state;

    // Yao color scheme (loaded from JSON)
    let yaoColorScheme = null;

    // Load Yao color scheme from JSON file
    async function loadYaoColorScheme() {
        try {
            const response = await fetch('data/cell_colour_scheme_yao.json');
            if (!response.ok) {
                console.warn('Could not load Yao color scheme, will use fallback');
                return null;
            }
            yaoColorScheme = await response.json();
            const DEBUG = !!window.DEBUG;
            if (DEBUG) console.log('Loaded Yao color scheme with', Object.keys(yaoColorScheme).length, 'colors');
            return yaoColorScheme;
        } catch (error) {
            console.warn('Error loading Yao color scheme:', error);
            return null;
        }
    }

    // Hex to RGB conversion
    function hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse hex values
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;

        return [r, g, b];
    }

    // HSL to RGB conversion using d3 (fallback for classes not in Yao scheme)
    function hslToRgb(h, s, l) {
        const rgb = d3.hsl(h, s / 100, l / 100).rgb();
        return [
            Math.round(rgb.r),
            Math.round(rgb.g),
            Math.round(rgb.b)
        ];
    }

    // Generate color palette using Yao scheme with fallback
    async function generateColorPalette(classNames) {
        // Load Yao scheme if not already loaded
        if (!yaoColorScheme) {
            await loadYaoColorScheme();
        }

        // Assign colors to each class
        classNames.forEach((className, i) => {
            if (yaoColorScheme && yaoColorScheme[className]) {
                // Use Yao color scheme
                const hexColor = yaoColorScheme[className];
                state.cellClassColors[className] = hexToRgb(hexColor);
            } else {
                // Fallback: generate color using HSL
                const hueStep = 360 / Math.max(classNames.length, 10);
                const hue = (i * hueStep) % 360;
                const saturation = 70 + (i % 3) * 10;
                const lightness = 50 + (i % 2) * 10;
                state.cellClassColors[className] = hslToRgb(hue, saturation, lightness);

                if (yaoColorScheme) {
                    console.log(`No Yao color for "${className}", using fallback`);
                }
            }
        });
    }

    // Get color for a class (with fallback)
    function getColorForClass(className) {
        return state.cellClassColors[className] || [128, 128, 128];
    }

    // Export functions
    window.SpatialViewer.colors = {
        generateColorPalette: generateColorPalette,
        getColorForClass: getColorForClass,
        loadYaoColorScheme: loadYaoColorScheme
    };

})();
