/**
 * Sequence Stratigraphy Exam - Main Application
 * Entry point that initializes and coordinates all modules
 */

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================

    const CONFIG = {
        examDuration: (2 * 60 + 10) * 60 * 1000, // 2 hours 10 minutes in ms
        autoSaveInterval: 30000, // 30 seconds
        maxWordLimits: {
            q1: 400,
            q2: 400,
            q3: 500,
            q4: 300
        },
        crossSectionImagePath: 'images/wheeler_exercise7-1.png',
        // Google Sheets logging endpoint
        loggingEndpoint: 'https://script.google.com/macros/s/AKfycbyK--ev-159clzxLoAWwWLnREHWBKkzjL2pXM1HZqDknu6ctd-VpTVDVicYn96aPiKy/exec'
    };

    // ==================== APPLICATION STATE ====================

    const AppState = {
        studentId: null,
        studentName: null,
        examStarted: false,
        examSubmitted: false,
        timer: null,
        autoSave: null,
        crossSectionCanvas: null,
        wheelerCanvas: null,
        crossSectionBg: null,
        wheelerBg: null,
        activeCanvas: 'crossSection', // 'crossSection' or 'wheeler'
        currentTool: 'line',
        currentColor: '#FF0000'
    };

    // ==================== DOM ELEMENTS ====================

    const DOM = {};

    function cacheDOMElements() {
        // Login
        DOM.loginModal = document.getElementById('loginModal');
        DOM.loginForm = document.getElementById('loginForm');
        DOM.studentIdInput = document.getElementById('studentId');
        DOM.studentNameInput = document.getElementById('studentName');
        DOM.startBtn = document.getElementById('startBtn');

        // Header
        DOM.headerStudentInfo = document.getElementById('headerStudentInfo');
        DOM.timer = document.getElementById('timer');
        DOM.saveStatus = document.getElementById('saveStatus');

        // Toolbar
        DOM.toolbar = document.getElementById('toolbar');
        DOM.colorSelect = document.getElementById('colorSelect');
        DOM.lineWidth = document.getElementById('lineWidth');
        DOM.lineWidthValue = document.getElementById('lineWidthValue');
        DOM.surfaceSelect = document.getElementById('surfaceSelect');
        DOM.tractSelect = document.getElementById('tractSelect');
        DOM.undoBtn = document.getElementById('undoBtn');
        DOM.redoBtn = document.getElementById('redoBtn');
        DOM.clearCrossSectionBtn = document.getElementById('clearCrossSectionBtn');
        DOM.clearWheelerBtn = document.getElementById('clearWheelerBtn');
        DOM.resetAllBtn = document.getElementById('resetAllBtn');

        // Canvases
        DOM.crossSectionBg = document.getElementById('crossSectionBg');
        DOM.crossSectionCanvas = document.getElementById('crossSectionCanvas');
        DOM.crossSectionWrapper = document.getElementById('crossSectionWrapper');
        DOM.wheelerBgCanvas = document.getElementById('wheelerBgCanvas');
        DOM.wheelerCanvas = document.getElementById('wheelerCanvas');
        DOM.wheelerWrapper = document.getElementById('wheelerWrapper');

        // Questions
        DOM.q1 = document.getElementById('q1');
        DOM.q2 = document.getElementById('q2');
        DOM.q3 = document.getElementById('q3');
        DOM.q4 = document.getElementById('q4');
        DOM.q1Count = document.getElementById('q1Count');
        DOM.q2Count = document.getElementById('q2Count');
        DOM.q3Count = document.getElementById('q3Count');
        DOM.q4Count = document.getElementById('q4Count');

        // Footer
        DOM.exportBtn = document.getElementById('exportBtn');
        DOM.submitBtn = document.getElementById('submitBtn');

        // Modals
        DOM.submitModal = document.getElementById('submitModal');
        DOM.clearModal = document.getElementById('clearModal');
        DOM.warningModal = document.getElementById('warningModal');
        DOM.expiredModal = document.getElementById('expiredModal');
        DOM.warningMessage = document.getElementById('warningMessage');
        DOM.autoTractModal = document.getElementById('autoTractModal');

        // Modal buttons
        DOM.cancelSubmit = document.getElementById('cancelSubmit');
        DOM.confirmSubmit = document.getElementById('confirmSubmit');
        DOM.cancelClear = document.getElementById('cancelClear');
        DOM.confirmClear = document.getElementById('confirmClear');
        DOM.dismissWarning = document.getElementById('dismissWarning');
        DOM.acknowledgeExpired = document.getElementById('acknowledgeExpired');

        // Auto Tract elements
        DOM.autoTractBtn = document.getElementById('autoTractBtn');
        DOM.cancelAutoTract = document.getElementById('cancelAutoTract');
        DOM.generateAutoTract = document.getElementById('generateAutoTract');
        DOM.tractFromNum = document.getElementById('tractFromNum');
        DOM.tractToNum = document.getElementById('tractToNum');
        DOM.autoTractType = document.getElementById('autoTractType');

        // Toast container
        DOM.toastContainer = document.getElementById('toastContainer');

        // Shortcuts help
        DOM.shortcutsHelp = document.getElementById('shortcutsHelp');
    }

    // ==================== LOGGING ====================

    /**
     * Log an event to Google Sheets using image beacon (most reliable cross-origin method)
     * @param {string} action - The action being logged (exam_start, exam_submit, etc.)
     * @param {Object} extraData - Additional data to log
     */
    function logToSheet(action, extraData = {}) {
        if (!CONFIG.loggingEndpoint) return;

        try {
            const params = new URLSearchParams({
                studentId: AppState.studentId || 'Unknown',
                studentName: AppState.studentName || 'Unknown',
                action: action,
                timestamp: new Date().toISOString()
            });

            // Image beacon - most reliable for cross-origin requests
            const img = new Image();
            img.src = CONFIG.loggingEndpoint + '?' + params.toString();
            console.log('Log beacon sent:', action);
        } catch (err) {
            console.warn('Logging failed:', err);
        }
    }

    // ==================== INITIALIZATION ====================

    function init() {
        cacheDOMElements();
        setupEventListeners();
        checkForSavedExam();
    }

    function checkForSavedExam() {
        if (ExamStorage.exists()) {
            const savedState = ExamStorage.load();
            if (savedState && savedState.studentId && !savedState.submitted) {
                // Offer to restore
                const restore = confirm(
                    `Found saved exam for ${savedState.studentName || savedState.studentId}.\n` +
                    `Last saved: ${new Date(savedState.timestamp).toLocaleString()}\n\n` +
                    `Do you want to continue this exam?`
                );

                if (restore) {
                    restoreExam(savedState);
                    return;
                } else {
                    ExamStorage.clear();
                }
            }
        }
    }

    function restoreExam(savedState) {
        AppState.studentId = savedState.studentId;
        AppState.studentName = savedState.studentName;

        // Hide login, show exam
        DOM.loginModal.classList.add('hidden');
        DOM.headerStudentInfo.textContent = `${savedState.studentName} (${savedState.studentId})`;

        // Initialize canvases
        initializeCanvases().then(() => {
            // Restore canvas states
            if (savedState.crossSectionState) {
                AppState.crossSectionCanvas.loadState(savedState.crossSectionState);
            }
            if (savedState.wheelerState) {
                AppState.wheelerCanvas.loadState(savedState.wheelerState);
            }

            // Restore answers
            if (savedState.answers) {
                DOM.q1.value = savedState.answers.question1 || '';
                DOM.q2.value = savedState.answers.question2 || '';
                DOM.q3.value = savedState.answers.question3 || '';
                if (DOM.q4) DOM.q4.value = savedState.answers.question4 || '';
                updateAllWordCounts();
            }

            // Start timer with remaining time
            const remainingTime = savedState.timeRemaining || CONFIG.examDuration;
            startExam(remainingTime);

            showToast('Exam restored successfully', 'success');
        });
    }

    async function initializeCanvases() {
        // Initialize cross-section background
        AppState.crossSectionBg = new CrossSectionBackground(
            'crossSectionBg',
            CONFIG.crossSectionImagePath
        );
        await AppState.crossSectionBg.init();

        // Initialize wheeler diagram background
        AppState.wheelerBg = new WheelerDiagramBackground('wheelerBgCanvas');
        // Wheeler diagram should match cross-section width and have LARGER height
        // to accommodate 50 time units clearly with good visual separation
        AppState.wheelerBg.init(
            AppState.crossSectionBg.canvas.width,
            Math.round(AppState.crossSectionBg.canvas.height * 1.5)
        );

        // Shared termination counter
        AppState.terminationCounter = { count: 0 };

        // Initialize drawing canvases
        AppState.crossSectionCanvas = new DrawingCanvas('crossSectionCanvas', {
            backgroundCanvasId: 'crossSectionBg',
            terminationCounter: AppState.terminationCounter,
            onTerminationPlaced: handleTerminationPlaced,
            onMarkerPlaced: handleMarkerPlaced,
            onDrillingLinePlaced: handleDrillingLinePlaced,
            onStateChange: () => triggerAutoSave(),
            onElementAdd: (element) => console.log('Element added:', element.type)
        });

        AppState.wheelerCanvas = new DrawingCanvas('wheelerCanvas', {
            backgroundCanvasId: 'wheelerBgCanvas',
            isWheelerDiagram: true,
            terminationCounter: AppState.terminationCounter,
            onStateChange: () => triggerAutoSave(),
            onElementAdd: (element) => console.log('Element added:', element.type)
        });

        // Set initial active canvas
        setActiveCanvas('crossSection');
    }

    function startExam(remainingTime = CONFIG.examDuration) {
        AppState.examStarted = true;

        // Initialize timer
        AppState.timer = new ExamTimer({
            duration: CONFIG.examDuration,
            onTick: handleTimerTick,
            onWarning: handleTimerWarning,
            onExpire: handleTimerExpire
        });

        // Set remaining time if restored
        if (remainingTime !== CONFIG.examDuration) {
            AppState.timer.setRemaining(remainingTime);
        }

        AppState.timer.start();

        // Initialize auto-save
        AppState.autoSave = new AutoSaveManager({
            interval: CONFIG.autoSaveInterval,
            getState: getExamState,
            onSave: handleAutoSave,
            onError: handleAutoSaveError
        });

        AppState.autoSave.start();
    }

    // ==================== EVENT LISTENERS ====================

    function setupEventListeners() {
        // Login form
        DOM.loginForm.addEventListener('submit', handleLogin);

        // Toolbar - tool buttons
        DOM.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                setTool(btn.dataset.tool);
            });
        });

        // Color select
        DOM.colorSelect.addEventListener('change', (e) => {
            setColor(e.target.value);
        });

        // Line width
        DOM.lineWidth.addEventListener('input', (e) => {
            const width = parseInt(e.target.value);
            DOM.lineWidthValue.textContent = `${width}px`;
            setLineWidth(width);
        });

        // Surface type dropdown
        DOM.surfaceSelect.addEventListener('change', (e) => {
            const surfaceType = e.target.value;
            if (surfaceType) {
                setSurfaceTool(surfaceType);
                // Reset tract dropdown
                DOM.tractSelect.value = '';
            }
        });

        // System tract dropdown
        DOM.tractSelect.addEventListener('change', (e) => {
            const tractType = e.target.value;
            if (tractType) {
                setSystemTractTool(tractType);
                // Reset surface dropdown
                DOM.surfaceSelect.value = '';
            }
        });

        // Undo/Redo
        DOM.undoBtn.addEventListener('click', handleUndo);
        DOM.redoBtn.addEventListener('click', handleRedo);

        // Clear buttons
        DOM.clearCrossSectionBtn.addEventListener('click', () => showClearModal('crossSection'));
        DOM.clearWheelerBtn.addEventListener('click', () => showClearModal('wheeler'));
        DOM.resetAllBtn.addEventListener('click', () => showClearModal('all'));

        // Canvas wrapper clicks (for selecting active canvas)
        DOM.crossSectionWrapper.addEventListener('click', () => setActiveCanvas('crossSection'));
        DOM.wheelerWrapper.addEventListener('click', () => setActiveCanvas('wheeler'));

        // Question text areas
        DOM.q1.addEventListener('input', () => updateWordCount('q1'));
        DOM.q2.addEventListener('input', () => updateWordCount('q2'));
        DOM.q3.addEventListener('input', () => updateWordCount('q3'));
        if (DOM.q4) DOM.q4.addEventListener('input', () => updateWordCount('q4'));

        // Footer buttons
        DOM.exportBtn.addEventListener('click', handleExport);
        DOM.submitBtn.addEventListener('click', () => showModal(DOM.submitModal));

        // Modal buttons
        DOM.cancelSubmit.addEventListener('click', () => hideModal(DOM.submitModal));
        DOM.confirmSubmit.addEventListener('click', handleSubmit);
        DOM.cancelClear.addEventListener('click', () => hideModal(DOM.clearModal));
        DOM.confirmClear.addEventListener('click', handleConfirmClear);
        DOM.dismissWarning.addEventListener('click', () => hideModal(DOM.warningModal));
        DOM.acknowledgeExpired.addEventListener('click', () => {
            hideModal(DOM.expiredModal);
            window.location.reload();
        });

        // Auto Tract modal
        DOM.autoTractBtn.addEventListener('click', () => showModal(DOM.autoTractModal));
        DOM.cancelAutoTract.addEventListener('click', () => hideModal(DOM.autoTractModal));
        DOM.generateAutoTract.addEventListener('click', handleGenerateAutoTract);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // Before unload warning
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // ==================== EVENT HANDLERS ====================

    function handleLogin(e) {
        e.preventDefault();

        const studentId = DOM.studentIdInput.value.trim();
        const studentName = DOM.studentNameInput.value.trim();

        if (!studentId || !studentName) {
            showToast('Please enter both Student ID and Name', 'error');
            return;
        }

        AppState.studentId = studentId;
        AppState.studentName = studentName;

        // Hide login modal
        DOM.loginModal.classList.add('hidden');

        // Update header
        DOM.headerStudentInfo.textContent = `${studentName} (${studentId})`;

        // Initialize canvases and start exam
        initializeCanvases().then(() => {
            startExam();
            // Log exam start to Google Sheets
            logToSheet('exam_start');
            showToast('Exam started. Good luck!', 'success');
        });
    }

    function handleTimerTick(remaining, timerClass) {
        DOM.timer.textContent = ExamTimer.formatTime(remaining);
        DOM.timer.className = `timer ${timerClass}`;
    }

    function handleTimerWarning(minutesRemaining) {
        DOM.warningMessage.textContent = `You have ${minutesRemaining} minutes remaining. Please review your answers.`;
        showModal(DOM.warningModal);

        // Also show toast
        showToast(`⚠️ ${minutesRemaining} minutes remaining!`, 'warning', 5000);
    }

    function handleTimerExpire() {
        // Auto-submit
        AppState.autoSave.forceSave();
        handleSubmit(true); // Force submit
        showModal(DOM.expiredModal);
    }

    function handleAutoSave(info) {
        DOM.saveStatus.textContent = `Saved: ${new Date(info.timestamp).toLocaleTimeString()}`;
        DOM.saveStatus.className = 'save-status saved';
    }

    function handleAutoSaveError(error) {
        DOM.saveStatus.textContent = 'Save failed!';
        DOM.saveStatus.className = 'save-status error';
        showToast('Auto-save failed. Please export your work manually.', 'error');
    }

    function triggerAutoSave() {
        if (AppState.autoSave) {
            // Debounce - don't save on every tiny change
            clearTimeout(AppState.saveDebounce);
            AppState.saveDebounce = setTimeout(() => {
                AppState.autoSave.forceSave();
            }, 2000);
        }
    }

    function handleUndo() {
        // Try to undo on the active canvas first, then the other one
        const activeCanvas = getActiveDrawingCanvas();
        const otherCanvas = AppState.activeCanvas === 'crossSection'
            ? AppState.wheelerCanvas
            : AppState.crossSectionCanvas;

        if (activeCanvas && activeCanvas.undo()) {
            showToast('Undo', 'info', 1000);
        } else if (otherCanvas && otherCanvas.undo()) {
            showToast('Undo', 'info', 1000);
        }
    }

    function handleRedo() {
        // Try to redo on the active canvas first, then the other one
        const activeCanvas = getActiveDrawingCanvas();
        const otherCanvas = AppState.activeCanvas === 'crossSection'
            ? AppState.wheelerCanvas
            : AppState.crossSectionCanvas;

        if (activeCanvas && activeCanvas.redo()) {
            showToast('Redo', 'info', 1000);
        } else if (otherCanvas && otherCanvas.redo()) {
            showToast('Redo', 'info', 1000);
        }
    }

    /**
     * Handle stratal termination placed on cross-section
     * Projects a horizontal line to the Wheeler diagram spanning from x1 to x2
     * (the same X positions as clicked on the cross-section)
     */
    function handleTerminationPlaced(termData) {
        if (!AppState.wheelerCanvas) return;

        // Get Wheeler canvas dimensions
        const wheelerCanvas = AppState.wheelerCanvas.canvas;

        // Wheeler diagram has padding: top: 40, right: 40, bottom: 60, left: 70
        const padding = { top: 40, right: 40, bottom: 60, left: 70 };

        // Calculate the plot area dimensions
        const plotWidth = wheelerCanvas.width - padding.left - padding.right;
        const plotHeight = wheelerCanvas.height - padding.top - padding.bottom;

        // Calculate X position ratios from cross-section (x1 = landward, x2 = basinward)
        const x1Ratio = termData.x1 / termData.canvasWidth;
        const x2Ratio = termData.x2 / termData.canvasWidth;

        // Map to Wheeler diagram X coordinates (within the plot area)
        // The line should span the SAME X range as the two clicked points on the cross-section
        const wheelerX1 = padding.left + (x1Ratio * plotWidth);
        const wheelerX2 = padding.left + (x2Ratio * plotWidth);

        // Calculate Y position in Wheeler - spread terminations across time axis
        // Map termination numbers to Y positions (older at bottom, younger at top)
        const yRatio = termData.number / 50; // Assuming max 50 terminations
        const wheelerY = wheelerCanvas.height - padding.bottom - (yRatio * plotHeight);

        // Add a horizontal line to the Wheeler diagram spanning from x1 to x2
        // Lines are ALWAYS BLACK regardless of the color used on the cross-section
        const lineElement = {
            type: 'terminationLine',
            color: '#000000',  // Always black
            x1: wheelerX1,
            x2: wheelerX2,
            y: wheelerY,
            label: termData.label,
            number: termData.number,
            lineWidth: 4,
            timestamp: Date.now()
        };

        AppState.wheelerCanvas.addElement(lineElement);
        showToast(`Termination ${termData.label} projected to Wheeler diagram`, 'success', 2000);
    }

    /**
     * Handle clinoform rollover marker placed on cross-section
     * Markers are only placed on the cross-section, no projection to Wheeler diagram
     */
    function handleMarkerPlaced(markerData) {
        // Rollover markers stay on cross-section only - no Wheeler projection
        // This callback is kept for potential future use but does nothing
    }

    /**
     * Handle drilling line placed on cross-section
     * Projects a subtle vertical line to the Wheeler diagram at the same X position
     */
    function handleDrillingLinePlaced(drillingData) {
        if (!AppState.wheelerCanvas) return;

        // Get Wheeler canvas dimensions
        const wheelerCanvas = AppState.wheelerCanvas.canvas;

        // Wheeler diagram has padding: top: 40, right: 40, bottom: 60, left: 70
        const padding = { top: 40, right: 40, bottom: 60, left: 70 };

        // Calculate the plot area dimensions
        const plotHeight = wheelerCanvas.height - padding.top - padding.bottom;

        // Calculate X position ratio from cross-section
        const xRatio = drillingData.x / drillingData.canvasWidth;

        // Map to Wheeler diagram X coordinate (within the plot area)
        const plotWidth = wheelerCanvas.width - padding.left - padding.right;
        const wheelerX = padding.left + (xRatio * plotWidth);

        // Add a vertical line spanning the full height of the Wheeler diagram
        const lineElement = {
            type: 'drillingProjection',
            color: 'rgba(255, 0, 0, 0.4)',  // Semi-transparent red
            x: wheelerX,
            y1: padding.top,
            y2: wheelerCanvas.height - padding.bottom,
            timestamp: Date.now()
        };

        AppState.wheelerCanvas.addElement(lineElement);
    }

    /**
     * Handle auto-generation of system tract from termination lines
     * Finds termination lines in the specified range and creates a polygon
     */
    function handleGenerateAutoTract() {
        if (!AppState.wheelerCanvas) {
            showToast('Wheeler canvas not initialized', 'error');
            return;
        }

        const fromNum = parseInt(DOM.tractFromNum.value);
        const toNum = parseInt(DOM.tractToNum.value);
        const tractType = DOM.autoTractType.value;

        if (isNaN(fromNum) || isNaN(toNum) || fromNum < 1 || toNum < 1) {
            showToast('Please enter valid termination numbers', 'error');
            return;
        }

        if (fromNum >= toNum) {
            showToast('From number must be less than To number', 'error');
            return;
        }

        // Find all termination lines in the Wheeler canvas within the range
        const terminationLines = AppState.wheelerCanvas.elements.filter(el =>
            el.type === 'terminationLine' &&
            el.number >= fromNum &&
            el.number <= toNum
        );

        if (terminationLines.length < 2) {
            showToast(`Need at least 2 termination lines in range ${fromNum}-${toNum}. Found ${terminationLines.length}.`, 'error');
            return;
        }

        // Sort by number (time order - lower numbers are older, at bottom)
        terminationLines.sort((a, b) => a.number - b.number);

        // Build polygon points:
        // Go up the left side (x1 values, from oldest to youngest)
        // Then down the right side (x2 values, from youngest to oldest)
        const polygonPoints = [];

        // Left side - going up (older to younger = bottom to top in Wheeler)
        for (const line of terminationLines) {
            polygonPoints.push({ x: line.x1, y: line.y });
        }

        // Right side - going down (younger to older = top to bottom)
        for (let i = terminationLines.length - 1; i >= 0; i--) {
            polygonPoints.push({ x: terminationLines[i].x2, y: terminationLines[i].y });
        }

        // Get tract color
        const tractColors = {
            'HST': '#FFFF00',
            'TST': '#00FFFF',
            'LST': '#FFA500',
            'FSST': '#FF69B4',
            'RST': '#90EE90'
        };

        // Create system tract polygon element
        const tractElement = {
            type: 'systemTract',
            tractType: tractType,
            color: tractColors[tractType] || '#FFFF00',
            points: polygonPoints,
            timestamp: Date.now()
        };

        AppState.wheelerCanvas.addElement(tractElement);

        hideModal(DOM.autoTractModal);
        showToast(`${tractType} system tract generated from terminations ${fromNum}-${toNum}`, 'success');
    }

    let clearTarget = null;

    function showClearModal(target) {
        clearTarget = target;
        showModal(DOM.clearModal);
    }

    function handleConfirmClear() {
        if (clearTarget === 'crossSection' && AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.clear();
            // Reset termination counter since cross-section terminations are cleared
            resetTerminationCounter();
            showToast('Cross-section cleared', 'info');
        } else if (clearTarget === 'wheeler' && AppState.wheelerCanvas) {
            AppState.wheelerCanvas.clear();
            showToast('Wheeler diagram cleared', 'info');
        } else if (clearTarget === 'all') {
            if (AppState.crossSectionCanvas) AppState.crossSectionCanvas.clear();
            if (AppState.wheelerCanvas) AppState.wheelerCanvas.clear();
            // Reset termination counter
            resetTerminationCounter();
            showToast('All drawings cleared', 'warning');
        }
        clearTarget = null;
        hideModal(DOM.clearModal);
    }

    /**
     * Reset the termination counter to start fresh
     */
    function resetTerminationCounter() {
        if (AppState.terminationCounter) {
            AppState.terminationCounter.count = 0;
            AppState.terminationCounter.availableNumbers = [];
        }
    }

    function handleExport() {
        try {
            const examData = getExamDataForExport();

            // Get the actual canvas elements
            const canvases = {
                crossSectionBg: document.getElementById('crossSectionBg'),
                crossSectionDraw: document.getElementById('crossSectionCanvas'),
                wheelerBg: document.getElementById('wheelerBgCanvas'),
                wheelerDraw: document.getElementById('wheelerCanvas')
            };

            console.log('=== EXPORT DEBUG ===');
            console.log('Cross-section BG canvas:', canvases.crossSectionBg, 'size:', canvases.crossSectionBg?.width, 'x', canvases.crossSectionBg?.height);
            console.log('Cross-section Draw canvas:', canvases.crossSectionDraw, 'size:', canvases.crossSectionDraw?.width, 'x', canvases.crossSectionDraw?.height);
            console.log('Wheeler BG canvas:', canvases.wheelerBg, 'size:', canvases.wheelerBg?.width, 'x', canvases.wheelerBg?.height);
            console.log('Wheeler Draw canvas:', canvases.wheelerDraw, 'size:', canvases.wheelerDraw?.width, 'x', canvases.wheelerDraw?.height);

            const result = ExamExport.exportAll(examData, canvases);

            if (result) {
                showToast('Exam exported! Check your downloads folder.', 'success');
            } else {
                showToast('Export may have had issues. Check console for errors.', 'warning');
            }
        } catch (e) {
            console.error('Export error:', e);
            showToast('Error exporting exam: ' + e.message, 'error');
        }
    }

    function handleSubmit(forceSubmit = false) {
        try {
            if (AppState.examSubmitted && !forceSubmit) {
                showToast('Exam already submitted', 'info');
                return;
            }

            // Stop timer and auto-save
            if (AppState.timer) AppState.timer.stop();
            if (AppState.autoSave) AppState.autoSave.stop();

            // Mark as submitted
            AppState.examSubmitted = true;

            // Log submission to Google Sheets
            logToSheet('exam_submit', {
                timeSpent: AppState.timer ? AppState.timer.getTimeSpent() : 0
            });

            // Final save
            const state = getExamState();
            state.submitted = true;
            state.submissionTime = Date.now();
            ExamStorage.save(state);

            // Export
            handleExport();

            hideModal(DOM.submitModal);
            showToast('Exam submitted successfully!', 'success', 10000);

            // Disable further editing
            disableExam();
        } catch (e) {
            console.error('Submit error:', e);
            showToast('Error submitting exam: ' + e.message, 'error');
        }
    }

    function handleKeyboardShortcuts(e) {
        // Don't trigger shortcuts when typing in text areas
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            // Allow Escape to blur
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        // Tool shortcuts
        switch (e.key.toLowerCase()) {
            case 'l':
                setTool('line');
                break;
            case 'p':
                setTool('polygon');
                break;
            case 'm':
                setTool('marker');
                break;
            case 't':
                setTool('text');
                break;
            case 'e':
                setTool('eraser');
                break;
            case 's':
                setTool('termination');
                break;
            case 'n':
                setTool('strataNumber');
                break;
            case 'd':
                setTool('drilling');
                break;
            case '?':
                toggleShortcutsHelp();
                break;
            case 'escape':
                // Cancel current drawing operation
                const canvas = getActiveDrawingCanvas();
                if (canvas) canvas.cancelCurrentOperation();
                break;
        }

        // Undo/Redo with Ctrl
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 's') {
                e.preventDefault();
                if (AppState.autoSave) {
                    AppState.autoSave.forceSave();
                    showToast('Saved!', 'success', 1000);
                }
            }
        }
    }

    function handleBeforeUnload(e) {
        if (AppState.examStarted && !AppState.examSubmitted) {
            // Force save
            if (AppState.autoSave) {
                AppState.autoSave.forceSave();
            }

            e.preventDefault();
            e.returnValue = 'You have unsaved exam progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    }

    // ==================== TOOL FUNCTIONS ====================

    function setTool(tool) {
        AppState.currentTool = tool;

        // Update toolbar buttons
        DOM.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Clear surface and tract dropdowns when switching to regular tools
        if (DOM.surfaceSelect) DOM.surfaceSelect.value = '';
        if (DOM.tractSelect) DOM.tractSelect.value = '';

        // Update both canvases
        if (AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.setTool(tool);
        }
        if (AppState.wheelerCanvas) {
            AppState.wheelerCanvas.setTool(tool);
        }
    }

    function setColor(color) {
        AppState.currentColor = color;

        if (AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.setColor(color);
        }
        if (AppState.wheelerCanvas) {
            AppState.wheelerCanvas.setColor(color);
        }
    }

    function setLineWidth(width) {
        if (AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.setLineWidth(width);
        }
        if (AppState.wheelerCanvas) {
            AppState.wheelerCanvas.setLineWidth(width);
        }
    }

    function setActiveCanvas(canvasName) {
        AppState.activeCanvas = canvasName;

        // Update visual indicators
        DOM.crossSectionWrapper.classList.toggle('active', canvasName === 'crossSection');
        DOM.wheelerWrapper.classList.toggle('active', canvasName === 'wheeler');
    }

    /**
     * Set surface tool with auto-color
     */
    function setSurfaceTool(surfaceType) {
        AppState.currentTool = 'surface';

        // Clear other tool selections
        DOM.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Update both canvases
        if (AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.setTool('surface');
            AppState.crossSectionCanvas.setSurfaceType(surfaceType);
        }
        if (AppState.wheelerCanvas) {
            AppState.wheelerCanvas.setTool('surface');
            AppState.wheelerCanvas.setSurfaceType(surfaceType);
        }
    }

    /**
     * Set system tract tool with auto-color
     */
    function setSystemTractTool(tractType) {
        AppState.currentTool = 'systemTract';

        // Clear other tool selections
        DOM.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Update both canvases
        if (AppState.crossSectionCanvas) {
            AppState.crossSectionCanvas.setTool('systemTract');
            AppState.crossSectionCanvas.setSystemTractType(tractType);
        }
        if (AppState.wheelerCanvas) {
            AppState.wheelerCanvas.setTool('systemTract');
            AppState.wheelerCanvas.setSystemTractType(tractType);
        }
    }

    function getActiveDrawingCanvas() {
        return AppState.activeCanvas === 'crossSection'
            ? AppState.crossSectionCanvas
            : AppState.wheelerCanvas;
    }

    // ==================== WORD COUNT ====================

    function updateWordCount(fieldId) {
        const textarea = DOM[fieldId];
        const counter = DOM[`${fieldId}Count`];
        const maxWords = CONFIG.maxWordLimits[fieldId];

        const text = textarea.value.trim();
        const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;

        counter.textContent = `${words} / ${maxWords} words`;

        // Update styling based on count
        counter.classList.remove('warning', 'danger');
        if (words > maxWords) {
            counter.classList.add('danger');
        } else if (words > maxWords * 0.9) {
            counter.classList.add('warning');
        }
    }

    function updateAllWordCounts() {
        updateWordCount('q1');
        updateWordCount('q2');
        updateWordCount('q3');
    }

    // ==================== STATE MANAGEMENT ====================

    function getExamState() {
        return {
            studentId: AppState.studentId,
            studentName: AppState.studentName,
            timeRemaining: AppState.timer ? AppState.timer.getRemaining() : CONFIG.examDuration,
            crossSectionState: AppState.crossSectionCanvas ? AppState.crossSectionCanvas.getState() : null,
            wheelerState: AppState.wheelerCanvas ? AppState.wheelerCanvas.getState() : null,
            answers: {
                question1: DOM.q1 ? DOM.q1.value : '',
                question2: DOM.q2 ? DOM.q2.value : '',
                question3: DOM.q3 ? DOM.q3.value : '',
                question4: DOM.q4 ? DOM.q4.value : ''
            },
            submitted: AppState.examSubmitted
        };
    }

    function getExamDataForExport() {
        return {
            studentId: AppState.studentId,
            studentName: AppState.studentName,
            timeSpent: AppState.timer ? AppState.timer.getTimeSpent() : 0,
            crossSectionElements: AppState.crossSectionCanvas ? AppState.crossSectionCanvas.elements : [],
            wheelerElements: AppState.wheelerCanvas ? AppState.wheelerCanvas.elements : [],
            answers: {
                question1: DOM.q1 ? DOM.q1.value : '',
                question2: DOM.q2 ? DOM.q2.value : '',
                question3: DOM.q3 ? DOM.q3.value : '',
                question4: DOM.q4 ? DOM.q4.value : ''
            }
        };
    }

    function disableExam() {
        // Disable all inputs
        DOM.q1.disabled = true;
        DOM.q2.disabled = true;
        DOM.q3.disabled = true;
        if (DOM.q4) DOM.q4.disabled = true;

        // Disable toolbar
        DOM.toolbar.querySelectorAll('button, select, input').forEach(el => {
            el.disabled = true;
        });

        // Disable submit/export buttons
        DOM.submitBtn.disabled = true;

        // Add visual indicator
        document.body.classList.add('exam-submitted');
    }

    // ==================== MODAL FUNCTIONS ====================

    function showModal(modal) {
        modal.classList.add('visible');
    }

    function hideModal(modal) {
        modal.classList.remove('visible');
    }

    // ==================== TOAST NOTIFICATIONS ====================

    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        DOM.toastContainer.appendChild(toast);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==================== SHORTCUTS HELP ====================

    function toggleShortcutsHelp() {
        DOM.shortcutsHelp.classList.toggle('visible');
    }

    // ==================== START APPLICATION ====================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
