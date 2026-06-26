import { Weather3D } from './weather3d.js';
import { TransitionEngine } from './transition.js';
import { WeatherParticles } from './particles.js';
import { fetchHKOWeather } from './hkoApi.js';

// Web Audio API MIDI Synthesizer for "Ode to Joy"
const MIDI_NOTES = {
    'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
    'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33
};

const ODE_TO_JOY = [
    // Phrase 1
    ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
    ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
    ['E4', 1.5], ['D4', 0.5], ['D4', 2],

    // Phrase 2
    ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
    ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
    ['D4', 1.5], ['C4', 0.5], ['C4', 2],

    // Phrase 3
    ['D4', 1], ['D4', 1], ['E4', 1], ['C4', 1],
    ['D4', 1], ['E4', 0.5], ['F4', 0.5], ['E4', 1], ['C4', 1],
    ['D4', 1], ['E4', 0.5], ['F4', 0.5], ['E4', 1], ['D4', 1],
    ['C4', 1], ['D4', 1], ['G3', 2],

    // Phrase 4
    ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
    ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
    ['D4', 1.5], ['C4', 0.5], ['C4', 2]
];

class MidiSynth {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.tempo = 145; // Upbeat tempo (BPM)
        this.beatDuration = 60 / this.tempo;
        this.currentNoteIndex = 0;
        this.nextNoteTime = 0;
        this.timerId = null;
        this.gainNode = null;
    }

    start() {
        if (this.isPlaying) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        window.audioCtx = this.ctx;
        window.bgmPlaying = true;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.8, this.ctx.currentTime); // Comfortable background volume (amplified 10x)
        this.gainNode.connect(this.ctx.destination);
        this.isPlaying = true;
        this.currentNoteIndex = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.bgmPlaying = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        window.audioCtx = null;
    }

    scheduler() {
        if (!this.isPlaying) return;

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playNote(this.currentNoteIndex, this.nextNoteTime);
            const noteData = ODE_TO_JOY[this.currentNoteIndex];
            const duration = noteData[1] * this.beatDuration;
            this.nextNoteTime += duration;
            this.currentNoteIndex = (this.currentNoteIndex + 1) % ODE_TO_JOY.length;
        }

        this.timerId = setTimeout(() => this.scheduler(), 25);
    }

    playNote(index, time) {
        const noteData = ODE_TO_JOY[index];
        const name = noteData[0];
        const duration = noteData[1] * this.beatDuration;
        const freq = MIDI_NOTES[name];

        if (!freq) return;

        // Triangle lead for retro MIDI keyboard/chime sound
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        // Simple synth ADSR envelope
        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0.001, time);
        noteGain.gain.linearRampToValueAtTime(0.35, time + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.02);

        osc.connect(noteGain);
        noteGain.connect(this.gainNode);

        osc.start(time);
        osc.stop(time + duration);

        // Sub bass oscillator (sine wave, two octaves below melody) on the downbeat of each bar
        if (index % 4 === 0) {
            const bassOsc = this.ctx.createOscillator();
            bassOsc.type = 'sine';
            bassOsc.frequency.setValueAtTime(freq / 4, time);

            const bassGain = this.ctx.createGain();
            bassGain.gain.setValueAtTime(0.001, time);
            bassGain.gain.linearRampToValueAtTime(0.3, time + 0.05);
            bassGain.gain.exponentialRampToValueAtTime(0.01, time + duration * 1.5 - 0.05);

            bassOsc.connect(bassGain);
            bassGain.connect(this.gainNode);

            bassOsc.start(time);
            bassOsc.stop(time + duration * 1.5);
        }
    }
}

