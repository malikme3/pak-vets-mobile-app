import { apiClient } from "./apiClient";
import type {
  Doctor,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  Animal,
  CreateAnimalRequest,
  UpdateAnimalRequest,
  Visit,
  CreateVisitRequest,
  UpdateVisitRequest,
  VisitDiagnosis,
  CreateVisitDiagnosisRequest,
  UpdateVisitDiagnosisRequest,
  VisitTreatment,
  CreateVisitTreatmentRequest,
  UpdateVisitTreatmentRequest,
  VisitNote,
  CreateVisitNoteRequest,
  UpdateVisitNoteRequest,
  MediaFile,
  CreateMediaFileRequest,
  UpdateMediaFileRequest,
  PresignedUrlResponse,
  ApiSuccessResponse,
  MatchAnimalImageRequest,
  MatchAnimalImageResponse,
  AnimalImage,
} from "../types/api";

// Doctors API
export const doctorApi = {
  getDoctor: async (doctorId: number): Promise<Doctor> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Doctor>>(
      `/doctors/${doctorId}`,
    );
    return response.data.data;
  },

  getAllDoctors: async (status?: "ACTIVE" | "INACTIVE"): Promise<Doctor[]> => {
    const params = status ? { status } : {};
    const response = await apiClient.instance.get<ApiSuccessResponse<Doctor[]>>(
      "/doctors",
      { params },
    );
    // Handle both wrapped response and direct array
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    // Fallback: if response is direct array (some APIs return this)
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  },

  createDoctor: async (request: CreateDoctorRequest): Promise<Doctor> => {
    const response = await apiClient.instance.post<ApiSuccessResponse<Doctor>>(
      "/doctors",
      request,
    );
    return response.data.data;
  },

  updateDoctor: async (
    doctorId: number,
    request: UpdateDoctorRequest,
  ): Promise<Doctor> => {
    const response = await apiClient.instance.put<ApiSuccessResponse<Doctor>>(
      `/doctors/${doctorId}`,
      request,
    );
    return response.data.data;
  },

  deleteDoctor: async (doctorId: number): Promise<void> => {
    await apiClient.instance.delete(`/doctors/${doctorId}`);
  },
};

// Animals API
export const animalApi = {
  getAnimal: async (animalId: number): Promise<Animal> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Animal>>(
      `/animals/${animalId}`,
    );
    return response.data.data;
  },

  getAllAnimals: async (species?: string): Promise<Animal[]> => {
    const params = species ? { species } : {};
    const response = await apiClient.instance.get<ApiSuccessResponse<Animal[]>>(
      "/animals",
      { params },
    );
    return response.data.data;
  },

  createAnimal: async (request: CreateAnimalRequest): Promise<Animal> => {
    const response = await apiClient.instance.post<ApiSuccessResponse<Animal>>(
      "/animals",
      request,
    );
    return response.data.data;
  },

  updateAnimal: async (
    animalId: number,
    request: UpdateAnimalRequest,
  ): Promise<Animal> => {
    const response = await apiClient.instance.put<ApiSuccessResponse<Animal>>(
      `/animals/${animalId}`,
      request,
    );
    return response.data.data;
  },

  deleteAnimal: async (animalId: number): Promise<void> => {
    await apiClient.instance.delete(`/animals/${animalId}`);
  },

  // Search animals by tag ID, owner name, or owner phone
  searchAnimals: async (query: string): Promise<Animal[]> => {
    // Since backend doesn't have a search endpoint, we'll fetch all and filter client-side
    // TODO: Implement proper search endpoint on backend
    const allAnimals = await animalApi.getAllAnimals();
    const lowerQuery = query.toLowerCase();
    return allAnimals.filter(
      (animal) =>
        animal.tagId?.toLowerCase().includes(lowerQuery) ||
        animal.ownerName?.toLowerCase().includes(lowerQuery) ||
        animal.ownerPhone?.includes(query),
    );
  },

  // Enroll animal reference images (face, ear, body)
  enrollAnimalImages: async (
    animalId: number,
    request: {
      faceImageUrl: string;
      earImageUrl: string;
      bodyImageUrl: string;
      captureDate?: string;
      notes?: string;
      source?: string;
    },
  ): Promise<{
    enrolled: boolean;
    embeddingIds: { face: number; ear: number; body: number };
    animalImageIds: { face: number; ear: number; body: number };
  }> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<{
        enrolled: boolean;
        embeddingIds: { face: number; ear: number; body: number };
        animalImageIds: { face: number; ear: number; body: number };
      }>
    >(`/animals/${animalId}/enroll`, request);
    return response.data.data;
  },

  matchAnimalImage: async (
    request: MatchAnimalImageRequest,
  ): Promise<MatchAnimalImageResponse> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<MatchAnimalImageResponse>
    >("/animals/match", request);
    return response.data.data;
  },

  getAnimalImages: async (animalId: number): Promise<AnimalImage[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<AnimalImage[]>
    >(`/animals/${animalId}/images`);
    return response.data.data;
  },
};

