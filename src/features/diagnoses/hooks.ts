import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseDiagnosisApi } from "../../services/vetApi";
import type {
  CaseDiagnosis,
  CreateCaseDiagnosisRequest,
  UpdateCaseDiagnosisRequest,
} from "../../types/api";
import { caseKeys } from "../cases/hooks";

export const diagnosisKeys = {
  all: ["diagnosis"] as const,
  detail: (id: number) => [...diagnosisKeys.all, id] as const,
  byCase: (caseId: number) =>
    [...diagnosisKeys.all, "case", caseId] as const,
};

export function useCaseDiagnosis(diagnosisId: number) {
  return useQuery({
    queryKey: diagnosisKeys.detail(diagnosisId),
    queryFn: () => caseDiagnosisApi.getCaseDiagnosis(diagnosisId),
    enabled: diagnosisId > 0,
  });
}

export function useCaseDiagnoses(caseId: number) {
  return useQuery({
    queryKey: diagnosisKeys.byCase(caseId),
    queryFn: () => caseDiagnosisApi.getCaseDiagnosesByCase(caseId),
    enabled: caseId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCaseDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCaseDiagnosisRequest) =>
      caseDiagnosisApi.createCaseDiagnosis(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: diagnosisKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: diagnosisKeys.detail(data.diagnosisId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useUpdateCaseDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      diagnosisId,
      request,
    }: {
      diagnosisId: number;
      request: UpdateCaseDiagnosisRequest;
    }) => caseDiagnosisApi.updateCaseDiagnosis(diagnosisId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: diagnosisKeys.detail(data.diagnosisId),
      });
      queryClient.invalidateQueries({
        queryKey: diagnosisKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useDeleteCaseDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      diagnosisId,
      caseId,
    }: {
      diagnosisId: number;
      caseId: number;
    }) => caseDiagnosisApi.deleteCaseDiagnosis(diagnosisId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: diagnosisKeys.byCase(variables.caseId),
      });
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.all });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(variables.caseId),
      });
    },
  });
}
