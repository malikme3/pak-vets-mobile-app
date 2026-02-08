import { useQuery } from '@tanstack/react-query';
import { doctorApi } from '../../services/vetApi';
import type { Doctor } from '../../types/api';

export const doctorKeys = {
  all: ['doctor'] as const,
  me: () => [...doctorKeys.all, 'me'] as const,
  detail: (id: number) => [...doctorKeys.all, id] as const,
  list: (filters?: { status?: 'ACTIVE' | 'INACTIVE' }) =>
    [...doctorKeys.all, 'list', filters] as const,
};

export function useCurrentDoctor() {
  // For now, get all doctors and use the first active one
  // TODO: Get doctor ID from auth store when auth is implemented
  return useQuery({
    queryKey: doctorKeys.me(),
    queryFn: async () => {
      const doctors = await doctorApi.getAllDoctors('ACTIVE');
      if (doctors.length === 0) {
        // If no active doctors, try getting all doctors
        const allDoctors = await doctorApi.getAllDoctors();
        if (allDoctors.length === 0) {
          throw new Error('No doctors found');
        }
        return allDoctors[0];
      }
      return doctors[0];
    },
  });
}

export function useDoctor(doctorId: number) {
  return useQuery({
    queryKey: doctorKeys.detail(doctorId),
    queryFn: () => doctorApi.getDoctor(doctorId),
    enabled: doctorId > 0,
  });
}

export function useDoctors(status?: 'ACTIVE' | 'INACTIVE') {
  return useQuery({
    queryKey: doctorKeys.list({ status }),
    queryFn: () => doctorApi.getAllDoctors(status),
  });
}
