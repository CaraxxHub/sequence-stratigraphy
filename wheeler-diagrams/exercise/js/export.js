/**
 * Sequence Stratigraphy Exam - Export Module
 * Handles exam export to JSON and PNG for grading
 */

const ExamExport = {
    /**
     * Generate complete exam export data
     * @param {Object} examData - All exam data
     * @returns {Object} - Export data object
     */
    generateExportData(examData) {
        const now = new Date();

        return {
            metadata: {
                examVersion: '1.0',
                courseCode: 'AS-F1 / GT-F1',
                courseName: 'Seismo- und Sequenzstratigraphie',
                university: 'FAU Erlangen-Nürnberg',
                semester: 'WS 2025/26',
                examDate: now.toISOString().split('T')[0],
                submissionTime: now.toISOString(),
                studentId: examData.studentId || 'Unknown',
                studentName: examData.studentName || 'Unknown',
                totalTimeSpent: examData.timeSpent || 0,
                timeSpentFormatted: this.formatTime(examData.timeSpent || 0),
                browserInfo: navigator.userAgent
            },

            section1: {
                title: 'Wheeler Diagram Construction',
                maxPoints: 50,
                crossSection: {
                    description: 'Clinoform cross-section interpretation',
                    elements: examData.crossSectionElements || [],
                    elementCount: (examData.crossSectionElements || []).length,
                    elementSummary: this.summarizeElements(examData.crossSectionElements || [])
                },
                wheeler: {
                    description: 'Wheeler (chronostratigraphic) diagram',
                    elements: examData.wheelerElements || [],
                    elementCount: (examData.wheelerElements || []).length,
                    elementSummary: this.summarizeElements(examData.wheelerElements || [])
                }
            },

            section2: {
                title: 'Interpretation Questions',
                maxPoints: 100,
                question1: {
                    title: 'Geological Evolution',
                    maxPoints: 25,
                    maxWords: 400,
                    text: examData.answers?.question1 || '',
                    wordCount: this.countWords(examData.answers?.question1 || '')
                },
                question2: {
                    title: 'Shoreline Trajectories',
                    maxPoints: 25,
                    maxWords: 400,
                    text: examData.answers?.question2 || '',
                    wordCount: this.countWords(examData.answers?.question2 || '')
                },
                question3: {
                    title: 'Surfaces and System Tracts',
                    maxPoints: 30,
                    maxWords: 500,
                    text: examData.answers?.question3 || '',
                    wordCount: this.countWords(examData.answers?.question3 || '')
                },
                question4: {
                    title: 'BONUS: Drilling Site Selection',
                    maxPoints: 10,
                    maxWords: 300,
                    text: examData.answers?.question4 || '',
                    wordCount: this.countWords(examData.answers?.question4 || '')
                }
            },

            statistics: {
                totalElements: (examData.crossSectionElements || []).length +
                              (examData.wheelerElements || []).length,
                totalWords: this.countWords(examData.answers?.question1 || '') +
                           this.countWords(examData.answers?.question2 || '') +
                           this.countWords(examData.answers?.question3 || '') +
                           this.countWords(examData.answers?.question4 || ''),
                completionPercentage: this.calculateCompletion(examData)
            }
        };
    },

    /**
     * Summarize drawing elements by type
     * @param {Array} elements
     * @returns {Object}
     */
    summarizeElements(elements) {
        const summary = {
            lines: 0,
            polygons: 0,
            markers: 0,
            texts: 0,
            byColor: {}
        };

        elements.forEach(el => {
            switch (el.type) {
                case 'line': summary.lines++; break;
                case 'polygon': summary.polygons++; break;
                case 'marker': summary.markers++; break;
                case 'text': summary.texts++; break;
            }

            // Count by color
            if (el.color) {
                summary.byColor[el.color] = (summary.byColor[el.color] || 0) + 1;
            }
        });

        return summary;
    },

    /**
     * Count words in text
     * @param {string} text
     * @returns {number}
     */
    countWords(text) {
        if (!text || typeof text !== 'string') return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    },

    /**
     * Format time in milliseconds to readable string
     * @param {number} ms
     * @returns {string}
     */
    formatTime(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        return parts.join(' ');
    },

    /**
     * Calculate exam completion percentage
     * @param {Object} examData
     * @returns {number}
     */
    calculateCompletion(examData) {
        let completed = 0;
        let total = 5; // 2 canvases + 3 questions

        // Check cross-section
        if ((examData.crossSectionElements || []).length > 0) completed++;

        // Check wheeler
        if ((examData.wheelerElements || []).length > 0) completed++;

        // Check questions
        if (this.countWords(examData.answers?.question1 || '') >= 50) completed++;
        if (this.countWords(examData.answers?.question2 || '') >= 50) completed++;
        if (this.countWords(examData.answers?.question3 || '') >= 50) completed++;

        return Math.round((completed / total) * 100);
    },

    /**
     * Download JSON file
     * @param {Object} data
     * @param {string} filename
     */
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    },

    /**
     * Download PNG image from canvas
     * @param {HTMLCanvasElement} canvas
     * @param {string} filename
     */
    downloadCanvasImage(canvas, filename) {
        const dataURL = canvas.toDataURL('image/png');
        const blob = this.dataURLToBlob(dataURL);
        this.downloadBlob(blob, filename);
    },

    /**
     * Create combined canvas image (background + drawing)
     * @param {HTMLCanvasElement} bgCanvas
     * @param {HTMLCanvasElement} drawCanvas
     * @returns {HTMLCanvasElement}
     */
    combineCanvases(bgCanvas, drawCanvas) {
        const combined = document.createElement('canvas');

        // Use the larger dimensions to ensure we capture everything
        const width = Math.max(bgCanvas.width || 0, drawCanvas.width || 0) || 1400;
        const height = Math.max(bgCanvas.height || 0, drawCanvas.height || 0) || 500;

        combined.width = width;
        combined.height = height;

        const ctx = combined.getContext('2d');

        // Fill with white background first
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw background canvas if it has content
        if (bgCanvas && bgCanvas.width > 0 && bgCanvas.height > 0) {
            ctx.drawImage(bgCanvas, 0, 0);
        }

        // Draw drawing canvas on top
        if (drawCanvas && drawCanvas.width > 0 && drawCanvas.height > 0) {
            ctx.drawImage(drawCanvas, 0, 0);
        }

        return combined;
    },

    /**
     * Convert data URL to Blob
     * @param {string} dataURL
     * @returns {Blob}
     */
    dataURLToBlob(dataURL) {
        const parts = dataURL.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], { type: mime });
    },

    /**
     * Download a blob as file
     * @param {Blob} blob
     * @param {string} filename
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Export complete exam (all files)
     * @param {Object} examData
     * @param {Object} canvases - { crossSectionBg, crossSectionDraw, wheelerBg, wheelerDraw }
     */
    async exportAll(examData, canvases) {
        try {
            const studentId = examData.studentId || 'unknown';
            const studentName = (examData.studentName || 'unknown').replace(/\s+/g, '_');
            const prefix = `SeqStrat_Exam_${studentId}_${studentName}`;

            // Generate export data
            const exportData = this.generateExportData(examData);

            // Generate image data URLs
            let crossSectionDataURL = null;
            let wheelerDataURL = null;

            // Create cross-section image
            console.log('Cross-section canvases check - BG:', canvases.crossSectionBg, 'Draw:', canvases.crossSectionDraw);
            if (canvases.crossSectionBg && canvases.crossSectionDraw) {
                try {
                    console.log('Creating Cross-section combined canvas...');
                    console.log('Cross-section BG dimensions:', canvases.crossSectionBg.width, 'x', canvases.crossSectionBg.height);
                    console.log('Cross-section Draw dimensions:', canvases.crossSectionDraw.width, 'x', canvases.crossSectionDraw.height);

                    // Try to get the background canvas data first to check for tainted canvas
                    try {
                        canvases.crossSectionBg.toDataURL();
                    } catch (taintError) {
                        console.warn('Cross-section BG canvas is tainted (CORS), using drawing canvas only');
                        // If BG is tainted, just use the drawing canvas with white background
                        const fallback = document.createElement('canvas');
                        fallback.width = canvases.crossSectionDraw.width || 1400;
                        fallback.height = canvases.crossSectionDraw.height || 500;
                        const ctx = fallback.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, fallback.width, fallback.height);
                        ctx.drawImage(canvases.crossSectionDraw, 0, 0);
                        crossSectionDataURL = fallback.toDataURL('image/png');
                        console.log('Cross-section fallback dataURL created, length:', crossSectionDataURL?.length);
                    }

                    // If not tainted, combine normally
                    if (!crossSectionDataURL) {
                        const crossSectionCombined = this.combineCanvases(
                            canvases.crossSectionBg,
                            canvases.crossSectionDraw
                        );
                        console.log('Cross-section combined canvas created:', crossSectionCombined.width, 'x', crossSectionCombined.height);
                        crossSectionDataURL = crossSectionCombined.toDataURL('image/png');
                        console.log('Cross-section dataURL created, length:', crossSectionDataURL?.length);
                    }
                } catch (e) {
                    console.error('Error creating cross-section image:', e);
                    // Last resort fallback - try just the drawing canvas
                    try {
                        crossSectionDataURL = canvases.crossSectionDraw.toDataURL('image/png');
                        console.log('Cross-section drawing-only dataURL created');
                    } catch (e2) {
                        console.error('Could not export cross-section at all:', e2);
                    }
                }
            } else {
                console.warn('Cross-section canvases missing - BG exists:', !!canvases.crossSectionBg, 'Draw exists:', !!canvases.crossSectionDraw);
            }

            // Create wheeler diagram image
            console.log('Wheeler canvases check - BG:', canvases.wheelerBg, 'Draw:', canvases.wheelerDraw);
            if (canvases.wheelerBg && canvases.wheelerDraw) {
                try {
                    console.log('Creating Wheeler combined canvas...');
                    console.log('Wheeler BG dimensions:', canvases.wheelerBg.width, 'x', canvases.wheelerBg.height);
                    console.log('Wheeler Draw dimensions:', canvases.wheelerDraw.width, 'x', canvases.wheelerDraw.height);
                    const wheelerCombined = this.combineCanvases(
                        canvases.wheelerBg,
                        canvases.wheelerDraw
                    );
                    console.log('Wheeler combined canvas created:', wheelerCombined.width, 'x', wheelerCombined.height);
                    wheelerDataURL = wheelerCombined.toDataURL('image/png');
                    console.log('Wheeler dataURL created, length:', wheelerDataURL?.length);
                } catch (e) {
                    console.error('Error creating wheeler image:', e);
                }
            } else {
                console.warn('Wheeler canvases missing - BG exists:', !!canvases.wheelerBg, 'Draw exists:', !!canvases.wheelerDraw);
            }

            // Download as PDF (non-editable format)
            await this.downloadPDFReport(exportData, crossSectionDataURL, wheelerDataURL, `${prefix}_Submission.pdf`);

            return exportData;
        } catch (e) {
            console.error('Export error:', e);
            alert('Error exporting exam: ' + e.message);
            return null;
        }
    },

    /**
     * Export for review (preview before submission)
     * @param {Object} examData
     * @returns {Object}
     */
    exportForReview(examData) {
        const exportData = this.generateExportData(examData);
        return exportData;
    },

    /**
     * Generate HTML report
     * @param {Object} exportData
     * @returns {string}
     */
    generateHTMLReport(exportData) {
        // Escape HTML in text answers to prevent XSS
        const escapeHtml = (text) => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br>');
        };

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Exam Submission - ${exportData.metadata.studentName} (${exportData.metadata.studentId})</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1a5276;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1a5276;
            margin: 0 0 10px 0;
            font-size: 1.8rem;
        }
        .header .course-info {
            color: #666;
            font-size: 1rem;
        }
        .student-info {
            background: linear-gradient(135deg, #1a5276, #2980b9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .student-info .info-item {
            display: flex;
            flex-direction: column;
        }
        .student-info .label {
            font-size: 0.8rem;
            opacity: 0.8;
            text-transform: uppercase;
        }
        .student-info .value {
            font-size: 1.1rem;
            font-weight: bold;
        }
        .stats-bar {
            display: flex;
            justify-content: space-around;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .stat {
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #1a5276;
        }
        .stat-label {
            font-size: 0.85rem;
            color: #666;
        }
        h2 {
            color: #1a5276;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-top: 40px;
        }
        .section-note {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #2980b9;
        }
        .question {
            margin-bottom: 35px;
            page-break-inside: avoid;
        }
        .question h3 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .word-count {
            font-size: 0.85rem;
            color: #666;
            font-weight: normal;
            background: #f0f0f0;
            padding: 3px 10px;
            border-radius: 4px;
        }
        .answer {
            background: #fafafa;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 4px;
            min-height: 100px;
        }
        .answer.empty {
            color: #999;
            font-style: italic;
        }
        .files-note {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin-top: 30px;
        }
        .files-note h4 {
            margin: 0 0 10px 0;
            color: #856404;
        }
        .files-note ul {
            margin: 0;
            padding-left: 20px;
        }
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.85rem;
            text-align: center;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 20px; }
            .question { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sequence Stratigraphy Examination</h1>
            <div class="course-info">
                ${exportData.metadata.courseName} | ${exportData.metadata.university} | ${exportData.metadata.semester}
            </div>
        </div>

        <div class="student-info">
            <div class="info-item">
                <span class="label">Student Name</span>
                <span class="value">${exportData.metadata.studentName}</span>
            </div>
            <div class="info-item">
                <span class="label">Student ID</span>
                <span class="value">${exportData.metadata.studentId}</span>
            </div>
            <div class="info-item">
                <span class="label">Submission Time</span>
                <span class="value">${new Date(exportData.metadata.submissionTime).toLocaleString()}</span>
            </div>
            <div class="info-item">
                <span class="label">Time Spent</span>
                <span class="value">${exportData.metadata.timeSpentFormatted}</span>
            </div>
        </div>

        <div class="stats-bar">
            <div class="stat">
                <div class="stat-value">${exportData.section1.crossSection.elementCount}</div>
                <div class="stat-label">Cross-Section Elements</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.section1.wheeler.elementCount}</div>
                <div class="stat-label">Wheeler Elements</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.statistics.totalWords}</div>
                <div class="stat-label">Total Words</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.statistics.completionPercentage}%</div>
                <div class="stat-label">Completion</div>
            </div>
        </div>

        <h2>Section 1: Wheeler Diagram Construction (50 points)</h2>
        <div class="section-note">
            <strong>Note:</strong> See the accompanying PNG image files for your Wheeler diagram and cross-section interpretations:
            <ul style="margin: 10px 0 0 0;">
                <li><code>*_CrossSection.png</code> - Your interpreted cross-section</li>
                <li><code>*_Wheeler.png</code> - Your constructed Wheeler diagram</li>
            </ul>
        </div>

        <h2>Section 2: Interpretation Questions (50 points)</h2>

        <div class="question">
            <h3>
                Question 1: Geological Evolution (15 points)
                <span class="word-count">${exportData.section2.question1.wordCount} / ${exportData.section2.question1.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question1.text ? 'empty' : ''}">
                ${exportData.section2.question1.text ? escapeHtml(exportData.section2.question1.text) : 'No answer provided'}
            </div>
        </div>

        <div class="question">
            <h3>
                Question 2: Shoreline Trajectories (${exportData.section2.question2.maxPoints} points)
                <span class="word-count">${exportData.section2.question2.wordCount} / ${exportData.section2.question2.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question2.text ? 'empty' : ''}">
                ${exportData.section2.question2.text ? escapeHtml(exportData.section2.question2.text) : 'No answer provided'}
            </div>
        </div>

        <div class="question">
            <h3>
                Question 3: Surfaces and System Tracts (${exportData.section2.question3.maxPoints} points)
                <span class="word-count">${exportData.section2.question3.wordCount} / ${exportData.section2.question3.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question3.text ? 'empty' : ''}">
                ${exportData.section2.question3.text ? escapeHtml(exportData.section2.question3.text) : 'No answer provided'}
            </div>
        </div>

        <div class="question">
            <h3>
                Question 4 (BONUS): Drilling Site Selection (${exportData.section2.question4.maxPoints} points)
                <span class="word-count">${exportData.section2.question4.wordCount} / ${exportData.section2.question4.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question4.text ? 'empty' : ''}">
                ${exportData.section2.question4.text ? escapeHtml(exportData.section2.question4.text) : 'No answer provided'}
            </div>
        </div>

        <div class="files-note">
            <h4>📁 Exported Files</h4>
            <ul>
                <li><strong>This file</strong> - Summary of your exam submission (HTML)</li>
                <li><strong>*_CrossSection.png</strong> - Your interpreted clinoform cross-section</li>
                <li><strong>*_Wheeler.png</strong> - Your constructed Wheeler diagram</li>
                <li><strong>*_Data.json</strong> - Machine-readable data (for grading system)</li>
            </ul>
            <p style="margin-top: 10px; font-size: 0.9rem;"><em>Please keep all files together when submitting your exam.</em></p>
        </div>

        <footer>
            Exam submitted: ${new Date(exportData.metadata.submissionTime).toLocaleString()}<br>
            Course: ${exportData.metadata.courseCode} - ${exportData.metadata.courseName}
        </footer>
    </div>
