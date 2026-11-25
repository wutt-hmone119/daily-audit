CREATE TABLE IF NOT EXISTS accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deliveries (
  id VARCHAR(100) NOT NULL,
  delivery_date DATE NOT NULL,
  movement_type ENUM('incoming','outgoing') NOT NULL,
  truck VARCHAR(80) NOT NULL DEFAULT '',
  supplier VARCHAR(100) NOT NULL,
  prepared_by VARCHAR(100) NOT NULL,
  paid_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  deleted_at DATETIME NULL,
  deletion_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_delivery_date (delivery_date),
  KEY idx_deleted_at (deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS delivery_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_id VARCHAR(100) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'အထွေထွေ',
  quantity DECIMAL(20,4) NOT NULL,
  unit_price DECIMAL(20,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_delivery_id (delivery_id),
  CONSTRAINT fk_delivery_items_delivery
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
) ENGINE=InnoDB;
