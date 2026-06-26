<?php
/**
 * Simple PHP Proxy for Hong Kong Observatory API
 * Place this file inside the same directory as index.html (e.g. /3d_weather_hong_kong/weather_proxy.php)
 * This resolves CORS browser blocking completely by doing the API call on the server side.
 */

// Allow same-origin and optionally CORS origins
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// Support querying different data types (rhrread, fnd, warnsum, srs)
$dataType = 'rhrread';
if (isset($_GET['dataType']) && in_array($_GET['dataType'], ['rhrread', 'fnd', 'warnsum', 'srs'])) {
    $dataType = $_GET['dataType'];
}

// Support querying different languages (tc, sc, en)
$lang = 'tc';
if (isset($_GET['lang']) && in_array($_GET['lang'], ['tc', 'sc', 'en'])) {
    $lang = $_GET['lang'];
}

if ($dataType === 'srs') {
    $year = isset($_GET['year']) ? intval($_GET['year']) : date('Y');
    $targetUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=' . $year . '&lang=' . $lang . '&rformat=json';
} else {
    $targetUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=' . $dataType . '&lang=' . $lang . '&_=' . time();
}

// Set up cURL request with a user agent (some APIs block empty user agent requests)
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Weather3DProxy/1.0');

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(502);
    echo json_encode([
        "error" => "cURL Error: " . curl_error($ch)
    ]);
} else if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        "error" => "HKO API returned HTTP code " . $httpCode
    ]);
} else {
    echo $response;
}

curl_close($ch);
?>
