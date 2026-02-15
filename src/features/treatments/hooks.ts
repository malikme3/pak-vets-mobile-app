import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseTreatmentApi } from "../../services/vetApi";
import type {
  CaseTreatment,
  CreateCaseTreatmentRequest,
  UpdateCaseTreatmentRequest,
} from "../../types/api";
import { caseKeys } from "../cases/hooks";

export const treatmentKeys = {
  all: ["treatment"] as const,
  detail: (id: number) => [...treatmentKeys.all, id] as const,
  byCase: (caseId: number) =>
    [...treatmentKeys.all, "case", caseId] as const,
};

export function useCaseTreatment(treatmentId: number) {
  return useQuery({
    queryKey: treatmentKeys.detail(treatmentId),
    queryFn: () => caseTreatmentApi.getCaseTreatment(treatmentId),
    enabled: treatmentId > 0,
  });
}

export function useCaseTreatments(caseId: number) {
  return useQuery({
    queryKey: treatmentKeys.byCase(caseId),
    queryFn: () => caseTreatmentApi.getCaseTreatmentsByCase(caseId),
    enabled: caseId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCaseTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCaseTreatmentRequest) =>
      caseTreatmentApi.createCaseTreatment(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: treatmentKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: treatmentKeys.detail(data.treatmentId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useUpdateCaseTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      treatmentId,
      request,
    }: {
      treatmentId: number;
      request: UpdateCaseTreatmentRequest;
    }) => caseTreatmentApi.updateCaseTreatment(treatmentId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: treatmentKeys.detail(data.treatmentId),
      });
      queryClient.invalidateQueries({
        queryKey: treatmentKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useDeleteCaseTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      treatmentId,
      caseId,
    }: {
      treatmentId: number;
      caseId: number;
    }) => caseTreatmentApi.deleteCaseTreatment(treatmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: treatmentKeys.byCase(variables.caseId),
      });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.all });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(variables.caseId),
      });
    },
  });
}
