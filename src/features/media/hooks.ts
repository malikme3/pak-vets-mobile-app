import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaFileApi } from "../../services/vetApi";
import type {
  MediaFile,
  CreateMediaFileRequest,
  UpdateMediaFileRequest,
} from "../../types/api";
import { caseKeys } from "../cases/hooks";
import { animalKeys } from "../animals/hooks";

export const mediaKeys = {
  all: ["media"] as const,
  detail: (id: number) => [...mediaKeys.all, id] as const,
  byCase: (caseId: number) => [...mediaKeys.all, "case", caseId] as const,
  byAnimal: (animalId: number) =>
    [...mediaKeys.all, "animal", animalId] as const,
};

export function useMediaFile(mediaId: number) {
  return useQuery({
    queryKey: mediaKeys.detail(mediaId),
    queryFn: () => mediaFileApi.getMediaFile(mediaId),
    enabled: mediaId > 0,
  });
}

export function useMediaFilesByCase(caseId: number) {
  return useQuery({
    queryKey: mediaKeys.byCase(caseId),
    queryFn: () => mediaFileApi.getMediaFilesByCase(caseId),
    enabled: caseId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useMediaFilesByAnimal(animalId: number) {
  return useQuery({
    queryKey: mediaKeys.byAnimal(animalId),
    queryFn: () => mediaFileApi.getMediaFilesByAnimal(animalId),
    enabled: animalId > 0,
  });
}

export function useCreateMediaFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateMediaFileRequest) =>
      mediaFileApi.createMediaFile(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: mediaKeys.detail(data.mediaId),
      });
      if (data.caseId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byCase(data.caseId),
        });
        queryClient.invalidateQueries({
          queryKey: caseKeys.detail(data.caseId),
        });
      }
      if (data.animalId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byAnimal(data.animalId),
        });
        queryClient.invalidateQueries({
          queryKey: animalKeys.detail(data.animalId),
        });
      }
    },
  });
}

export function useUpdateMediaFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mediaId,
      request,
    }: {
      mediaId: number;
      request: UpdateMediaFileRequest;
    }) => mediaFileApi.updateMediaFile(mediaId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: mediaKeys.detail(data.mediaId),
      });
      if (data.caseId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byCase(data.caseId),
        });
        queryClient.invalidateQueries({
          queryKey: caseKeys.detail(data.caseId),
        });
      }
      if (data.animalId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byAnimal(data.animalId),
        });
        queryClient.invalidateQueries({
          queryKey: animalKeys.detail(data.animalId),
        });
      }
    },
  });
}

export function useDeleteMediaFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mediaId,
      caseId,
      animalId,
    }: {
      mediaId: number;
      caseId?: number;
      animalId?: number;
    }) => mediaFileApi.deleteMediaFile(mediaId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      if (variables.caseId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byCase(variables.caseId),
        });
        queryClient.invalidateQueries({
          queryKey: caseKeys.detail(variables.caseId),
        });
      }
      if (variables.animalId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byAnimal(variables.animalId),
        });
        queryClient.invalidateQueries({
          queryKey: animalKeys.detail(variables.animalId),
        });
      }
    },
  });
}
