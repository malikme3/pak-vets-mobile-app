import { apiClient } from "./apiClient";
import type { Doctor } from "../types/api";

type LoginResponse = {
  sessionToken: string;
  doctorId: number;
  status: string;
};

export const authApi = {
  loginWithFirebase: async (firebaseIdToken: string): Promise<LoginResponse> => {
    const response = await apiClient.instance.post<{ data: LoginResponse }>(
      "/auth/login",
      {},
      {
        headers: {
          Authorization: `Bearer ${firebaseIdToken}`,
        },
      },
    );
    return response.data.data;
  },
  me: async (): Promise<Doctor> => {
    const response = await apiClient.instance.get<{ data: Doctor }>(
      "/auth/me",
    );
    return response.data.data;
  },
};