// Visits API
export const visitApi = {
  getVisit: async (visitId: number): Promise<Visit> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Visit>>(
      `/visits/${visitId}`,
    );
    return response.data.data;
  },

  getAllVisits: async (): Promise<Visit[]> => {
    const response =
      await apiClient.instance.get<ApiSuccessResponse<Visit[]>>("/visits");
    return response.data.data;
  },

  getVisitsByAnimal: async (animalId: number): Promise<Visit[]> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Visit[]>>(
      `/animals/${animalId}/visits`,
    );
    return response.data.data;
  },

  getVisitsByDoctor: async (doctorId: number): Promise<Visit[]> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Visit[]>>(
      `/doctors/${doctorId}/visits`,
    );
    return response.data.data;
  },

  createVisit: async (request: CreateVisitRequest): Promise<Visit> => {
    const response = await apiClient.instance.post<ApiSuccessResponse<Visit>>(
      "/visits",
      request,
    );
    return response.data.data;
  },

  updateVisit: async (
    visitId: number,
    request: UpdateVisitRequest,
  ): Promise<Visit> => {
    const response = await apiClient.instance.put<ApiSuccessResponse<Visit>>(
      `/visits/${visitId}`,
      request,
    );
    return response.data.data;
  },

  deleteVisit: async (visitId: number): Promise<void> => {
    await apiClient.instance.delete(`/visits/${visitId}`);
  },
};

// Visit Diagnoses API
export const visitDiagnosisApi = {
  getVisitDiagnosis: async (diagnosisId: number): Promise<VisitDiagnosis> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitDiagnosis>
    >(`/visit-diagnoses/${diagnosisId}`);
    return response.data.data;
  },

  getVisitDiagnosesByVisit: async (
    visitId: number,
  ): Promise<VisitDiagnosis[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitDiagnosis[]>
    >(`/visits/${visitId}/diagnoses`);
    return response.data.data;
  },

  createVisitDiagnosis: async (
    request: CreateVisitDiagnosisRequest,
  ): Promise<VisitDiagnosis> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<VisitDiagnosis>
    >("/visit-diagnoses", request);
    return response.data.data;
  },

  updateVisitDiagnosis: async (
    diagnosisId: number,
    request: UpdateVisitDiagnosisRequest,
  ): Promise<VisitDiagnosis> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<VisitDiagnosis>
    >(`/visit-diagnoses/${diagnosisId}`, request);
    return response.data.data;
  },

  deleteVisitDiagnosis: async (diagnosisId: number): Promise<void> => {
    await apiClient.instance.delete(`/visit-diagnoses/${diagnosisId}`);
  },
};

// Visit Treatments API
export const visitTreatmentApi = {
  getVisitTreatment: async (treatmentId: number): Promise<VisitTreatment> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitTreatment>
    >(`/visit-treatments/${treatmentId}`);
    return response.data.data;
  },

  getVisitTreatmentsByVisit: async (
    visitId: number,
  ): Promise<VisitTreatment[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitTreatment[]>
    >(`/visits/${visitId}/treatments`);
    return response.data.data;
  },

  createVisitTreatment: async (
    request: CreateVisitTreatmentRequest,
  ): Promise<VisitTreatment> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<VisitTreatment>
    >("/visit-treatments", request);
    return response.data.data;
  },

  updateVisitTreatment: async (
    treatmentId: number,
    request: UpdateVisitTreatmentRequest,
  ): Promise<VisitTreatment> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<VisitTreatment>
    >(`/visit-treatments/${treatmentId}`, request);
    return response.data.data;
  },

  deleteVisitTreatment: async (treatmentId: number): Promise<void> => {
    await apiClient.instance.delete(`/visit-treatments/${treatmentId}`);
  },
};

// Visit Notes API
export const visitNoteApi = {
  getVisitNote: async (noteId: number): Promise<VisitNote> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitNote>
    >(`/visit-notes/${noteId}`);
    return response.data.data;
  },

  getVisitNotesByVisit: async (visitId: number): Promise<VisitNote[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<VisitNote[]>
    >(`/visits/${visitId}/notes`);
    return response.data.data;
  },

  createVisitNote: async (
    request: CreateVisitNoteRequest,
  ): Promise<VisitNote> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<VisitNote>
    >("/visit-notes", request);
    return response.data.data;
  },

  updateVisitNote: async (
    noteId: number,
    request: UpdateVisitNoteRequest,
  ): Promise<VisitNote> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<VisitNote>
    >(`/visit-notes/${noteId}`, request);
    return response.data.data;
  },

  deleteVisitNote: async (noteId: number): Promise<void> => {
    await apiClient.instance.delete(`/visit-notes/${noteId}`);
  },
};

// Media Files API
export const mediaFileApi = {
  getPresignedUrl: async (
    visitId: number,
    fileType: "AUDIO" | "IMAGE" | "VIDEO" | "DOC",
    fileName: string,
  ): Promise<PresignedUrlResponse> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<PresignedUrlResponse>
    >("/media-files/presigned-url", {
      visitId,
      fileType,
      fileName,
    });
    return response.data.data;
  },

  getMediaFile: async (mediaId: number): Promise<MediaFile> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<MediaFile>
    >(`/media-files/${mediaId}`);
    return response.data.data;
  },

  getMediaFilesByVisit: async (visitId: number): Promise<MediaFile[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<MediaFile[]>
    >(`/visits/${visitId}/media-files`);
    return response.data.data;
  },

  getMediaFilesByAnimal: async (animalId: number): Promise<MediaFile[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<MediaFile[]>
    >(`/animals/${animalId}/media-files`);
    return response.data.data;
  },

  createMediaFile: async (
    request: CreateMediaFileRequest,
  ): Promise<MediaFile> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<MediaFile>
    >("/media-files", request);
    return response.data.data;
  },

  updateMediaFile: async (
    mediaId: number,
    request: UpdateMediaFileRequest,
  ): Promise<MediaFile> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<MediaFile>
    >(`/media-files/${mediaId}`, request);
    return response.data.data;
  },

  deleteMediaFile: async (mediaId: number): Promise<void> => {
    await apiClient.instance.delete(`/media-files/${mediaId}`);
  },
};
