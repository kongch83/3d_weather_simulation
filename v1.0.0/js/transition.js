import * as THREE from 'three';

// Transition Engine Configuration
export const LERP_FACTOR = 0.02; // Smooth 5-10 seconds transition

// Base Presets for Time of Day
export const TIME_PRESETS = {
    morning: {
        skyColor: new THREE.Color('#818cf8'), // Soft indigo/lavender dawn sky
        ambientColor: new THREE.Color('#eedcff'), // Soft warm violet ambient
        ambientIntensity: 0.75,
        sunColor: new THREE.Color('#ffedd5'), // Warm golden sunrise sun
        sunIntensity: 0.95,
        sunPos: new THREE.Vector3(0, 16, -50), // Low rising sun angle
        buildingEmissive: 0.35, // Neon lights slowly fading out
        waterColor: new THREE.Color('#38bdf8')
    },
    day: {
        skyColor: new THREE.Color('#38bdf8'), // Vibrant blue
        ambientColor: new THREE.Color('#f0f9ff'),
        ambientIntensity: 1.0,
        sunColor: new THREE.Color('#fbbf24'),
        sunIntensity: 1.4,
        sunPos: new THREE.Vector3(0, 38, -50), // Centered horizontally, high in the sky to clear buildings
        buildingEmissive: 0.05, // Almost off
        waterColor: new THREE.Color('#38bdf8')
    },
    sunset: {
        skyColor: new THREE.Color('#f97316'), // Rich orange/pink sky
        ambientColor: new THREE.Color('#ffedd5'),
        ambientIntensity: 0.65,
        sunColor: new THREE.Color('#fdba74'),
        sunIntensity: 1.0,
        sunPos: new THREE.Vector3(0, 24, -50), // Centered horizontally, mid-height above center skyscrapers
        buildingEmissive: 0.6, // Start turning on
        waterColor: new THREE.Color('#38bdf8')
    },
    night: {
        skyColor: new THREE.Color('#0c1530'), // Lighter deep blue
        ambientColor: new THREE.Color('#2e2a72'), // Lighter rich indigo-purple
        ambientIntensity: 0.45, // Increased ambient light
        sunColor: new THREE.Color('#a5b4fc'), // Moonlight tint
        sunIntensity: 0.45, // Stronger moonlight
        sunPos: new THREE.Vector3(0, 34, -50), // Centered horizontally, high moon clear of buildings
        buildingEmissive: 1.0, // Fully illuminated neon lights
        waterColor: new THREE.Color('#38bdf8') // Lighter water color
    }
};

// Modifiers for Weather Conditions
export const WEATHER_MODIFIERS = {
    clear: {
        intensityScale: 1.0,
        skyColorScale: new THREE.Color('#ffffff'),
        fogDensity: 0.0008, // Lower density to keep buildings visible (92% visible at 100 units)
        fogColor: null, // Dynamic: uses skyColor
        rainIntensity: 0.0,
        lightningChance: 0.0,
        waterRoughness: 0.1,
        waterDistortion: 1.0,
        cloudiness: 0.2
    },
    cloudy: {
        intensityScale: 0.5,
        skyColorScale: new THREE.Color('#5b6f82'), // Gray tint
        fogDensity: 0.0035, // Skyline is ~70% visible, giving cloudy mood
        fogColor: new THREE.Color('#4a5768'),
        rainIntensity: 0.0,
        lightningChance: 0.0,
        waterRoughness: 0.35,
        waterDistortion: 1.6,
        cloudiness: 1.0
    },
    rainy: {
        intensityScale: 0.25,
        skyColorScale: new THREE.Color('#3d4a58'), // Dark gray-blue tint
        fogDensity: 0.0065, // Skyline is ~52% visible, mist and rain effect
        fogColor: new THREE.Color('#2d3844'),
        rainIntensity: 0.95,
        lightningChance: 0.0,
        waterRoughness: 0.65,
        waterDistortion: 2.8,
        cloudiness: 1.0
    },
    thunderstorm: {
        intensityScale: 0.12,
        skyColorScale: new THREE.Color('#19222c'), // Very dark overcast
        fogDensity: 0.0085, // Skyline is ~43% visible
        fogColor: new THREE.Color('#111822'),
        rainIntensity: 1.6, // Heavy rain
        lightningChance: 0.04, // 4% chance of lightning trigger per frame
        waterRoughness: 0.85,
        waterDistortion: 3.8,
        cloudiness: 1.0
    },
    foggy: {
        intensityScale: 0.4,
        skyColorScale: new THREE.Color('#ccd6e2'), // Pale gray
        fogDensity: 0.020, // Thick mist, skyline is ~13% visible but still discernable
        fogColor: new THREE.Color('#9daec2'),
        rainIntensity: 0.0,
        lightningChance: 0.0,
        waterRoughness: 0.2,
        waterDistortion: 0.85,
        cloudiness: 0.4
    },
    windy: {
        intensityScale: 0.7,
        skyColorScale: new THREE.Color('#859bb0'), // Slate gray-blue sky
        fogDensity: 0.002, // Clear but slightly dusty/misty air
        fogColor: new THREE.Color('#64748b'),
        rainIntensity: 0.0,
        lightningChance: 0.0,
        waterRoughness: 0.8, // Rough water surface
        waterDistortion: 3.5, // Fast/violent water wave distortion
        cloudiness: 0.7
    }
};

