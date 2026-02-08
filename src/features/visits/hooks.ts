import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitApi } from '../../services/vetApi';
import type { Visit, CreateVisitRequest, UpdateVisitRequest } from '../../types/api';
import { animalKeys } from '../animals/hooks';

export const visitKeys = {
  all: ['visit'] as const,
  detail: (id: number) => [...visitKeys.all, id] as const,
  list: (filters?: { animalId?: number; doctorId?: number }) =>
    [...visitKeys.all, 'list', filters] as const,
};

export function useVisit(visitId: number) {
  return useQuery({
    queryKey: visitKeys.detail(visitId),
    queryFn: () => visitApi.getVisit(visitId),
    enabled: visitId > 0,
  });
}

export function useVisitsByAnimal(animalId: number) {
  return useQuery({
    queryKey: visitKeys.list({ animalId }),
    queryFn: () => visitApi.getVisitsByAnimal(animalId),
    enabled: animalId > 0,
  });
}

export function useVisitsByDoctor(doctorId: number) {
  return useQuery({
    queryKey: visitKeys.list({ doctorId }),
    queryFn: () => visitApi.getVisitsByDoctor(doctorId),
    enabled: doctorId > 0,
  });
}

export function useAllVisits() {
  return useQuery({
    queryKey: visitKeys.list(),
    queryFn: () => visitApi.getAllVisits(),
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateVisitRequest) => visitApi.createVisit(request),
    onSuccess: (data) => {
      // Invalidate visit queries
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
      queryClient.invalidateQueries({ queryKey: visitKeys.list({ animalId: data.animalId }) });
      queryClient.invalidateQueries({ queryKey: visitKeys.list({ doctorId: data.doctorId }) });
      queryClient.invalidateQueries({ queryKey: visitKeys.list() });
      // Also invalidate animal queries since visit count might change
      queryClient.invalidateQueries({ queryKey: animalKeys.detail(data.animalId) });
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, request }: { visitId: number; request: UpdateVisitRequest }) =>
      visitApi.updateVisit(visitId, request),
    onSuccess: (data) => {
      // Invalidate specific visit and related queries
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
      queryClient.invalidateQueries({ queryKey: visitKeys.list({ animalId: data.animalId }) });
      queryClient.invalidateQueries({ queryKey: visitKeys.list({ doctorId: data.doctorId }) });
    },
  });
}

export function useDeleteVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (visitId: number) => visitApi.deleteVisit(visitId),
    onSuccess: () => {
      // Invalidate all visit queries
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
    },
  });
}
