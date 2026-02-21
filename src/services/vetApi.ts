import { apiClient } from "./apiClient";
import type {
  Doctor,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  Farmer,
  CreateFarmerRequest,
  Animal,
  CreateAnimalRequest,
  UpdateAnimalRequest,
  Case,
  CreateCaseRequest,
  UpdateCaseRequest,
  CaseDiagnosis,
  CreateCaseDiagnosisRequest,
  UpdateCaseDiagnosisRequest,
  DiagnosisSuggestion,
  CaseTreatment,
  CreateCaseTreatmentRequest,
  UpdateCaseTreatmentRequest,
  TreatmentSuggestion,
  CaseNote,
  CreateCaseNoteRequest,
  UpdateCaseNoteRequest,
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

// Farmers API
const FARMERS_PATH = "/farmers";

export const farmerApi = {
  getAllFarmers: async (): Promise<Farmer[]> => {
    const response =
      await apiClient.instance.get<ApiSuccessResponse<Farmer[]>>(FARMERS_PATH);
    return response.data.data;
  },

  /** Farmers within radius (km) of lat/long. All three params required. */
  getFarmersNearby: async (
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<Farmer[]> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Farmer[]>>(
      FARMERS_PATH,
      {
        params: { latitude, longitude, radiusKm },
      },
    );
    return response.data.data;
  },

  getFarmer: async (farmerId: number): Promise<Farmer> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Farmer>>(
      `/farmers/${farmerId}`,
    );
    return response.data.data;
  },

  createFarmer: async (request: CreateFarmerRequest): Promise<Farmer> => {
    const response = await apiClient.instance.post<ApiSuccessResponse<Farmer>>(
      "/farmers",
      request,
    );
    return response.data.data;
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

  getAllAnimals: async (
    speciesOrOptions?:
      | string
      | {
          species?: string;
          latitude?: number;
          longitude?: number;
          radiusKm?: number;
        },
  ): Promise<Animal[]> => {
    const options =
      typeof speciesOrOptions === "string"
        ? { species: speciesOrOptions }
        : (speciesOrOptions ?? {});
    const params: Record<string, string | number> = {};
    if (options.species) params.species = options.species;
    if (options.latitude != null) params.latitude = options.latitude;
    if (options.longitude != null) params.longitude = options.longitude;
    if (options.radiusKm != null) params.radiusKm = options.radiusKm;
    const response = await apiClient.instance.get<ApiSuccessResponse<Animal[]>>(
      "/animals",
      { params: Object.keys(params).length ? params : undefined },
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

  // Search animals by tag ID, farmer name, phone, or NIC
  searchAnimals: async (query: string): Promise<Animal[]> => {
    // Since backend doesn't have a search endpoint, we'll fetch all and filter client-side
    // TODO: Implement proper search endpoint on backend
    const allAnimals = await animalApi.getAllAnimals();
    const lowerQuery = query.toLowerCase();
    return allAnimals.filter(
      (animal) =>
        animal.tagId?.toLowerCase().includes(lowerQuery) ||
        animal.farmer?.fullName?.toLowerCase().includes(lowerQuery) ||
        animal.farmer?.phoneNumber?.includes(query) ||
        animal.farmer?.nicNo?.toLowerCase().includes(lowerQuery),
    );
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

// Cases API
export const caseApi = {
  getCase: async (caseId: number): Promise<Case> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Case>>(
      `/cases/${caseId}`,
    );
    return response.data.data;
  },

  getAllCases: async (): Promise<Case[]> => {
    const response =
      await apiClient.instance.get<ApiSuccessResponse<Case[]>>("/cases");
    return response.data.data;
  },

  getCasesByAnimal: async (animalId: number): Promise<Case[]> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<Case[]>>(
      `/animals/${animalId}/cases`,
    );
    return response.data.data;
  },

  getCasesByDoctor: async (
    doctorId: number,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
    },
  ): Promise<Case[]> => {
    const params: Record<string, string> = {};
    if (options?.latitude != null) params.latitude = String(options.latitude);
    if (options?.longitude != null)
      params.longitude = String(options.longitude);
    if (options?.radiusKm != null) params.radiusKm = String(options.radiusKm);
    const response = await apiClient.instance.get<ApiSuccessResponse<Case[]>>(
      `/doctors/${doctorId}/cases`,
      { params: Object.keys(params).length ? params : undefined },
    );
    return response.data.data;
  },

  createCase: async (request: CreateCaseRequest): Promise<Case> => {
    const response = await apiClient.instance.post<ApiSuccessResponse<Case>>(
      "/cases",
      request,
    );
    return response.data.data;
  },

  updateCase: async (
    caseId: number,
    request: UpdateCaseRequest,
  ): Promise<Case> => {
    const response = await apiClient.instance.put<ApiSuccessResponse<Case>>(
      `/cases/${caseId}`,
      request,
    );
    return response.data.data;
  },

  deleteCase: async (caseId: number): Promise<void> => {
    await apiClient.instance.delete(`/cases/${caseId}`);
  },
};

// Case Diagnoses API
export const caseDiagnosisApi = {
  getCaseDiagnosis: async (diagnosisId: number): Promise<CaseDiagnosis> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<CaseDiagnosis>
    >(`/case-diagnoses/${diagnosisId}`);
    return response.data.data;
  },

  getCaseDiagnosesByCase: async (caseId: number): Promise<CaseDiagnosis[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<CaseDiagnosis[]>
    >(`/cases/${caseId}/diagnoses`);
    return response.data.data;
  },

  suggestDiagnoses: async (
    complaint: string,
  ): Promise<DiagnosisSuggestion[]> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<DiagnosisSuggestion[]>
    >("/case-diagnoses/suggest", { complaint });
    return response.data.data;
  },

  createCaseDiagnosis: async (
    request: CreateCaseDiagnosisRequest,
  ): Promise<CaseDiagnosis> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<CaseDiagnosis>
    >("/case-diagnoses", request);
    return response.data.data;
  },

  updateCaseDiagnosis: async (
    diagnosisId: number,
    request: UpdateCaseDiagnosisRequest,
  ): Promise<CaseDiagnosis> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<CaseDiagnosis>
    >(`/case-diagnoses/${diagnosisId}`, request);
    return response.data.data;
  },

  deleteCaseDiagnosis: async (diagnosisId: number): Promise<void> => {
    await apiClient.instance.delete(`/case-diagnoses/${diagnosisId}`);
  },
};