export class TransitionEngine {
    constructor() {
        // Initialize current state with default Day/Clear values
        this.currentState = {
            skyColor: new THREE.Color('#38bdf8'),
            ambientColor: new THREE.Color('#f0f9ff'),
            ambientIntensity: 0.85,
            sunColor: new THREE.Color('#fef08a'),
            sunIntensity: 1.25,
            sunPos: new THREE.Vector3(60, 75, -45),
            buildingEmissive: 0.05,
            waterColor: new THREE.Color('#0284c7'),
            waterRoughness: 0.1,
            waterDistortion: 1.0,
            fogDensity: 0.003,
            fogColor: new THREE.Color('#38bdf8'),
            rainIntensity: 0.0,
            lightningChance: 0.0,
            currentRainfall: 0.0,
            cloudiness: 0.2
        };

        // Initialize target state identical to current
        this.targetState = JSON.parse(JSON.stringify(this.currentState));
        // Deep copy vector/color objects
        this.targetState.skyColor = this.currentState.skyColor.clone();
        this.targetState.ambientColor = this.currentState.ambientColor.clone();
        this.targetState.sunColor = this.currentState.sunColor.clone();
        this.targetState.sunPos = this.currentState.sunPos.clone();
        this.targetState.waterColor = this.currentState.waterColor.clone();
        this.targetState.fogColor = this.currentState.fogColor.clone();
    }

