package iuh.fit.notificationservice.Migration;

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
        log.info("Checking database migrations for NotificationService...");
        addEmailColumnIfNeeded();
        makeUserIdNullableIfNeeded();
        log.info("Database migration check complete.");
    }

    private void addEmailColumnIfNeeded() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'notifications' " +
                            "AND COLUMN_NAME = 'email'",
                    Integer.class);

            if (count != null && count > 0) {
                log.info("Migration V1: 'email' column already exists in notifications table, skipping.");
                return;
            }

            log.info("Migration V1: Adding 'email' column to notifications table...");
            jdbcTemplate.execute("ALTER TABLE notifications ADD COLUMN email VARCHAR(255) AFTER user_id");
            log.info("Migration V1: 'email' column added successfully.");
        } catch (Exception e) {
            log.error("Migration V1: Failed to add 'email' column: {}", e.getMessage());
        }
    }

    private void makeUserIdNullableIfNeeded() {
        try {
            Integer nullableCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'notifications' " +
                            "AND COLUMN_NAME = 'user_id' " +
                            "AND IS_NULLABLE = 'YES'",
                    Integer.class);

            if (nullableCount != null && nullableCount > 0) {
                log.info("Migration V1: 'user_id' is already nullable, skipping.");
                return;
            }

            log.info("Migration V1: Making 'user_id' column nullable...");
            jdbcTemplate.execute("ALTER TABLE notifications MODIFY COLUMN user_id BIGINT NULL");
            log.info("Migration V1: 'user_id' column is now nullable.");
        } catch (Exception e) {
            log.error("Migration V1: Failed to make 'user_id' nullable: {}", e.getMessage());
        }
    }
}
