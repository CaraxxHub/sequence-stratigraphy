/**
 * Sequence Stratigraphy Exam - Canvas Drawing Module
 * Handles all drawing functionality for cross-section and Wheeler diagram
 * Updated with: Strata numbering, Drilling tool, Auto Tract support
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
        this.terminationCounter = options.terminationCounter || { count: 0, availableNumbers: [] };
        this.onTerminationPlaced = options.onTerminationPlaced || (() => {});

        // Marker (rollover) callback for projecting to Wheeler diagram
        this.onMarkerPlaced = options.onMarkerPlaced || (() => {});

        // Drilling line callback for projecting to Wheeler diagram
        this.onDrillingLinePlaced = options.onDrillingLinePlaced || (() => {});

        // Surface tool settings (auto-color by type)
        this.surfaceType = null;
        this.surfaceColors = {
            'SB': '#000000',    // Sequence Boundary - Black
            'TS': '#0000FF',    // Transgressive Surface - Blue
            'MFS': '#FF0000',   // Maximum Flooding Surface - Red
            'BSFR': '#800080',  // Basal Surface of Forced Regression - Purple
            'CC': '#FF6600',    // Correlative Conformity - Orange
            'MRS': '#00CED1'    // Maximum Regressive Surface - Cyan
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

        // Strata numbering counter (shared across canvases)
        this.strataCounter = options.strataCounter || { count: 0 };

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

    init() {
        this.resizeCanvas();

        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('dblclick', this.handleDoubleClick);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);

        // Touch support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        this.keyHandler = this.handleKeyDown;
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.redraw();
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;

        if (this.backgroundCanvasId) {
            const bgCanvas = document.getElementById(this.backgroundCanvasId);
            if (bgCanvas) {
                this.canvas.width = bgCanvas.width;
                this.canvas.height = bgCanvas.height;
            }
        } else if (this.isWheelerDiagram) {
            const crossSectionCanvas = document.getElementById('crossSectionBg');
            if (crossSectionCanvas) {
                this.canvas.width = crossSectionCanvas.width;
                this.canvas.height = Math.round(crossSectionCanvas.height * 0.6);
            } else {
                this.canvas.width = 1400;
                this.canvas.height = 500;
            }
        } else {
            this.canvas.width = wrapper.clientWidth || 1400;
            this.canvas.height = 500;
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        const pos = this.getMousePos(e);

        switch (this.currentTool) {
            case 'line': this.addLinePoint(pos); break;
            case 'polygon': this.addPolygonPoint(pos); break;
            case 'marker': this.placeMarker(pos); break;
            case 'text': this.startText(pos); break;
            case 'eraser': this.handleEraser(pos); break;
            case 'termination': this.placeTermination(pos); break;
            case 'strataNumber': this.placeStrataNumber(pos); break;
            case 'drilling': this.placeDrillingSite(pos); break;
            case 'surface': this.addSurfacePoint(pos); break;
            case 'systemTract': this.addSystemTractPoint(pos); break;
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.currentMousePos = pos;

        if (this.currentTool === 'eraser') {
            const element = this.findElementAt(pos);
            if (element !== this.hoverElement) {
                this.hoverElement = element;
                this.redraw();
                this.canvas.style.cursor = element ? 'pointer' : 'crosshair';
            }
        }

        if (this.isDrawing) {
            switch (this.currentTool) {
                case 'line':
                case 'surface':
                    this.updateLine(pos);
                    break;
                case 'polygon':
                case 'systemTract':
                    this.updatePolygon(pos);
                    break;
            }
        }
    }

    handleMouseUp(e) {}

    handleDoubleClick(e) {
        if (this.currentTool === 'line' && this.isDrawing) this.finishLine();
        else if (this.currentTool === 'polygon' && this.isDrawing) this.finishPolygon();
        else if (this.currentTool === 'surface' && this.isDrawing) this.finishSurface();
        else if (this.currentTool === 'systemTract' && this.isDrawing) this.finishSystemTract();
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') this.cancelCurrentOperation();
    }

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
        this.cancelTermination();
        this.cancelDrilling();
    }

    // ==================== LINE TOOL ====================
    startLine(pos) {
        this.isDrawing = true;
        this.points = [pos];
        this.activeElement = { type: 'line', color: this.currentColor, width: this.lineWidth, points: [pos] };
    }

    updateLine(pos) {
        this.redraw();
        this.drawLinePreview(pos);
    }

    drawLinePreview(pos) {
        if (this.points.length === 0) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.fillStyle = this.currentColor;
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    addLinePoint(pos) {
        if (!this.isDrawing) this.startLine(pos);
        else {
            this.points.push(pos);
            this.activeElement.points = [...this.points];
            this.redraw();
        }
    }

    finishLine() {
        if (this.points.length < 2) { this.cancelCurrentOperation(); return; }
        const element = { type: 'line', color: this.currentColor, width: this.lineWidth, points: [...this.points], timestamp: Date.now() };
        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== POLYGON TOOL ====================
    addPolygonPoint(pos) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = { type: 'polygon', color: this.currentColor, points: [pos] };
        } else {
            const start = this.points[0];
            const dist = Math.hypot(pos.x - start.x, pos.y - start.y);
            if (this.points.length >= 3 && dist < 15) this.finishPolygon();
            else {
                this.points.push(pos);
                this.activeElement.points = [...this.points];
                this.redraw();
            }
        }
    }

    updatePolygon(pos) {
        this.redraw();
        this.drawPolygonPreview(pos);
    }

    drawPolygonPreview(pos) {
        if (this.points.length === 0) return;
        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.closePath();
        this.ctx.fillStyle = this.hexToRgba(this.currentColor, 0.3);
        this.ctx.fill();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.points.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.fillStyle = index === 0 ? '#00FF00' : this.currentColor;
            this.ctx.arc(point.x, point.y, index === 0 ? 6 : 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    finishPolygon() {
        if (this.points.length < 3) { this.cancelCurrentOperation(); return; }
        const element = { type: 'polygon', color: this.currentColor, points: [...this.points], timestamp: Date.now() };
        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== MARKER TOOL ====================
    placeMarker(pos) {
        const element = { type: 'marker', color: this.currentColor, x: pos.x, y: pos.y, size: 12, timestamp: Date.now() };
        this.addElement(element);
        this.onMarkerPlaced({ x: pos.x, y: pos.y, color: this.currentColor, canvasWidth: this.canvas.width, canvasHeight: this.canvas.height });
    }

    // ==================== STRATAL TERMINATION TOOL ====================
    initTerminationState() {
        if (!this.terminationState) {
            this.terminationState = { waitingForSecondClick: false, firstPoint: null, currentNumber: null, color: null };
        }
    }

    getNextTerminationNumber() {
        if (!this.terminationCounter.availableNumbers) this.terminationCounter.availableNumbers = [];
        if (this.terminationCounter.availableNumbers.length > 0) {
            this.terminationCounter.availableNumbers.sort((a, b) => a - b);
            return this.terminationCounter.availableNumbers.shift();
        }
        this.terminationCounter.count++;
        return this.terminationCounter.count;
    }

    recycleTerminationNumber(num) {
        if (!this.terminationCounter.availableNumbers) this.terminationCounter.availableNumbers = [];
        if (!this.terminationCounter.availableNumbers.includes(num)) this.terminationCounter.availableNumbers.push(num);
    }

    placeTermination(pos) {
        this.initTerminationState();
        if (!this.terminationState.waitingForSecondClick) {
            const num = this.getNextTerminationNumber();
            this.terminationState = { waitingForSecondClick: true, firstPoint: { x: pos.x, y: pos.y }, currentNumber: num, color: this.currentColor };
            const element = { type: 'termination', color: this.currentColor, x: pos.x, y: pos.y, label: `${num}`, number: num, isFirstPoint: true, timestamp: Date.now() };
            this.addElement(element);
            this.showTerminationHint(`Click basinward point to complete termination ${num}-${num}`);
        } else {
            const num = this.terminationState.currentNumber;
            const firstPoint = this.terminationState.firstPoint;
            const color = this.terminationState.color;
            const element = { type: 'termination', color: color, x: pos.x, y: pos.y, label: `${num}`, number: num, isFirstPoint: false, timestamp: Date.now() };
            this.addElement(element);
            const x1 = Math.min(firstPoint.x, pos.x);
            const x2 = Math.max(firstPoint.x, pos.x);
            this.onTerminationPlaced({ x1, x2, y1: firstPoint.y, y2: pos.y, label: `${num}-${num}`, number: num, color: color, canvasWidth: this.canvas.width, canvasHeight: this.canvas.height });
            this.terminationState = { waitingForSecondClick: false, firstPoint: null, currentNumber: null, color: null };
            this.hideTerminationHint();
        }
    }

    showTerminationHint(message) {
        this.hideTerminationHint();
        const hint = document.createElement('div');
        hint.id = 'terminationHint';
        hint.textContent = message;
        hint.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,165,0,0.9);color:#000;padding:8px 16px;border-radius:4px;font-weight:bold;font-size:14px;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        this.canvas.parentElement.appendChild(hint);
    }

    hideTerminationHint() {
        const existingHint = document.getElementById('terminationHint');
        if (existingHint) existingHint.remove();
    }

    cancelTermination() {
        if (this.terminationState && this.terminationState.waitingForSecondClick) {
            const num = this.terminationState.currentNumber;
            const lastElement = this.elements[this.elements.length - 1];
            if (lastElement && lastElement.type === 'termination' && lastElement.number === num) {
                this.elements.pop();
                this.recycleTerminationNumber(num);
            }
            this.terminationState = { waitingForSecondClick: false, firstPoint: null, currentNumber: null, color: null };
            this.hideTerminationHint();
            this.redraw();
        }
    }

    // ==================== SURFACE TOOL ====================
    setSurfaceType(type) {
        this.surfaceType = type;
        if (type && this.surfaceColors[type]) this.currentColor = this.surfaceColors[type];
    }

    addSurfacePoint(pos) {
        if (!this.surfaceType) return;
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = { type: 'surface', surfaceType: this.surfaceType, color: this.surfaceColors[this.surfaceType], width: 3, points: [pos] };
        } else {
            this.points.push(pos);
            this.activeElement.points = [...this.points];
            this.redraw();
        }
    }

    finishSurface() {
        if (this.points.length < 2) { this.cancelCurrentOperation(); return; }
        const element = { type: 'surface', surfaceType: this.surfaceType, color: this.surfaceColors[this.surfaceType], width: 3, points: [...this.points], timestamp: Date.now() };
        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== SYSTEM TRACT TOOL ====================
    setSystemTractType(type) {
        this.systemTractType = type;
        if (type && this.systemTractColors[type]) this.currentColor = this.systemTractColors[type];
    }

    addSystemTractPoint(pos) {
        if (!this.systemTractType) return;
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.points = [pos];
            this.activeElement = { type: 'systemTract', tractType: this.systemTractType, color: this.systemTractColors[this.systemTractType], points: [pos] };
        } else {
            const start = this.points[0];
            const dist = Math.hypot(pos.x - start.x, pos.y - start.y);
            if (this.points.length >= 3 && dist < 15) this.finishSystemTract();
            else {
                this.points.push(pos);
                this.activeElement.points = [...this.points];
                this.redraw();
            }
        }
    }

    finishSystemTract() {
        if (this.points.length < 3) { this.cancelCurrentOperation(); return; }
        const element = { type: 'systemTract', tractType: this.systemTractType, color: this.systemTractColors[this.systemTractType], points: [...this.points], timestamp: Date.now() };
        this.addElement(element);
        this.isDrawing = false;
        this.points = [];
        this.activeElement = null;
    }

    // ==================== STRATA NUMBERING TOOL ====================
    placeStrataNumber(pos) {
        this.strataCounter.count++;
        const num = this.strataCounter.count;
        const element = { type: 'strataNumber', number: num, color: '#000000', x: pos.x, y: pos.y, timestamp: Date.now() };
        this.addElement(element);
    }

    // ==================== DRILLING SITE TOOL ====================
    initDrillingState() {
        if (!this.drillingState) this.drillingState = { waitingForSecondClick: false, rigPosition: null };
    }

    placeDrillingSite(pos) {
        this.initDrillingState();
        if (!this.drillingState.waitingForSecondClick) {
            this.drillingState = { waitingForSecondClick: true, rigPosition: { x: pos.x, y: pos.y } };
            const rigElement = { type: 'drillingSite', color: '#FF0000', x: pos.x, y: pos.y, timestamp: Date.now() };
            this.addElement(rigElement);
            this.showDrillingHint('Click on target reservoir interval');
        } else {
            const rigPos = this.drillingState.rigPosition;
            const lineElement = { type: 'drillingLine', color: '#FF0000', x1: rigPos.x, y1: rigPos.y, x2: pos.x, y2: pos.y, timestamp: Date.now() };
            this.addElement(lineElement);
            this.onDrillingLinePlaced({ x: rigPos.x, y1: rigPos.y, y2: pos.y, canvasWidth: this.canvas.width, canvasHeight: this.canvas.height });
            this.drillingState = { waitingForSecondClick: false, rigPosition: null };
            this.hideDrillingHint();
        }
    }

    showDrillingHint(message) {
        this.hideDrillingHint();
        const hint = document.createElement('div');
        hint.id = 'drillingHint';
        hint.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,0,0,0.9);color:#FFF;padding:8px 16px;border-radius:4px;font-weight:bold;font-size:14px;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        hint.textContent = message;
        this.canvas.parentElement.appendChild(hint);
    }

    hideDrillingHint() {
        const existingHint = document.getElementById('drillingHint');
        if (existingHint) existingHint.remove();
    }

    cancelDrilling() {
        if (this.drillingState && this.drillingState.waitingForSecondClick) {
            const lastElement = this.elements[this.elements.length - 1];
            if (lastElement && lastElement.type === 'drillingSite') this.elements.pop();
            this.drillingState = { waitingForSecondClick: false, rigPosition: null };
            this.hideDrillingHint();
            this.redraw();
        }
    }

    // ==================== TEXT TOOL ====================
    startText(pos) {
        if (this.textInput) this.textInput.remove();
        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.className = 'canvas-text-input';
        this.textInput.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;font-size:14px;font-family:Arial,sans-serif;border:1px solid ${this.currentColor};padding:2px 5px;background:white;color:${this.currentColor};outline:none;z-index:1000;min-width:100px;`;
        const wrapper = this.canvas.parentElement;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        this.textInput.style.left = `${pos.x * scaleX}px`;
        this.textInput.style.top = `${pos.y * scaleY}px`;
        wrapper.appendChild(this.textInput);
        this.textInput.focus();
        this.textPosition = pos;
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.finishText();
            else if (e.key === 'Escape') this.cancelCurrentOperation();
        });
        this.textInput.addEventListener('blur', () => setTimeout(() => this.finishText(), 100));
    }

    finishText() {
        if (!this.textInput) return;
        const text = this.textInput.value.trim();
        if (text) {
            const element = { type: 'text', color: this.currentColor, x: this.textPosition.x, y: this.textPosition.y, text: text, fontSize: 14, timestamp: Date.now() };
            this.addElement(element);
        }
        this.textInput.remove();
        this.textInput = null;
        this.textPosition = null;
    }

    // ==================== ERASER TOOL ====================
    handleEraser(pos) {
        const element = this.findElementAt(pos);
        if (element) {
            const index = this.elements.indexOf(element);
            if (index > -1) {
                this.redoStack = [];
                this.undoStack.push({ action: 'remove', element: element, index: index });
                this.elements.splice(index, 1);
                this.hoverElement = null;
                this.redraw();
                this.onStateChange();
            }
        }
    }

    findElementAt(pos) {
        for (let i = this.elements.length - 1; i >= 0; i--) {
            if (this.isPointInElement(pos, this.elements[i])) return this.elements[i];
        }
        return null;
    }

    isPointInElement(pos, element) {
        const threshold = 10;
        switch (element.type) {
            case 'line': return this.isPointNearLine(pos, element.points, threshold);
            case 'polygon': return this.isPointInPolygon(pos, element.points);
            case 'marker': return Math.hypot(pos.x - element.x, pos.y - element.y) < element.size + 5;
            case 'text':
                const textWidth = element.text.length * 8;
                return pos.x >= element.x && pos.x <= element.x + textWidth && pos.y >= element.y - element.fontSize && pos.y <= element.y;
            case 'termination': return Math.hypot(pos.x - element.x, pos.y - element.y) < 15;
            case 'terminationLine': return Math.abs(pos.y - element.y) < 10 && pos.x >= element.x1 && pos.x <= element.x2;
            case 'surface': return this.isPointNearLine(pos, element.points, threshold);
            case 'systemTract': return this.isPointInPolygon(pos, element.points);
            case 'strataNumber': return Math.hypot(pos.x - element.x, pos.y - element.y) < 10;
            case 'drillingSite': return Math.hypot(pos.x - element.x, pos.y - element.y) < 20;
            case 'drillingLine': return this.isPointNearLine(pos, [{ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }], threshold);
            case 'drillingProjection': return Math.abs(pos.x - element.x) < 8 && pos.y >= element.y1 && pos.y <= element.y2;
            default: return false;
        }
    }

    isPointNearLine(pos, points, threshold) {
        for (let i = 0; i < points.length - 1; i++) {
            if (this.pointToLineDistance(pos, points[i], points[i + 1]) < threshold) return true;
        }
        return false;
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x, B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x, D = lineEnd.y - lineStart.y;
        const dot = A * C + B * D, lenSq = C * C + D * D;
        let param = lenSq !== 0 ? dot / lenSq : -1;
        let xx, yy;
        if (param < 0) { xx = lineStart.x; yy = lineStart.y; }
        else if (param > 1) { xx = lineEnd.x; yy = lineEnd.y; }
        else { xx = lineStart.x + param * C; yy = lineStart.y + param * D; }
        return Math.hypot(point.x - xx, point.y - yy);
    }

    isPointInPolygon(pos, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y, xj = points[j].x, yj = points[j].y;
            if (((yi > pos.y) !== (yj > pos.y)) && (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    }

    // ==================== ELEMENT MANAGEMENT ====================
    addElement(element) {
        this.elements.push(element);
        this.redoStack = [];
        if (this.undoStack.length >= this.maxHistory) this.undoStack.shift();
        this.undoStack.push({ action: 'add', element: element });
        this.redraw();
        this.onStateChange();
        this.onElementAdd(element);
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        const action = this.undoStack.pop();
        if (action.action === 'add') {
            const index = this.elements.indexOf(action.element);
            if (index > -1) this.elements.splice(index, 1);
            if (action.element.type === 'termination') this.recycleTerminationNumber(action.element.number);
            this.redoStack.push(action);
        } else if (action.action === 'remove') {
            this.elements.splice(action.index, 0, action.element);
            this.redoStack.push(action);
        }
        this.redraw();
        this.onStateChange();
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        const action = this.redoStack.pop();
        if (action.action === 'add') {
            this.elements.push(action.element);
            this.undoStack.push(action);
        } else if (action.action === 'remove') {
            const index = this.elements.indexOf(action.element);
            if (index > -1) this.elements.splice(index, 1);
            this.undoStack.push(action);
        }
        this.redraw();
        this.onStateChange();
        return true;
    }

    clear() {
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
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.elements.forEach(element => this.drawElement(element));
        if (this.hoverElement && this.currentTool === 'eraser') this.drawElementHighlight(this.hoverElement);
        if (this.activeElement && this.isDrawing) {
            if (this.currentTool === 'polygon' || this.currentTool === 'systemTract') this.drawPolygonPreview(this.currentMousePos);
            else if (this.currentTool === 'line' || this.currentTool === 'surface') this.drawLinePreview(this.currentMousePos);
        }
    }

    drawElement(element) {
        switch (element.type) {
            case 'line': this.drawLine(element); break;
            case 'polygon': this.drawPolygon(element); break;
            case 'marker': this.drawMarker(element); break;
            case 'text': this.drawText(element); break;
            case 'termination': this.drawTermination(element); break;
            case 'terminationLine': this.drawTerminationLine(element); break;
            case 'surface': this.drawSurface(element); break;
            case 'systemTract': this.drawSystemTract(element); break;
            case 'rolloverSquare': this.drawRolloverSquare(element); break;
            case 'strataNumber': this.drawStrataNumber(element); break;
            case 'drillingSite': this.drawDrillingSite(element); break;
            case 'drillingLine': this.drawDrillingLine(element); break;
            case 'drillingProjection': this.drawDrillingProjection(element); break;
        }
    }

    drawStrataNumber(element) {
        const radius = 7;
        this.ctx.beginPath();
        this.ctx.arc(element.x, element.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(element.number.toString(), element.x, element.y);
    }

    drawDrillingSite(element) {
        const x = element.x, y = element.y;
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.fillStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(x, y - 25);
        this.ctx.lineTo(x - 12, y + 10);
        this.ctx.lineTo(x + 12, y + 10);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x - 8, y - 5);
        this.ctx.lineTo(x + 8, y - 5);
        this.ctx.moveTo(x - 5, y - 15);
        this.ctx.lineTo(x + 5, y - 15);
        this.ctx.stroke();
        this.ctx.fillRect(x - 15, y + 10, 30, 5);
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('DRILL', x, y + 18);
    }

    drawDrillingLine(element) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color || '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 4]);
        this.ctx.moveTo(element.x1, element.y1);
        this.ctx.lineTo(element.x2, element.y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.arc(element.x2, element.y2, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
    }

    drawDrillingProjection(element) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color || 'rgba(255, 0, 0, 0.4)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.ctx.moveTo(element.x, element.y1);
        this.ctx.lineTo(element.x, element.y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.font = '8px Arial';
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText('⛏', element.x, element.y1 - 2);
    }

    drawLine(element) {
        if (element.points.length < 2) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
        this.ctx.stroke();
    }

    drawPolygon(element) {
        if (element.points.length < 3) return;
        this.ctx.beginPath();
        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
        this.ctx.closePath();
        this.ctx.fillStyle = this.hexToRgba(element.color, 0.5);
        this.ctx.fill();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

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

    drawText(element) {
        this.ctx.font = `bold ${element.fontSize || 14}px Arial`;
        this.ctx.fillStyle = element.color;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(element.text, element.x, element.y);
    }

    drawTermination(element) {
        const radius = 8;
        this.ctx.beginPath();
        this.ctx.arc(element.x, element.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = element.color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        this.ctx.font = 'bold 9px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(element.label, element.x, element.y);
        this.ctx.textAlign = 'left';
    }

    drawTerminationLine(element) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.lineWidth || 4;
        this.ctx.moveTo(element.x1, element.y);
        this.ctx.lineTo(element.x2, element.y);
        this.ctx.stroke();
        this.ctx.font = 'bold 9px Arial';
        this.ctx.fillStyle = element.color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(element.label, element.x1, element.y + 3);
        this.ctx.textAlign = 'left';
    }

    drawRolloverSquare(element) {
        const size = 8;
        this.ctx.fillStyle = element.color || '#FFA500';
        this.ctx.fillRect(element.x - size/2, element.y - size/2, size, size);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(element.x - size/2, element.y - size/2, size, size);
    }

    drawSurface(element) {
        if (element.points.length < 2) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.width || 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
        this.ctx.stroke();
        const midIndex = Math.floor(element.points.length / 2);
        const midPoint = element.points[midIndex];
        this.ctx.font = 'bold 11px Arial';
        const labelText = element.surfaceType;
        const textWidth = this.ctx.measureText(labelText).width;
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(midPoint.x - textWidth/2 - 3, midPoint.y - 18, textWidth + 6, 14);
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(midPoint.x - textWidth/2 - 3, midPoint.y - 18, textWidth + 6, 14);
        this.ctx.fillStyle = element.color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(labelText, midPoint.x, midPoint.y - 11);
        this.ctx.textAlign = 'left';
    }

    drawSystemTract(element) {
        if (element.points.length < 3) return;
        this.ctx.beginPath();
        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
        this.ctx.closePath();
        this.ctx.fillStyle = this.hexToRgba(element.color, 0.4);
        this.ctx.fill();
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        let cx = 0, cy = 0;
        element.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= element.points.length;
        cy /= element.points.length;
        this.ctx.font = 'bold 12px Arial';
        const labelText = element.tractType;
        const textWidth = this.ctx.measureText(labelText).width;
        this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
        this.ctx.fillRect(cx - textWidth/2 - 4, cy - 8, textWidth + 8, 16);
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cx - textWidth/2 - 4, cy - 8, textWidth + 8, 16);
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(labelText, cx, cy);
        this.ctx.textAlign = 'left';
    }

    drawElementHighlight(element) {
        this.ctx.save();
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        switch (element.type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
                this.ctx.stroke();
                break;
            case 'polygon':
                this.ctx.beginPath();
                this.ctx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) this.ctx.lineTo(element.points[i].x, element.points[i].y);
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'marker':
                this.ctx.beginPath();
                this.ctx.arc(element.x, element.y - 6, 15, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'text':
                this.ctx.strokeRect(element.x - 2, element.y - 2, element.text.length * 8 + 4, element.fontSize + 4);
                break;
            case 'strataNumber':
                this.ctx.beginPath();
                this.ctx.arc(element.x, element.y, 10, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'drillingSite':
                this.ctx.beginPath();
                this.ctx.arc(element.x, element.y, 22, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'drillingLine':
                this.ctx.beginPath();
                this.ctx.moveTo(element.x1, element.y1);
                this.ctx.lineTo(element.x2, element.y2);
                this.ctx.stroke();
                break;
            case 'drillingProjection':
                this.ctx.beginPath();
                this.ctx.moveTo(element.x, element.y1);
                this.ctx.lineTo(element.x, element.y2);
                this.ctx.stroke();
                break;
        }
        this.ctx.restore();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    setTool(tool) {
        this.cancelCurrentOperation();
        this.currentTool = tool;
        this.hoverElement = null;
        this.canvas.style.cursor = 'crosshair';
    }

    setColor(color) { this.currentColor = color; }
    setLineWidth(width) { this.lineWidth = width; }
    toDataURL() { return this.canvas.toDataURL('image/png'); }
    getState() { return { elements: JSON.parse(JSON.stringify(this.elements)), canvasId: this.canvasId }; }
    loadState(state) { if (state && state.elements) { this.elements = state.elements; this.undoStack = []; this.redoStack = []; this.redraw(); } }
    hasElements() { return this.elements.length > 0; }
    getElementCount() { return this.elements.length; }

    // ==================== TOUCH SUPPORT ====================
    handleTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches.length > 1) return;
        const touch = e.touches[0];
        const now = Date.now();
        if (this.lastTapTime && (now - this.lastTapTime) < 300 && this.lastTapPos && Math.abs(touch.clientX - this.lastTapPos.x) < 30 && Math.abs(touch.clientY - this.lastTapPos.y) < 30) {
            this.handleDoubleClick({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
            this.lastTapTime = 0;
            return;
        }
        this.lastTapTime = now;
        this.lastTapPos = { x: touch.clientX, y: touch.clientY };
        this.handleMouseDown(new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY, button: 0 }));
    }

    handleTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches.length > 1) return;
        const touch = e.touches[0];
        this.handleMouseMove(new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY }));
    }

    handleTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        this.handleMouseUp(new MouseEvent('mouseup'));
    }
}

// ==================== BACKGROUND CANVASES ====================

class CrossSectionBackground {
    constructor(canvasId, imageSrc = null) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.imageSrc = imageSrc;
        this.image = null;
        this.imageLoaded = false;
        this.padding = { top: 40, right: 40, bottom: 60, left: 70 };
    }

    async init() {
        if (this.imageSrc) await this.loadImage();
        else { this.setCanvasSize(1400, 500); this.drawSyntheticCrossSection(); }
    }

    loadImage() {
        return new Promise((resolve) => {
            this.image = new Image();
            this.image.onload = () => {
                const maxWidth = 1400;
                let targetWidth = this.image.width, targetHeight = this.image.height;
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
                this.setCanvasSize(1400, 500);
                this.drawSyntheticCrossSection();
                resolve();
            };
            this.image.src = this.imageSrc;
        });
    }

    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    drawSyntheticCrossSection() {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.padding;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        this.drawAxes();
        const plotWidth = w - p.left - p.right, plotHeight = h - p.top - p.bottom;
        for (let i = 0; i < 25; i++) {
            const progress = i / 24;
            ctx.beginPath();
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            const points = this.generateClinoformPoints(progress, plotWidth, plotHeight, p);
            ctx.moveTo(points[0].x, points[0].y);
            for (let j = 1; j < points.length; j++) ctx.lineTo(points[j].x, points[j].y);
            ctx.stroke();
        }
    }

    generateClinoformPoints(progress, plotWidth, plotHeight, p) {
        const points = [];
        const shelfBreakX = 30 + progress * 90, basinFloorDepth = 50 + progress * 550;
        for (let j = 0; j <= 50; j++) {
            const xKm = (j / 50) * 150;
            let depthM = xKm < shelfBreakX ? 650 - progress * 550 + (xKm / shelfBreakX) * 30 : Math.min(basinFloorDepth, (650 - progress * 550 + 30) + (xKm - shelfBreakX) * 2);
            depthM = Math.max(0, Math.min(700, depthM));
            points.push({ x: p.left + (xKm / 150) * plotWidth, y: p.top + (depthM / 700) * plotHeight });
        }
        return points;
    }

    drawAxes() {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.padding;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';
        ctx.beginPath(); ctx.moveTo(p.left, p.top); ctx.lineTo(p.left, h - p.bottom); ctx.stroke();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let d = 0; d <= 700; d += 175) { const y = p.top + (d / 700) * (h - p.top - p.bottom); ctx.fillText(d.toString(), p.left - 10, y); }
        ctx.save(); ctx.translate(20, h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial'; ctx.fillText('Depth (m)', 0, 0); ctx.restore();
        ctx.beginPath(); ctx.moveTo(p.left, h - p.bottom); ctx.lineTo(w - p.right, h - p.bottom); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '12px Arial';
        for (let d = 0; d <= 150; d += 50) { const x = p.left + (d / 150) * (w - p.left - p.right); ctx.fillText(d.toString(), x, h - p.bottom + 10); }
        ctx.font = 'bold 14px Arial'; ctx.fillText('Distance (km)', w / 2, h - 15);
        ctx.font = 'bold 16px Arial'; ctx.fillText('Clinoform Cross-Section', w / 2, 15);
    }
}

class WheelerDiagramBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.padding = { top: 40, right: 40, bottom: 60, left: 70 };
    }

    init(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
    }

    draw() {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.padding;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        this.drawGrid();
        this.drawAxes();
    }

    drawGrid() {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.padding;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.3;
        ctx.setLineDash([2, 4]);
        for (let x = 0; x <= 150; x += 10) { const xPos = p.left + (x / 150) * (w - p.left - p.right); ctx.beginPath(); ctx.moveTo(xPos, p.top); ctx.lineTo(xPos, h - p.bottom); ctx.stroke(); }
        for (let t = 0; t <= 50; t += 1) { const yPos = h - p.bottom - (t / 50) * (h - p.top - p.bottom); ctx.beginPath(); ctx.moveTo(p.left, yPos); ctx.lineTo(w - p.right, yPos); ctx.stroke(); }
        ctx.setLineDash([]);
    }

    drawAxes() {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.padding;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';
        ctx.beginPath(); ctx.moveTo(p.left, p.top); ctx.lineTo(p.left, h - p.bottom); ctx.stroke();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let t = 0; t <= 50; t += 10) { const y = h - p.bottom - (t / 50) * (h - p.top - p.bottom); ctx.fillText(t.toString(), p.left - 10, y); }
        ctx.save(); ctx.translate(20, h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial'; ctx.fillText('Relative Time', 0, 0); ctx.restore();
        ctx.beginPath(); ctx.moveTo(p.left, h - p.bottom); ctx.lineTo(w - p.right, h - p.bottom); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '12px Arial';
        for (let d = 0; d <= 150; d += 50) { const x = p.left + (d / 150) * (w - p.left - p.right); ctx.fillText(d.toString(), x, h - p.bottom + 10); }
        ctx.font = 'bold 14px Arial'; ctx.fillText('Distance (km)', w / 2, h - 15);
        ctx.font = 'bold 16px Arial'; ctx.fillText('Wheeler Diagram (Chronostratigraphic Chart)', w / 2, 15);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DrawingCanvas, CrossSectionBackground, WheelerDiagramBackground };
}
