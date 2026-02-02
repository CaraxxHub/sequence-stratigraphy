/**
 * Sequence Stratigraphy Exam - Storage Module
 * Handles localStorage for auto-save and state persistence
 */

const ExamStorage = {
    KEY: 'sequenceStratExam_v1',
    BACKUP_KEY: 'sequenceStratExam_backup',

    /**
     * Check if localStorage is available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Save exam state
     * @param {Object} state - The exam state to save
     * @returns {boolean} - Whether save was successful
     */
    save(state) {
        if (!this.isAvailable()) {
            console.warn('localStorage not available, cannot save');
            return false;
        }

        try {
            const data = {
                version: '1.0',
                timestamp: Date.now(),
                ...state
            };

            // Create backup of previous save
            const existing = localStorage.getItem(this.KEY);
            if (existing) {
                localStorage.setItem(this.BACKUP_KEY, existing);
            }

            localStorage.setItem(this.KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save exam state:', e);

            // Handle quota exceeded
            if (e.name === 'QuotaExceededError') {
                this.handleQuotaExceeded();
            }

            return false;
        }
    },

    /**
     * Load exam state
     * @returns {Object|null} - The saved exam state or null
     */
    load() {
        if (!this.isAvailable()) {
            console.warn('localStorage not available');
            return null;
        }

        try {
            const data = localStorage.getItem(this.KEY);
            if (!data) return null;

            const parsed = JSON.parse(data);

            // Validate data structure
            if (!this.validateState(parsed)) {
                console.warn('Invalid saved state, attempting backup');
                return this.loadBackup();
            }

            return parsed;
        } catch (e) {
            console.error('Failed to load exam state:', e);
            return this.loadBackup();
        }
    },

    /**
     * Load backup state
     * @returns {Object|null}
     */
    loadBackup() {
        try {
            const backup = localStorage.getItem(this.BACKUP_KEY);
            if (!backup) return null;

            const parsed = JSON.parse(backup);
            if (this.validateState(parsed)) {
                return parsed;
            }
        } catch (e) {
            console.error('Failed to load backup:', e);
        }
        return null;
    },

    /**
     * Validate state structure
     * @param {Object} state
     * @returns {boolean}
     */
    validateState(state) {
        if (!state || typeof state !== 'object') return false;
        if (!state.timestamp) return false;
        // Add more validation as needed
        return true;
    },

    /**
     * Clear saved exam state
     */
    clear() {
        if (!this.isAvailable()) return;

        try {
            localStorage.removeItem(this.KEY);
            localStorage.removeItem(this.BACKUP_KEY);
        } catch (e) {
            console.error('Failed to clear storage:', e);
        }
    },

    /**
     * Check if saved exam exists
     * @returns {boolean}
     */
    exists() {
        if (!this.isAvailable()) return false;
        return localStorage.getItem(this.KEY) !== null;
    },

    /**
     * Get save timestamp
     * @returns {number|null}
     */
    getTimestamp() {
        const state = this.load();
        return state ? state.timestamp : null;
    },

    /**
     * Handle quota exceeded error
     */
    handleQuotaExceeded() {
        console.warn('Storage quota exceeded, attempting cleanup');

        // Try to clear old backups
        try {
            localStorage.removeItem(this.BACKUP_KEY);

            // Try to compress current data by removing canvas images
            const current = localStorage.getItem(this.KEY);
            if (current) {
                const parsed = JSON.parse(current);

                // Remove canvas images to save space
                if (parsed.crossSectionCanvas) {
                    delete parsed.crossSectionCanvas.image;
                }
                if (parsed.wheelerCanvas) {
                    delete parsed.wheelerCanvas.image;
                }

                localStorage.setItem(this.KEY, JSON.stringify(parsed));
            }
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    },

    /**
     * Get storage usage info
     * @returns {Object}
     */
    getStorageInfo() {
        if (!this.isAvailable()) {
            return { available: false };
        }

        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage.getItem(key).length * 2; // UTF-16
                }
            }

            const examData = localStorage.getItem(this.KEY);
            const examSize = examData ? examData.length * 2 : 0;

            return {
                available: true,
                totalUsed: total,
                examDataSize: examSize,
                estimatedLimit: 5 * 1024 * 1024 // 5MB typical limit
            };
        } catch (e) {
            return { available: true, error: e.message };
        }
    },

    /**
     * Export state as downloadable JSON
     * @returns {string} - JSON string
     */
    exportState() {
        const state = this.load();
        return state ? JSON.stringify(state, null, 2) : null;
    },

    /**
     * Import state from JSON string
     * @param {string} jsonString
     * @returns {boolean}
     */
    importState(jsonString) {
        try {
            const state = JSON.parse(jsonString);
            if (this.validateState(state)) {
                return this.save(state);
            }
            return false;
        } catch (e) {
            console.error('Failed to import state:', e);
            return false;
        }
    }
};

/**
 * Auto-save manager
 */
class AutoSaveManager {
    constructor(options = {}) {
        this.interval = options.interval || 30000; // 30 seconds default
        this.onSave = options.onSave || (() => {});
        this.onError = options.onError || (() => {});
        this.getState = options.getState || (() => ({}));

        this.intervalId = null;
        this.lastSaveTime = null;
        this.saveCount = 0;
        this.isEnabled = true;
    }

    /**
     * Start auto-save
     */
    start() {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            if (this.isEnabled) {
                this.save();
            }
        }, this.interval);

        // Initial save
        this.save();
    }

    /**
     * Stop auto-save
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Perform a save
     */
    save() {
        try {
            const state = this.getState();
            const success = ExamStorage.save(state);

            if (success) {
                this.lastSaveTime = Date.now();
                this.saveCount++;
                this.onSave({
                    timestamp: this.lastSaveTime,
                    saveCount: this.saveCount
                });
            } else {
                this.onError({ message: 'Save failed' });
            }
        } catch (e) {
            console.error('Auto-save error:', e);
            this.onError({ message: e.message });
        }
    }

    /**
     * Force an immediate save
     */
    forceSave() {
        this.save();
    }

    /**
     * Enable/disable auto-save
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * Get last save time
     */
    getLastSaveTime() {
        return this.lastSaveTime;
    }

    /**
     * Format last save time for display
     */
    getLastSaveTimeFormatted() {
        if (!this.lastSaveTime) return 'Never';

        const date = new Date(this.lastSaveTime);
        return date.toLocaleTimeString();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExamStorage, AutoSaveManager };
}