class App {
    constructor() {
        // UI Elements
        this.tempValEl = document.getElementById('temp-val');
        this.humidityValEl = document.getElementById('humidity-val');
        this.uvValEl = document.getElementById('uv-val');
        this.windValEl = document.getElementById('wind-val');
        this.stationValEl = document.getElementById('station-val');
        this.warningValEl = document.getElementById('warning-val');
        this.rainyPsrEl = document.getElementById('rainy-psr');
        this.weatherDescEl = document.getElementById('weather-desc');
        this.weatherIconEl = document.getElementById('weather-icon');
        this.statusIndicatorEl = document.getElementById('status-indicator');
        this.statusTextEl = document.getElementById('status-text');
        this.timerValEl = document.getElementById('timer-val');
        this.progressFillEl = document.getElementById('progress-fill');
        this.clockEl = document.getElementById('clock');
        this.sunriseValEl = document.getElementById('sunrise-val');
        this.sunsetValEl = document.getElementById('sunset-val');

        // Status Board Indicators (Read-only)
        this.weatherIndicators = document.querySelectorAll('#weather-indicators .indicator');
        this.timeIndicators = document.querySelectorAll('#time-indicators .indicator');

        // Interactive UI Controls
        this.uiContainer = document.getElementById('ui-container');
        this.toggleUiBtn = document.getElementById('toggle-ui-btn');
        this.toggleUiIcon = document.getElementById('toggle-ui-icon');
        this.resetViewBtn = document.getElementById('reset-view-btn');

        this.tabWeatherBtn = document.getElementById('tab-weather-btn');
        this.tabStatusBtn = document.getElementById('tab-status-btn');
        this.hudWeatherCard = document.getElementById('hud-weather-card');
        this.hudStatusCard = document.getElementById('hud-status-card');

        // Language Selector Elements
        this.langBtn = document.getElementById('lang-btn');
        this.langDropdownMenu = document.getElementById('lang-dropdown-menu');
        this.langChevron = document.getElementById('lang-chevron');
        this.currentLangText = document.getElementById('current-lang-text');
        this.langOptions = document.querySelectorAll('.lang-option');

        // UI States
        this.isUiVisible = true;
        this.activeTab = 'weather'; // 'weather' | 'status'

        // Application State
        this.currentMode = 'auto'; // 'auto' | 'manual'
        this.hkoWeather = null;
        this.hkoTimeOfDay = null;
        this.hkoRainfall = null;

        this.currentWeather = 'clear';
        this.currentTimeOfDay = 'day';
        this.currentRainfall = 0.0;

        // Mode Selector Buttons
        this.modeAutoBtn = document.getElementById('mode-auto-btn');
        this.modeManualBtn = document.getElementById('mode-manual-btn');

        // Timer settings (fixed 60 seconds auto-sync)
        this.countdown = 60;
        this.timerInterval = null;
        this.lastUpdateTime = null;

        // Language / i18n State
        this.currentLang = localStorage.getItem('preferred_language') || 'zh-Hant';
        this.translations = null;

        // Initialize 3D and FX Engines
        this.weather3D = new Weather3D('webgl-canvas');
        this.transitionEngine = new TransitionEngine();
        this.particles = new WeatherParticles(this.weather3D.scene, this.weather3D.clouds);
        this.midiSynth = new MidiSynth();

        this.init();
    }

    async init() {
        // 1. Start rendering loop
        this.animate();

        // Initialize transition targets immediately based on constructor defaults
        this.updateSceneTargets();

        // 2. Load translations first
        await this.loadTranslations(this.currentLang);
        this.updateLangSelectorUI(this.currentLang);
        this.applyTranslations();

        // Update initial road text based on loaded translations
        if (this.weather3D && typeof this.weather3D.updateRoadText === 'function') {
            const slowVal = this.translations.slow_driving || '慢駛';
            this.weather3D.updateRoadText(slowVal);
        }

        // 3. Setup System Clock
        this.startClock();

        // 4. Initial HKO weather load
        this.syncWithHKO();

        // 5. Setup HKO polling cycle
        this.startPollingTimer();

        // 6. Setup Interactive Event Listeners (Hide/Show UI & Mobile Tabs)
        this.setupEventListeners();
    }

