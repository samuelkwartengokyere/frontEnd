<?php
/**
 * Shared templates, events, and settings for Campaign Studio.
 * Upload this file with the rest of the site. It writes library.json
 * in this folder so every browser sees the same saved workspace.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Studio-Key');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('LIBRARY_WRITE_KEY', 'tha-campaign-library');

require_once __DIR__ . '/db.php';

$file = __DIR__ . '/library.json';
$key = library_request_key();
if (!hash_equals(LIBRARY_WRITE_KEY, $key)) {
    library_deny(403, 'Not allowed');
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if (db_available()) {
    library_handle_with_database($method);
}
if ($method === 'GET') {
    $data = library_with_lock($file, false, function ($fp, $data) {
        return $data;
    });
    library_send($data);
}

if ($method !== 'POST') {
    library_deny(405, 'Method not allowed');
}

$raw = file_get_contents('php://input');
if (!is_string($raw) || strlen($raw) > 3000000) {
    library_deny(413, 'That save is too large to share.');
}

$body = json_decode($raw, true);
if (!is_array($body)) {
    library_deny(400, 'Could not read that save.');
}

$kind = isset($body['kind']) ? (string) $body['kind'] : '';
$action = isset($body['action']) ? (string) $body['action'] : '';
if ($kind !== 'templates' && $kind !== 'events' && $kind !== 'settings') {
    library_deny(400, 'Unknown library.');
}
if ($action !== 'upsert' && $action !== 'delete') {
    library_deny(400, 'Unknown save action.');
}
if ($kind === 'settings' && $action !== 'upsert') {
    library_deny(400, 'Unknown save action.');
}

$data = library_with_lock($file, true, function ($fp, $data) use ($kind, $action, $body) {
    if ($kind === 'settings') {
        $item = isset($body['item']) && is_array($body['item']) ? $body['item'] : null;
        $scope = $item && isset($item['scope']) ? (string) $item['scope'] : '';
        if ($scope === 'config') {
            $data['settings']['config'] = library_stamp_settings(library_clean_config($item));
        } elseif ($scope === 'auth') {
            $clean = library_clean_auth($item);
            if (!$clean) {
                library_deny(400, 'Login email and password are required.');
            }
            $data['settings']['auth'] = library_stamp_settings($clean);
        } else {
            library_deny(400, 'Unknown settings.');
        }
        library_write($fp, $data);
        return $data;
    }
    if ($action === 'delete') {
        $id = library_clean_id(isset($body['id']) ? $body['id'] : '');
        if ($id === '') {
            library_deny(400, 'Missing item id.');
        }
        $data[$kind] = library_remove_id($data[$kind], $id);
    } else {
        $item = isset($body['item']) && is_array($body['item']) ? $body['item'] : null;
        if (!$item) {
            library_deny(400, 'Missing item.');
        }
        $clean = $kind === 'templates' ? library_clean_template($item) : library_clean_event($item);
        if (!$clean) {
            library_deny(400, 'Name is required.');
        }
        $clean = library_stamp($clean, library_find($data[$kind], $clean['id']));
        $data[$kind] = library_upsert_item($data[$kind], $clean);
    }
    library_write($fp, $data);
    return $data;
});

library_send($data);

function library_request_key() {
    if (!empty($_SERVER['HTTP_X_STUDIO_KEY'])) {
        return (string) $_SERVER['HTTP_X_STUDIO_KEY'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                if (strcasecmp((string) $name, 'X-Studio-Key') === 0) {
                    return (string) $value;
                }
            }
        }
    }
    return '';
}

function library_deny($code, $message) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => $message));
    exit;
}

function library_send($data) {
    header('Content-Type: application/json; charset=utf-8');
    $payload = array(
        'ok' => true,
        'templates' => array_values($data['templates']),
        'events' => array_values($data['events']),
        'settings' => $data['settings']
    );
    if (isset($data['history']) && is_array($data['history'])) {
        $payload['history'] = array_values($data['history']);
    }
    echo json_encode($payload);
    exit;
}

function library_empty_settings() {
    return array(
        'config' => array('updatedAt' => 0),
        'auth' => array('updatedAt' => 0)
    );
}

function library_normalize($data) {
    if (!isset($data['templates']) || !is_array($data['templates'])) {
        $data['templates'] = array();
    }
    if (!isset($data['events']) || !is_array($data['events'])) {
        $data['events'] = array();
    }
    if (!isset($data['settings']) || !is_array($data['settings'])) {
        $data['settings'] = library_empty_settings();
    }
    if (!isset($data['settings']['config']) || !is_array($data['settings']['config'])) {
        $data['settings']['config'] = array('updatedAt' => 0);
    }
    if (!isset($data['settings']['auth']) || !is_array($data['settings']['auth'])) {
        $data['settings']['auth'] = array('updatedAt' => 0);
    }
    return $data;
}

function library_empty() {
    return library_normalize(array());
}

function library_decode($raw) {
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return library_empty();
    }
    return library_normalize($data);
}

function library_read_handle($fp) {
    rewind($fp);
    $raw = stream_get_contents($fp);
    return library_decode(is_string($raw) ? $raw : '');
}

function library_write($fp, $data) {
    rewind($fp);
    ftruncate($fp, 0);
    $flags = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_UNESCAPED_SLASHES')) {
        $flags |= JSON_UNESCAPED_SLASHES;
    }
    $data = library_normalize($data);
    fwrite($fp, json_encode(array(
        'templates' => array_values($data['templates']),
        'events' => array_values($data['events']),
        'settings' => $data['settings']
    ), $flags));
    fflush($fp);
}

function library_with_lock($file, $exclusive, $fn) {
    $fp = fopen($file, 'c+');
    if (!$fp) {
        library_deny(500, 'Could not open the shared library. Make this folder writable.');
    }
    if (!flock($fp, $exclusive ? LOCK_EX : LOCK_SH)) {
        fclose($fp);
        library_deny(500, 'Could not lock the shared library.');
    }
    $data = library_read_handle($fp);
    $result = $fn($fp, $data);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

function library_stamp_settings($item) {
    $item['updatedAt'] = (int) round(microtime(true) * 1000);
    return $item;
}

function library_clean_http_url($value) {
    $url = trim((string) $value);
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2000 || !preg_match('/^https?:\/\//i', $url)) {
        return '';
    }
    return $url;
}

function library_clean_config($item) {
    $config = array();
    $textKeys = array(
        'publicKey' => 200,
        'serviceId' => 200,
        'templateId' => 200,
        'fromName' => 200
    );
    foreach ($textKeys as $key => $max) {
        if (array_key_exists($key, $item)) {
            $config[$key] = library_clean_text($item[$key], $max);
        }
    }
    if (array_key_exists('openTrackUrl', $item)) {
        $config['openTrackUrl'] = library_clean_http_url($item['openTrackUrl']);
    }
    if (array_key_exists('logoUrl', $item)) {
        $config['logoUrl'] = library_clean_logo_url($item['logoUrl']);
    }
    if (array_key_exists('logoDataUrl', $item)) {
        $config['logoDataUrl'] = library_clean_logo_data($item['logoDataUrl']);
    }
    foreach (array('fromEmail', 'senderEmail') as $key) {
        if (!array_key_exists($key, $item)) {
            continue;
        }
        $email = strtolower(trim((string) $item[$key]));
        $config[$key] = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
    }
    if (array_key_exists('repliesEnabled', $item)) {
        $config['repliesEnabled'] = !empty($item['repliesEnabled']);
    }
    if (array_key_exists('sendMode', $item)) {
        $config['sendMode'] = ((string) $item['sendMode'] === 'batch') ? 'batch' : 'immediate';
    }
    if (array_key_exists('batchSize', $item)) {
        $size = (int) $item['batchSize'];
        if ($size < 1) {
            $size = 1;
        }
        if ($size > 1000) {
            $size = 1000;
        }
        $config['batchSize'] = $size;
    }
    if (array_key_exists('batchIntervalMinutes', $item)) {
        $minutes = (int) $item['batchIntervalMinutes'];
        if ($minutes < 1) {
            $minutes = 1;
        }
        if ($minutes > 120) {
            $minutes = 120;
        }
        $config['batchIntervalMinutes'] = $minutes;
    }
    return $config;
}

function library_clean_auth($item) {
    $email = strtolower(trim((string) (isset($item['email']) ? $item['email'] : '')));
    $password = (string) (isset($item['password']) ? $item['password'] : '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 200) {
        return null;
    }
    return array(
        'email' => $email,
        'password' => $password
    );
}

function library_clean_id($value) {
    $id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $value);
    $length = strlen($id);
    if ($length < 8 || $length > 80) {
        return '';
    }
    return $id;
}

function library_clean_text($value, $max) {
    $text = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string) $value));
    if (strlen($text) > $max) {
        $text = substr($text, 0, $max);
    }
    return $text;
}

function library_clean_logo_url($value) {
    $url = trim((string) $value);
    if (strlen($url) > 2000 || !preg_match('/^https?:\/\//i', $url)) {
        return '';
    }
    return $url;
}

function library_clean_logo_data($value) {
    $logo = trim((string) $value);
    if (strlen($logo) < 32 || strlen($logo) >= 80000) {
        return '';
    }
    if (!preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i', $logo)) {
        return '';
    }
    return $logo;
}

function library_clean_people($people, $emails) {
    $clean = array();
    $seen = array();
    $sources = array();
    if (is_array($people)) {
        foreach ($people as $person) {
            if (!is_array($person)) {
                continue;
            }
            $sources[] = array(
                'name' => isset($person['name']) ? $person['name'] : '',
                'email' => isset($person['email']) ? $person['email'] : ''
            );
        }
    }
    if (!count($sources) && is_array($emails)) {
        foreach ($emails as $email) {
            $sources[] = array('name' => '', 'email' => $email);
        }
    }
    foreach ($sources as $person) {
        $email = strtolower(trim((string) $person['email']));
        if ($email === '' || isset($seen[$email]) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        $seen[$email] = true;
        $clean[] = array(
            'name' => library_clean_text($person['name'], 200),
            'email' => $email
        );
        if (count($clean) >= 8000) {
            break;
        }
    }
    return $clean;
}

function library_stamp($item, $existing) {
    $now = (int) round(microtime(true) * 1000);
    $created = 0;
    if ($existing && !empty($existing['createdAt'])) {
        $created = (int) $existing['createdAt'];
    } elseif (!empty($item['createdAt'])) {
        $created = (int) $item['createdAt'];
    }
    if ($created <= 0) {
        $created = $now;
    }
    $item['createdAt'] = $created;
    $item['updatedAt'] = $now;
    return $item;
}

function library_find($list, $id) {
    foreach ($list as $item) {
        if (is_array($item) && isset($item['id']) && $item['id'] === $id) {
            return $item;
        }
    }
    return null;
}

function library_remove_id($list, $id) {
    $next = array();
    foreach ($list as $item) {
        if (!is_array($item) || !isset($item['id']) || $item['id'] !== $id) {
            $next[] = $item;
        }
    }
    return $next;
}

function library_upsert_item($list, $item) {
    $next = array();
    $replaced = false;
    foreach ($list as $current) {
        if (is_array($current) && isset($current['id']) && $current['id'] === $item['id']) {
            $next[] = $item;
            $replaced = true;
        } else {
            $next[] = $current;
        }
    }
    if (!$replaced) {
        $next[] = $item;
    }
    return $next;
}

function library_clean_template($item) {
    $id = library_clean_id(isset($item['id']) ? $item['id'] : '');
    $name = library_clean_text(isset($item['name']) ? $item['name'] : '', 200);
    if ($id === '' || $name === '') {
        return null;
    }
    return array(
        'id' => $id,
        'name' => $name,
        'subject' => library_clean_text(isset($item['subject']) ? $item['subject'] : '', 300),
        'message' => library_clean_text(isset($item['message']) ? $item['message'] : '', 50000),
        'logoUrl' => library_clean_logo_url(isset($item['logoUrl']) ? $item['logoUrl'] : ''),
        'logoDataUrl' => library_clean_logo_data(isset($item['logoDataUrl']) ? $item['logoDataUrl'] : ''),
        'createdAt' => isset($item['createdAt']) ? (int) $item['createdAt'] : 0,
        'updatedAt' => isset($item['updatedAt']) ? (int) $item['updatedAt'] : 0
    );
}

function library_clean_event($item) {
    $id = library_clean_id(isset($item['id']) ? $item['id'] : '');
    $name = library_clean_text(isset($item['name']) ? $item['name'] : '', 200);
    if ($id === '' || $name === '') {
        return null;
    }
    $people = library_clean_people(
        isset($item['people']) ? $item['people'] : array(),
        isset($item['emails']) ? $item['emails'] : array()
    );
    $emails = array();
    foreach ($people as $person) {
        $emails[] = $person['email'];
    }
    return array(
        'id' => $id,
        'name' => $name,
        'description' => library_clean_text(isset($item['description']) ? $item['description'] : '', 1000),
        'people' => $people,
        'emails' => $emails,
        'createdAt' => isset($item['createdAt']) ? (int) $item['createdAt'] : 0,
        'updatedAt' => isset($item['updatedAt']) ? (int) $item['updatedAt'] : 0
    );
}

function library_clean_email_list($value, $limit) {
    $clean = array();
    $seen = array();
    if (!is_array($value)) {
        return $clean;
    }
    foreach ($value as $email) {
        $email = strtolower(trim((string) $email));
        if ($email === '' || isset($seen[$email]) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        $seen[$email] = true;
        $clean[] = $email;
        if (count($clean) >= $limit) {
            break;
        }
    }
    return $clean;
}

function library_clean_history($item) {
    if (!is_array($item)) {
        return null;
    }
    $id = library_clean_id(isset($item['id']) ? $item['id'] : '');
    if ($id === '') {
        return null;
    }
    $recipients = library_clean_email_list(isset($item['recipients']) ? $item['recipients'] : array(), 8000);
    $succeeded = library_clean_email_list(isset($item['succeededEmails']) ? $item['succeededEmails'] : array(), 8000);
    $failed = library_clean_email_list(isset($item['failedEmails']) ? $item['failedEmails'] : array(), 8000);
    $opens = array();
    if (isset($item['recipientOpens']) && is_array($item['recipientOpens'])) {
        foreach ($item['recipientOpens'] as $email => $rec) {
            $key = strtolower(trim((string) $email));
            if ($key === '' || !filter_var($key, FILTER_VALIDATE_EMAIL) || !is_array($rec)) {
                continue;
            }
            $token = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) (isset($rec['token']) ? $rec['token'] : ''));
            $opens[$key] = array(
                'token' => $token,
                'openedAt' => !empty($rec['openedAt']) ? (int) $rec['openedAt'] : null,
                'lastOpenedAt' => !empty($rec['lastOpenedAt']) ? (int) $rec['lastOpenedAt'] : null,
                'openCount' => isset($rec['openCount']) ? (int) $rec['openCount'] : 0
            );
        }
    }
    $details = array();
    if (isset($item['failedDetails']) && is_array($item['failedDetails'])) {
        foreach ($item['failedDetails'] as $line) {
            $details[] = library_clean_text($line, 2000);
            if (count($details) >= 8000) {
                break;
            }
        }
    }
    $attachments = array();
    if (isset($item['attachmentNames']) && is_array($item['attachmentNames'])) {
        foreach ($item['attachmentNames'] as $name) {
            $attachments[] = library_clean_text($name, 300);
            if (count($attachments) >= 20) {
                break;
            }
        }
    }
    $created = isset($item['createdAt']) ? (int) $item['createdAt'] : 0;
    if ($created <= 0) {
        $created = db_now();
    }
    $updated = isset($item['updatedAt']) ? (int) $item['updatedAt'] : $created;
    return array(
        'id' => $id,
        'createdAt' => $created,
        'updatedAt' => $updated,
        'eventName' => library_clean_text(isset($item['eventName']) ? $item['eventName'] : '', 200),
        'subject' => library_clean_text(isset($item['subject']) ? $item['subject'] : '', 300),
        'message' => library_clean_text(isset($item['message']) ? $item['message'] : '', 200000),
        'fromName' => library_clean_text(isset($item['fromName']) ? $item['fromName'] : '', 200),
        'fromEmail' => library_clean_text(isset($item['fromEmail']) ? $item['fromEmail'] : '', 190),
        'replyTo' => library_clean_text(isset($item['replyTo']) ? $item['replyTo'] : '', 190),
        'logoUrl' => library_clean_logo_url(isset($item['logoUrl']) ? $item['logoUrl'] : ''),
        'attachmentNames' => $attachments,
        'recipients' => $recipients,
        'succeededEmails' => $succeeded,
        'failedEmails' => $failed,
        'recipientOpens' => $opens,
        'success' => isset($item['success']) ? (int) $item['success'] : count($succeeded),
        'failed' => isset($item['failed']) ? (int) $item['failed'] : count($failed),
        'failedDetails' => $details,
        'sendMode' => (isset($item['sendMode']) && (string) $item['sendMode'] === 'batch') ? 'batch' : 'immediate',
        'batchSize' => isset($item['batchSize']) ? (int) $item['batchSize'] : 0,
        'batchCount' => isset($item['batchCount']) ? (int) $item['batchCount'] : 0,
        'batchesDone' => isset($item['batchesDone']) ? (int) $item['batchesDone'] : 0,
        'stopped' => !empty($item['stopped'])
    );
}

function library_import_legacy_library() {
    if (db_meta_get('legacy_library_import') === '1') {
        return;
    }
    $file = __DIR__ . '/library.json';
    if (is_file($file)) {
        $data = json_decode((string) file_get_contents($file), true);
        if (is_array($data)) {
            if (!empty($data['templates']) && is_array($data['templates'])) {
                foreach ($data['templates'] as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $clean = library_clean_template($item);
                    if (!$clean) {
                        continue;
                    }
                    if (!empty($item['createdAt'])) {
                        $clean['createdAt'] = (int) $item['createdAt'];
                    }
                    if (!empty($item['updatedAt'])) {
                        $clean['updatedAt'] = (int) $item['updatedAt'];
                    }
                    db_upsert_template($clean);
                }
            }
            if (!empty($data['events']) && is_array($data['events'])) {
                foreach ($data['events'] as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $clean = library_clean_event($item);
                    if (!$clean) {
                        continue;
                    }
                    if (!empty($item['createdAt'])) {
                        $clean['createdAt'] = (int) $item['createdAt'];
                    }
                    if (!empty($item['updatedAt'])) {
                        $clean['updatedAt'] = (int) $item['updatedAt'];
                    }
                    db_upsert_event($clean);
                }
            }
            if (!empty($data['settings']['config']) && is_array($data['settings']['config'])) {
                db_save_config(library_clean_config($data['settings']['config']));
            }
            if (!empty($data['settings']['auth']) && is_array($data['settings']['auth'])) {
                $auth = $data['settings']['auth'];
                $email = isset($auth['email']) ? $auth['email'] : '';
                $password = isset($auth['password']) ? $auth['password'] : '';
                $updated = isset($auth['updatedAt']) ? (int) $auth['updatedAt'] : db_now();
                if ($email !== '' && $password !== '') {
                    db_set_user_password($email, $password, $updated);
                }
            }
        }
    }
    db_meta_set('legacy_library_import', '1');
}

function library_handle_with_database($method) {
    library_import_legacy_library();
    if ($method === 'GET') {
        library_send(db_library());
    }
    if ($method !== 'POST') {
        library_deny(405, 'Method not allowed');
    }

    $raw = file_get_contents('php://input');
    if (!is_string($raw) || strlen($raw) > 8000000) {
        library_deny(413, 'That save is too large to share.');
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        library_deny(400, 'Could not read that save.');
    }

    $kind = isset($body['kind']) ? (string) $body['kind'] : '';
    $action = isset($body['action']) ? (string) $body['action'] : '';

    if ($kind === 'auth') {
        if ($action !== 'login') {
            library_deny(400, 'Unknown save action.');
        }
        $email = strtolower(trim((string) (isset($body['email']) ? $body['email'] : '')));
        $password = (string) (isset($body['password']) ? $body['password'] : '');
        if (!db_verify_login($email, $password)) {
            library_deny(401, 'Those credentials do not match this workspace.');
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => true, 'email' => $email));
        exit;
    }

    if ($kind === 'history') {
        if ($action === 'clear') {
            db_clear_history();
            library_send(db_library());
        }
        if ($action === 'delete') {
            $id = library_clean_id(isset($body['id']) ? $body['id'] : '');
            if ($id === '') {
                library_deny(400, 'Missing item id.');
            }
            db_delete_campaign($id);
            library_send(db_library());
        }
        if ($action !== 'upsert') {
            library_deny(400, 'Unknown save action.');
        }
        $item = isset($body['item']) && is_array($body['item']) ? library_clean_history($body['item']) : null;
        if (!$item) {
            library_deny(400, 'Missing item.');
        }
        db_upsert_campaign($item);
        library_send(db_library());
    }

    if ($kind !== 'templates' && $kind !== 'events' && $kind !== 'settings') {
        library_deny(400, 'Unknown library.');
    }
    if ($action !== 'upsert' && $action !== 'delete') {
        library_deny(400, 'Unknown save action.');
    }
    if ($kind === 'settings' && $action !== 'upsert') {
        library_deny(400, 'Unknown save action.');
    }

    if ($kind === 'settings') {
        $item = isset($body['item']) && is_array($body['item']) ? $body['item'] : null;
        $scope = $item && isset($item['scope']) ? (string) $item['scope'] : '';
        if ($scope === 'config') {
            db_save_config(library_stamp_settings(library_clean_config($item)));
        } elseif ($scope === 'auth') {
            $result = db_update_login($item);
            if (empty($result['ok'])) {
                library_deny(400, isset($result['error']) ? $result['error'] : 'Could not update the login.');
            }
        } else {
            library_deny(400, 'Unknown settings.');
        }
        library_send(db_library());
    }

    if ($action === 'delete') {
        $id = library_clean_id(isset($body['id']) ? $body['id'] : '');
        if ($id === '') {
            library_deny(400, 'Missing item id.');
        }
        if ($kind === 'templates') {
            db_delete_template($id);
        } else {
            db_delete_event($id);
        }
        library_send(db_library());
    }

    $item = isset($body['item']) && is_array($body['item']) ? $body['item'] : null;
    if (!$item) {
        library_deny(400, 'Missing item.');
    }
    $clean = $kind === 'templates' ? library_clean_template($item) : library_clean_event($item);
    if (!$clean) {
        library_deny(400, 'Name is required.');
    }
    $existing = $kind === 'templates' ? db_find_template($clean['id']) : db_find_event($clean['id']);
    $clean = library_stamp($clean, $existing);
    if ($kind === 'templates') {
        db_upsert_template($clean);
    } else {
        db_upsert_event($clean);
    }
    library_send(db_library());
}
