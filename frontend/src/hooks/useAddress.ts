import { useQuery } from "@tanstack/react-query";
import { getProvinces, getWards } from "../services/provinceApi";

export function useProvinces() {
  return useQuery({
    queryKey: ["provinces"],
    queryFn: getProvinces,
    staleTime: Infinity,
  });
}

export function useWards(provinceCode: number | undefined) {
  return useQuery({
    queryKey: ["wards", provinceCode],
    queryFn: () => getWards(provinceCode!),
    enabled: !!provinceCode,
  });
}
