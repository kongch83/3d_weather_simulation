# 3D Weather Simulation - Hong Kong (3D 實時天氣模擬 - 香港)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)

A premium, interactive 3D WebGL-based weather simulation application depicting the Victoria Harbour skyline in Tsim Sha Tsui, Hong Kong. The application synchronizes with real-time astronomical and weather data from the **Hong Kong Observatory (HKO) Open Data API** to dynamically adjust the environment, including time-of-day lighting, sky conditions, and weather effects.

Live Demo : https://demo.cloudian.hk/3d_weather_simulation/v1.0.0/

---

## 🌟 Key Features

- **Real-Time Weather Synchronization**: Automatically fetches live weather reports, sunrise/sunset times, UV index, relative humidity, wind speed, wind direction, and active weather warnings from the Hong Kong Observatory every 60 seconds.
- **Dynamic 3D Environment (Three.js)**:
  - Procedurally generated representation of the Victoria Harbour skyline (buildings, shoreline, streets).
  - A rich selection of animated 3D objects, landmarks, vehicles, and wildlife.
  - Interactive camera controls via OrbitControls, featuring a camera coordinates HUD.
- **Atmospheric Particle Systems**:
  - Custom WebGL particle systems for rain streaks, falling snow, drifting clouds, and wind.
  - Procedural 3D zigzag lightning bolts and screen flashes triggered during thunderstorm warnings.
- **Time & Weather Transition Engine**: Smooth, frame-rate independent interpolation (LERP) between time-of-day presets (Morning, Day, Sunset, Night) and weather modifiers (fog density, light intensity, color shifts).
- **Internationalization (i18n)**: Multi-language support with **Traditional Chinese (`zh-Hant`) as the default language**, and the ability to dynamically toggle to Simplified Chinese (`zh-Hans`) or English (`en`).
- **Procedural Sound Design**: Real-time synthesized background music and spatialized thunder audio effects using the Web Audio API.

---

## 📂 Project Structure

```bash
3d_sky_hk/v1.0.0/
├── index.html               # Main HTML entrypoint (Tailwind configuration, HUD layout)
├── style.css                # Custom CSS (glassmorphism UI, scrollbars, micro-animations)
├── favicon.png              # App icon
├── weather_proxy.php        # Server-side PHP CORS proxy for HKO API
├── lang/                    # Localization dictionaries
│   ├── en.json              # English translations
│   ├── tc.json              # Traditional Chinese translations (Default)
│   └── sc.json              # Simplified Chinese translations
└── js/                      # JavaScript modules
    ├── app.js               # Application bootstrap, BGM synth, and UI handlers
    ├── hkoApi.js            # HKO weather API client & CORS fallback orchestrator
    ├── weather3d.js         # Three.js 3D scene creation, animation, and rendering
    ├── transition.js        # LERP engine & lighting presets (Morning, Day, Sunset, Night)
    └── particles.js         # Rain, snow, cloud drift, and lightning generator
```

### File Resource Map

- **[index.html](index.html)**: Main page bootstrapping the HUD, camera positioning feedback, language selectors, visual styling stylesheets, and the WebGL canvas wrapper.
- **[style.css](style.css)**: Holds the structural UI code, including animations, glassmorphism templates, responsive panels, status lights, progress bars, and scrollbar layouts.
- **[weather_proxy.php](weather_proxy.php)**: PHP-based server-side proxy supporting cached requests, bypasses CORS, issues HTTP headers, and connects directly to HKO.
- **[lang/](lang/)**: Localization folder containing:
  - **[en.json](lang/en.json)**: English dictionary mapping labels, UV descriptions, and weather conditions.
  - **[tc.json](lang/tc.json)**: Traditional Chinese (繁體中文) dictionary (Default language resource).
  - **[sc.json](lang/sc.json)**: Simplified Chinese (简体中文) dictionary.