</body>
</html>
        `;
    },

    /**
     * Download HTML report
     * @param {Object} exportData
     * @param {string} filename
     */
    downloadHTMLReport(exportData, filename) {
        const html = this.generateHTMLReport(exportData);
        const blob = new Blob([html], { type: 'text/html' });
        this.downloadBlob(blob, filename);
    },

    /**
     * Download HTML report with embedded images
     * @param {Object} exportData
     * @param {string} crossSectionDataURL - Base64 data URL for cross-section image
     * @param {string} wheelerDataURL - Base64 data URL for Wheeler diagram image
     * @param {string} filename
     */
    downloadHTMLReportWithImages(exportData, crossSectionDataURL, wheelerDataURL, filename) {
        const html = this.generateHTMLReportWithImages(exportData, crossSectionDataURL, wheelerDataURL);
        const blob = new Blob([html], { type: 'text/html' });
        this.downloadBlob(blob, filename);
    },

    /**
     * Generate and download PDF report (non-editable format)
     * @param {Object} exportData
     * @param {string} crossSectionDataURL
     * @param {string} wheelerDataURL
     * @param {string} filename
     */
    async downloadPDFReport(exportData, crossSectionDataURL, wheelerDataURL, filename) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // Helper to add text with word wrap
        const addWrappedText = (text, x, startY, maxWidth, lineHeight = 5) => {
            const lines = pdf.splitTextToSize(text, maxWidth);
            lines.forEach((line, i) => {
                if (startY + (i * lineHeight) > pageHeight - margin) {
                    pdf.addPage();
                    startY = margin;
                }
                pdf.text(line, x, startY + (i * lineHeight));
            });
            return startY + (lines.length * lineHeight);
        };

        // Header
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Wheeler Exercise 7 - Submission', margin, y);
        y += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Student: ${exportData.metadata.studentName} (${exportData.metadata.studentId})`, margin, y);
        y += 6;
        pdf.text(`Submitted: ${new Date(exportData.metadata.submissionTime).toLocaleString()}`, margin, y);
        y += 6;
        pdf.text(`Time Spent: ${Math.floor(exportData.metadata.timeSpent / 60000)} minutes`, margin, y);
        y += 10;

        // Cross-section diagram
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('a. Cross-Section Interpretation', margin, y);
        y += 5;

        if (crossSectionDataURL) {
            try {
                const imgWidth = pageWidth - (2 * margin);
                const imgHeight = imgWidth * 0.4; // Approximate aspect ratio
                if (y + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }
                pdf.addImage(crossSectionDataURL, 'PNG', margin, y, imgWidth, imgHeight);
                y += imgHeight + 8;
            } catch (e) {
                console.error('Error adding cross-section to PDF:', e);
                pdf.setFontSize(10);
                pdf.text('[Cross-section image could not be embedded]', margin, y);
                y += 8;
            }
        }

        // Wheeler diagram
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        if (y > pageHeight - 80) {
            pdf.addPage();
            y = margin;
        }
        pdf.text('b. Wheeler Diagram', margin, y);
        y += 5;

        if (wheelerDataURL) {
            try {
                const imgWidth = pageWidth - (2 * margin);
                const imgHeight = imgWidth * 0.4;
                if (y + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }
                pdf.addImage(wheelerDataURL, 'PNG', margin, y, imgWidth, imgHeight);
                y += imgHeight + 10;
            } catch (e) {
                console.error('Error adding Wheeler diagram to PDF:', e);
                pdf.setFontSize(10);
                pdf.text('[Wheeler diagram image could not be embedded]', margin, y);
                y += 10;
            }
        }

        // Questions section
        pdf.addPage();
        y = margin;
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Interpretation Questions', margin, y);
        y += 10;

        // Question 1
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Question 1: Geological Evolution', margin, y);
        y += 6;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const q1Text = exportData.section2.question1.text || 'No answer provided';
        y = addWrappedText(q1Text, margin, y, pageWidth - (2 * margin));
        y += 8;

        // Question 2
        if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Question 2: Shoreline Trajectories', margin, y);
        y += 6;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const q2Text = exportData.section2.question2.text || 'No answer provided';
        y = addWrappedText(q2Text, margin, y, pageWidth - (2 * margin));
        y += 8;

        // Question 3
        if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Question 3: Surfaces and System Tracts', margin, y);
        y += 6;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const q3Text = exportData.section2.question3.text || 'No answer provided';
        y = addWrappedText(q3Text, margin, y, pageWidth - (2 * margin));
        y += 8;

        // Question 4 (Bonus)
        if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Question 4 (BONUS): Drilling Site Selection', margin, y);
        y += 6;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const q4Text = exportData.section2.question4?.text || 'No answer provided';
        y = addWrappedText(q4Text, margin, y, pageWidth - (2 * margin));

        // Footer on last page
        pdf.setFontSize(8);
        pdf.setTextColor(128);
        pdf.text('This document was generated automatically and is non-editable.', margin, pageHeight - 10);
        pdf.text(`Course: AS-F1 / GT-F1 - Seismo- und Sequenzstratigraphie | FAU Erlangen-Nürnberg`, margin, pageHeight - 6);

        // Save PDF
        pdf.save(filename);
    },

    /**
     * Generate HTML report with embedded images
     * @param {Object} exportData
     * @param {string} crossSectionDataURL
     * @param {string} wheelerDataURL
     * @returns {string}
     */
    generateHTMLReportWithImages(exportData, crossSectionDataURL, wheelerDataURL) {
        // Escape HTML in text answers to prevent XSS
        const escapeHtml = (text) => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br>');
        };

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Exam Submission - ${exportData.metadata.studentName} (${exportData.metadata.studentId})</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1a5276;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1a5276;
            margin: 0 0 10px 0;
            font-size: 1.8rem;
        }
        .header .course-info {
            color: #666;
            font-size: 1rem;
        }
        .student-info {
            background: linear-gradient(135deg, #1a5276, #2980b9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .student-info .info-item {
            display: flex;
            flex-direction: column;
        }
        .student-info .label {
            font-size: 0.8rem;
            opacity: 0.8;
            text-transform: uppercase;
        }
        .student-info .value {
            font-size: 1.1rem;
            font-weight: bold;
        }
        .stats-bar {
            display: flex;
            justify-content: space-around;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .stat {
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #1a5276;
        }
        .stat-label {
            font-size: 0.85rem;
            color: #666;
        }
        h2 {
            color: #1a5276;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-top: 40px;
        }
        .diagram-section {
            margin: 20px 0;
        }
        .diagram-section h3 {
            color: #333;
            margin-bottom: 15px;
        }
        .diagram-image {
            width: 100%;
            max-width: 100%;
            border: 2px solid #ddd;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .question {
            margin-bottom: 35px;
            page-break-inside: avoid;
        }
        .question h3 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .word-count {
            font-size: 0.85rem;
            color: #666;
            font-weight: normal;
            background: #f0f0f0;
            padding: 3px 10px;
            border-radius: 4px;
        }
        .answer {
            background: #fafafa;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 4px;
            min-height: 100px;
        }
        .answer.empty {
            color: #999;
            font-style: italic;
        }
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.85rem;
            text-align: center;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 20px; }
            .question { page-break-inside: avoid; }
            .diagram-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sequence Stratigraphy Examination</h1>
            <div class="course-info">
                ${exportData.metadata.courseName} | ${exportData.metadata.university} | ${exportData.metadata.semester}
            </div>
        </div>

        <div class="student-info">
            <div class="info-item">
                <span class="label">Student Name</span>
                <span class="value">${exportData.metadata.studentName}</span>
            </div>
            <div class="info-item">
                <span class="label">Student ID</span>
                <span class="value">${exportData.metadata.studentId}</span>
            </div>
            <div class="info-item">
                <span class="label">Submission Time</span>
                <span class="value">${new Date(exportData.metadata.submissionTime).toLocaleString()}</span>
            </div>
            <div class="info-item">
                <span class="label">Time Spent</span>
                <span class="value">${exportData.metadata.timeSpentFormatted}</span>
            </div>
        </div>

        <div class="stats-bar">
            <div class="stat">
                <div class="stat-value">${exportData.section1.crossSection.elementCount}</div>
                <div class="stat-label">Cross-Section Elements</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.section1.wheeler.elementCount}</div>
                <div class="stat-label">Wheeler Elements</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.statistics.totalWords}</div>
                <div class="stat-label">Total Words</div>
            </div>
            <div class="stat">
                <div class="stat-value">${exportData.statistics.completionPercentage}%</div>
                <div class="stat-label">Completion</div>
            </div>
        </div>

        <h2>Section 1: Wheeler Diagram Construction (50 points)</h2>

        <div class="diagram-section">
            <h3>Cross-Section Interpretation</h3>
            ${crossSectionDataURL ? `<img src="${crossSectionDataURL}" alt="Cross-Section Interpretation" class="diagram-image">` : '<p><em>No cross-section drawing submitted</em></p>'}
        </div>

        <div class="diagram-section">
            <h3>Wheeler Diagram (Chronostratigraphic Chart)</h3>
            ${wheelerDataURL ? `<img src="${wheelerDataURL}" alt="Wheeler Diagram" class="diagram-image">` : '<p><em>No Wheeler diagram submitted</em></p>'}
        </div>

        <h2>Section 2: Interpretation Questions (50 points)</h2>

        <div class="question">
            <h3>
                Question 1: Geological Evolution (15 points)
                <span class="word-count">${exportData.section2.question1.wordCount} / ${exportData.section2.question1.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question1.text ? 'empty' : ''}">
                ${exportData.section2.question1.text ? escapeHtml(exportData.section2.question1.text) : 'No answer provided'}
            </div>
        </div>

        <div class="question">
            <h3>
                Question 2: Accommodation and Sediment Supply (20 points)
                <span class="word-count">${exportData.section2.question2.wordCount} / ${exportData.section2.question2.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question2.text ? 'empty' : ''}">
                ${exportData.section2.question2.text ? escapeHtml(exportData.section2.question2.text) : 'No answer provided'}
            </div>
        </div>

        <div class="question">
            <h3>
                Question 3: Sequence Stratigraphic Surfaces and Facies (15 points)
                <span class="word-count">${exportData.section2.question3.wordCount} / ${exportData.section2.question3.maxWords} words</span>
            </h3>
            <div class="answer ${!exportData.section2.question3.text ? 'empty' : ''}">
                ${exportData.section2.question3.text ? escapeHtml(exportData.section2.question3.text) : 'No answer provided'}
            </div>
        </div>

        <footer>
            Exam submitted: ${new Date(exportData.metadata.submissionTime).toLocaleString()}<br>
            Course: ${exportData.metadata.courseCode} - ${exportData.metadata.courseName}<br>
            <small>This document contains the complete exam submission including all diagrams and written answers.</small>
        </footer>
    </div>
</body>
</html>
        `;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExamExport;
}
