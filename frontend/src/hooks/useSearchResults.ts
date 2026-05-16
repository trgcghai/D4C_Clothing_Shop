import { useQuery } from "@tanstack/react-query";
import { searchProducts, type SearchOptions } from "../services/searchApi";

export const searchKeys = {
  all: ["search"] as const,
  list: (query: string, options?: SearchOptions) =>
    [...searchKeys.all, query, options] as const,
};

export function useSearchResults(query: string, options?: SearchOptions) {
  return useQuery({
    queryKey: searchKeys.list(query, options),
    queryFn: () => searchProducts(query, options),
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}
