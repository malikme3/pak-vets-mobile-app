import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitDiagnosisApi } from '../../services/vetApi';
import type { VisitDiagnosis, CreateVisitDiagnosisRequest, UpdateVisitDiagnosisRequest } from '../../types/api';
import { visitKeys } from '../visits/hooks';

export const diagnosisKeys = {
  all: ['diagnosis'] as const,
  detail: (id: number) => [...diagnosisKeys.all, id] as const,
  byVisit: (visitId: number) => [...diagnosisKeys.all, 'visit', visitId] as const,
};

export function useVisitDiagnosis(diagnosisId: number) {
  return useQuery({
    queryKey: diagnosisKeys.detail(diagnosisId),
    queryFn: () => visitDiagnosisApi.getVisitDiagnosis(diagnosisId),
    enabled: diagnosisId > 0,
  });
}

export function useVisitDiagnoses(visitId: number) {
  return useQuery({
    queryKey: diagnosisKeys.byVisit(visitId),
    queryFn: () => visitDiagnosisApi.getVisitDiagnosesByVisit(visitId),
    enabled: visitId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateVisitDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateVisitDiagnosisRequest) =>
      visitDiagnosisApi.createVisitDiagnosis(request),
    onSuccess: (data) => {
      // Invalidate diagnosis queries for this visit
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.byVisit(data.visitId) });
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.detail(data.diagnosisId) });
      // Also invalidate visit queries since diagnosis count might change
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
    },
  });
}

export function useUpdateVisitDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ diagnosisId, request }: { diagnosisId: number; request: UpdateVisitDiagnosisRequest }) =>
      visitDiagnosisApi.updateVisitDiagnosis(diagnosisId, request),
    onSuccess: (data) => {
      // Invalidate specific diagnosis and visit queries
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.detail(data.diagnosisId) });
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.byVisit(data.visitId) });
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
    },
  });
}

export function useDeleteVisitDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ diagnosisId, visitId }: { diagnosisId: number; visitId: number }) =>
      visitDiagnosisApi.deleteVisitDiagnosis(diagnosisId),
    onSuccess: (_, variables) => {
      // Invalidate diagnosis queries for this visit
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.byVisit(variables.visitId) });
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.all });
      // Also invalidate visit queries
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(variables.visitId) });
    },
  });
}
