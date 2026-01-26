/**
 * Sequence Stratigraphy Exam - Canvas Drawing Module
 * Handles all drawing functionality for cross-section and Wheeler diagram
 */

class DrawingCanvas {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }

        this.ctx = this.canvas.getContext('2d');
        this.canvasId = canvasId;

        // Options
        this.backgroundCanvasId = options.backgroundCanvasId || null;
        this.isWheelerDiagram = options.isWheelerDiagram || false;

        // Drawing state
        this.isDrawing = false;
        this.currentTool = 'line';
        this.currentColor = '#FF0000';
        this.lineWidth = 3;
        this.points = [];
        this.elements = [];
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;

        // Active element being drawn
        this.activeElement = null;

        // Selection state for eraser
        this.selectedElement = null;
        this.hoverElement = null;

        // Text input state
        this.textInput = null;

        // Current mouse position (for previews)
        this.currentMousePos = { x: 0, y: 0 };

        // Stratal termination counter (shared across canvases via callback)
        // Now tracks available numbers for reuse after undo
        this.terminationCounter = options.terminationCounter || { count: 0, availableNumbers: [] };
        this.onTerminationPlaced = options.onTerminationPlaced || (() => {});

        // Marker (rollover) callback for projecting to Wheeler diagram
        this.onMarkerPlaced = options.onMarkerPlaced || (() => {});

        // Surface tool settings (auto-color by type)
        this.surfaceType = null;
        this.surfaceColors = {
            'SB': '#FF0000',    // Sequence Boundary - Red
            'MFS': '#0000FF',   // Maximum Flooding Surface - Blue
            'TS': '#00AA00',    // Transgressive Surface - Green
            'RSME': '#FF6600',  // Regressive Surface of Marine Erosion - Orange
            'CC': '#990099'     // Correlative Conformity - Purple
        };

        // System tract tool settings (auto-color by type)
        this.systemTractType = null;
        this.systemTractColors = {
            'HST': '#FFFF00',   // Highstand Systems Tract - Yellow
            'TST': '#00FFFF',   // Transgressive Systems Tract - Cyan
            'LST': '#FFA500',   // Lowstand Systems Tract - Orange
            'FSST': '#FF69B4',  // Falling Stage Systems Tract - Pink
            'RST': '#90EE90'    // Regressive Systems Tract - Light Green
        };

        // Callbacks
        this.onStateChange = options.onStateChange || (() => {});
        this.onElementAdd = options.onElementAdd || (() => {});

        // Bind event handlers
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Initialize
        this.init();
    }

    /**
     * Initialize canvas and event listeners
     */
    init() {
        // Set up canvas size
        this.resizeCanvas();

        // Event listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('dblclick', this.handleDoubleClick);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);

        // Touch support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Keyboard events (handled globally in main.js, but we store reference)
        this.keyHandler = this.handleKeyDown;

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Initial draw
        this.redraw();
    }

    /**
     * Resize canvas to match container or background
     */
    resizeCanvas() {
        const wrapper = this.canvas.parentElement;

        if (this.backgroundCanvasId) {
            const bgCanvas = document.getElementById(this.backgroundCanvasId);
            if (bgCanvas) {
                this.canvas.width = bgCanvas.width;
                this.canvas.height = bgCanvas.height;
            }
        } else if (this.isWheelerDiagram) {
            // Wheeler diagram: match cross-section width but appropriate height
            const crossSectionCanvas = document.getElementById('crossSectionBg');
            if (crossSectionCanvas) {
                this.canvas.width = crossSectionCanvas.width;
                this.canvas.height = Math.round(crossSectionCanvas.height * 0.6); // 60% height ratio
            } else {
                this.canvas.width = 1400;
                this.canvas.height = 500;
            }
        } else {
            // Default size
            this.canvas.width = wrapper.clientWidth || 1400;
            this.canvas.height = 500;
        }
    }

    /**
     * Get mouse position relative to canvas
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(e) {
        if (e.button !== 0) return; // Only left click

        const pos = this.getMousePos(e);

        switch (this.currentTool) {
            case 'line':
                this.addLinePoint(pos);
                break;
            case 'polygon':
                this.addPolygonPoint(pos);
                break;
            case 'marker':
                this.placeMarker(pos);
                break;
            case 'text':
                this.startText(pos);
                break;
            case 'eraser':
                this.handleEraser(pos);
                break;
            case 'termination':
                this.placeTermination(pos);
                break;
            case 'surface':
                this.addSurfacePoint(pos);
                break;
            case 'systemTract':
                this.addSystemTractPoint(pos);
                break;
        }
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.currentMousePos = pos;

        // Update cursor for eraser hover
        if (this.currentTool === 'eraser') {
            const element = this.findElementAt(pos);
            if (element !== this.hoverElement) {
                this.hoverElement = element;
                this.redraw();
                this.canvas.style.cursor = element ? 'pointer' : 'crosshair';
            }
        }

        // Handle active drawing
        if (this.isDrawing) {
            switch (this.currentTool) {
                case 'line':
                    this.updateLine(pos);
                    break;
                case 'polygon':
                    this.updatePolygon(pos);
                    break;
                case 'surface':
                    this.updateLine(pos);
                    break;
                case 'systemTract':
                    this.updatePolygon(pos);
                    break;
            }
        }
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(e) {
        // Line tool doesn't end on mouse up - it ends on double click
        // Polygon tool doesn't end on mouse up - it ends when closing the shape
    }

    /**
     * Handle double click
     */
    handleDoubleClick(e) {
        const pos = this.getMousePos(e);

        if (this.currentTool === 'line' && this.isDrawing) {
            this.finishLine();
        } else if (this.currentTool === 'polygon' && this.isDrawing) {
            this.finishPolygon();
        } else if (this.currentTool === 'surface' && this.isDrawing) {
            this.finishSurface();
        } else if (this.currentTool === 'systemTract' && this.isDrawing) {
            this.finishSystemTract();
        }
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.cancelCurrentOperation();
        }
    }

    /**
     * Cancel current drawing operation
     */
    cancelCurrentOperation() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.points = [];
            this.activeElement = null;
            this.redraw();
        }
        if (this.textInput) {
            this.textInput.remove();
            this.textInput = null;
        }
        // Cancel any in-progress termination
        this.cancelTermination();
    }

    // ==================== LINE TOOL ====================

    /**
     * Start drawing a line
     */
    startLine(pos) {
        this.isDrawing = true;
        this.points = [pos];
        this.activeElement = {
            type: 'line',
            color: this.currentColor,
            width: this.lineWidth,
            points: [pos]
        };
    }

    /**
     * Update line with new point
     */
    updateLine(pos) {
        // Update preview
        this.redraw();
        this.drawLinePreview(pos);
    }

    /**
     * Draw line preview
     */
    drawLinePreview(pos) {
        if (this.points.length === 0) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw existing points
        this.ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        // Draw to current position
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        // Draw points as small circles
        this.points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.fillStyle = this.currentColor;
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    /**
     * Add point to current line (on click)
     */
    addLinePoint(pos) {
        if (!this.isDrawing) {
            this.startLine(pos);
        } else {
            this.points.push(pos);
            this.activeElement.points = [...this.points];
            this.redraw();
        }
    }

    /**
     * Finish the line
     */
    finishLine() {
        if (this.points.length < 2) {
            this.cancelCurrentOperation();
            return;
        }

        const element = {
            type: 'line',
            color: this.currentColor,
            width: this.lineWidth,
            points: [...this.points],
            timestamp: Date.now()
        };

        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== POLYGON TOOL ====================

    /**
     * Add point to polygon
     */
    addPolygonPoint(pos) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = {
                type: 'polygon',
                color: this.currentColor,
                points: [pos]
            };
        } else {
            // Check if clicking near start point to close polygon
            const start = this.points[0];
            const dist = Math.hypot(pos.x - start.x, pos.y - start.y);

            if (this.points.length >= 3 && dist < 15) {
                this.finishPolygon();
            } else {
                this.points.push(pos);
                this.activeElement.points = [...this.points];
                this.redraw();
            }
        }
    }

    /**
     * Update polygon preview
     */
    updatePolygon(pos) {
        this.redraw();
        this.drawPolygonPreview(pos);
    }

    /**
     * Draw polygon preview
     */
    drawPolygonPreview(pos) {
        if (this.points.length === 0) return;

        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.closePath();

        // Fill with transparency
        this.ctx.fillStyle = this.hexToRgba(this.currentColor, 0.3);
        this.ctx.fill();

        // Stroke outline
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw points
        this.points.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.fillStyle = index === 0 ? '#00FF00' : this.currentColor;
            this.ctx.arc(point.x, point.y, index === 0 ? 6 : 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    /**
     * Finish the polygon
     */
    finishPolygon() {
        if (this.points.length < 3) {
            this.cancelCurrentOperation();
            return;
        }

        const element = {
            type: 'polygon',
            color: this.currentColor,
            points: [...this.points],
            timestamp: Date.now()
        };

        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== MARKER TOOL ====================

    /**
     * Place a marker (triangle) - clinoform rollover
     * Also triggers callback to project to Wheeler diagram
     */
    placeMarker(pos) {
        const element = {
            type: 'marker',
            color: this.currentColor,
            x: pos.x,
            y: pos.y,
            size: 12,
            timestamp: Date.now()
        };

        this.addElement(element);

        // Trigger callback to project rollover to Wheeler diagram
        this.onMarkerPlaced({
            x: pos.x,
            y: pos.y,
            color: this.currentColor,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        });
    }

    // ==================== STRATAL TERMINATION TOOL ====================

    /**
     * Initialize termination state for two-click workflow
     */
    initTerminationState() {
        if (!this.terminationState) {
            this.terminationState = {
                waitingForSecondClick: false,
                firstPoint: null,
                currentNumber: null,
                color: null
            };
        }
    }

    /**
     * Get next available termination number (reuses undone numbers)
     */
    getNextTerminationNumber() {
        // Initialize availableNumbers array if not present
        if (!this.terminationCounter.availableNumbers) {
            this.terminationCounter.availableNumbers = [];
        }

        // If there are available (recycled) numbers, use the smallest one
        if (this.terminationCounter.availableNumbers.length > 0) {
            this.terminationCounter.availableNumbers.sort((a, b) => a - b);
            return this.terminationCounter.availableNumbers.shift();
        }

        // Otherwise increment counter
        this.terminationCounter.count++;
        return this.terminationCounter.count;
    }

    /**
     * Return a termination number to the available pool (for undo)
     */
    recycleTerminationNumber(num) {
        if (!this.terminationCounter.availableNumbers) {
            this.terminationCounter.availableNumbers = [];
        }
        if (!this.terminationCounter.availableNumbers.includes(num)) {
            this.terminationCounter.availableNumbers.push(num);
        }
    }

    /**
     * Place a stratal termination point
     * Requires TWO clicks: first for landward termination, second for basinward termination.
     * The distance between the two clicks is then projected to the Wheeler diagram.
     */
    placeTermination(pos) {
        this.initTerminationState();

        if (!this.terminationState.waitingForSecondClick) {
            // FIRST CLICK - Landward termination point
            const num = this.getNextTerminationNumber();

            // Store state for second click
            this.terminationState = {
                waitingForSecondClick: true,
                firstPoint: { x: pos.x, y: pos.y },
                currentNumber: num,
                color: this.currentColor
            };

            // Create first termination marker on cross-section
            const element = {
                type: 'termination',
                color: this.currentColor,
                x: pos.x,
                y: pos.y,
                label: `${num}`,
                number: num,
                isFirstPoint: true,
                timestamp: Date.now()
            };

            this.addElement(element);

            // Show user feedback that we're waiting for second click
            this.showTerminationHint(`Click basinward point to complete termination ${num}-${num}`);

        } else {
            // SECOND CLICK - Basinward termination point
            const num = this.terminationState.currentNumber;
            const firstPoint = this.terminationState.firstPoint;
            const color = this.terminationState.color;

            // Create second termination marker on cross-section
            const element = {
                type: 'termination',
                color: color,
                x: pos.x,
                y: pos.y,
                label: `${num}`,
                number: num,
                isFirstPoint: false,
                timestamp: Date.now()
            };

            this.addElement(element);

            // Determine which point is landward (smaller x) and basinward (larger x)
            const x1 = Math.min(firstPoint.x, pos.x);
            const x2 = Math.max(firstPoint.x, pos.x);
            const y1 = firstPoint.x < pos.x ? firstPoint.y : pos.y;
            const y2 = firstPoint.x < pos.x ? pos.y : firstPoint.y;

            // Trigger callback to project to Wheeler diagram with BOTH positions
            this.onTerminationPlaced({
                x1: x1,  // Landward X position
                x2: x2,  // Basinward X position
                y1: y1,  // Y at landward point
                y2: y2,  // Y at basinward point
                label: `${num}-${num}`,
                number: num,
                color: color,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height
            });

            // Reset state
            this.terminationState = {
                waitingForSecondClick: false,
                firstPoint: null,
                currentNumber: null,
                color: null
            };

            this.hideTerminationHint();
        }
    }

    /**
     * Show hint message for termination tool
     */
    showTerminationHint(message) {
        // Remove existing hint if any
        this.hideTerminationHint();

        // Create hint element
        const hint = document.createElement('div');
        hint.id = 'terminationHint';
        hint.className = 'termination-hint';
        hint.textContent = message;
        hint.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 165, 0, 0.9);
            color: #000;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        this.canvas.parentElement.appendChild(hint);
    }

    /**
     * Hide termination hint message
     */
    hideTerminationHint() {
        const existingHint = document.getElementById('terminationHint');
        if (existingHint) {
            existingHint.remove();
        }
    }

    /**
     * Cancel termination if in progress (for tool switching or escape)
     */
    cancelTermination() {
        if (this.terminationState && this.terminationState.waitingForSecondClick) {
            // Remove the first point that was placed
            const num = this.terminationState.currentNumber;
            const lastElement = this.elements[this.elements.length - 1];
            if (lastElement && lastElement.type === 'termination' && lastElement.number === num) {
                this.elements.pop();
                // Recycle the number for reuse
                this.recycleTerminationNumber(num);
            }

            this.terminationState = {
                waitingForSecondClick: false,
                firstPoint: null,
                currentNumber: null,
                color: null
            };

            this.hideTerminationHint();
            this.redraw();
        }
    }

    // ==================== SURFACE TOOL ====================

    /**
     * Set the surface type (determines color automatically)
     */
    setSurfaceType(type) {
        this.surfaceType = type;
        if (type && this.surfaceColors[type]) {
            this.currentColor = this.surfaceColors[type];
        }
    }

    /**
     * Add point to surface line
     */
    addSurfacePoint(pos) {
        if (!this.surfaceType) {
            console.warn('Surface type not set');
            return;
        }

        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = {
                type: 'surface',
                surfaceType: this.surfaceType,
                color: this.surfaceColors[this.surfaceType],
                width: 3,
                points: [pos]
            };
        } else {
            this.points.push(pos);
            this.activeElement.points = [...this.points];
            this.redraw();
        }
    }

    /**
     * Finish the surface line
     */
    finishSurface() {
        if (this.points.length < 2) {
            this.cancelCurrentOperation();
            return;
        }

        const element = {
            type: 'surface',
            surfaceType: this.surfaceType,
            color: this.surfaceColors[this.surfaceType],
            width: 3,
            points: [...this.points],
            timestamp: Date.now()
        };

        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== SYSTEM TRACT TOOL ====================

    /**
     * Set the system tract type (determines color automatically)
     */
    setSystemTractType(type) {
        this.systemTractType = type;
        if (type && this.systemTractColors[type]) {
            this.currentColor = this.systemTractColors[type];
        }
    }

    /**
     * Add point to system tract polygon
     */
    addSystemTractPoint(pos) {
        if (!this.systemTractType) {
            console.warn('System tract type not set');
            return;
        }

        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = {
                type: 'systemTract',
                tractType: this.systemTractType,
                color: this.systemTractColors[this.systemTractType],
                points: [pos]
            };
        } else {
            // Check if clicking near start point to close polygon
            const start = this.points[0];
            const dist = Math.hypot(pos.x - start.x, pos.y - start.y);

            if (this.points.length >= 3 && dist < 15) {
                this.finishSystemTract();
            } else {
                this.points.push(pos);
                this.activeElement.points = [...this.points];
                this.redraw();
            }
        }
    }

    /**
     * Finish the system tract polygon
     */
    finishSystemTract() {
        if (this.points.length < 3) {
            this.cancelCurrentOperation();
            return;
        }

        const element = {
            type: 'systemTract',
            tractType: this.systemTractType,
            color: this.systemTractColors[this.systemTractType],
            points: [...this.points],
            timestamp: Date.now()
        };

        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== TEXT TOOL ====================

    /**
     * Start text input
     */
    startText(pos) {
        // Remove existing text input if any
        if (this.textInput) {
            this.textInput.remove();
        }

        // Create text input element
        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.className = 'canvas-text-input';
        this.textInput.style.cssText = `
            position: absolute;
            left: ${pos.x}px;
            top: ${pos.y}px;
            font-size: 14px;
            font-family: Arial, sans-serif;
            border: 1px solid ${this.currentColor};
            padding: 2px 5px;
            background: white;
            color: ${this.currentColor};
            outline: none;
            z-index: 1000;
            min-width: 100px;
        `;

        // Position relative to canvas wrapper
        const wrapper = this.canvas.parentElement;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;

        this.textInput.style.left = `${pos.x * scaleX}px`;
        this.textInput.style.top = `${pos.y * scaleY}px`;

        wrapper.appendChild(this.textInput);
        this.textInput.focus();

        // Store position for later
        this.textPosition = pos;

        // Handle enter key
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.finishText();
            } else if (e.key === 'Escape') {
                this.cancelCurrentOperation();
            }
        });

        // Handle blur
        this.textInput.addEventListener('blur', () => {
            setTimeout(() => this.finishText(), 100);
        });
    }

    /**
     * Finish text input
     */
    finishText() {
        if (!this.textInput) return;

        const text = this.textInput.value.trim();
        if (text) {
            const element = {
                type: 'text',
                color: this.currentColor,
                x: this.textPosition.x,
                y: this.textPosition.y,
                text: text,
                fontSize: 14,
                timestamp: Date.now()
            };

            this.addElement(element);
        }

        this.textInput.remove();
        this.textInput = null;
        this.textPosition = null;
    }

    // ==================== ERASER TOOL ====================

    /**
     * Handle eraser click
     */
    handleEraser(pos) {
        const element = this.findElementAt(pos);
        if (element) {
            const index = this.elements.indexOf(element);
            if (index > -1) {
                // Store for undo
                this.redoStack = []; // Clear redo stack
                this.undoStack.push({
                    action: 'remove',
                    element: element,
                    index: index
                });

                // Remove element
                this.elements.splice(index, 1);
                this.hoverElement = null;
                this.redraw();
                this.onStateChange();
            }
        }
    }

    /**
     * Find element at position
     */
    findElementAt(pos) {
        // Search in reverse order (top elements first)
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const element = this.elements[i];

            if (this.isPointInElement(pos, element)) {
                return element;
            }
        }
        return null;
    }

    /**
     * Check if point is in element
     */
    isPointInElement(pos, element) {
        const threshold = 10;

        switch (element.type) {
            case 'line':
                return this.isPointNearLine(pos, element.points, threshold);
            case 'polygon':
                return this.isPointInPolygon(pos, element.points);
            case 'marker':
                return Math.hypot(pos.x - element.x, pos.y - element.y) < element.size + 5;
            case 'text':
                // Approximate text bounds
                const textWidth = element.text.length * 8;
                const textHeight = element.fontSize;
                return pos.x >= element.x && pos.x <= element.x + textWidth &&
                       pos.y >= element.y - textHeight && pos.y <= element.y;
            case 'termination':
                return Math.hypot(pos.x - element.x, pos.y - element.y) < 15;
            case 'terminationLine':
                return Math.abs(pos.y - element.y) < 10 &&
                       pos.x >= element.x1 && pos.x <= element.x2;
            case 'surface':
                return this.isPointNearLine(pos, element.points, threshold);
            case 'systemTract':
                return this.isPointInPolygon(pos, element.points);
            default:
                return false;
        }
    }

    /**
     * Check if point is near a polyline
     */
    isPointNearLine(pos, points, threshold) {
        for (let i = 0; i < points.length - 1; i++) {
            const dist = this.pointToLineDistance(pos, points[i], points[i + 1]);
            if (dist < threshold) return true;
        }
        return false;
    }

    /**
     * Calculate distance from point to line segment
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = lenSq !== 0 ? dot / lenSq : -1;

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        return Math.hypot(point.x - xx, point.y - yy);
    }

    /**
     * Check if point is inside polygon
     */
    isPointInPolygon(pos, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            if (((yi > pos.y) !== (yj > pos.y)) &&
                (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // ==================== ELEMENT MANAGEMENT ====================

    /**
     * Add element to canvas
     */
    addElement(element) {
        this.elements.push(element);
        this.redoStack = []; // Clear redo stack on new action

        // Maintain history limit
        if (this.undoStack.length >= this.maxHistory) {
            this.undoStack.shift();
        }

        this.undoStack.push({
            action: 'add',
            element: element
        });

        this.redraw();
        this.onStateChange();
        this.onElementAdd(element);
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.undoStack.length === 0) return false;

        const action = this.undoStack.pop();

        if (action.action === 'add') {
            // Remove the element
            const index = this.elements.indexOf(action.element);
            if (index > -1) {
                this.elements.splice(index, 1);
            }
            // If it's a termination, recycle its number for reuse
            if (action.element.type === 'termination') {
                this.recycleTerminationNumber(action.element.number);
            }
            this.redoStack.push(action);
        } else if (action.action === 'remove') {
            // Re-add the element at original position
            this.elements.splice(action.index, 0, action.element);
            this.redoStack.push(action);
        }

        this.redraw();
        this.onStateChange();
        return true;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return false;

        const action = this.redoStack.pop();

        if (action.action === 'add') {
            // Re-add the element
            this.elements.push(action.element);
            this.undoStack.push(action);
        } else if (action.action === 'remove') {
            // Remove the element again
            const index = this.elements.indexOf(action.element);
            if (index > -1) {
                this.elements.splice(index, 1);
            }
            this.undoStack.push(action);
        }

        this.redraw();
        this.onStateChange();
        return true;
    }

    /**
     * Clear all elements
     */
    clear() {
        // Store current state for potential undo
        const oldElements = [...this.elements];
        this.elements = [];
        this.undoStack = [];
        this.redoStack = [];
        this.points = [];
        this.isDrawing = false;
        this.activeElement = null;

        this.redraw();
        this.onStateChange();
    }

    // ==================== DRAWING ====================

    /**
     * Redraw all elements
     */
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all saved elements
        this.elements.forEach(element => {
            this.drawElement(element);
        });

        // Draw hover highlight for eraser
        if (this.hoverElement && this.currentTool === 'eraser') {
            this.drawElementHighlight(this.hoverElement);
        }

        // Draw active element preview
        if (this.activeElement && this.isDrawing) {
            if (this.currentTool === 'polygon' || this.currentTool === 'systemTract') {
                this.drawPolygonPreview(this.currentMousePos);
            } else if (this.currentTool === 'line' || this.currentTool === 'surface') {
                this.drawLinePreview(this.currentMousePos);
            }
        }
    }

    /**
     * Draw a single element
     */
    drawElement(element) {
        switch (element.type) {
            case 'line':
                this.drawLine(element);
                break;
            case 'polygon':
                this.drawPolygon(element);
                break;
            case 'marker':
                this.drawMarker(element);
                break;
            case 'text':
                this.drawText(element);
                break;
            case 'termination':
                this.drawTermination(element);
                break;
            case 'terminationLine':
                this.drawTerminationLine(element);
                break;
            case 'surface':
                this.drawSurface(element);
                break;
            case 'systemTract':
                this.drawSystemTract(element);
                break;
            case 'rolloverSquare':
                this.drawRolloverSquare(element);
                break;
        }
    }

    /**
     * Draw line element
     */
    drawLine(element) {
        if (element.points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
            this.ctx.lineTo(element.points[i].x, element.points[i].y);
        }

        this.ctx.stroke();
    }

    /**
     * Draw polygon element
     */
    drawPolygon(element) {
        if (element.points.length < 3) return;

        this.ctx.beginPath();
        this.ctx.moveTo(element.points[0].x, element.points[0].y);

        for (let i = 1; i < element.points.length; i++) {
            this.ctx.lineTo(element.points[i].x, element.points[i].y);
        }

        this.ctx.closePath();

        // Fill with some transparency
        this.ctx.fillStyle = this.hexToRgba(element.color, 0.5);
        this.ctx.fill();

        // Stroke outline
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    /**
     * Draw marker (triangle)
     */
    drawMarker(element) {
        const size = element.size || 12;

        this.ctx.beginPath();
        this.ctx.moveTo(element.x, element.y);
        this.ctx.lineTo(element.x - size / 2, element.y - size);
        this.ctx.lineTo(element.x + size / 2, element.y - size);
        this.ctx.closePath();

        this.ctx.fillStyle = element.color;
        this.ctx.fill();

        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    /**
     * Draw text element
     */
    drawText(element) {
        this.ctx.font = `bold ${element.fontSize || 14}px Arial`;
        this.ctx.fillStyle = element.color;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(element.text, element.x, element.y);
    }

    /**
     * Draw stratal termination label (on cross-section)
     * Shows a small circle with the number inside - clean and simple
     */
    drawTermination(element) {
        const ctx = this.ctx;
        const radius = 8;  // Smaller radius

        // Draw filled circle with border
        ctx.beginPath();
        ctx.arc(element.x, element.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = element.color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw the number inside the circle (white text for visibility)
        ctx.font = 'bold 9px Arial';  // Smaller font
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(element.label, element.x, element.y);

        // Reset text alignment
        ctx.textAlign = 'left';
    }

    /**
     * Draw stratal termination line (on Wheeler diagram)
     * This is a thick horizontal line spanning the diagram width
     */
    drawTerminationLine(element) {
        const ctx = this.ctx;

        // Draw thick horizontal line
        ctx.beginPath();
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.lineWidth || 4;
        ctx.moveTo(element.x1, element.y);
        ctx.lineTo(element.x2, element.y);
        ctx.stroke();

        // Draw label aligned at the left endpoint (below the line)
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = element.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(element.label, element.x1, element.y + 3);
        ctx.textAlign = 'left';
    }

    /**
     * Draw rollover square (on Wheeler diagram)
     * Orange square marking clinoform rollover position
     */
    drawRolloverSquare(element) {
        const ctx = this.ctx;
        const size = 8;  // Same size as termination circles

        // Draw filled square
        ctx.fillStyle = element.color || '#FFA500';  // Orange
        ctx.fillRect(element.x - size/2, element.y - size/2, size, size);

        // Draw border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(element.x - size/2, element.y - size/2, size, size);
    }

    /**
     * Draw surface element (colored line with label)
     */
    drawSurface(element) {
        if (element.points.length < 2) return;

        const ctx = this.ctx;

        // Draw the line
        ctx.beginPath();
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
            ctx.lineTo(element.points[i].x, element.points[i].y);
        }
        ctx.stroke();

        // Draw label at the midpoint
        const midIndex = Math.floor(element.points.length / 2);
        const midPoint = element.points[midIndex];

        ctx.font = 'bold 11px Arial';
        const labelText = element.surfaceType;
        const textWidth = ctx.measureText(labelText).width;

        // Background for label
        ctx.fillStyle = 'white';
        ctx.fillRect(midPoint.x - textWidth/2 - 3, midPoint.y - 18, textWidth + 6, 14);
        ctx.strokeStyle = element.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(midPoint.x - textWidth/2 - 3, midPoint.y - 18, textWidth + 6, 14);

        // Label text
        ctx.fillStyle = element.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midPoint.x, midPoint.y - 11);
        ctx.textAlign = 'left';
    }

    /**
     * Draw system tract element (filled polygon with label)
     */
    drawSystemTract(element) {
        if (element.points.length < 3) return;

        const ctx = this.ctx;

        // Draw filled polygon
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);

        for (let i = 1; i < element.points.length; i++) {
            ctx.lineTo(element.points[i].x, element.points[i].y);
        }
        ctx.closePath();

        // Fill with transparency
        ctx.fillStyle = this.hexToRgba(element.color, 0.4);
        ctx.fill();

        // Stroke outline
        ctx.strokeStyle = element.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Calculate centroid for label
        let cx = 0, cy = 0;
        element.points.forEach(p => {
            cx += p.x;
            cy += p.y;
        });
        cx /= element.points.length;
        cy /= element.points.length;

        // Draw label at centroid
        ctx.font = 'bold 12px Arial';
        const labelText = element.tractType;
        const textWidth = ctx.measureText(labelText).width;

        // Background for label
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(cx - textWidth/2 - 4, cy - 8, textWidth + 8, 16);
        ctx.strokeStyle = element.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - textWidth/2 - 4, cy - 8, textWidth + 8, 16);

        // Label text
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, cx, cy);
        ctx.textAlign = 'left';
    }

    /**
     * Draw highlight around element (for eraser hover)
     */
    drawElementHighlight(element) {
        this.ctx.save();
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        switch (element.type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) {
                    this.ctx.lineTo(element.points[i].x, element.points[i].y);
                }
                this.ctx.stroke();
                break;
            case 'polygon':
                this.ctx.beginPath();
                this.ctx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) {
                    this.ctx.lineTo(element.points[i].x, element.points[i].y);
                }
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'marker':
                this.ctx.beginPath();
                this.ctx.arc(element.x, element.y - 6, 15, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'text':
                const width = element.text.length * 8;
                this.ctx.strokeRect(element.x - 2, element.y - 2, width + 4, element.fontSize + 4);
                break;
        }

        this.ctx.restore();
    }

    // ==================== UTILITY ====================

    /**
     * Convert hex color to rgba
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Set current tool
     */
    setTool(tool) {
        this.cancelCurrentOperation();
        this.currentTool = tool;
        this.hoverElement = null;
        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * Set current color
     */
    setColor(color) {
        this.currentColor = color;
    }

    /**
     * Set line width
     */
    setLineWidth(width) {
        this.lineWidth = width;
    }

    /**
     * Get canvas as data URL
     */
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Get current state for saving
     */
    getState() {
        return {
            elements: JSON.parse(JSON.stringify(this.elements)),
            canvasId: this.canvasId
        };
    }

    /**
     * Load state from saved data
     */
    loadState(state) {
        if (state && state.elements) {
            this.elements = state.elements;
            this.undoStack = [];
            this.redoStack = [];
            this.redraw();
        }
    }

    /**
     * Check if canvas has any elements
     */
    hasElements() {
        return this.elements.length > 0;
    }

    /**
     * Get element count
     */
    getElementCount() {
        return this.elements.length;
    }

    // ==================== TOUCH SUPPORT ====================

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0
        });
        this.handleMouseDown(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseMove(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.handleMouseUp(new MouseEvent('mouseup'));
    }
}

