import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { visitNoteApi } from "../../services/vetApi";
import type {
  VisitNote,
  CreateVisitNoteRequest,
  UpdateVisitNoteRequest,
} from "../../types/api";
import { visitKeys } from "../visits/hooks";

export const noteKeys = {
  all: ["note"] as const,
  detail: (id: number) => [...noteKeys.all, id] as const,
  byVisit: (visitId: number) => [...noteKeys.all, "visit", visitId] as const,
};

export function useVisitNote(noteId: number) {
  return useQuery({
    queryKey: noteKeys.detail(noteId),
    queryFn: () => visitNoteApi.getVisitNote(noteId),
    enabled: noteId > 0,
  });
}

export function useVisitNotes(visitId: number) {
  return useQuery({
    queryKey: noteKeys.byVisit(visitId),
    queryFn: () => visitNoteApi.getVisitNotesByVisit(visitId),
    enabled: visitId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateVisitNoteRequest) =>
      visitNoteApi.createVisitNote(request),
    onSuccess: (data) => {
      // Invalidate note queries for this visit
      queryClient.invalidateQueries({
        queryKey: noteKeys.byVisit(data.visitId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(data.noteId) });
      // Also invalidate visit queries
      queryClient.invalidateQueries({
        queryKey: visitKeys.detail(data.visitId),
      });
    },
  });
}

export function useUpdateVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      request,
    }: {
      noteId: number;
      request: UpdateVisitNoteRequest;
    }) => visitNoteApi.updateVisitNote(noteId, request),
    onSuccess: (data) => {
      // Invalidate specific note and visit queries
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(data.noteId) });
      queryClient.invalidateQueries({
        queryKey: noteKeys.byVisit(data.visitId),
      });
      queryClient.invalidateQueries({
        queryKey: visitKeys.detail(data.visitId),
      });
    },
  });
}

export function useDeleteVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, visitId }: { noteId: number; visitId: number }) =>
      visitNoteApi.deleteVisitNote(noteId),
    onSuccess: (_, variables) => {
      // Invalidate note queries for this visit
      queryClient.invalidateQueries({
        queryKey: noteKeys.byVisit(variables.visitId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      // Also invalidate visit queries
      queryClient.invalidateQueries({
        queryKey: visitKeys.detail(variables.visitId),
      });
    },
  });
}
