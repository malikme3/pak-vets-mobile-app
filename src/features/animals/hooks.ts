import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalApi } from "../../services/vetApi";
import type {
  Animal,
  CreateAnimalRequest,
  UpdateAnimalRequest,
} from "../../types/api";

export const animalKeys = {
  all: ["animal"] as const,
  detail: (id: number) => [...animalKeys.all, id] as const,
  images: (id: number) => [...animalKeys.all, id, "images"] as const,
  list: (filters?: { species?: string }) =>
    [...animalKeys.all, "list", filters] as const,
  search: (query: string) => [...animalKeys.all, "search", query] as const,
};

export function useAnimal(animalId: number) {
  return useQuery({
    queryKey: animalKeys.detail(animalId),
    queryFn: () => animalApi.getAnimal(animalId),
    enabled: animalId > 0,
  });
}

export function useAnimalImages(animalId: number) {
  return useQuery({
    queryKey: animalKeys.images(animalId),
    queryFn: () => animalApi.getAnimalImages(animalId),
    enabled: animalId > 0,
  });
}

export function useAnimals(species?: string) {
  return useQuery({
    queryKey: animalKeys.list({ species }),
    queryFn: () => animalApi.getAllAnimals(species),
  });
}

export function useSearchAnimals(query: string) {
  return useQuery({
    queryKey: animalKeys.search(query),
    queryFn: () => animalApi.searchAnimals(query),
    enabled: query.length > 0,
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateAnimalRequest) =>
      animalApi.createAnimal(request),
    onSuccess: () => {
      // Invalidate animal list queries
      queryClient.invalidateQueries({ queryKey: animalKeys.list() });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
    },
  });
}

export function useUpdateAnimal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      animalId,
      request,
    }: {
      animalId: number;
      request: UpdateAnimalRequest;
    }) => animalApi.updateAnimal(animalId, request),
    onSuccess: (data) => {
      // Invalidate specific animal and list queries
      queryClient.invalidateQueries({
        queryKey: animalKeys.detail(data.animalId),
      });
      queryClient.invalidateQueries({ queryKey: animalKeys.list() });
    },
  });
}

export function useDeleteAnimal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (animalId: number) => animalApi.deleteAnimal(animalId),
    onSuccess: () => {
      // Invalidate animal list queries
      queryClient.invalidateQueries({ queryKey: animalKeys.list() });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
    },
  });
}