/**
 * Cross-Section Background Canvas
 * Draws the clinoform cross-section image or generates one programmatically
 */
class CrossSectionBackground {
    constructor(canvasId, imageSrc = null) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.imageSrc = imageSrc;
        this.image = null;
        this.imageLoaded = false;

        // Diagram dimensions (based on spec: 0-150km, 0-700m)
        this.xMin = 0;
        this.xMax = 150; // km
        this.yMin = 0;
        this.yMax = 700; // m

        this.padding = { top: 40, right: 40, bottom: 60, left: 70 };
    }

    /**
     * Initialize and draw background
     */
    async init() {
        if (this.imageSrc) {
            await this.loadImage();
        } else {
            this.setCanvasSize(1400, 500);
            this.drawSyntheticCrossSection();
        }
    }

    /**
     * Load external image
     */
    loadImage() {
        return new Promise((resolve, reject) => {
            this.image = new Image();
            this.image.onload = () => {
                // Scale image to fit within max width while maintaining aspect ratio
                const maxWidth = 1400;
                let targetWidth = this.image.width;
                let targetHeight = this.image.height;

                if (targetWidth > maxWidth) {
                    const scale = maxWidth / targetWidth;
                    targetWidth = maxWidth;
                    targetHeight = Math.round(this.image.height * scale);
                }

                this.canvas.width = targetWidth;
                this.canvas.height = targetHeight;
                this.ctx.drawImage(this.image, 0, 0, targetWidth, targetHeight);
                this.imageLoaded = true;
                resolve();
            };
            this.image.onerror = () => {
                console.warn('Failed to load cross-section image, generating synthetic one');
                this.setCanvasSize(1400, 500);
                this.drawSyntheticCrossSection();
                resolve();
            };
            this.image.src = this.imageSrc;
        });
    }

    /**
     * Set canvas size
     */
    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Draw synthetic cross-section (fallback if no image)
     */
    drawSyntheticCrossSection() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        // Draw axes
        this.drawAxes();

        // Calculate plot area
        const plotWidth = w - p.left - p.right;
        const plotHeight = h - p.top - p.bottom;

        // Generate clinoform surfaces
        const numSurfaces = 25;

        for (let i = 0; i < numSurfaces; i++) {
            const progress = i / (numSurfaces - 1);

            ctx.beginPath();
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;

            // Generate clinoform shape - shelf to slope to basin floor
            const points = this.generateClinoformPoints(progress, plotWidth, plotHeight, p);

            ctx.moveTo(points[0].x, points[0].y);
            for (let j = 1; j < points.length; j++) {
                ctx.lineTo(points[j].x, points[j].y);
            }
            ctx.stroke();

            // Add arrows on some surfaces to show depositional direction
            if (i % 3 === 0 && i > 0) {
                this.drawDepositionalArrows(points, ctx);
            }
        }

        // Add rollover position markers (blue triangles)
        this.drawRolloverMarkers();
    }

    /**
     * Generate clinoform surface points
     */
    generateClinoformPoints(progress, plotWidth, plotHeight, p) {
        const points = [];
        const numPoints = 50;

        // Parameters that change with progress (younger surfaces prograde basinward)
        const shelfBreakX = 30 + progress * 90; // km position of shelf break (moves basinward)
        const basinFloorDepth = 50 + progress * 550; // Depth at basin floor
        const slopeAngle = 2 + Math.random() * 1; // degrees

        for (let j = 0; j <= numPoints; j++) {
            const xKm = (j / numPoints) * 150; // 0 to 150 km
            let depthM;

            if (xKm < shelfBreakX) {
                // Shelf - relatively flat, shallow
                const shelfProgress = xKm / shelfBreakX;
                depthM = 650 - progress * 550 + shelfProgress * 30;
            } else {
                // Slope and basin floor
                const slopeProgress = (xKm - shelfBreakX) / (150 - shelfBreakX);
                const slopeDepth = Math.min(basinFloorDepth, (xKm - shelfBreakX) * Math.tan(slopeAngle * Math.PI / 180) * 10);
                depthM = (650 - progress * 550 + 30) + slopeDepth * slopeProgress;

                // Flatten at basin floor
                if (depthM > basinFloorDepth) {
                    depthM = basinFloorDepth + (xKm - shelfBreakX - 50) * 0.5;
                }
            }

            // Clamp depth
            depthM = Math.max(0, Math.min(700, depthM));

            // Convert to canvas coordinates
            const x = p.left + (xKm / 150) * plotWidth;
            const y = p.top + (depthM / 700) * plotHeight;

            points.push({ x, y, xKm, depthM });
        }

        return points;
    }

    /**
     * Draw depositional direction arrows
     */
    drawDepositionalArrows(points, ctx) {
        const arrowSize = 8;

        // Find points on the slope portion
        for (let i = 10; i < points.length - 10; i += 8) {
            const p1 = points[i];
            const p2 = points[i + 5];

            // Calculate direction
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len < 5) continue;

            const angle = Math.atan2(dy, dx);

            // Draw arrow
            ctx.save();
            ctx.fillStyle = '#CC0000';
            ctx.translate(p1.x + dx / 2, p1.y + dy / 2);
            ctx.rotate(angle);

            ctx.beginPath();
            ctx.moveTo(arrowSize, 0);
            ctx.lineTo(-arrowSize / 2, -arrowSize / 2);
            ctx.lineTo(-arrowSize / 2, arrowSize / 2);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Draw rollover position markers
     */
    drawRolloverMarkers() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        // Add some rollover markers at approximate positions
        const rollovers = [
            { x: 0.25, y: 0.15 },
            { x: 0.35, y: 0.25 },
            { x: 0.45, y: 0.35 },
            { x: 0.55, y: 0.45 },
            { x: 0.65, y: 0.55 },
        ];

        ctx.fillStyle = '#0066CC';
        rollovers.forEach(r => {
            const x = p.left + r.x * (w - p.left - p.right);
            const y = p.top + r.y * (h - p.top - p.bottom);

            ctx.beginPath();
            ctx.moveTo(x, y + 8);
            ctx.lineTo(x - 6, y);
            ctx.lineTo(x + 6, y);
            ctx.closePath();
            ctx.fill();
        });
    }

    /**
     * Draw axes
     */
    drawAxes() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';

        // Y-axis (Depth)
        ctx.beginPath();
        ctx.moveTo(p.left, p.top);
        ctx.lineTo(p.left, h - p.bottom);
        ctx.stroke();

        // Y-axis labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let d = 0; d <= 700; d += 175) {
            const y = p.top + (d / 700) * (h - p.top - p.bottom);
            ctx.fillText(d.toString(), p.left - 10, y);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(p.left - 5, y);
            ctx.lineTo(p.left, y);
            ctx.stroke();
        }

        // Y-axis title
        ctx.save();
        ctx.translate(20, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Depth (m)', 0, 0);
        ctx.restore();

        // X-axis (Distance)
        ctx.beginPath();
        ctx.moveTo(p.left, h - p.bottom);
        ctx.lineTo(w - p.right, h - p.bottom);
        ctx.stroke();

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '12px Arial';
        for (let d = 0; d <= 150; d += 50) {
            const x = p.left + (d / 150) * (w - p.left - p.right);
            ctx.fillText(d.toString(), x, h - p.bottom + 10);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, h - p.bottom);
            ctx.lineTo(x, h - p.bottom + 5);
            ctx.stroke();
        }

        // X-axis title
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Distance (km)', w / 2, h - 15);

        // Title
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Clinoform Cross-Section', w / 2, 15);
    }
}