    /**
     * Load JSON language file
     */
    async loadTranslations(lang) {
        const fileMap = {
            'zh-Hant': 'lang/tc.json',
            'zh-Hans': 'lang/sc.json',
            'en': 'lang/en.json'
        };
        const fileName = fileMap[lang] || 'lang/tc.json';
        try {
            const response = await fetch(fileName, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('preferred_language', lang);
            console.log(`Loaded translations successfully for lang: ${lang}`);
        } catch (err) {
            console.error(`Failed to load translation file ${fileName}:`, err);
            // Fallback empty translation object to avoid crashing
            this.translations = this.translations || {};
        }
    }

    /**
     * Update active CSS and text indicator in language selector dropdown
     */
    updateLangSelectorUI(selectedLang) {
        let langName = '繁體';
        if (selectedLang === 'zh-Hans') langName = '簡体';
        else if (selectedLang === 'en') langName = 'English';

        if (this.currentLangText) {
            this.currentLangText.textContent = langName;
        }

        this.langOptions.forEach(opt => {
            const optLang = opt.getAttribute('data-lang');
            if (optLang === selectedLang) {
                opt.className = "lang-option w-full text-left px-4 py-2 text-xs md:text-sm text-sky-400 font-semibold hover:bg-slate-900/60 transition-colors duration-150";
            } else {
                opt.className = "lang-option w-full text-left px-4 py-2 text-xs md:text-sm text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors duration-150";
            }
        });
    }

    /**
     * Apply dictionary texts to elements with data-i18n attributes
     */
    applyTranslations() {
        if (!this.translations) return;

        // 1. Apply to standard labels
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (this.translations[key]) {
                el.textContent = this.translations[key];
            }
        });

