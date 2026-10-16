<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';

$file = __DIR__ . '/opens.json';
$gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

function empty_opens() {
    return array('opens' => array());
}

function decode_opens($raw) {
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['opens']) || !is_array($data['opens'])) {
        return empty_opens();
    }
    return $data;
}

if (isset($_GET['report'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if (db_available()) {
        echo json_encode(db_open_report());
        exit;
    }
    if (!is_file($file)) {
        echo json_encode(empty_opens());
        exit;
    }
    echo file_get_contents($file);
    exit;
}

$token = isset($_GET['t']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $_GET['t']) : '';
if ($token !== '' && db_available()) {
    try {
        db_record_open($token);
        $token = '';
    } catch (Throwable $e) {
        /* File log below keeps the open if MySQL fails mid-request. */
    }
}
if ($token !== '') {
    $fp = fopen($file, 'c+');
    if ($fp) {
        flock($fp, LOCK_EX);
        $contents = stream_get_contents($fp);
        $data = decode_opens($contents);
        $now = (int) round(microtime(true) * 1000);
        $prev = isset($data['opens'][$token]) && is_array($data['opens'][$token])
            ? $data['opens'][$token]
            : null;
        $data['opens'][$token] = array(
            'firstOpenedAt' => $prev && !empty($prev['firstOpenedAt']) ? $prev['firstOpenedAt'] : $now,
            'lastOpenedAt' => $now,
            'count' => ($prev && !empty($prev['count']) ? (int) $prev['count'] : 0) + 1
        );
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

header('Content-Type: image/gif');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
echo $gif;
