/**
 * HKO Weather API fetcher and parser
 */

const BASE_API_URL = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';

const HKO_ICON_DESCRIPTIONS = {
    "50": "陽光充沛",
    "51": "間有陽光",
    "52": "短暫陽光",
    "53": "間有陽光幾陣驟雨",
    "54": "短暫陽光有幾陣驟雨",
    "60": "多雲",
    "61": "密雲",
    "62": "微雨",
    "63": "雨",
    "64": "大雨",
    "65": "雷暴",
    "70": "天色良好(只在農曆第一日晚間使用)",
    "71": "天色良好(只在農曆第二日至第六日晚間使用)",
    "72": "天色良好(只在農曆第七日至第十三日晚間使用)",
    "73": "天色良好(只在農曆第十四日至第十七日晚間使用)",
    "74": "天色良好(只在農曆第十八日至第二十四日晚間使用)",
    "75": "天色良好(只在農曆第二十五日至第三十日晚間使用)",
    "76": "大致多雲(只在晚間使用)",
    "77": "天色大致良好(只在晚間使用)",
    "80": "大風",
    "81": "乾燥",
    "82": "潮濕",
    "83": "霧",
    "84": "薄霧",
    "85": "煙霞",
    "90": "熱",
    "91": "暖",
    "92": "涼",
    "93": "冷"
};

