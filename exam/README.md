# Sequence Stratigraphy Online Exam

**Course:** Seismo- und Sequenzstratigraphie (AS-F1 / GT-F1)
**Institution:** FAU Erlangen-Nürnberg
**Semester:** WS 2025/26
**Exam Date:** 26 January 2026

## Overview

This is an interactive browser-based examination for testing students' ability to:
- Interpret clinoform cross-sections
- Identify sequence stratigraphic surfaces (SB, MFS, TS)
- Construct Wheeler (chronostratigraphic) diagrams
- Explain basin evolution and sequence stratigraphy concepts

## Features

- **2-hour timed exam** with visual countdown
- **Auto-save every 30 seconds** to localStorage
- **Full undo/redo support** for all drawing operations
- **Multiple drawing tools**: Line, Polygon, Marker, Text, Eraser
- **Pre-defined color palette** for stratigraphic conventions
- **Export functionality** for grading (JSON + PNG images)
- **Session recovery** if browser is accidentally closed

## File Structure

```
sequence-strat-exam/
├── index.html              # Main exam page
├── css/
│   └── exam.css           # All styles
├── js/
│   ├── main.js            # Application entry point
│   ├── timer.js           # Timer functionality
│   ├── canvas.js          # Canvas drawing tools
│   ├── storage.js         # LocalStorage handling
│   └── export.js          # Export functionality
├── images/
│   └── wheeler_exam_crosssection.png  # Cross-section image (add your own)
└── README.md              # This file
```

## Deployment Instructions

### Option 1: Local File System
1. Extract all files to a folder
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari)
3. Note: Some browsers may restrict localStorage when running from `file://`

### Option 2: Local Web Server (Recommended for Testing)
```bash
# Using Python 3
cd sequence-strat-exam
python -m http.server 8000

# Then open: http://localhost:8000
```

### Option 3: Web Server Deployment
1. Upload all files to your web server
2. Ensure HTTPS is enabled (required for localStorage)
3. Disable browser caching during exam period

## Adding the Cross-Section Image

The exam requires a clinoform cross-section image. To add your own:

1. Name your image `wheeler_exam_crosssection.png`
2. Place it in the `images/` folder
3. Recommended dimensions: 1400-4750px width
4. The image should show:
   - X-axis: Distance (0-150 km)
   - Y-axis: Depth (0-700 m)
   - Clinoform geometries with stratal terminations

If no image is provided, the application will generate a synthetic cross-section.

## Exam Workflow

### For Students:
1. Enter Student ID and Name
2. Click "Start Exam"
3. Use the toolbar to draw on the cross-section and Wheeler diagram
4. Answer the three interpretation questions
5. Click "Submit Exam" when finished (or auto-submit at time expiry)

### For Instructors:
1. Students' work is exported as:
   - `exam_[studentId]_[timestamp]_data.json` - Complete exam data
   - `exam_[studentId]_[timestamp]_crosssection.png` - Annotated cross-section
   - `exam_[studentId]_[timestamp]_wheeler.png` - Wheeler diagram
2. The JSON file contains all drawing elements, answers, and metadata

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| L | Line tool |
| P | Polygon tool |
| M | Marker tool |
| T | Text tool |
| E | Eraser tool |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Force save |
| Esc | Cancel current operation |
| ? | Toggle shortcuts help |

## Color Conventions

### Surfaces (Lines)
- **Red (#FF0000)** - Sequence Boundary (SB)
- **Blue (#0000FF)** - Maximum Flooding Surface (MFS)
- **Cyan (#00FFFF)** - Transgressive Surface (TS)

### Systems Tracts (Fill)
- **Cream (#FFFACD)** - Highstand Systems Tract (HST)
- **Green (#98FB98)** - Transgressive Systems Tract (TST)
- **Orange (#FFB347)** - Lowstand Systems Tract (LST)

### Markers
- **Orange (#FFA500)** - Clinoform Rollover Position

## Browser Requirements

- **Minimum resolution:** 1280 x 720
- **Supported browsers:** Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- **JavaScript:** Must be enabled
- **localStorage:** Must be available

## Troubleshooting

### "Not saved" status persists
- Check if localStorage is available in your browser
- Try using HTTPS instead of HTTP
- Clear browser cache and reload

### Drawing tools not working
- Click on the canvas to activate it (blue border indicates active)
- Check that a tool is selected in the toolbar
- For lines: click to add points, double-click to finish

### Timer shows wrong time
- If restored from a saved session, the timer continues from where it left off
- Contact instructor if timer seems incorrect

### Export not downloading
- Check browser's download settings
- Allow pop-ups from this site
- Try a different browser

## Technical Notes

- Pure HTML5/CSS3/JavaScript (no external dependencies)
- Canvas API for all drawing operations
- localStorage for persistence (5MB limit)
- No server-side component required

## Contact

For technical issues during the exam, contact the course instructor.

---

*Generated for FAU Erlangen-Nürnberg, Department of Geosciences*
