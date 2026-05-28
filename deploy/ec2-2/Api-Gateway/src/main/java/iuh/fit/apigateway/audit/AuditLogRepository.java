package iuh.fit.apigateway.audit;

import org.springframework.data.elasticsearch.repository.ReactiveElasticsearchRepository;
import org.springframework.stereotype.Repository;

/**
 * Reactive Spring Data Elasticsearch repository for AuditLog documents.
 * Uses non-blocking I/O so it is safe to use inside a WebFlux/Project Reactor pipeline.
 */
@Repository
public interface AuditLogRepository extends ReactiveElasticsearchRepository<AuditLog, String> {
}
