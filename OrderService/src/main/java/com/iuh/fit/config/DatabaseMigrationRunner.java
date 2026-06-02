package com.iuh.fit.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigrationRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseMigrationRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("Checking database migrations for OrderService...");
        createShedlockTableIfNeeded();
        log.info("Database migration check complete.");
    }

    private void createShedlockTableIfNeeded() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'shedlock'",
                    Integer.class);

            if (count != null && count > 0) {
                log.info("Migration V1: 'shedlock' table already exists, skipping.");
                return;
            }

            log.info("Migration V1: Creating 'shedlock' table...");
            jdbcTemplate.execute(
                    "CREATE TABLE shedlock (" +
                            "name VARCHAR(64) NOT NULL, " +
                            "lock_until TIMESTAMP(3) NOT NULL, " +
                            "locked_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), " +
                            "locked_by VARCHAR(255) NOT NULL, " +
                            "PRIMARY KEY (name)" +
                            ")"
            );
            log.info("Migration V1: 'shedlock' table created successfully.");
        } catch (Exception e) {
            log.error("Migration V1: Failed to create 'shedlock' table: {}", e.getMessage());
        }
    }
}
