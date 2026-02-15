import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseApi } from "../../services/vetApi";
import type {
  Case,
  CreateCaseRequest,
  UpdateCaseRequest,
} from "../../types/api";
import { animalKeys } from "../animals/hooks";

export const caseKeys = {
  all: ["case"] as const,
  detail: (id: number) => [...caseKeys.all, id] as const,
  list: (filters?: { animalId?: number; doctorId?: number }) =>
    [...caseKeys.all, "list", filters] as const,
};

export function useCase(caseId: number) {
  return useQuery({
    queryKey: caseKeys.detail(caseId),
    queryFn: () => caseApi.getCase(caseId),
    enabled: caseId > 0,
  });
}

export function useCasesByAnimal(animalId: number) {
  return useQuery({
    queryKey: caseKeys.list({ animalId }),
    queryFn: () => caseApi.getCasesByAnimal(animalId),
    enabled: animalId > 0,
  });
}

export function useCasesByDoctor(doctorId: number) {
  return useQuery({
    queryKey: caseKeys.list({ doctorId }),
    queryFn: () => caseApi.getCasesByDoctor(doctorId),
    enabled: doctorId > 0,
  });
}

export function useAllCases() {
  return useQuery({
    queryKey: caseKeys.list(),
    queryFn: () => caseApi.getAllCases(),
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCaseRequest) => caseApi.createCase(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.list({ animalId: data.animalId }),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.list({ doctorId: data.doctorId }),
      });
      queryClient.invalidateQueries({ queryKey: caseKeys.list() });
      queryClient.invalidateQueries({
        queryKey: animalKeys.detail(data.animalId),
      });
    },
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      caseId,
      request,
    }: {
      caseId: number;
      request: UpdateCaseRequest;
    }) => caseApi.updateCase(caseId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.list({ animalId: data.animalId }),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.list({ doctorId: data.doctorId }),
      });
    },
  });
}

export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (caseId: number) => caseApi.deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.all });
    },
  });
}