- **[js/app.js](js/app.js)**: Configures global events, UI listeners, keyboard shortcuts, background audio controls (via a procedurally generated chiptune synth play scheduler), and coordinates updates between HKO data fetchers and Three.js modules.
- **[js/hkoApi.js](js/hkoApi.js)**: Controls the Hong Kong Observatory Open Data integration, querying current weather reports (`rhrread`), forecasts (`fnd`), warnings (`warnsum`), and solar/lunar astronomical schedules (`srs`). Orchestrates fallback configurations (Local PHP -> Direct Fetch -> Public Proxy).
- **[js/weather3d.js](js/weather3d.js)**: Configures the Three.js WebGL scene including models, lighting rigs, OrbitControls, building geometry, water materials, Ferris Wheel, ship/ferry pathways, and animation loops.
- **[js/transition.js](js/transition.js)**: Controls lighting/sky colors and properties for morning, day, sunset, and night. Interpolates properties dynamically.
- **[js/particles.js](js/particles.js)**: Creates and animates clouds, rain streaks, snow, fog, and lightning bolts.

---

## 📐 3D Objects in the Scene

The simulated virtual harbor is composed of various low-poly 3D models generated procedurally within **[js/weather3d.js](js/weather3d.js)**:

1. **Water Plane (Victoria Harbour)**: Realistically rendered harbor surface with moving normal maps representing wind-driven wave ripples.
2. **Waterfront Promenade (Tsim Sha Tsui Walkway)**: Custom concrete walkways, stone borders, safety railings, wooden benches, and stylized flower troughs.
3. **Salisbury Road**: Dual-lane asphalt roadway with standard Hong Kong double yellow no-parking lines and lane dividers.
4. **Traffic Lights**: Dynamic street traffic light poles painted in black and yellow stripes, containing red, yellow, and green lamps that switch cycles.
5. **Hong Kong Island Skyline**: A backdrop of skyscrapers of different architectural shapes, decorated with randomized window grids that emit warm light at night.
6. **Victoria Peak Range**: Background mountain ranges providing depth behind the skyscrapers.
7. **The Peak Tower**: Landmark structure positioned in the mountains, featuring its iconic crescent-shaped viewing deck and illuminated neon strips.
8. **The Hong Kong Observation Wheel (Ferris Wheel)**: Scaled (2x) recreation featuring base concrete tiers, steps, structural supports, a main rotating rim, glowing neon spokes, and rotating passenger cabins.
9. **Vehicles**: Dynamic cars, taxis, and double-decker buses with spinning wheels and illuminated headlights/taillights moving along Salisbury Road.
10. **Watercraft & Vessels**:
    - **Star Ferry**: Iconic green-and-white passenger ferry with lit windows and signal lights.
    - **Traditional Wooden Junk Boat**: Traditional boat featuring three red-orange sails and hanging lanterns.
    - **Sleek Speedboat**: A high-speed vessel with a yellow-and-white hull, blue windshield, and black outboard motor.
    - **Longboat (Sampan)**: Standard local longboat with a white canopy and structural pillars.
    - **Yellow Beach Boat**: A stationary yellow beach boat situated near the shore (scaled 2x).
11. **Landscaping**: Swaying palm trees with segmented trunks and leafy tops, reacting to wind.
12. **Drifting Clouds**: Drifting 3D cloud clusters that adjust in density and speed based on HKO data.
13. **Celestial Bodies**: Procedural Sun and Moon meshes that move along an orbital path.
14. **Characters & Wildlife**:
    - **Pedestrians**: Low-poly walking characters traversing the promenade.
    - **Queueing People**: Standing crowds waiting in line at the Ferris Wheel.
    - **Seated People**: Animated characters sitting on benches, waving their hands.
    - **Park Dogs**: Three animated dogs walking, sniffing, and playing in the green spaces.
    - **Beach Crabs**: Side-walking orange crabs with claws and moving legs scurrying along the sand.

---

## 🔊 Procedural Audio Design

The application utilizes the **Web Audio API** to generate all sound effects procedurally in real-time, eliminating the need to download large audio files:

