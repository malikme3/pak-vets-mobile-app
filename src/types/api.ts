// API Response Types matching backend structure

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Request/Response types matching backend models
export interface Doctor {
  doctorId: number;
  fullName: string;
  phone: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE';
  locationName?: string;
  createdAt: string;
}

export interface CreateDoctorRequest {
  fullName: string;
  phone: string;
  email?: string;
  locationName?: string;
}

export interface UpdateDoctorRequest {
  fullName?: string;
  phone?: string;
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  locationName?: string;
}

export interface Animal {
  animalId: number;
  ownerName?: string;
  ownerPhone?: string;
  species: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  tagId?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnimalRequest {
  ownerName?: string;
  ownerPhone?: string;
  species: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  tagId?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateAnimalRequest {
  ownerName?: string;
  ownerPhone?: string;
  species?: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  tagId?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export interface Visit {
  visitId: number;
  animalId: number;
  doctorId: number;
  visitDatetime: string;
  chiefComplaint?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitRequest {
  animalId: number;
  doctorId: number;
  visitDatetime: string;
  chiefComplaint?: string;
  notes?: string;
}

export interface UpdateVisitRequest {
  animalId?: number;
  doctorId?: number;
  visitDatetime?: string;
  chiefComplaint?: string;
  notes?: string;
}

export interface VisitDiagnosis {
  diagnosisId: number;
  visitId: number;
  diagnosisText: string;
  status: 'SUSPECTED' | 'CONFIRMED';
  createdAt: string;
}

export interface CreateVisitDiagnosisRequest {
  visitId: number;
  diagnosisText: string;
  status?: 'SUSPECTED' | 'CONFIRMED';
}

export interface UpdateVisitDiagnosisRequest {
  diagnosisText?: string;
  status?: 'SUSPECTED' | 'CONFIRMED';
}

export interface VisitTreatment {
  treatmentId: number;
  visitId: number;
  treatmentType?: 'MEDICATION' | 'PROCEDURE' | 'ADVICE';
  treatmentStatus: 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'STOPPED';
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
  createdAt: string;
}

export interface CreateVisitTreatmentRequest {
  visitId: number;
  treatmentType?: 'MEDICATION' | 'PROCEDURE' | 'ADVICE';
  treatmentStatus?: 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'STOPPED';
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
}

export interface UpdateVisitTreatmentRequest {
  treatmentType?: 'MEDICATION' | 'PROCEDURE' | 'ADVICE';
  treatmentStatus?: 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'STOPPED';
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
}

export interface VisitNote {
  noteId: number;
  visitId: number;
  noteType: 'TEXT' | 'VOICE_TRANSCRIPT';
  noteText: string;
  mediaId?: number;
  createdAt: string;
}

export interface CreateVisitNoteRequest {
  visitId: number;
  noteType?: 'TEXT' | 'VOICE_TRANSCRIPT';
  noteText: string;
  mediaId?: number;
}

export interface UpdateVisitNoteRequest {
  noteType?: 'TEXT' | 'VOICE_TRANSCRIPT';
  noteText?: string;
  mediaId?: number;
}

export interface MediaFile {
  mediaId: number;
  visitId?: number;
  animalId?: number;
  fileType: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOC';
  s3Key?: string;
  url?: string;
  createdAt: string;
}

export interface CreateMediaFileRequest {
  visitId?: number;
  animalId?: number;
  fileType: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOC';
  s3Key?: string;
  url?: string;
}

export interface UpdateMediaFileRequest {
  visitId?: number;
  animalId?: number;
  fileType?: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOC';
  s3Key?: string;
  url?: string;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  s3Key: string;
  url: string;
}