// Case Treatments API
export const caseTreatmentApi = {
  suggestTreatments: async (
    diagnoses: Array<{
      diagnosis_text: string;
      status: "SUSPECTED" | "CONFIRMED";
    }>,
  ): Promise<TreatmentSuggestion[]> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<TreatmentSuggestion[]>
    >("/case-treatments/suggest", { diagnoses });
    return response.data.data;
  },

  getCaseTreatment: async (treatmentId: number): Promise<CaseTreatment> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<CaseTreatment>
    >(`/case-treatments/${treatmentId}`);
    return response.data.data;
  },

  getCaseTreatmentsByCase: async (caseId: number): Promise<CaseTreatment[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<CaseTreatment[]>
    >(`/cases/${caseId}/treatments`);
    return response.data.data;
  },

  createCaseTreatment: async (
    request: CreateCaseTreatmentRequest,
  ): Promise<CaseTreatment> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<CaseTreatment>
    >("/case-treatments", request);
    return response.data.data;
  },

  updateCaseTreatment: async (
    treatmentId: number,
    request: UpdateCaseTreatmentRequest,
  ): Promise<CaseTreatment> => {
    const response = await apiClient.instance.put<
      ApiSuccessResponse<CaseTreatment>
    >(`/case-treatments/${treatmentId}`, request);
    return response.data.data;
  },

  deleteCaseTreatment: async (treatmentId: number): Promise<void> => {
    await apiClient.instance.delete(`/case-treatments/${treatmentId}`);
  },
};

// Case Notes API
export const caseNoteApi = {
  getCaseNote: async (noteId: number): Promise<CaseNote> => {
    const response = await apiClient.instance.get<ApiSuccessResponse<CaseNote>>(
      `/case-notes/${noteId}`,
    );
    return response.data.data;
  },

  getCaseNotesByCase: async (caseId: number): Promise<CaseNote[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<CaseNote[]>
    >(`/cases/${caseId}/notes`);
    return response.data.data;
  },

  createCaseNote: async (request: CreateCaseNoteRequest): Promise<CaseNote> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<CaseNote>
    >("/case-notes", request);
    return response.data.data;
  },

  updateCaseNote: async (
    noteId: number,
    request: UpdateCaseNoteRequest,
  ): Promise<CaseNote> => {
    const response = await apiClient.instance.put<ApiSuccessResponse<CaseNote>>(
      `/case-notes/${noteId}`,
      request,
    );
    return response.data.data;
  },

  deleteCaseNote: async (noteId: number): Promise<void> => {
    await apiClient.instance.delete(`/case-notes/${noteId}`);
  },
};

// Media Files API
export const mediaFileApi = {
  getPresignedUrl: async (
    caseId: number,
    fileType: "AUDIO" | "IMAGE" | "VIDEO" | "DOC",
    fileName: string,
  ): Promise<PresignedUrlResponse> => {
    const response = await apiClient.instance.post<
      ApiSuccessResponse<PresignedUrlResponse>
    >("/media-files/presigned-url", {
      caseId,
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

  getMediaFilesByCase: async (caseId: number): Promise<MediaFile[]> => {
    const response = await apiClient.instance.get<
      ApiSuccessResponse<MediaFile[]>
    >(`/cases/${caseId}/media-files`);
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
