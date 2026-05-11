package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class PaginatedUserResponse {
    private List<UserSummaryResponse> data;
    private long total;
    private int page;
    private int size;
    private int totalPages;
}