        // 2. Apply to tooltips / title attributes
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (this.translations[key]) {
                el.setAttribute('title', this.translations[key]);
            }
        });

        // 3. Update dynamic toggle title
        if (this.toggleUiBtn) {
            if (this.isUiVisible) {
                this.toggleUiBtn.setAttribute('title', this.translations.toggle_ui_title_hide || '隱藏介面');
            } else {
                this.toggleUiBtn.setAttribute('title', this.translations.toggle_ui_title_show || '顯示介面');
            }
        }
    }

    /**
     * Asynchronously change current language, re-render DOM, update 3D environment, and fetch weather
     */
    async changeLanguage(selectedLang) {
        if (selectedLang === this.currentLang && this.translations) return;

        await this.loadTranslations(selectedLang);
        this.updateLangSelectorUI(selectedLang);
        this.applyTranslations();

        // Update 3D road texture dynamically
        if (this.weather3D && typeof this.weather3D.updateRoadText === 'function') {
            const slowVal = this.translations.slow_driving || '慢駛';
            this.weather3D.updateRoadText(slowVal);
        }

        // Trigger immediate API fetch to sync texts in the selected language
        this.syncWithHKO();
    }

    /**
     * The main requestAnimationFrame rendering loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Update transition variables towards targets
        this.transitionEngine.update();

        // Update weather particle systems (rain + lightning chance)
        const rainInt = this.transitionEngine.currentState.rainIntensity;
        const lightChance = this.transitionEngine.currentState.lightningChance;
        this.particles.update(rainInt, lightChance);

        // Update and render the 3D scene (including street traffic, walking pedestrians and water)
        this.weather3D.update(this.transitionEngine.currentState, this.particles.lightningStrength);
    }

    startClock() {
        const dateEl = document.getElementById('date-display');
        const updateClock = () => {
            const now = new Date();
            const timeLocale = this.currentLang === 'en' ? 'en-US' : 'zh-HK';
            this.clockEl.textContent = now.toLocaleTimeString(timeLocale, { hour12: false });

            if (dateEl) {
                const days = this.translations && this.translations.days
                    ? this.translations.days
                    : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                const dayName = days[now.getDay()];
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const date = String(now.getDate()).padStart(2, '0');

                if (this.currentLang === 'en') {
                    dateEl.textContent = `${year}-${month}-${date} (${dayName})`;
                } else {
                    dateEl.textContent = `${year}-${month}-${date} ${dayName}`;
                }
            }
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    /**
     * Update 3D transition targets & indicators UI
     */
    updateSceneTargets() {
        this.transitionEngine.setTarget(this.currentWeather, this.currentTimeOfDay, this.currentRainfall);
        this.updateIndicatorUI(this.currentWeather, this.currentTimeOfDay);
    }

    /**
     * Fetch HKO API and feed variables to 3D and HUD layers
     */
    async syncWithHKO() {
        this.statusIndicatorEl.className = 'status-dot syncing w-2.5 h-2.5 rounded-full inline-block';
        this.statusTextEl.textContent = this.translations && this.translations.status_syncing
            ? this.translations.status_syncing
            : "獲取天文台 API 數據中...";

        try {
            // Map the selected language zh-Hant / zh-Hans / en to HKO's tc / sc / en
            let hkoLang = 'tc';
            if (this.currentLang === 'zh-Hans') hkoLang = 'sc';
            else if (this.currentLang === 'en') hkoLang = 'en';

            const data = await fetchHKOWeather(hkoLang);

            // Populate HUD elements
            this.tempValEl.textContent = data.temperature;
            this.humidityValEl.textContent = `${data.humidity}%`;
            this.uvValEl.textContent = data.uvIndex > 0 ? `${data.uvIndex} (${data.uvDesc})` : '0';
            if (this.windValEl) {
                const dir = data.windDir || '--';
                const speed = data.windSpeed || '--';
                this.windValEl.textContent = `${dir} ${speed}`;
            }

            // Resolve dynamic weather descriptions using local translation mapping
            const hkoDesc = this.translations && this.translations.hko_descriptions && this.translations.hko_descriptions[data.hkoIcon]
                ? this.translations.hko_descriptions[data.hkoIcon]
                : data.description;
            this.weatherDescEl.textContent = hkoDesc;

            if (this.sunriseValEl) this.sunriseValEl.textContent = data.sunrise || '--:--';
            if (this.sunsetValEl) this.sunsetValEl.textContent = data.sunset || '--:--';

            // Update Special Warnings with premium color coding & pulse effects
            if (this.warningValEl) {
                const noWarningText = this.translations && this.translations.no_warning
                    ? this.translations.no_warning
                    : '無特別警告';
                const warnings = data.warnings || noWarningText;
                this.warningValEl.textContent = warnings;

                // Reset classes
                this.warningValEl.className = 'value text-xs md:text-sm font-semibold mt-1';

                if (data.warningLevel === 'danger') {
                    this.warningValEl.classList.add('text-rose-400', 'animate-pulse');
                } else if (data.warningLevel === 'warning') {
                    this.warningValEl.classList.add('text-amber-400');
                } else {
                    this.warningValEl.classList.add('text-slate-400');
                }
            }

            // Update PSR text
            if (this.rainyPsrEl) {
                this.rainyPsrEl.textContent = data.psr || '--';
            }

            // Update weather icon alt text with localized string
            this.updateWeatherIcon(data.hkoIcon, hkoDesc);

            // Save latest HKO data for auto mode restoration
            this.hkoWeather = data.condition;
            this.hkoTimeOfDay = data.timeOfDay;
            this.hkoRainfall = data.rainfall;

            // Feed to 3D Scene states only if in auto mode
            if (this.currentMode === 'auto') {
                this.currentWeather = data.condition;
                this.currentTimeOfDay = data.timeOfDay;
                this.currentRainfall = data.rainfall;
                this.updateSceneTargets();
            }

            // Update status text
            this.statusIndicatorEl.className = 'status-dot online w-2.5 h-2.5 rounded-full inline-block';

            const successLabel = this.translations && this.translations.status_sync_success
                ? this.translations.status_sync_success
                : '同步成功';
            this.statusTextEl.textContent = `${successLabel} (${data.timestamp})`;
            this.lastUpdateTime = Date.now();
        } catch (error) {
            console.error(error);
            this.statusIndicatorEl.className = 'status-dot offline w-2.5 h-2.5 rounded-full inline-block';

            const failedLabel = this.translations && this.translations.status_sync_failed
                ? this.translations.status_sync_failed
                : 'API 連線失敗，10 秒後重試...';
            this.statusTextEl.textContent = failedLabel;

            // Fast-retry in case of connection drop
            setTimeout(() => {
                this.syncWithHKO();
            }, 10000);
        }
    }

    /**
     * Highlight indicators in the status board to reflect active HKO weather
     */
    updateIndicatorUI(weather, timeOfDay) {
        this.weatherIndicators.forEach(ind => {
            if (ind.getAttribute('data-weather') === weather) {
                ind.classList.add('active');
            } else {
                ind.classList.remove('active');
            }
        });

        this.timeIndicators.forEach(ind => {
            if (ind.getAttribute('data-time') === timeOfDay) {
                ind.classList.add('active');
            } else {
                ind.classList.remove('active');
            }
        });
    }

    /**
     * Start the 60-seconds loop polling timer with UI progress fill animation
     */
    startPollingTimer() {
        clearInterval(this.timerInterval);
        this.countdown = 60;
        this.timerValEl.textContent = this.countdown;

        // Reset progress bar transform
        this.progressFillEl.style.transition = 'none';
        this.progressFillEl.style.transform = 'scaleX(1)';

        // Brief delay to allow css layout recalculation
        setTimeout(() => {
            this.progressFillEl.style.transition = 'transform 60s linear';
            this.progressFillEl.style.transform = 'scaleX(0)';
        }, 50);

        this.timerInterval = setInterval(() => {
            this.countdown--;
            this.timerValEl.textContent = this.countdown;

            if (this.countdown <= 0) {
                this.syncWithHKO();
                this.startPollingTimer(); // Restart polling countdown
            }
        }, 1000);
    }

    /**
     * Update weather icon image source based on HKO API icon code
     */
    updateWeatherIcon(hkoIcon, description) {
        if (this.weatherIconEl) {
            this.weatherIconEl.src = `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${hkoIcon}.png`;
            this.weatherIconEl.alt = description || '天氣圖示';
        }
    }

    /**
     * Set up custom click/touch event listeners for UI interactions
     */
    setupEventListeners() {
        // A. Toggle UI Visibility
        if (this.toggleUiBtn && this.uiContainer) {
            console.log("Toggle UI button bound successfully.");
            this.toggleUiBtn.addEventListener('click', () => {
                console.log("Toggle UI button clicked! Target state isUiVisible:", !this.isUiVisible);
                this.isUiVisible = !this.isUiVisible;
                if (this.isUiVisible) {
                    this.uiContainer.classList.remove('ui-hidden');
                    if (this.toggleUiIcon) this.toggleUiIcon.className = 'fa-solid fa-eye-slash text-base md:text-lg';
                    const hideTitle = this.translations && this.translations.toggle_ui_title_hide ? this.translations.toggle_ui_title_hide : '隱藏介面';
                    this.toggleUiBtn.setAttribute('title', hideTitle);
                } else {
                    this.uiContainer.classList.add('ui-hidden');
                    if (this.toggleUiIcon) this.toggleUiIcon.className = 'fa-solid fa-eye text-base md:text-lg';
                    const showTitle = this.translations && this.translations.toggle_ui_title_show ? this.translations.toggle_ui_title_show : '顯示介面';
                    this.toggleUiBtn.setAttribute('title', showTitle);
                }
            });
        } else {
            console.warn("Toggle UI button or container not found in DOM!", {
                btn: this.toggleUiBtn,
                container: this.uiContainer
            });
        }

        // B. Mobile Tab Switching
        const switchTab = (tab) => {
            if (this.activeTab === tab) return;
            this.activeTab = tab;

            if (tab === 'weather') {
                // Switch Active Tab Button Styling
                if (this.tabWeatherBtn && this.tabStatusBtn) {
                    this.tabWeatherBtn.classList.add('active');
                    this.tabWeatherBtn.classList.remove('text-slate-400', 'hover:text-slate-200');

                    this.tabStatusBtn.classList.remove('active');
                    this.tabStatusBtn.classList.add('text-slate-400', 'hover:text-slate-200');
                }

                // Switch visible card
                if (this.hudWeatherCard && this.hudStatusCard) {
                    this.hudWeatherCard.classList.remove('hidden');
                    this.hudWeatherCard.classList.add('flex');

                    this.hudStatusCard.classList.add('hidden');
                    this.hudStatusCard.classList.remove('flex');
                }
            } else {
                // Switch Active Tab Button Styling
                if (this.tabWeatherBtn && this.tabStatusBtn) {
                    this.tabStatusBtn.classList.add('active');
                    this.tabStatusBtn.classList.remove('text-slate-400', 'hover:text-slate-200');

                    this.tabWeatherBtn.classList.remove('active');
                    this.tabWeatherBtn.classList.add('text-slate-400', 'hover:text-slate-200');
                }

                // Switch visible card
                if (this.hudWeatherCard && this.hudStatusCard) {
                    this.hudWeatherCard.classList.add('hidden');
                    this.hudWeatherCard.classList.remove('flex');

                    this.hudStatusCard.classList.remove('hidden');
                    this.hudStatusCard.classList.add('flex');
                }
            }
        };

        if (this.tabWeatherBtn && this.tabStatusBtn) {
            this.tabWeatherBtn.addEventListener('click', () => switchTab('weather'));
            this.tabStatusBtn.addEventListener('click', () => switchTab('status'));
        }

        // C. Reset Camera View Event
        if (this.resetViewBtn) {
            this.resetViewBtn.addEventListener('click', () => {
                if (this.weather3D && typeof this.weather3D.resetCamera === 'function') {
                    this.weather3D.resetCamera();
                }
            });
        }

        // D. Background Music Toggle Control
        this.musicToggleBtn = document.getElementById('music-toggle-btn');
        this.musicIcon = document.getElementById('music-icon');

        if (this.musicToggleBtn && this.midiSynth) {
            this.musicToggleBtn.addEventListener('click', () => {
                if (!this.midiSynth.isPlaying) {
                    try {
                        this.midiSynth.start();
                        if (this.musicIcon) {
                            this.musicIcon.className = 'fa-solid fa-volume-high text-xs md:text-sm text-sky-400 fa-beat';
                        }
                        this.musicToggleBtn.classList.add('border-sky-500/50', 'bg-sky-500/10');
                    } catch (err) {
                        console.error("Failed to start MIDI synthesizer:", err);
                    }
                } else {
                    this.midiSynth.stop();
                    if (this.musicIcon) {
                        this.musicIcon.className = 'fa-solid fa-volume-xmark text-xs md:text-sm';
                    }
                    this.musicToggleBtn.classList.remove('border-sky-500/50', 'bg-sky-500/10');
                }
            });
        }

        // E. Language Dropdown Control
        if (this.langBtn && this.langDropdownMenu) {
            const toggleDropdown = (forceClose = false) => {
                const isCurrentlyOpen = !this.langDropdownMenu.classList.contains('hidden');
                if (forceClose || isCurrentlyOpen) {
                    this.langDropdownMenu.classList.add('hidden');
                } else {
                    this.langDropdownMenu.classList.remove('hidden');
                }
            };

            this.langBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDropdown();
            });

            this.langOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedLang = option.getAttribute('data-lang');
                    this.changeLanguage(selectedLang);
                    toggleDropdown(true);
                });
            });

            // Close dropdown if clicking elsewhere in the document
            document.addEventListener('click', (e) => {
                const container = document.getElementById('lang-selector-container');
                if (container && !container.contains(e.target)) {
                    toggleDropdown(true);
                }
            });
        }

        // F. Weather & Time of Day manual override controls
        this.weatherIndicators.forEach(ind => {
            ind.addEventListener('click', () => {
                if (this.currentMode === 'manual') {
                    const weather = ind.getAttribute('data-weather');
                    this.currentWeather = weather;
                    if (weather === 'rainy') {
                        this.currentRainfall = 10.0;
                    } else if (weather === 'thunderstorm') {
                        this.currentRainfall = 15.0;
                    } else {
                        this.currentRainfall = 0.0;
                    }
                    this.updateSceneTargets();
                }
            });
        });

        this.timeIndicators.forEach(ind => {
            ind.addEventListener('click', () => {
                if (this.currentMode === 'manual') {
                    const time = ind.getAttribute('data-time');
                    this.currentTimeOfDay = time;
                    this.updateSceneTargets();
                }
            });
        });

        // G. Auto/Manual Mode Toggles
        if (this.modeAutoBtn && this.modeManualBtn) {
            this.modeAutoBtn.addEventListener('click', () => this.setMode('auto'));
            this.modeManualBtn.addEventListener('click', () => this.setMode('manual'));
        }
    }

    /**
     * Set Application Simulation Mode ('auto' | 'manual')
     */
    setMode(mode) {
        this.currentMode = mode;
        
        // Update active button styling
        if (mode === 'auto') {
            if (this.modeAutoBtn) {
                this.modeAutoBtn.className = "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all duration-300 bg-sky-500/20 text-sky-400 border border-sky-500/30";
            }
            if (this.modeManualBtn) {
                this.modeManualBtn.className = "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all duration-300 text-slate-400 hover:text-slate-200";
            }
            
            // Disable pointer events on indicators
            this.weatherIndicators.forEach(ind => {
                ind.classList.add('pointer-events-none');
                ind.classList.remove('cursor-pointer', 'hover:bg-slate-800/80', 'hover:text-slate-100', 'hover:border-slate-700');
            });
            this.timeIndicators.forEach(ind => {
                ind.classList.add('pointer-events-none');
                ind.classList.remove('cursor-pointer', 'hover:bg-slate-800/80', 'hover:text-slate-100', 'hover:border-slate-700');
            });
            
            // Revert scene to HKO weather
            if (this.hkoWeather) {
                this.currentWeather = this.hkoWeather;
                this.currentTimeOfDay = this.hkoTimeOfDay;
                this.currentRainfall = this.hkoRainfall;
                this.updateSceneTargets();
            }
        } else {
            if (this.modeManualBtn) {
                this.modeManualBtn.className = "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all duration-300 bg-sky-500/20 text-sky-400 border border-sky-500/30";
            }
            if (this.modeAutoBtn) {
                this.modeAutoBtn.className = "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all duration-300 text-slate-400 hover:text-slate-200";
            }
            
            // Enable pointer events on indicators
            this.weatherIndicators.forEach(ind => {
                ind.classList.remove('pointer-events-none');
                ind.classList.add('cursor-pointer', 'hover:bg-slate-800/80', 'hover:text-slate-100', 'hover:border-slate-700');
            });
            this.timeIndicators.forEach(ind => {
                ind.classList.remove('pointer-events-none');
                ind.classList.add('cursor-pointer', 'hover:bg-slate-800/80', 'hover:text-slate-100', 'hover:border-slate-700');
            });
        }
    }
}

// Instantiate App when page loads
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