### 1. Interactive Background Music (BGM)
- Plays an upbeat chiptune-style rendition of *Ode to Joy* arranged via an in-memory MIDI scheduler.
- Features a **melody track** driven by a triangle wave oscillator (for retro chime characteristics) with an ADSR gain envelope.
- Incorporates a **sub-bass track** driven by a sine wave oscillator positioned two octaves below, firing on the downbeat of each bar.
- Includes a dedicated toggle button (`BGM Toggle`) to start or stop playback.

### 2. Synthesized Thunder Sounds
- Procedurally generated during active thunderstorm warnings, synchronized with visual lightning flashes.
- Generates **deep brown noise** dynamically from white noise using a one-pole feedback filter.
- Passes the noise through a `lowpass` filter with an exponential frequency sweep (decaying from 150Hz down to 60Hz) to simulate the rolling reverberation of thunder moving away.
- Implements a custom gain envelope consisting of a sharp, loud initial attack (the lightning crack) followed by a long, rumbling decay.
- Automatically calculates a random delay (between 0.3s and 1.5s) between the visual lightning flash and the audio playback to simulate speed-of-sound distance.

---

## ⚙️ How It Works (Logic)

### 1. Data Fetching & CORS Fallback Orchestration
Browsers enforce CORS (Cross-Origin Resource Sharing) which can block direct client-side requests to the HKO API. To solve this, **[js/hkoApi.js](js/hkoApi.js)** utilizes a multi-layered fallback pipeline:
1. **Local PHP Proxy** (**[weather_proxy.php](weather_proxy.php)**): Requests are routed through the hosting server, resolving CORS immediately.
2. **Direct Fetch**: Attempts a direct connection in environments where CORS is disabled or relaxed.
3. **Public CORS Proxies**: Chains requests through multiple public services (`corsproxy.org`, `allorigins.win`, `codetabs.com`, etc.) as secondary fallbacks.

### 2. Time-of-Day Presets & LERP Engine
The time of day is determined by comparing the current local time against the fetched sunrise and sunset times for Hong Kong:
- **Morning**: Sunrise to Sunrise + 2 hours.
- **Day**: Afternoon.
- **Sunset**: Sunset - 1.5 hours to Sunset.
- **Night**: Sunset to Sunrise.

**[js/transition.js](js/transition.js)** defines base presets (sky color, ambient/directional light intensities, building emissive neon values, water colors) for each period and interpolates them continuously using a smooth linear interpolation factor:
$$\text{Value}_{\text{current}} = \text{Value}_{\text{current}} + (\text{Target} - \text{Value}_{\text{current}}) \times \text{LERP\_FACTOR}$$

### 3. Weather Condition Modifiers
Incoming weather signals modify the environmental attributes:
- **Rain / Thunderstorm**: Activates rain particles, dims directional light, increases fog density, and switches neon lights on (darkening the sky). Spawns random 3D lightning bolts.
- **Foggy**: Drastically reduces fog visibility and dims overall lighting.
- **Windy**: Increases cloud speed, water wave animation rate, and tree swaying frequencies.
- **Snowy**: Replaces rain particles with falling snow crystals.

---

## 🛠️ Deployment

Simply host the project folder on a standard **PHP web server** to allow the CORS-resolving backend proxy (`weather_proxy.php`) to function correctly. 

---

## 🌐 Languages & Technologies Used

- **Default Language**: Traditional Chinese (`zh-Hant`)
- **Markup & Structure**: HTML5 (semantic layout)
- **Styling**: Tailwind CSS (CDN v3.x) & Custom CSS (featuring glassmorphism, blur backdrops, and modern fonts like Inter & Montserrat)
- **3D Graphics Engine**: Three.js (v0.160.0, utilizing ESM imports & OrbitControls)
- **Programming Language**: JavaScript (ES Modules, async-await, modular layout)
- **Audio Synthesizer**: Web Audio API (real-time chiptune synthesis)
- **Server Scripting**: PHP (for CORS routing)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE details for more information.