    /**
     * Compute new targets based on combination of Weather and Time of Day
     */
    setTarget(weather, timeOfDay, currentRainfall = 0) {
        const timePreset = TIME_PRESETS[timeOfDay] || TIME_PRESETS.day;
        const weatherMod = WEATHER_MODIFIERS[weather] || WEATHER_MODIFIERS.clear;

        // 1. Sky Color (blend preset sky with gray scale modifiers)
        this.targetState.skyColor.copy(timePreset.skyColor).multiply(weatherMod.skyColorScale);

        // 2. Ambient Lighting
        this.targetState.ambientColor.copy(timePreset.ambientColor).multiply(weatherMod.skyColorScale);
        this.targetState.ambientIntensity = timePreset.ambientIntensity * weatherMod.intensityScale;

        // 3. Sun/Moon Light
        this.targetState.sunColor.copy(timePreset.sunColor);
        this.targetState.sunIntensity = timePreset.sunIntensity * weatherMod.intensityScale;
        this.targetState.sunPos.copy(timePreset.sunPos);

        // 4. Building lights (turn them on during storm even in day/morning)
        if (weather === 'thunderstorm' && (timeOfDay === 'day' || timeOfDay === 'morning')) {
            this.targetState.buildingEmissive = 0.5; // Turn lights on halfway due to dark storm
        } else {
            this.targetState.buildingEmissive = timePreset.buildingEmissive;
        }

        // 5. Water
        this.targetState.waterColor.copy(timePreset.waterColor).multiply(weatherMod.skyColorScale);
        this.targetState.waterRoughness = weatherMod.waterRoughness;
        this.targetState.waterDistortion = weatherMod.waterDistortion;

        // 6. Fog
        this.targetState.fogDensity = weatherMod.fogDensity;
        if (weatherMod.fogColor) {
            this.targetState.fogColor.copy(weatherMod.fogColor);
        } else {
            this.targetState.fogColor.copy(this.targetState.skyColor);
        }

        // 7. Particles and weather activities (scale rain by actual hourly volume)
        if (weather === 'rainy' || weather === 'thunderstorm') {
            if (currentRainfall <= 0.01) {
                // Fallback to default preset rain intensity if HKO reports 0 rainfall volume during rainy/stormy conditions
                this.targetState.rainIntensity = weatherMod.rainIntensity;
            } else {
                // Square root scaling ensures light rain is visible but keeps extreme torrential rain visually stable
                this.targetState.rainIntensity = Math.min(2.5, 0.15 + Math.sqrt(currentRainfall) * 0.25);
            }
        } else {
            this.targetState.rainIntensity = weatherMod.rainIntensity;
        }
        this.targetState.lightningChance = weatherMod.lightningChance;
        this.targetState.currentRainfall = currentRainfall;
        this.targetState.cloudiness = weatherMod.cloudiness;

        console.log(`Transition targets updated - Weather: ${weather}, Time: ${timeOfDay}, Rainfall: ${currentRainfall}mm, Intensity: ${this.targetState.rainIntensity}`);
    }

    /**
     * Frame-by-frame interpolation loop (lerp)
     */
    update() {
        const f = LERP_FACTOR;

        // Lerp scalar values
        this.currentState.ambientIntensity = THREE.MathUtils.lerp(this.currentState.ambientIntensity, this.targetState.ambientIntensity, f);
        this.currentState.sunIntensity = THREE.MathUtils.lerp(this.currentState.sunIntensity, this.targetState.sunIntensity, f);
        this.currentState.buildingEmissive = THREE.MathUtils.lerp(this.currentState.buildingEmissive, this.targetState.buildingEmissive, f);
        this.currentState.waterRoughness = THREE.MathUtils.lerp(this.currentState.waterRoughness, this.targetState.waterRoughness, f);
        this.currentState.waterDistortion = THREE.MathUtils.lerp(this.currentState.waterDistortion, this.targetState.waterDistortion, f);
        this.currentState.fogDensity = THREE.MathUtils.lerp(this.currentState.fogDensity, this.targetState.fogDensity, f);
        this.currentState.rainIntensity = THREE.MathUtils.lerp(this.currentState.rainIntensity, this.targetState.rainIntensity, f);
        this.currentState.lightningChance = THREE.MathUtils.lerp(this.currentState.lightningChance, this.targetState.lightningChance, f);
        this.currentState.currentRainfall = THREE.MathUtils.lerp(this.currentState.currentRainfall, this.targetState.currentRainfall, f);
        this.currentState.cloudiness = THREE.MathUtils.lerp(this.currentState.cloudiness, this.targetState.cloudiness, f);

        // Lerp colors
        this.currentState.skyColor.lerp(this.targetState.skyColor, f);
        this.currentState.ambientColor.lerp(this.targetState.ambientColor, f);
        this.currentState.sunColor.lerp(this.targetState.sunColor, f);
        this.currentState.waterColor.lerp(this.targetState.waterColor, f);
        this.currentState.fogColor.lerp(this.targetState.fogColor, f);

        // Lerp vectors (sun position)
        this.currentState.sunPos.lerp(this.targetState.sunPos, f);
    }
}
