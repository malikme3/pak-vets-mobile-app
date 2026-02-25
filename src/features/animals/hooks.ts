import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { animalApi } from "../../services/vetApi";
import type {
  Animal,
  CreateAnimalRequest,
  UpdateAnimalRequest,
  PaginatedData,
} from "../../types/api";

export const animalKeys = {
  all: ["animal"] as const,
  detail: (id: number) => [...animalKeys.all, id] as const,
  images: (id: number) => [...animalKeys.all, id, "images"] as const,
  listRoot: () => [...animalKeys.all, "list"] as const,
  list: (filters?: { species?: string }) =>
    [...animalKeys.listRoot(), filters?.species ?? "all"] as const,
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
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useAnimals(species?: string) {
  return useQuery({
    queryKey: animalKeys.list({ species }),
    queryFn: () => animalApi.getAllAnimals(species),
  });
}

export function useSearchAnimals(query: string) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: animalKeys.search(normalizedQuery),
    queryFn: () => animalApi.searchAnimals(normalizedQuery),
    enabled: normalizedQuery.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useSearchAnimalsPaginated(
  query: string,
  pageSize: number = 20,
) {
  const normalizedQuery = query.trim();

  return useInfiniteQuery<PaginatedData<Animal>, Error>({
    queryKey: [
      "animal",
      "search-paginated",
      normalizedQuery,
      pageSize,
    ] as const,
    enabled: normalizedQuery.length >= 2,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      animalApi.searchAnimalsPage(
        normalizedQuery,
        typeof pageParam === "number" ? pageParam : 0,
        pageSize,
      ),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.pagination;
      if (!pagination?.hasNext) return undefined;
      if (typeof pagination.nextOffset === "number")
        return pagination.nextOffset;
      return undefined;
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateAnimalRequest) =>
      animalApi.createAnimal(request),
    onSuccess: () => {
      // Invalidate animal list queries
      queryClient.invalidateQueries({ queryKey: animalKeys.listRoot() });
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
      queryClient.invalidateQueries({ queryKey: animalKeys.listRoot() });
    },
  });
}

export function useDeleteAnimal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (animalId: number) => animalApi.deleteAnimal(animalId),
    onSuccess: () => {
      // Invalidate animal list queries
      queryClient.invalidateQueries({ queryKey: animalKeys.listRoot() });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
    },
  });
}
