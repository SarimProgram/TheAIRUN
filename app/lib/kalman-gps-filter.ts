// app/lib/kalman-gps-filter.ts

/**
 * Kalman GPS Filter
 *
 * A lightweight 1D Kalman filter applied independently to lat/lon.
 * This is the key technique used by apps like Strava for GPS smoothing.
 *
 * The filter works by:
 * 1. Predicting the next position based on current state
 * 2. Updating the prediction based on new measurement, weighted by uncertainty
 * 3. Outputting a smoothed position that reduces jitter
 *
 * How it reduces jitter:
 * - When you're stationary, GPS readings jump around due to signal noise
 * - The Kalman filter weights each new reading based on its accuracy
 * - Inaccurate readings get less weight, so the position stays stable
 * - The processNoise parameter controls how fast the filter reacts to real movement
 */
export class KalmanGPSFilter {
    // State: estimated lat/lon
    private lat: number = 0;
    private lon: number = 0;

    // Variance (uncertainty) of our estimate
    private variance: number = 1;

    // Process noise: how much we expect position to change per update
    // Lower = smoother but slower to react
    // Higher = more responsive but less smooth
    // Recommended: 2-4 for running/walking apps
    private readonly processNoise: number;

    // Initialized flag
    private initialized: boolean = false;

    /**
     * Create a new Kalman GPS Filter
     * @param processNoise How much position is expected to change per update (default: 3)
     *                     Lower values = smoother but slower to react
     *                     Higher values = more responsive but less smooth
     */
    constructor(processNoise: number = 3) {
        this.processNoise = processNoise;
    }

    /**
     * Process a new GPS reading and return smoothed coordinates
     * @param rawLat Raw latitude from GPS
     * @param rawLon Raw longitude from GPS
     * @param accuracy GPS accuracy in meters (lower = more accurate)
     * @returns Smoothed latitude and longitude
     */
    filter(
        rawLat: number,
        rawLon: number,
        accuracy: number
    ): { lat: number; lon: number } {
        // Measurement noise is based on GPS accuracy
        // We square it because variance is in squared units
        const measurementNoise = accuracy * accuracy;

        if (!this.initialized) {
            // First reading: use raw values as initial estimate
            this.lat = rawLat;
            this.lon = rawLon;
            this.variance = measurementNoise;
            this.initialized = true;
            return { lat: this.lat, lon: this.lon };
        }

        // Prediction step: increase uncertainty over time
        // This models the idea that the user might have moved since last update
        this.variance += this.processNoise;

        // Kalman gain: determines how much to trust the new measurement
        // When gain is high (close to 1): we trust the new measurement more
        // When gain is low (close to 0): we trust our prediction more
        // High accuracy (low measurementNoise) = high gain
        const gain = this.variance / (this.variance + measurementNoise);

        // Update step: blend prediction with measurement
        // new_estimate = prediction + gain * (measurement - prediction)
        this.lat += gain * (rawLat - this.lat);
        this.lon += gain * (rawLon - this.lon);

        // Update variance: our estimate is now more certain
        this.variance *= 1 - gain;

        return { lat: this.lat, lon: this.lon };
    }

    /**
     * Get the current estimated position without processing a new reading
     */
    getCurrentPosition(): { lat: number; lon: number } | null {
        if (!this.initialized) return null;
        return { lat: this.lat, lon: this.lon };
    }

    /**
     * Reset the filter state (call when starting a new run)
     */
    reset(): void {
        this.initialized = false;
        this.variance = 1;
        this.lat = 0;
        this.lon = 0;
    }

    /**
     * Check if the filter has been initialized with at least one reading
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}
