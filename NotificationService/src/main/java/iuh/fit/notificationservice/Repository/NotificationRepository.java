package iuh.fit.notificationservice.Repository;

import iuh.fit.notificationservice.Domain.Entity.Notification;
import iuh.fit.notificationservice.Domain.Enum.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    List<Notification> findByStatus(NotificationStatus status);

    List<Notification> findByUserId(Long userId);

    List<Notification> findByEmail(String email);
}