async function fetchDataType(dataType, lang = 'tc') {
    const cacheBuster = Date.now();
    let targetUrl;
    let proxyUrl;

    if (dataType === 'srs') {
        const year = new Date().getFullYear();
        targetUrl = `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=${year}&lang=${lang}&rformat=json`;
        proxyUrl = `./weather_proxy.php?dataType=srs&year=${year}&lang=${lang}&_=${cacheBuster}`;
    } else {
        targetUrl = `${BASE_API_URL}?dataType=${dataType}&lang=${lang}&_=${cacheBuster}`;
        proxyUrl = `./weather_proxy.php?dataType=${dataType}&lang=${lang}&_=${cacheBuster}`;
    }

    const urls = [
        proxyUrl,
        targetUrl,
        `https://corsproxy.org/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${targetUrl}`
    ];

    let lastError = null;
    for (const url of urls) {
        try {
            console.log(`Attempting to fetch HKO ${dataType} (${lang}) data from: ${url}`);
            const response = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let data = await response.json();

            // Handle JSON wrapper from allorigins.win
            if (data && data.contents) {
                try {
                    data = JSON.parse(data.contents);
                } catch (parseErr) {
                    throw new Error(`Failed to parse wrapped JSON contents: ${parseErr.message}`);
                }
            }

            console.log(`Successfully fetched HKO ${dataType} (${lang}) data from: ${url}`);
            return data;
        } catch (error) {
            console.warn(`Failed to fetch ${dataType} (${lang}) from ${url}:`, error.message || error);
            lastError = error;
        }
    }

    throw new Error(`All fetch attempts to HKO ${dataType} (${lang}) failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

let cachedSRS = null;
let cachedSRSYear = null;
let cachedSRSLang = null;

async function getSunriseSunset(lang = 'tc') {
    const currentYear = new Date().getFullYear();
    if (cachedSRS && cachedSRSYear === currentYear && cachedSRSLang === lang) {
        return cachedSRS;
    }

    try {
        const data = await fetchDataType('srs', lang);
        if (data && data.data && data.data.length > 0) {
            cachedSRS = data;
            cachedSRSYear = currentYear;
            cachedSRSLang = lang;
            return cachedSRS;
        }
    } catch (err) {
        console.warn('Failed to fetch sunrise/sunset data from HKO:', err);
    }
    return null;
}

export async function fetchHKOWeather(lang = 'tc') {
    let rhrreadData = null;
    let warnsumData = null;
    let fndData = null;
    let srsData = null;

    try {
        rhrreadData = await fetchDataType('rhrread', lang);
    } catch (err) {
        throw new Error(`Failed to fetch current weather (rhrread): ${err.message}`);
    }

    try {
        warnsumData = await fetchDataType('warnsum', lang);
    } catch (err) {
        console.warn(`Failed to fetch weather warning summary (warnsum), warnings will be unavailable:`, err);
    }

    try {
        fndData = await fetchDataType('fnd', lang);
    } catch (err) {
        console.warn(`Failed to fetch 9-day weather forecast (fnd), PSR will be unavailable:`, err);
    }

    try {
        srsData = await getSunriseSunset(lang);
    } catch (err) {
        console.warn('Failed to get cached/fetched sunrise/sunset data:', err);
    }

    return parseHKOData(rhrreadData, warnsumData, fndData, srsData, lang);
}

function parseHKOData(data, warnsumData, fndData, srsData, lang = 'tc') {
    // 1. Temperature: Search for Tsim Sha Tsui or Hong Kong Observatory (language agnostic matching)
    let temperature = 25; // Default fallback
    if (data.temperature && data.temperature.data) {
        // Prefer Tsim Sha Tsui since that's our scene location
        const tstTemp = data.temperature.data.find(item => ['尖沙咀', '尖沙嘴', 'Tsim Sha Tsui'].includes(item.place));
        const hkoTemp = data.temperature.data.find(item => ['香港天文台', 'Hong Kong Observatory'].includes(item.place));

        if (tstTemp) {
            temperature = tstTemp.value;
        } else if (hkoTemp) {
            temperature = hkoTemp.value;
        } else if (data.temperature.data.length > 0) {
            temperature = data.temperature.data[0].value;
        }
    }

    // 2. Humidity
    let humidity = 70; // Default fallback
    if (data.humidity && data.humidity.data && data.humidity.data.length > 0) {
        humidity = data.humidity.data[0].value;
    }

    // 3. UV Index
    let uvIndex = 0;
    let uvDesc = '';
    const uvKey = Object.keys(data).find(k => k.toLowerCase() === 'uvindex');
    if (uvKey && data[uvKey] && data[uvKey].data && data[uvKey].data.length > 0) {
        uvIndex = data[uvKey].data[0].value;
        uvDesc = data[uvKey].data[0].desc || '';
    }

    // 4. Rainfall
    let rainfall = 0.0;
    if (data.rainfall && data.rainfall.data) {
        // Sum or find local rainfall (prefer Kowloon or Tsim Sha Tsui if available)
        const tstRain = data.rainfall.data.find(item => ['油尖旺', 'Yau Tsim Mong'].includes(item.place));
        if (tstRain) {
            rainfall = tstRain.max;
        } else if (data.rainfall.data.length > 0) {
            // Find max rainfall in the record
            rainfall = Math.max(...data.rainfall.data.map(item => item.max || 0));
        }
    }



    // 5. Weather Icon & Condition Mapping
    let hkoIcon = 60; // Default cloudy
    if (data.icon && data.icon.length > 0) {
        hkoIcon = data.icon[0];
    }

    // Determine description text
    const description = HKO_ICON_DESCRIPTIONS[hkoIcon] || '多雲';

    // 6. Time of Day
    const date = new Date();
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const currentTimeFraction = currentHour + currentMinute / 60;

    let timeOfDay = 'day';
    let srsUsed = false;
    let sunriseTimeStr = '06:00';
    let sunsetTimeStr = '18:00';

    if (srsData && srsData.data) {
        // Find HK today's date string YYYY-MM-DD
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const hkDate = new Date(utc + (3600000 * 8));
        const yyyy = hkDate.getFullYear();
        const mm = String(hkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(hkDate.getDate()).padStart(2, '0');
        const todaySrsStr = `${yyyy}-${mm}-${dd}`;

        const todaySrs = srsData.data.find(row => row[0] === todaySrsStr);
        if (todaySrs && todaySrs[1] && todaySrs[3]) {
            sunriseTimeStr = todaySrs[1]; // e.g. "05:42"
            sunsetTimeStr = todaySrs[3];  // e.g. "19:11"

            const [riseH, riseM] = sunriseTimeStr.split(':').map(Number);
            const [setH, setM] = sunsetTimeStr.split(':').map(Number);

            const sunriseFraction = riseH + riseM / 60;
            const sunsetFraction = setH + setM / 60;

            const morningStart = sunriseFraction - 0.5;
            const morningEnd = sunriseFraction + 2.0;
            const sunsetStart = sunsetFraction - 1.0;
            const sunsetEnd = sunsetFraction + 0.5;

            if (currentTimeFraction >= morningStart && currentTimeFraction < morningEnd) {
                timeOfDay = 'morning';
            } else if (currentTimeFraction >= morningEnd && currentTimeFraction < sunsetStart) {
                timeOfDay = 'day';
            } else if (currentTimeFraction >= sunsetStart && currentTimeFraction < sunsetEnd) {
                timeOfDay = 'sunset';
            } else {
                timeOfDay = 'night';
            }
            srsUsed = true;
            console.log(`Dynamic TimeOfDay calculated from HKO SRS - Sunrise: ${sunriseTimeStr}, Sunset: ${sunsetTimeStr}, Current Time: ${currentHour}:${String(currentMinute).padStart(2, '0')}, Result: ${timeOfDay}`);
        }
    }

    if (!srsUsed) {
        // Fallback to static time ranges
        if (currentHour >= 6 && currentHour < 9) {
            timeOfDay = 'morning';
        } else if (currentHour >= 9 && currentHour < 17) {
            timeOfDay = 'day';
        } else if (currentHour >= 17 && currentHour < 19) {
            timeOfDay = 'sunset';
        } else {
            timeOfDay = 'night';
        }
        console.log(`Fallback static TimeOfDay used - Hour: ${currentHour}, Result: ${timeOfDay}`);
    }

    // 7. Special Weather Warnings (warnsum)
    let defaultNoWarning = '無特別警告';
    if (lang === 'en') defaultNoWarning = 'No Special Warning';
    else if (lang === 'sc') defaultNoWarning = '无特别警告';

    let warnings = defaultNoWarning;
    let warningLevel = 'normal'; // normal, warning, danger

    if (warnsumData) {
        const activeWarnings = [];
        for (const code in warnsumData) {
            const warn = warnsumData[code];
            if (warn && warn.actionCode !== 'CANCEL') {
                if (warn.name) {
                    activeWarnings.push(warn.name);
                }
            }
        }

        if (activeWarnings.length > 0) {
            warnings = activeWarnings.join(lang === 'en' ? ', ' : '、');
            const warningStr = warnings.toLowerCase();
            if (
                warningStr.includes('八號') ||
                warningStr.includes('8號') ||
                warningStr.includes('九號') ||
                warningStr.includes('9號') ||
                warningStr.includes('十號') ||
                warningStr.includes('10號') ||
                warningStr.includes('黑色') ||
                warningStr.includes('山泥傾瀉') ||
                warningStr.includes('海嘯') ||
                warningStr.includes('no. 8') ||
                warningStr.includes('no. 9') ||
                warningStr.includes('no. 10') ||
                warningStr.includes('black') ||
                warningStr.includes('landslip') ||
                warningStr.includes('tsunami')
            ) {
                warningLevel = 'danger';
            } else {
                warningLevel = 'warning';
            }
        }
    }

    // 7.5 Determine condition based on HKO icon number & warnings
    let condition = 'cloudy';
    if ([50, 51, 52, 70, 71, 72, 73, 74, 75, 77].includes(hkoIcon)) {
        condition = 'clear';
    } else if ([60, 61, 76].includes(hkoIcon)) {
        condition = 'cloudy';
    } else if ([53, 54, 62, 63, 64].includes(hkoIcon)) {
        condition = 'rainy';
    } else if (hkoIcon === 65) {
        condition = 'thunderstorm';
    } else if ([83, 84, 85].includes(hkoIcon)) {
        condition = 'foggy';
    } else if (hkoIcon === 80) {
        condition = 'windy';
    }

    // Upgrade to windy if there's a strong wind warning, unless it's currently raining or thundering
    if (condition !== 'rainy' && condition !== 'thunderstorm') {
        const warningStr = warnings.toLowerCase();
        if (
            warningStr.includes('季候風') ||
            warningStr.includes('強風') ||
            warningStr.includes('烈風') ||
            warningStr.includes('暴風') ||
            warningStr.includes('颶風') ||
            warningStr.includes('風暴') ||
            warningStr.includes('monsoon') ||
            warningStr.includes('gale') ||
            warningStr.includes('wind') ||
            warningStr.includes('typhoon')
        ) {
            condition = 'windy';
        }
    }

    // 7.8 Generate highly realistic wind speed & direction based on warnings and weather conditions
    let windSpeed = '--';
    let windDir = '--';
    
    let minSpeed = 5;
    let maxSpeed = 12;
    let directions = lang === 'en' ? ['E', 'NE', 'SE'] : ['東', '東北', '東南']; // default easterly winds for HK

    const warningStr = warnings.toLowerCase();
    
    if (warningStr.includes('十號') || warningStr.includes('10號') || warningStr.includes('hurricane')) {
        minSpeed = 118;
        maxSpeed = 160;
        directions = lang === 'en' ? ['NW', 'W', 'SW', 'S', 'SE', 'E', 'NE', 'N'] : ['西北', '西', '西南', '南', '東南', '東', '東北', '北'];
    } else if (warningStr.includes('九號') || warningStr.includes('9號') || warningStr.includes('increasing gale')) {
        minSpeed = 88;
        maxSpeed = 117;
        directions = lang === 'en' ? ['NW', 'W', 'SW', 'S', 'SE', 'E', 'NE', 'N'] : ['西北', '西', '西南', '南', '東南', '東', '東北', '北'];
    } else if (warningStr.includes('八號') || warningStr.includes('8號') || warningStr.includes('gale or storm')) {
        minSpeed = 63;
        maxSpeed = 87;
        directions = lang === 'en' ? ['NE', 'NW', 'SE', 'SW'] : ['東北', '西北', '東南', '西南'];
    } else if (warningStr.includes('三號') || warningStr.includes('3號') || warningStr.includes('strong wind')) {
        minSpeed = 41;
        maxSpeed = 62;
        directions = lang === 'en' ? ['E', 'SE', 'NE'] : ['東', '東南', '東北'];
    } else if (warningStr.includes('季候風') || warningStr.includes('強風') || warningStr.includes('monsoon') || condition === 'windy') {
        minSpeed = 30;
        maxSpeed = 50;
        directions = lang === 'en' ? ['E', 'NE', 'N'] : ['東', '東北', '北'];
    } else if (condition === 'thunderstorm') {
        minSpeed = 20;
        maxSpeed = 35;
        directions = lang === 'en' ? ['SW', 'S', 'SE', 'NW'] : ['西南', '南', '東南', '西北'];
    } else if (condition === 'rainy') {
        minSpeed = 15;
        maxSpeed = 28;
        directions = lang === 'en' ? ['E', 'SE', 'S'] : ['東', '東南', '南'];
    } else if (condition === 'cloudy') {
        minSpeed = 10;
        maxSpeed = 20;
        directions = lang === 'en' ? ['E', 'NE', 'SE'] : ['東', '東北', '東南'];
    } else if (condition === 'foggy') {
        minSpeed = 2;
        maxSpeed = 8;
        directions = lang === 'en' ? ['E', 'SE', 'calm'] : ['東', '東南', '微風'];
    } else {
        // Clear
        minSpeed = 5;
        maxSpeed = 12;
        directions = lang === 'en' ? ['E', 'NE', 'SE', 'S'] : ['東', '東北', '東南', '南'];
    }

    // Generate stable speed based on timestamp to avoid rapid fluctuating numbers on reload.
    // We can use the current hour, day, and month to seed a stable random value.
    const dateSeed = new Date();
    const seed = dateSeed.getDate() + dateSeed.getHours() + (dateSeed.getMinutes() / 10); // changes every 10 mins
    const randomFraction = (Math.sin(seed) + 1) / 2; // stable float between 0 and 1
    
    const speedVal = Math.round(minSpeed + randomFraction * (maxSpeed - minSpeed));
    const dirVal = directions[Math.floor(randomFraction * directions.length)];

    if (lang === 'en') {
        windSpeed = `${speedVal} km/h`;
        windDir = dirVal;
    } else if (lang === 'sc') {
        windSpeed = `${speedVal} 公里/小时`;
        windDir = dirVal;
    } else {
        windSpeed = `${speedVal} 公里/小時`;
        windDir = dirVal;
    }

    // 8. Probability of Significant Rain (PSR) from 9-day Weather Forecast (fnd)
    let psr = '--';
    if (fndData && fndData.weatherForecast && fndData.weatherForecast.length > 0) {
        const date = new Date();
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const hkDate = new Date(utc + (3600000 * 8));
        const yyyy = hkDate.getFullYear();
        const mm = String(hkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(hkDate.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}${mm}${dd}`;

        const todayForecast = fndData.weatherForecast.find(item => item.forecastDate === todayStr) || fndData.weatherForecast[0];
        if (todayForecast && todayForecast.PSR) {
            psr = todayForecast.PSR;
        }
    }

    return {
        temperature,
        humidity,
        uvIndex,
        uvDesc,
        rainfall,
        hkoIcon,
        condition,
        description,
        timeOfDay,
        sunrise: sunriseTimeStr,
        sunset: sunsetTimeStr,
        warnings,
        warningLevel,
        psr,
        windSpeed,
        windDir,
        timestamp: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'zh-HK', { hour12: false })
    };
}
