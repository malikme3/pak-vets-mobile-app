import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaFileApi } from '../../services/vetApi';
import type { MediaFile, CreateMediaFileRequest, UpdateMediaFileRequest } from '../../types/api';
import { visitKeys } from '../visits/hooks';
import { animalKeys } from '../animals/hooks';

export const mediaKeys = {
  all: ['media'] as const,
  detail: (id: number) => [...mediaKeys.all, id] as const,
  byVisit: (visitId: number) => [...mediaKeys.all, 'visit', visitId] as const,
  byAnimal: (animalId: number) => [...mediaKeys.all, 'animal', animalId] as const,
};

export function useMediaFile(mediaId: number) {
  return useQuery({
    queryKey: mediaKeys.detail(mediaId),
    queryFn: () => mediaFileApi.getMediaFile(mediaId),
    enabled: mediaId > 0,
  });
}

export function useMediaFilesByVisit(visitId: number) {
  return useQuery({
    queryKey: mediaKeys.byVisit(visitId),
    queryFn: () => mediaFileApi.getMediaFilesByVisit(visitId),
    enabled: visitId > 0,
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
      // Invalidate media queries
      queryClient.invalidateQueries({ queryKey: mediaKeys.detail(data.mediaId) });
      if (data.visitId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byVisit(data.visitId) });
        queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
      }
      if (data.animalId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byAnimal(data.animalId) });
        queryClient.invalidateQueries({ queryKey: animalKeys.detail(data.animalId) });
      }
    },
  });
}

export function useUpdateMediaFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaId, request }: { mediaId: number; request: UpdateMediaFileRequest }) =>
      mediaFileApi.updateMediaFile(mediaId, request),
    onSuccess: (data) => {
      // Invalidate specific media and related queries
      queryClient.invalidateQueries({ queryKey: mediaKeys.detail(data.mediaId) });
      if (data.visitId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byVisit(data.visitId) });
        queryClient.invalidateQueries({ queryKey: visitKeys.detail(data.visitId) });
      }
      if (data.animalId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byAnimal(data.animalId) });
        queryClient.invalidateQueries({ queryKey: animalKeys.detail(data.animalId) });
      }
    },
  });
}

export function useDeleteMediaFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaId, visitId, animalId }: { mediaId: number; visitId?: number; animalId?: number }) =>
      mediaFileApi.deleteMediaFile(mediaId),
    onSuccess: (_, variables) => {
      // Invalidate media queries
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      if (variables.visitId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byVisit(variables.visitId) });
        queryClient.invalidateQueries({ queryKey: visitKeys.detail(variables.visitId) });
      }
      if (variables.animalId) {
        queryClient.invalidateQueries({ queryKey: mediaKeys.byAnimal(variables.animalId) });
        queryClient.invalidateQueries({ queryKey: animalKeys.detail(variables.animalId) });
      }
    },
  });
}
