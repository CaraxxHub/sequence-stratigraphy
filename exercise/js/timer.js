/**
 * Sequence Stratigraphy Exam - Timer Module
 * Handles exam countdown timer with warnings
 */

class ExamTimer {
    constructor(options = {}) {
        this.duration = options.duration || 2 * 60 * 60 * 1000; // 2 hours default
        this.remaining = this.duration;
        this.onTick = options.onTick || (() => {});
        this.onWarning = options.onWarning || (() => {});
        this.onExpire = options.onExpire || (() => {});

        // Warning times in milliseconds
        this.warningTimes = [
            30 * 60 * 1000,  // 30 minutes
            15 * 60 * 1000,  // 15 minutes
            5 * 60 * 1000    // 5 minutes
        ];
        this.warningsShown = new Set();

        this.intervalId = null;
        this.startTime = null;
        this.pausedTime = null;
        this.isRunning = false;
    }

    /**
     * Start the timer
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now();

        // Initial tick
        this.onTick(this.remaining, this.getTimerClass());

        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
    }

    /**
     * Internal tick function
     */
    tick() {
        this.remaining -= 1000;

        // Check for warnings
        this.warningTimes.forEach(time => {
            if (this.remaining <= time && this.remaining > time - 1000 && !this.warningsShown.has(time)) {
                this.warningsShown.add(time);
                this.onWarning(Math.floor(time / 60000));
            }
        });

        // Update display
        this.onTick(this.remaining, this.getTimerClass());

        // Check for expiry
        if (this.remaining <= 0) {
            this.stop();
            this.remaining = 0;
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
    }

    /**
     * Pause the timer
     */
    pause() {
        if (!this.isRunning) return;
        this.stop();
        this.pausedTime = Date.now();
    }

    /**
     * Resume the timer
     */
    resume() {
        if (this.isRunning) return;
        this.start();
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
        return this.remaining;
    }

    /**
     * Set remaining time in milliseconds
     */
    setRemaining(ms) {
        this.remaining = Math.max(0, ms);
        this.warningsShown.clear();

        // Re-check which warnings have already passed
        this.warningTimes.forEach(time => {
            if (this.remaining <= time) {
                this.warningsShown.add(time);
            }
        });

        this.onTick(this.remaining, this.getTimerClass());
    }

    /**
     * Get time spent so far
     */
    getTimeSpent() {
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
        this.warningsShown.clear();
        this.startTime = null;
        this.pausedTime = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExamTimer;
}
