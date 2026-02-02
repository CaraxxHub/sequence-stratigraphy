/**
 * Sequence Stratigraphy Exam - Timer Module
 * Handles exam countdown timer with warnings
 * Uses real-time tracking to persist across tab switches
 */

class ExamTimer {
    constructor(options = {}) {
        this.duration = options.duration || 2 * 60 * 60 * 1000; // 2 hours default
        this.remaining = this.duration;
        this.onTick = options.onTick || (() => {});
        this.onWarning = options.onWarning || (() => {});
        this.onExpire = options.onExpire || (() => {});
        this.storageKey = options.storageKey || 'examTimerState';

        // Warning times in milliseconds
        this.warningTimes = [
            30 * 60 * 1000,  // 30 minutes
            15 * 60 * 1000,  // 15 minutes
            5 * 60 * 1000    // 5 minutes
        ];
        this.warningsShown = new Set();

        this.intervalId = null;
        this.endTime = null;  // Absolute end time (Date.now() + remaining)
        this.isRunning = false;

        // Bind visibility change handler
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * Start the timer
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;

        // Set absolute end time based on remaining time
        this.endTime = Date.now() + this.remaining;

        // Save state to localStorage
        this.saveState();

        // Initial tick
        this.updateRemaining();
        this.onTick(this.remaining, this.getTimerClass());

        // Use requestAnimationFrame-friendly interval for accurate timing
        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);

        // Listen for visibility changes to handle tab switching
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Also handle window focus/blur for additional reliability
        window.addEventListener('focus', this.handleVisibilityChange);
    }

    /**
     * Handle visibility change (tab switch)
     */
    handleVisibilityChange() {
        if (this.isRunning) {
            // Immediately update remaining time based on real clock
            this.updateRemaining();
            this.onTick(this.remaining, this.getTimerClass());

            // Check if expired while tab was hidden
            if (this.remaining <= 0) {
                this.stop();
                this.remaining = 0;
                this.onExpire();
            }
        }
    }

    /**
     * Update remaining time based on absolute end time
     */
    updateRemaining() {
        if (this.endTime) {
            this.remaining = Math.max(0, this.endTime - Date.now());
        }
    }

    /**
     * Internal tick function
     */
    tick() {
        // Calculate remaining from absolute end time (not decrement)
        this.updateRemaining();

        // Check for warnings
        this.warningTimes.forEach(time => {
            if (this.remaining <= time && this.remaining > time - 1500 && !this.warningsShown.has(time)) {
                this.warningsShown.add(time);
                this.onWarning(Math.floor(time / 60000));
                this.saveState();
            }
        });

        // Update display
        this.onTick(this.remaining, this.getTimerClass());

        // Save state periodically (every 10 seconds)
        if (Math.floor(this.remaining / 1000) % 10 === 0) {
            this.saveState();
        }

        // Check for expiry
        if (this.remaining <= 0) {
            this.stop();
            this.remaining = 0;
            this.clearState();
            this.onExpire();
        }
    }

    /**
     * Stop the timer
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;

        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('focus', this.handleVisibilityChange);
    }

    /**
     * Pause the timer
     */
    pause() {
        if (!this.isRunning) return;
        this.updateRemaining();
        this.stop();
        this.saveState();
    }

    /**
     * Resume the timer
     */
    resume() {
        if (this.isRunning) return;
        this.start();
    }

    /**
     * Save timer state to localStorage
     */
    saveState() {
        try {
            const state = {
                endTime: this.endTime,
                warningsShown: Array.from(this.warningsShown),
                duration: this.duration
            };
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Could not save timer state:', e);
        }
    }

    /**
     * Load timer state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const state = JSON.parse(saved);
                if (state.endTime) {
                    this.endTime = state.endTime;
                    this.remaining = Math.max(0, this.endTime - Date.now());
                    this.warningsShown = new Set(state.warningsShown || []);
                    return true;
                }
            }
        } catch (e) {
            console.warn('Could not load timer state:', e);
        }
        return false;
    }

    /**
     * Clear saved timer state
     */
    clearState() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.warn('Could not clear timer state:', e);
        }
    }

    /**
     * Get the CSS class for timer color
     */
    getTimerClass() {
        if (this.remaining > 30 * 60 * 1000) {
            return 'safe';
        } else if (this.remaining > 15 * 60 * 1000) {
            return 'warning';
        } else if (this.remaining > 5 * 60 * 1000) {
            return 'warning';
        } else {
            return 'danger';
        }
    }

    /**
     * Format time as HH:MM:SS
     */
    static formatTime(ms) {
        if (ms < 0) ms = 0;

        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
    }

    /**
     * Get remaining time in milliseconds
     */
    getRemaining() {
        this.updateRemaining();
        return this.remaining;
    }

    /**
     * Set remaining time in milliseconds
     */
    setRemaining(ms) {
        this.remaining = Math.max(0, ms);
        this.endTime = Date.now() + this.remaining;
        this.warningsShown.clear();

        // Re-check which warnings have already passed
        this.warningTimes.forEach(time => {
            if (this.remaining <= time) {
                this.warningsShown.add(time);
            }
        });

        this.saveState();
        this.onTick(this.remaining, this.getTimerClass());
    }

    /**
     * Get time spent so far
     */
    getTimeSpent() {
        this.updateRemaining();
        return this.duration - this.remaining;
    }

    /**
     * Check if timer is running
     */
    isActive() {
        return this.isRunning;
    }

    /**
     * Reset the timer to initial duration
     */
    reset() {
        this.stop();
        this.remaining = this.duration;
        this.endTime = null;
        this.warningsShown.clear();
        this.clearState();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExamTimer;
}
