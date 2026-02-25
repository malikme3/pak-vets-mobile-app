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
  listRoot: () => [...caseKeys.all, "list"] as const,
  byAnimal: (animalId: number) =>
    [...caseKeys.listRoot(), "animal", animalId] as const,
  byDoctor: (doctorId: number) =>
    [...caseKeys.listRoot(), "doctor", doctorId] as const,
  allList: () => [...caseKeys.listRoot(), "all"] as const,
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
    queryKey: caseKeys.byAnimal(animalId),
    queryFn: () => caseApi.getCasesByAnimal(animalId),
    enabled: animalId > 0,
  });
}

export function useCasesByDoctor(doctorId: number) {
  return useQuery({
    queryKey: caseKeys.byDoctor(doctorId),
    queryFn: () => caseApi.getCasesByDoctor(doctorId),
    enabled: doctorId > 0,
  });
}

export function useAllCases() {
  return useQuery({
    queryKey: caseKeys.allList(),
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
        queryKey: caseKeys.byAnimal(data.animalId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.byDoctor(data.doctorId),
      });
      queryClient.invalidateQueries({ queryKey: caseKeys.listRoot() });
      queryClient.invalidateQueries({
        queryKey: animalKeys.detail(data.animalId),
      });
      // Refetch animal images so Active Cases avatar appears once step function has enrolled images.
      queryClient.invalidateQueries({
        queryKey: animalKeys.images(data.animalId),
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
        queryKey: caseKeys.byAnimal(data.animalId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.byDoctor(data.doctorId),
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
