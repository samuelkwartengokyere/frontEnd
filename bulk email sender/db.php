<?php
/**
 * MySQL connection and storage for Campaign Studio.
 * Uses the XAMPP defaults (127.0.0.1, root, empty password) unless db.config.php exists.
 */
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function db_config() {
    $config = array(
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'tha_campaign_studio',
        'user' => 'root',
        'pass' => ''
    );
    $file = __DIR__ . '/db.config.php';
    if (is_file($file)) {
        $custom = include $file;
        if (is_array($custom)) {
            $config = array_merge($config, $custom);
        }
    }
    return $config;
}

function db() {
    static $mysqli = null;
    if ($mysqli instanceof mysqli) {
        return $mysqli;
    }
    $config = db_config();
    if (!preg_match('/^[A-Za-z0-9_]+$/', (string) $config['name'])) {
        throw new RuntimeException('Invalid database name.');
    }
    $mysqli = new mysqli(
        (string) $config['host'],
        (string) $config['user'],
        (string) $config['pass'],
        '',
        (int) $config['port']
    );
    $mysqli->set_charset('utf8mb4');
    $name = $config['name'];
    $mysqli->query(
        "CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $mysqli->select_db($name);
    return $mysqli;
}

function db_now() {
    return (int) round(microtime(true) * 1000);
}

function db_migrate() {
    static $done = false;
    if ($done) {
        return;
    }
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    if (!is_string($sql) || trim($sql) === '') {
        throw new RuntimeException('schema.sql is missing.');
    }
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    $parts = preg_split('/;\s*(?:\r?\n|$)/', $sql);
    if (!is_array($parts)) {
        throw new RuntimeException('Could not read schema.sql.');
    }
    $conn = db();
    foreach ($parts as $statement) {
        $statement = trim((string) $statement);
        if ($statement === '') {
            continue;
        }
        $conn->query($statement);
    }
    db_seed_user();
    db_import_opens_file();
    $done = true;
}

function db_available() {
    try {
        db_migrate();
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function db_meta_get($key) {
    $stmt = db()->prepare('SELECT meta_value FROM studio_meta WHERE meta_key = ?');
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ? (string) $row['meta_value'] : '';
}

function db_meta_set($key, $value) {
    $stmt = db()->prepare(
        'INSERT INTO studio_meta (meta_key, meta_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)'
    );
    $stmt->bind_param('ss', $key, $value);
    $stmt->execute();
}

function db_seed_user() {
    if (db_user()) {
        return;
    }
    $email = 'events@techhubafrica.org';
    $hash = password_hash('AfricaTech2026', PASSWORD_DEFAULT);
    $now = db_now();
    $stmt = db()->prepare(
        'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('ssii', $email, $hash, $now, $now);
    $stmt->execute();
}

function db_import_opens_file() {
    if (db_meta_get('legacy_opens_import') === '1') {
        return;
    }
    $file = __DIR__ . '/opens.json';
    if (is_file($file)) {
        $data = json_decode((string) file_get_contents($file), true);
        $opens = is_array($data) && isset($data['opens']) && is_array($data['opens']) ? $data['opens'] : array();
        foreach ($opens as $token => $rec) {
            $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $token);
            if ($clean === '' || !is_array($rec)) {
                continue;
            }
            $first = (int) (isset($rec['firstOpenedAt']) ? $rec['firstOpenedAt'] : (isset($rec['openedAt']) ? $rec['openedAt'] : 0));
            $last = (int) (isset($rec['lastOpenedAt']) ? $rec['lastOpenedAt'] : $first);
            $count = (int) (isset($rec['count']) ? $rec['count'] : (isset($rec['openCount']) ? $rec['openCount'] : 1));
            if ($first <= 0) {
                $first = $last > 0 ? $last : db_now();
            }
            if ($last <= 0) {
                $last = $first;
            }
            if ($count < 1) {
                $count = 1;
            }
            db_write_open($clean, $first, $last, $count, true);
        }
    }
    db_meta_set('legacy_opens_import', '1');
}

function db_user() {
    $result = db()->query(
        'SELECT id, email, password_hash, created_at, updated_at FROM users ORDER BY id ASC LIMIT 1'
    );
    $row = $result->fetch_assoc();
    return $row ?: null;
}

function db_verify_login($email, $password) {
    $user = db_user();
    if (!$user) {
        return false;
    }
    $expected = strtolower(trim((string) $user['email']));
    if (strtolower(trim((string) $email)) !== $expected) {
        return false;
    }
    return password_verify((string) $password, (string) $user['password_hash']);
}

function db_update_login($item) {
    $email = strtolower(trim((string) (isset($item['email']) ? $item['email'] : '')));
    $current = (string) (isset($item['currentPassword']) ? $item['currentPassword'] : '');
    $password = (string) (isset($item['password']) ? $item['password'] : '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return array('ok' => false, 'error' => 'Enter a valid login email.');
    }
    $user = db_user();
    if (!$user || $current === '' || !password_verify($current, (string) $user['password_hash'])) {
        return array('ok' => false, 'error' => 'Current password is incorrect.');
    }
    $hash = (string) $user['password_hash'];
    if ($password !== '' && !hash_equals($password, $current)) {
        if (strlen($password) < 8 || strlen($password) > 200) {
            return array('ok' => false, 'error' => 'New password must be at least 8 characters.');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    $now = db_now();
    $id = (int) $user['id'];
    $stmt = db()->prepare('UPDATE users SET email = ?, password_hash = ?, updated_at = ? WHERE id = ?');
    $stmt->bind_param('ssii', $email, $hash, $now, $id);
    $stmt->execute();
    return array('ok' => true, 'email' => $email);
}

function db_set_user_password($email, $password, $updatedAt) {
    $email = strtolower(trim((string) $email));
    $password = (string) $password;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        return;
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $updatedAt = (int) $updatedAt;
    if ($updatedAt <= 0) {
        $updatedAt = db_now();
    }
    $user = db_user();
    if ($user) {
        $id = (int) $user['id'];
        $created = (int) $user['created_at'];
        $stmt = db()->prepare(
            'UPDATE users SET email = ?, password_hash = ?, created_at = ?, updated_at = ? WHERE id = ?'
        );
        $stmt->bind_param('ssiii', $email, $hash, $created, $updatedAt, $id);
        $stmt->execute();
        return;
    }
    $stmt = db()->prepare(
        'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('ssii', $email, $hash, $updatedAt, $updatedAt);
    $stmt->execute();
}

function db_json_flags() {
    $flags = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_UNESCAPED_SLASHES')) {
        $flags |= JSON_UNESCAPED_SLASHES;
    }
    return $flags;
}

function db_save_config($config) {
    if (!is_array($config)) {
        $config = array();
    }
    if (empty($config['updatedAt'])) {
        $config['updatedAt'] = db_now();
    }
    $payload = json_encode($config, db_json_flags());
    $updated = (int) $config['updatedAt'];
    $scope = 'config';
    $stmt = db()->prepare(
        'INSERT INTO app_settings (scope, payload, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)'
    );
    $stmt->bind_param('ssi', $scope, $payload, $updated);
    $stmt->execute();
}

function db_read_config() {
    $scope = 'config';
    $stmt = db()->prepare('SELECT payload FROM app_settings WHERE scope = ?');
    $stmt->bind_param('s', $scope);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return array('updatedAt' => 0);
    }
    $decoded = json_decode((string) $row['payload'], true);
    return is_array($decoded) ? $decoded : array('updatedAt' => 0);
}

function db_find_template($id) {
    $stmt = db()->prepare(
        'SELECT id, name, subject, message, logo_url, logo_data, created_at, updated_at
         FROM templates WHERE id = ?'
    );
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ? db_template_from_row($row) : null;
}

function db_template_from_row($row) {
    return array(
        'id' => (string) $row['id'],
        'name' => (string) $row['name'],
        'subject' => (string) $row['subject'],
        'message' => (string) $row['message'],
        'logoUrl' => (string) $row['logo_url'],
        'logoDataUrl' => (string) $row['logo_data'],
        'createdAt' => (int) $row['created_at'],
        'updatedAt' => (int) $row['updated_at']
    );
}

function db_templates() {
    $result = db()->query(
        'SELECT id, name, subject, message, logo_url, logo_data, created_at, updated_at
         FROM templates ORDER BY updated_at DESC'
    );
    $list = array();
    while ($row = $result->fetch_assoc()) {
        $list[] = db_template_from_row($row);
    }
    return $list;
}

function db_upsert_template($item) {
    $id = (string) $item['id'];
    $name = (string) $item['name'];
    $subject = (string) (isset($item['subject']) ? $item['subject'] : '');
    $message = (string) (isset($item['message']) ? $item['message'] : '');
    $logoUrl = (string) (isset($item['logoUrl']) ? $item['logoUrl'] : '');
    $logoData = (string) (isset($item['logoDataUrl']) ? $item['logoDataUrl'] : '');
    $created = (int) (isset($item['createdAt']) ? $item['createdAt'] : db_now());
    $updated = (int) (isset($item['updatedAt']) ? $item['updatedAt'] : $created);
    $stmt = db()->prepare(
        'INSERT INTO templates (id, name, subject, message, logo_url, logo_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            subject = VALUES(subject),
            message = VALUES(message),
            logo_url = VALUES(logo_url),
            logo_data = VALUES(logo_data),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at)'
    );
    $stmt->bind_param('ssssssii', $id, $name, $subject, $message, $logoUrl, $logoData, $created, $updated);
    $stmt->execute();
}

function db_delete_template($id) {
    $stmt = db()->prepare('DELETE FROM templates WHERE id = ?');
    $stmt->bind_param('s', $id);
    $stmt->execute();
}

function db_find_event($id) {
    $events = db_events();
    foreach ($events as $event) {
        if ($event['id'] === $id) {
            return $event;
        }
    }
    return null;
}

function db_events() {
    $result = db()->query(
        'SELECT id, name, description, created_at, updated_at FROM events ORDER BY updated_at DESC'
    );
    $peopleByEvent = array();
    $people = db()->query('SELECT event_id, name, email FROM event_people ORDER BY id ASC');
    while ($row = $people->fetch_assoc()) {
        $eventId = (string) $row['event_id'];
        if (!isset($peopleByEvent[$eventId])) {
            $peopleByEvent[$eventId] = array();
        }
        $peopleByEvent[$eventId][] = array(
            'name' => (string) $row['name'],
            'email' => (string) $row['email']
        );
    }
    $list = array();
    while ($row = $result->fetch_assoc()) {
        $id = (string) $row['id'];
        $group = isset($peopleByEvent[$id]) ? $peopleByEvent[$id] : array();
        $emails = array();
        foreach ($group as $person) {
            $emails[] = $person['email'];
        }
        $list[] = array(
            'id' => $id,
            'name' => (string) $row['name'],
            'description' => (string) $row['description'],
            'people' => $group,
            'emails' => $emails,
            'createdAt' => (int) $row['created_at'],
            'updatedAt' => (int) $row['updated_at']
        );
    }
    return $list;
}

function db_upsert_event($item) {
    $id = (string) $item['id'];
    $name = (string) $item['name'];
    $description = (string) (isset($item['description']) ? $item['description'] : '');
    $created = (int) (isset($item['createdAt']) ? $item['createdAt'] : db_now());
    $updated = (int) (isset($item['updatedAt']) ? $item['updatedAt'] : $created);
    $people = isset($item['people']) && is_array($item['people']) ? $item['people'] : array();
    $conn = db();
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare(
            'INSERT INTO events (id, name, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                description = VALUES(description),
                created_at = VALUES(created_at),
                updated_at = VALUES(updated_at)'
        );
        $stmt->bind_param('sssii', $id, $name, $description, $created, $updated);
        $stmt->execute();
        $delete = $conn->prepare('DELETE FROM event_people WHERE event_id = ?');
        $delete->bind_param('s', $id);
        $delete->execute();
        $insert = $conn->prepare(
            'INSERT INTO event_people (event_id, name, email) VALUES (?, ?, ?)'
        );
        foreach ($people as $person) {
            if (!is_array($person)) {
                continue;
            }
            $personName = (string) (isset($person['name']) ? $person['name'] : '');
            $email = strtolower(trim((string) (isset($person['email']) ? $person['email'] : '')));
            if ($email === '') {
                continue;
            }
            $insert->bind_param('sss', $id, $personName, $email);
            $insert->execute();
        }
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        throw $e;
    }
}

function db_delete_event($id) {
    $stmt = db()->prepare('DELETE FROM events WHERE id = ?');
    $stmt->bind_param('s', $id);
    $stmt->execute();
}

function db_history() {
    $result = db()->query('SELECT payload FROM campaigns ORDER BY created_at DESC LIMIT 500');
    $list = array();
    while ($row = $result->fetch_assoc()) {
        $item = json_decode((string) $row['payload'], true);
        if (is_array($item) && !empty($item['id'])) {
            $list[] = $item;
        }
    }
    return $list;
}

function db_campaign_reason_map($details) {
    $map = array();
    if (!is_array($details)) {
        return $map;
    }
    foreach ($details as $line) {
        $text = (string) $line;
        $cut = strpos($text, ' — ') !== false ? explode(' — ', $text, 2) : explode(' - ', $text, 2);
        $email = strtolower(trim((string) $cut[0]));
        if ($email === '') {
            continue;
        }
        $map[$email] = isset($cut[1]) ? (string) $cut[1] : '';
    }
    return $map;
}

function db_upsert_campaign($item) {
    $id = (string) $item['id'];
    $created = (int) $item['createdAt'];
    $updated = (int) $item['updatedAt'];
    $eventName = (string) (isset($item['eventName']) ? $item['eventName'] : '');
    $subject = (string) (isset($item['subject']) ? $item['subject'] : '');
    $message = (string) (isset($item['message']) ? $item['message'] : '');
    $fromName = (string) (isset($item['fromName']) ? $item['fromName'] : '');
    $fromEmail = (string) (isset($item['fromEmail']) ? $item['fromEmail'] : '');
    $replyTo = (string) (isset($item['replyTo']) ? $item['replyTo'] : '');
    $sendMode = (isset($item['sendMode']) && $item['sendMode'] === 'batch') ? 'batch' : 'immediate';
    $batchSize = (int) (isset($item['batchSize']) ? $item['batchSize'] : 0);
    $batchCount = (int) (isset($item['batchCount']) ? $item['batchCount'] : 0);
    $batchesDone = (int) (isset($item['batchesDone']) ? $item['batchesDone'] : 0);
    $stopped = !empty($item['stopped']) ? 1 : 0;
    $success = (int) (isset($item['success']) ? $item['success'] : 0);
    $failed = (int) (isset($item['failed']) ? $item['failed'] : 0);
    $attachmentNames = json_encode(
        isset($item['attachmentNames']) && is_array($item['attachmentNames']) ? array_values($item['attachmentNames']) : array(),
        db_json_flags()
    );
    $payload = json_encode($item, db_json_flags());
    $conn = db();
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare(
            'INSERT INTO campaigns (
                id, created_at, updated_at, event_name, subject, message, from_name, from_email, reply_to,
                send_mode, batch_size, batch_count, batches_done, stopped, success_count, failed_count,
                attachment_names, payload
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                updated_at = VALUES(updated_at),
                event_name = VALUES(event_name),
                subject = VALUES(subject),
                message = VALUES(message),
                from_name = VALUES(from_name),
                from_email = VALUES(from_email),
                reply_to = VALUES(reply_to),
                send_mode = VALUES(send_mode),
                batch_size = VALUES(batch_size),
                batch_count = VALUES(batch_count),
                batches_done = VALUES(batches_done),
                stopped = VALUES(stopped),
                success_count = VALUES(success_count),
                failed_count = VALUES(failed_count),
                attachment_names = VALUES(attachment_names),
                payload = VALUES(payload)'
        );
        $stmt->bind_param(
            'siisssssssiiiiiiss',
            $id,
            $created,
            $updated,
            $eventName,
            $subject,
            $message,
            $fromName,
            $fromEmail,
            $replyTo,
            $sendMode,
            $batchSize,
            $batchCount,
            $batchesDone,
            $stopped,
            $success,
            $failed,
            $attachmentNames,
            $payload
        );
        $stmt->execute();

        $delete = $conn->prepare('DELETE FROM campaign_recipients WHERE campaign_id = ?');
        $delete->bind_param('s', $id);
        $delete->execute();

        $failedSet = array();
        if (isset($item['failedEmails']) && is_array($item['failedEmails'])) {
            foreach ($item['failedEmails'] as $email) {
                $failedSet[strtolower(trim((string) $email))] = true;
            }
        }
        $sentSet = array();
        if (isset($item['succeededEmails']) && is_array($item['succeededEmails'])) {
            foreach ($item['succeededEmails'] as $email) {
                $sentSet[strtolower(trim((string) $email))] = true;
            }
        }
        $reasons = db_campaign_reason_map(isset($item['failedDetails']) ? $item['failedDetails'] : array());
        $opens = isset($item['recipientOpens']) && is_array($item['recipientOpens']) ? $item['recipientOpens'] : array();
        $emails = array();
        $sources = isset($item['recipients']) && is_array($item['recipients']) ? $item['recipients'] : array();
        foreach ($sources as $email) {
            $emails[strtolower(trim((string) $email))] = true;
        }
        foreach (array_keys($sentSet) as $email) {
            $emails[$email] = true;
        }
        foreach (array_keys($failedSet) as $email) {
            $emails[$email] = true;
        }

        $insert = $conn->prepare(
            'INSERT INTO campaign_recipients
                (campaign_id, email, status, reason, open_token, opened_at, last_opened_at, open_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach (array_keys($emails) as $email) {
            if ($email === '') {
                continue;
            }
            if (isset($failedSet[$email])) {
                $status = 'failed';
            } elseif (isset($sentSet[$email])) {
                $status = 'sent';
            } else {
                $status = 'pending';
            }
            $reason = isset($reasons[$email]) ? substr((string) $reasons[$email], 0, 1000) : '';
            $open = isset($opens[$email]) && is_array($opens[$email]) ? $opens[$email] : array();
            $token = isset($open['token']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $open['token']) : '';
            $openedAt = !empty($open['openedAt']) ? (int) $open['openedAt'] : 0;
            $lastOpened = !empty($open['lastOpenedAt']) ? (int) $open['lastOpenedAt'] : $openedAt;
            $openCount = isset($open['openCount']) ? (int) $open['openCount'] : 0;
            $insert->bind_param(
                'sssssiii',
                $id,
                $email,
                $status,
                $reason,
                $token,
                $openedAt,
                $lastOpened,
                $openCount
            );
            $insert->execute();
        }
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        throw $e;
    }
}

function db_delete_campaign($id) {
    $stmt = db()->prepare('DELETE FROM campaigns WHERE id = ?');
    $stmt->bind_param('s', $id);
    $stmt->execute();
}

function db_clear_history() {
    db()->query('DELETE FROM campaigns');
}

function db_library() {
    $user = db_user();
    $auth = array('updatedAt' => 0);
    if ($user) {
        $auth = array(
            'email' => (string) $user['email'],
            'updatedAt' => (int) $user['updated_at']
        );
    }
    return array(
        'templates' => db_templates(),
        'events' => db_events(),
        'settings' => array(
            'config' => db_read_config(),
            'auth' => $auth
        ),
        'history' => db_history()
    );
}

function db_write_open($token, $first, $last, $count, $replace) {
    if ($replace) {
        $stmt = db()->prepare(
            'INSERT INTO email_opens (token, first_opened_at, last_opened_at, open_count)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                first_opened_at = LEAST(first_opened_at, VALUES(first_opened_at)),
                last_opened_at = GREATEST(last_opened_at, VALUES(last_opened_at)),
                open_count = GREATEST(open_count, VALUES(open_count))'
        );
        $stmt->bind_param('siii', $token, $first, $last, $count);
        $stmt->execute();
        return;
    }
    $stmt = db()->prepare(
        'INSERT INTO email_opens (token, first_opened_at, last_opened_at, open_count)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
            last_opened_at = VALUES(last_opened_at),
            open_count = open_count + 1'
    );
    $stmt->bind_param('sii', $token, $first, $last);
    $stmt->execute();
}

function db_record_open($token) {
    $token = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $token);
    if ($token === '') {
        return;
    }
    $now = db_now();
    db_write_open($token, $now, $now, 1, false);
}

function db_open_report() {
    $opens = array();
    $result = db()->query('SELECT token, first_opened_at, last_opened_at, open_count FROM email_opens');
    while ($row = $result->fetch_assoc()) {
        $opens[(string) $row['token']] = array(
            'firstOpenedAt' => (int) $row['first_opened_at'],
            'lastOpenedAt' => (int) $row['last_opened_at'],
            'count' => (int) $row['open_count']
        );
    }
    return array('opens' => $opens);
}
