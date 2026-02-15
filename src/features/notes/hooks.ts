import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseNoteApi } from "../../services/vetApi";
import type {
  CaseNote,
  CreateCaseNoteRequest,
  UpdateCaseNoteRequest,
} from "../../types/api";
import { caseKeys } from "../cases/hooks";

export const noteKeys = {
  all: ["note"] as const,
  detail: (id: number) => [...noteKeys.all, id] as const,
  byCase: (caseId: number) => [...noteKeys.all, "case", caseId] as const,
};

export function useCaseNote(noteId: number) {
  return useQuery({
    queryKey: noteKeys.detail(noteId),
    queryFn: () => caseNoteApi.getCaseNote(noteId),
    enabled: noteId > 0,
  });
}

export function useCaseNotes(caseId: number) {
  return useQuery({
    queryKey: noteKeys.byCase(caseId),
    queryFn: () => caseNoteApi.getCaseNotesByCase(caseId),
    enabled: caseId > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCaseNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCaseNoteRequest) =>
      caseNoteApi.createCaseNote(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(data.noteId) });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useUpdateCaseNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      request,
    }: {
      noteId: number;
      request: UpdateCaseNoteRequest;
    }) => caseNoteApi.updateCaseNote(noteId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(data.noteId) });
      queryClient.invalidateQueries({
        queryKey: noteKeys.byCase(data.caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(data.caseId),
      });
    },
  });
}

export function useDeleteCaseNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, caseId }: { noteId: number; caseId: number }) =>
      caseNoteApi.deleteCaseNote(noteId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.byCase(variables.caseId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      queryClient.invalidateQueries({
        queryKey: caseKeys.detail(variables.caseId),
      });
    },
  });
}
