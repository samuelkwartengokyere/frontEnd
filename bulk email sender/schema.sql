-- Campaign Studio database for XAMPP / MariaDB.
-- Database name: tha_campaign_studio
-- Default XAMPP login: host 127.0.0.1, user root, password empty.
--
-- phpMyAdmin: http://localhost/phpmyadmin
-- Import this file on the Import tab, or open the app once and it creates
-- the same tables on first use.
--
-- The default workspace user is inserted by the app (not by this file):
--   email:    events@techhubafrica.org
--   password: the password in config.js (AfricaTech2026 until you change it)

CREATE DATABASE IF NOT EXISTS tha_campaign_studio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tha_campaign_studio;

-- Workspace sign-in. The password is stored as a hash.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sender, EmailJS, logo, batch, and open-tracking settings (one row per scope).
CREATE TABLE IF NOT EXISTS app_settings (
  scope VARCHAR(32) NOT NULL,
  payload LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reusable campaign messages.
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  subject VARCHAR(300) NOT NULL DEFAULT '',
  message MEDIUMTEXT NOT NULL,
  logo_url VARCHAR(2000) NOT NULL DEFAULT '',
  logo_data MEDIUMTEXT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event audiences such as Hackathon or Startup Pitch.
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- People on an event list.
CREATE TABLE IF NOT EXISTS event_people (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_person (event_id, email),
  CONSTRAINT fk_event_people_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per launched campaign. The full history record is in payload.
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(80) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  event_name VARCHAR(200) NOT NULL DEFAULT '',
  subject VARCHAR(300) NOT NULL DEFAULT '',
  message MEDIUMTEXT NOT NULL,
  from_name VARCHAR(200) NOT NULL DEFAULT '',
  from_email VARCHAR(190) NOT NULL DEFAULT '',
  reply_to VARCHAR(190) NOT NULL DEFAULT '',
  send_mode VARCHAR(20) NOT NULL DEFAULT 'immediate',
  batch_size INT UNSIGNED NOT NULL DEFAULT 0,
  batch_count INT UNSIGNED NOT NULL DEFAULT 0,
  batches_done INT UNSIGNED NOT NULL DEFAULT 0,
  stopped TINYINT(1) NOT NULL DEFAULT 0,
  success_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  attachment_names TEXT NULL,
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_campaigns_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per address in a campaign, including send status and open counts.
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason VARCHAR(1000) NOT NULL DEFAULT '',
  open_token VARCHAR(80) NULL,
  opened_at BIGINT NULL,
  last_opened_at BIGINT NULL,
  open_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_recipient (campaign_id, email),
  KEY idx_campaign_recipient_token (open_token),
  CONSTRAINT fk_campaign_recipients_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Open-tracking pixels. A token can be recorded before the campaign row is saved.
CREATE TABLE IF NOT EXISTS email_opens (
  token VARCHAR(80) NOT NULL,
  first_opened_at BIGINT NOT NULL,
  last_opened_at BIGINT NOT NULL,
  open_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Internal flags (legacy file import). Not used by the campaign screens.
CREATE TABLE IF NOT EXISTS studio_meta (
  meta_key VARCHAR(64) NOT NULL,
  meta_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
