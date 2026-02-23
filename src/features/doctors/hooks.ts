import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../services/authApi";
import { useAuthStore } from "../../store/authStore";
import type { Doctor } from "../../types/api";

export const doctorKeys = {
  all: ["doctor"] as const,
  me: () => [...doctorKeys.all, "me"] as const,
  detail: (id: number) => [...doctorKeys.all, id] as const,
  list: (filters?: { status?: "ACTIVE" | "INACTIVE" }) =>
    [...doctorKeys.all, "list", filters] as const,
};

export function useCurrentDoctor() {
  const authStatus = useAuthStore((state) => state.status);
  return useQuery({
    queryKey: doctorKeys.me(),
    queryFn: () => authApi.me(),
    enabled: authStatus === "signedIn",
  });
}

export function useDoctor(doctorId: number) {
  return useQuery({
    queryKey: doctorKeys.detail(doctorId),
    queryFn: () => doctorApi.getDoctor(doctorId),
    enabled: doctorId > 0,
  });
}

export function useDoctors(status?: "ACTIVE" | "INACTIVE") {
  return useQuery({
    queryKey: doctorKeys.list({ status }),
    queryFn: () => doctorApi.getAllDoctors(status),
  });
}
