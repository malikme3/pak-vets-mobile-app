import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitTreatmentApi } from '../../services/vetApi';
import type { VisitTreatment, CreateVisitTreatmentRequest, UpdateVisitTreatmentRequest } from '../../types/api';
import { visitKeys } from '../visits/hooks';

export const treatmentKeys = {
  all: ['treatment'] as const,
  detail: (id: number) => [...treatmentKeys.all, id] as const,
  byVisit: (visitId: number) => [...treatmentKeys.all, 'visit', visitId] as const,
};

export function useVisitTreatment(treatmentId: number) {
  return useQuery({
    queryKey: treatmentKeys.detail(treatmentId),
    queryFn: () => visitTreatmentApi.getVisitTreatment(treatmentId),
    enabled: treatmentId > 0,
  });
}

export function useVisitTreatments(visitId: number) {
  return useQuery({
    queryKey: treatmentKeys.byVisit(visitId),
    queryFn: () => visitTreatmentApi.getVisitTreatmentsByVisit(visitId),
    enabled: visitId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateVisitTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateVisitTreatmentRequest) =>
      visitTreatmentApi.createVisitTreatment(request),
    onSuccess: (data) => {
      // Invalidate treatment queries for this visit
      queryClient.invalidateQueries({ queryKey: treatmentKeys.byVisit(data.visitId) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.detail(data.treatmentId) });
      // Also invalidate visit queries
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
    },
  });
}

export function useUpdateVisitTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ treatmentId, request }: { treatmentId: number; request: UpdateVisitTreatmentRequest }) =>
      visitTreatmentApi.updateVisitTreatment(treatmentId, request),
    onSuccess: (data) => {
      // Invalidate specific treatment and visit queries
      queryClient.invalidateQueries({ queryKey: treatmentKeys.detail(data.treatmentId) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.byVisit(data.visitId) });
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
    },
  });
}

export function useDeleteVisitTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ treatmentId, visitId }: { treatmentId: number; visitId: number }) =>
      visitTreatmentApi.deleteVisitTreatment(treatmentId),
    onSuccess: (_, variables) => {
      // Invalidate treatment queries for this visit
      queryClient.invalidateQueries({ queryKey: treatmentKeys.byVisit(variables.visitId) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.all });
      // Also invalidate visit queries
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(variables.visitId) });
    },
  });
}