/**
 * Wheeler Diagram Background Canvas
 * Draws the time-distance grid for the Wheeler diagram
 */
class WheelerDiagramBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Diagram dimensions
        this.xMin = 0;
        this.xMax = 150; // km (matching cross-section)
        this.yMin = 0;
        this.yMax = 50; // Time units

        this.padding = { top: 40, right: 40, bottom: 60, left: 70 };
    }

    /**
     * Initialize and draw
     */
    init(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
    }

    /**
     * Draw the Wheeler diagram grid
     */
    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        // Draw grid
        this.drawGrid();

        // Draw axes
        this.drawAxes();
    }

    /**
     * Draw grid lines
     */
    drawGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        ctx.strokeStyle = '#000000';  // Black grid lines
        ctx.lineWidth = 0.3;
        ctx.setLineDash([2, 4]);

        // Vertical lines (every 10 km)
        for (let x = 0; x <= 150; x += 10) {
            const xPos = p.left + (x / 150) * (w - p.left - p.right);
            ctx.beginPath();
            ctx.moveTo(xPos, p.top);
            ctx.lineTo(xPos, h - p.bottom);
            ctx.stroke();
        }

        // Horizontal lines (every time unit - 50 lines total)
        for (let t = 0; t <= 50; t += 1) {
            const yPos = h - p.bottom - (t / 50) * (h - p.top - p.bottom);
            ctx.beginPath();
            ctx.moveTo(p.left, yPos);
            ctx.lineTo(w - p.right, yPos);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    /**
     * Draw axes
     */
    drawAxes() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.padding;

        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';

        // Y-axis (Time)
        ctx.beginPath();
        ctx.moveTo(p.left, p.top);
        ctx.lineTo(p.left, h - p.bottom);
        ctx.stroke();

        // Y-axis labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let t = 0; t <= 50; t += 10) {
            const y = h - p.bottom - (t / 50) * (h - p.top - p.bottom);
            ctx.fillText(t.toString(), p.left - 10, y);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(p.left - 5, y);
            ctx.lineTo(p.left, y);
            ctx.stroke();
        }

        // Y-axis title
        ctx.save();
        ctx.translate(20, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Relative Time', 0, 0);
        ctx.restore();

        // X-axis (Distance)
        ctx.beginPath();
        ctx.moveTo(p.left, h - p.bottom);
        ctx.lineTo(w - p.right, h - p.bottom);
        ctx.stroke();

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '12px Arial';
        for (let d = 0; d <= 150; d += 50) {
            const x = p.left + (d / 150) * (w - p.left - p.right);
            ctx.fillText(d.toString(), x, h - p.bottom + 10);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, h - p.bottom);
            ctx.lineTo(x, h - p.bottom + 5);
            ctx.stroke();
        }

        // X-axis title
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Distance (km)', w / 2, h - 15);

        // Title
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Wheeler Diagram (Chronostratigraphic Chart)', w / 2, 15);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DrawingCanvas, CrossSectionBackground, WheelerDiagramBackground };
}
