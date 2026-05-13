package iuh.fit.notificationservice.Service;

import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;

public interface NotificationService {

    NotificationResponse sendNotification(SendNotificationRequest request);

    NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request);

    void sendVerificationEmail(VerificationEmailEvent event);

    void sendAccountLockedEmail(AccountEvent event);

    void sendAccountUnlockedEmail(AccountEvent event);

    void sendOrderCreatedEmail(OrderStatusEvent event);

    void sendOrderPaidEmail(OrderStatusEvent event);

    void sendOrderCancelledEmail(OrderStatusEvent event);
}
