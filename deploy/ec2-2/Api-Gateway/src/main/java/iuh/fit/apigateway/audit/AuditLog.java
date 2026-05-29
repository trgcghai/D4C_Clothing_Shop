package iuh.fit.apigateway.audit;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;

/**
 * Elasticsearch document that represents one audit event captured at the API Gateway.
 * Each incoming HTTP request produces exactly one AuditLog entry after the response
 * has been sent to the client.
 */
@Document(indexName = "api-gateway-audit")
public class AuditLog {

    @Id
    private String id;

    /** Timestamp when the request was received (UTC). */
    @Field(type = FieldType.Date, format = DateFormat.date_time)
    private Instant timestamp;

    /** Authenticated user ID extracted from JWT; null for anonymous requests. */
    @Field(type = FieldType.Keyword)
    private String userId;

    /** Username / subject from JWT; null for anonymous requests. */
    @Field(type = FieldType.Keyword)
    private String username;

    /** HTTP method: GET, POST, PUT, DELETE, PATCH, … */
    @Field(type = FieldType.Keyword)
    private String method;

    /** Raw request path, e.g. /api/products/123. */
    @Field(type = FieldType.Keyword)
    private String path;

    /** Client IP address (from X-Forwarded-For if behind proxy, else remoteAddress). */
    @Field(type = FieldType.Keyword)
    private String clientIp;

    /** HTTP response status code returned to the client. */
    @Field(type = FieldType.Integer)
    private int statusCode;

    /** Total round-trip duration in milliseconds (gateway receives → gateway sends response). */
    @Field(type = FieldType.Long)
    private long durationMs;

    /** The service the request was routed to, e.g. USERSERVICE. */
    @Field(type = FieldType.Keyword)
    private String targetService;

    // -------------------------------------------------------------------------
    // Constructors
    // -------------------------------------------------------------------------

    public AuditLog() {}

    private AuditLog(Builder builder) {
        this.id           = builder.id;
        this.timestamp    = builder.timestamp;
        this.userId       = builder.userId;
        this.username     = builder.username;
        this.method       = builder.method;
        this.path         = builder.path;
        this.clientIp     = builder.clientIp;
        this.statusCode   = builder.statusCode;
        this.durationMs   = builder.durationMs;
        this.targetService = builder.targetService;
    }

    // -------------------------------------------------------------------------
    // Builder
    // -------------------------------------------------------------------------

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String id;
        private Instant timestamp;
        private String userId;
        private String username;
        private String method;
        private String path;
        private String clientIp;
        private int statusCode;
        private long durationMs;
        private String targetService;

        public Builder id(String id)                       { this.id = id; return this; }
        public Builder timestamp(Instant ts)               { this.timestamp = ts; return this; }
        public Builder userId(String uid)                  { this.userId = uid; return this; }
        public Builder username(String u)                  { this.username = u; return this; }
        public Builder method(String m)                    { this.method = m; return this; }
        public Builder path(String p)                      { this.path = p; return this; }
        public Builder clientIp(String ip)                 { this.clientIp = ip; return this; }
        public Builder statusCode(int code)                { this.statusCode = code; return this; }
        public Builder durationMs(long ms)                 { this.durationMs = ms; return this; }
        public Builder targetService(String svc)           { this.targetService = svc; return this; }

        public AuditLog build()                            { return new AuditLog(this); }
    }

    // -------------------------------------------------------------------------
    // Getters / Setters
    // -------------------------------------------------------------------------

    public String getId()                { return id; }
    public void setId(String id)         { this.id = id; }

    public Instant getTimestamp()        { return timestamp; }
    public void setTimestamp(Instant ts) { this.timestamp = ts; }

    public String getUserId()            { return userId; }
    public void setUserId(String uid)    { this.userId = uid; }

    public String getUsername()          { return username; }
    public void setUsername(String u)    { this.username = u; }

    public String getMethod()            { return method; }
    public void setMethod(String m)      { this.method = m; }

    public String getPath()              { return path; }
    public void setPath(String p)        { this.path = p; }

    public String getClientIp()          { return clientIp; }
    public void setClientIp(String ip)   { this.clientIp = ip; }

    public int getStatusCode()           { return statusCode; }
    public void setStatusCode(int code)  { this.statusCode = code; }

    public long getDurationMs()          { return durationMs; }
    public void setDurationMs(long ms)   { this.durationMs = ms; }

    public String getTargetService()     { return targetService; }
    public void setTargetService(String svc) { this.targetService = svc; }
}
