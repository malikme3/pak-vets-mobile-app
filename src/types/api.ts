// API Response Types matching backend structure

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
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

export interface PaginationMeta {
  limit?: number;
  offset?: number;
  count?: number;
  total?: number;
  hasNext?: boolean;
  nextOffset?: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination?: PaginationMeta;
}

// Request/Response types matching backend models
export interface Doctor {
  doctorId: number;
  fullName: string;
  phone: string;
  email?: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED";
  firebaseUid?: string;
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
  status?: "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED";
  locationName?: string;
}

export interface FarmerInfo {
  fullName: string;
  phoneNumber: string;
  nicNo?: string;
  villageName?: string;
}

export interface Farmer {
  farmerId: number;
  fullName: string;
  phoneNumber: string;
  nicNo?: string;
  villageName?: string;
  tehName?: string;
  districtName?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  /** Set when list was filtered by lat/long/radius (distance in km). */
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFarmerRequest {
  fullName: string;
  phoneNumber: string;
  nicNo?: string;
  villageName?: string;
  tehName?: string;
  districtName?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
}

export type AnimalStatus =
  | "MILKING"
  | "DRY"
  | "PREGNANT"
  | "LACTATING"
  | "IN_HEAT"
  | "OTHER";

export interface Animal {
  animalId: number;
  farmerId?: number;
  farmer?: FarmerInfo;
  species: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  status?: AnimalStatus;
  otherStatusValue?: string;
  heartGirthCm?: number;
  bodyLengthCm?: number;
  tagId?: string;
  animalTagline?: string;
  aiShortSummary?: string;
  aiSummary?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  /** Set when list was filtered by lat/long/radius (distance in km). */
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnimalRequest {
  farmerId?: number;
  species: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  status?: AnimalStatus;
  otherStatusValue?: string;
  heartGirthCm?: number;
  bodyLengthCm?: number;
  tagId?: string;
  animalTagline?: string;
  aiShortSummary?: string;
  aiSummary?: string;
  chiefComplaint?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateAnimalRequest {
  farmerId?: number;
  species?: string;
  breed?: string;
  sex?: string;
  ageMonths?: number;
  color?: string;
  weightKg?: number;
  status?: AnimalStatus;
  otherStatusValue?: string;
  heartGirthCm?: number;
  bodyLengthCm?: number;
  tagId?: string;
  animalTagline?: string;
  aiShortSummary?: string;
  aiSummary?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export type CaseStatus = "IN_PROGRESS" | "COMPLETED";

export interface Case {
  caseId: number;
  animalId: number;
  doctorId: number;
  caseDatetime: string;
  chiefComplaint?: string;
  notes?: string;
  status?: CaseStatus;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Distance in km when returned from nearby-cases (get cases by doctor with lat/long/radius). */
  distanceKm?: number;
}

export interface CreateCaseRequest {
  animalId: number;
  doctorId: number;
  caseDatetime: string;
  chiefComplaint?: string;
  notes?: string;
  status?: CaseStatus;
}

export interface UpdateCaseRequest {
  animalId?: number;
  doctorId?: number;
  caseDatetime?: string;
  chiefComplaint?: string;
  notes?: string;
  status?: CaseStatus;
}

export interface CaseDiagnosis {
  diagnosisId: number;
  caseId: number;
  diagnosisText: string;
  status: "SUSPECTED" | "CONFIRMED";
  mediaId?: number;
  createdAt: string;
}

export interface DiagnosisSuggestion {
  diagnosis_text: string;
  status: "SUSPECTED" | "CONFIRMED";
}

export interface CreateCaseDiagnosisRequest {
  caseId: number;
  diagnosisText: string;
  status?: "SUSPECTED" | "CONFIRMED";
  mediaId?: number;
}

export interface UpdateCaseDiagnosisRequest {
  diagnosisText?: string;
  status?: "SUSPECTED" | "CONFIRMED";
}

export interface TreatmentSuggestion {
  treatmentType: "MEDICATION" | "PROCEDURE" | "ADVICE";
  medicineNameFree?: string | null;
  dose?: string | null;
  route?: string | null;
  frequency?: string | null;
  durationDays?: number | null;
  instructions?: string | null;
}

export interface CaseTreatment {
  treatmentId: number;
  caseId: number;
  treatmentType?: "MEDICATION" | "PROCEDURE" | "ADVICE";
  treatmentStatus: "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED";
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
  mediaId?: number;
  createdAt: string;
}

export interface CreateCaseTreatmentRequest {
  caseId: number;
  treatmentType?: "MEDICATION" | "PROCEDURE" | "ADVICE";
  treatmentStatus?: "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED";
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
  mediaId?: number;
}

export interface UpdateCaseTreatmentRequest {
  treatmentType?: "MEDICATION" | "PROCEDURE" | "ADVICE";
  treatmentStatus?: "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED";
  medicineId?: number;
  medicineNameFree?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
}

export interface CaseNote {
  noteId: number;
  caseId: number;
  noteType: "TEXT" | "VOICE_TRANSCRIPT";
  noteText: string;
  mediaId?: number;
  createdAt: string;
}

export interface CreateCaseNoteRequest {
  caseId: number;
  noteType?: "TEXT" | "VOICE_TRANSCRIPT";
  noteText: string;
  mediaId?: number;
}

export interface UpdateCaseNoteRequest {
  noteType?: "TEXT" | "VOICE_TRANSCRIPT";
  noteText?: string;
  mediaId?: number;
}

export interface MediaFile {
  mediaId: number;
  caseId?: number;
  animalId?: number;
  fileType: "AUDIO" | "IMAGE" | "VIDEO" | "DOC";
  s3Key?: string;
  url?: string;
  createdAt: string;
}

export interface CreateMediaFileRequest {
  caseId?: number;
  animalId?: number;
  fileType: "AUDIO" | "IMAGE" | "VIDEO" | "DOC";
  s3Key?: string;
  url?: string;
}

export interface UpdateMediaFileRequest {
  caseId?: number;
  animalId?: number;
  fileType?: "AUDIO" | "IMAGE" | "VIDEO" | "DOC";
  s3Key?: string;
  url?: string;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  s3Key: string;
  url: string;
}

// Match animal by image (find animal by face/ear/body image)
export type MatchImageType = "FACE" | "EAR" | "BODY" | "AUTO";

export interface MatchAnimalImageRequest {
  queryImageUrl: string;
  expectedType?: MatchImageType;
  topK?: number;
  minScore?: number;
}

export interface MatchCandidate {
  animalId: number;
  score: number;
  imageType: string;
  refImageUrl: string;
  embeddingId: number;
}

export interface MatchAnimalImageResponse {
  matchedAnimalId: number | null;
  bestScore: number;
  matchStatus: "MATCH" | "NO_MATCH";
  candidates: MatchCandidate[];
}

export type AnimalImageType =
  | "FACE"
  | "EAR"
  | "BODY"
  | "LAB_REPORT"
  | "VACINATION"
  | "EXRAY";

export interface CreateAnimalImageRequest {
  imageType: AnimalImageType;
  s3Key: string;
  s3Url: string;
  captureDate?: string;
  notes?: string;
  source?: string;
}

export interface AnimalImage {
  animalImageId: number;
  animalId: number;
  imageType: AnimalImageType;
  s3Key: string;
  s3Url: string;
  captureDate?: string;
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}
