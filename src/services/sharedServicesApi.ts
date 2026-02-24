/**
 * Shared Services API Client
 * Handles interactions with the shared-services-api for S3 operations and audio transcription
 */

import axios from "axios";

const isDev = typeof __DEV__ === "boolean" ? __DEV__ : false;

function devLog(message?: unknown, ...optionalParams: unknown[]) {
  if (isDev) console.log(message, ...optionalParams);
}

function devError(message?: unknown, ...optionalParams: unknown[]) {
  if (isDev) console.error(message, ...optionalParams);
}

/**
 * Effective pak-vets API base URL (must match apiClient.ts so bucket matches API).
 * Preprod API → preprod bucket → preprod step function. Dev API → dev bucket → dev step function.
 */
function getEffectivePakVetsApiUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    (typeof __DEV__ === "boolean" && !__DEV__
      ? "https://pak-vets-preprod.roundrocktennis.com"
      : "https://pak-vets-dev.roundrocktennis.com")
  );
}

/**
 * Get the current stage for S3 bucket (pak-vets-assets-<stage>).
 * Derived from the same API URL as apiClient so uploads always trigger the step function for the env the app is using.
 * EXPO_PUBLIC_STAGE is only used when API URL is not clearly dev/preprod (e.g. localhost).
 */
function getStage(): string {
  const apiUrl = getEffectivePakVetsApiUrl();
  if (apiUrl.includes("pak-vets-preprod")) return "preprod";
  if (apiUrl.includes("pak-vets-dev")) return "dev";
  const match = apiUrl.match(/pak-vets-(\w+)\.roundrocktennis\.com/);
  if (match?.[1]) return match[1];
  return process.env.EXPO_PUBLIC_STAGE || "dev";
}

/**
 * Shared Services API base URL. Must match stage so preprod app uses shared-preprod (same IAM/bucket).
 * Override with EXPO_PUBLIC_SHARED_SERVICES_API_URL if needed.
 */
function getSharedServicesApiUrl(): string {
  if (process.env.EXPO_PUBLIC_SHARED_SERVICES_API_URL) {
    return process.env.EXPO_PUBLIC_SHARED_SERVICES_API_URL;
  }
  const stage = getStage();
  return `https://shared-${stage}.roundrocktennis.com`;
}

/**
 * Get S3 bucket name based on current stage
 * Format: pak-vets-assets-${stage}
 */
export function getBucketName(): string {
  const stage = getStage();
  return `pak-vets-assets-${stage}`;
}

// Request/Response interfaces
export interface UploadSignedUrlRequest {
  bucketName: string;
  filePath: string;
  tags?: string;
}

export interface UploadSignedUrlResponse {
  signedUrl: string;
  fileUrl: string;
}

export interface DownloadSignedUrlRequest {
  bucketName: string;
  filePath: string;
}

export interface TranscribeAudioRequest {
  s3Url: string;
}

export interface TranscriptData {
  rawText: string;
  improvedText?: string;
}

export interface AudioProcessStatus {
  status: "SUCCESS" | "REJECTED";
  transcript: TranscriptData;
}

export interface TranscribeAudioResponse {
  status: "SUCCESS" | "REJECTED";
  transcript: TranscriptData;
}

export interface ProcessStructuredTranscriptionRequest {
  audioS3Url: string;
  expectedSchema: Record<string, unknown>;
}

export interface StructuredTranscriptionResponse {
  audioTranscriptRaw: string;
  audioTranscriptEnriched: string;
  audioTranscriptStructured: Record<string, unknown> | null;
  status: "SUCCESS" | "FAILED";
}

export interface ProcessStructuredTranscriptionApiResponse {
  success: boolean;
  data?: StructuredTranscriptionResponse;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ProcessStructuredImageRequest {
  imageS3Url: string;
  instruction: string;
  expectedSchema: Record<string, unknown>;
}

export interface StructuredImageResponse {
  imageStructured: Record<string, unknown> | null;
  status: "SUCCESS" | "FAILED";
}

export interface ProcessStructuredImageApiResponse {
  success: boolean;
  data?: {
    imageStructured?: Record<string, unknown> | null;
    imageTextStructured?: Record<string, unknown> | null;
    structuredData?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
    status?: "SUCCESS" | "FAILED";
  };
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

/** Reverse geocode response (GET /geocode/reverse). address may include village, town, road when backend supports them. */
export interface ReverseGeocodeAddress {
  city?: string;
  subdistrict?: string;
  district?: string;
  state_district?: string;
  state?: string;
  country?: string;
  country_code?: string;
  village?: string;
  town?: string;
  road?: string;
}

export interface ReverseGeocodeData {
  display_name: string;
  address: ReverseGeocodeAddress;
}

export interface ReverseGeocodeApiResponse {
  success: boolean;
  data?: ReverseGeocodeData;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  meta: { requestId: string; timestamp: string };
}

/**
 * Reverse geocode: lat/lon → display_name and structured address.
 * Uses shared-services-api GET /geocode/reverse.
 */
export async function getReverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeData> {
  const base = getSharedServicesApiUrl();
  const url = `${base}/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const response = await axios.get<ReverseGeocodeApiResponse>(url);
  if (!response.data.success || !response.data.data) {
    throw new Error(
      response.data?.error?.message ?? "Reverse geocode request failed",
    );
  }
  return response.data.data;
}

/**
 * Get presigned URL for S3 upload
 */
export async function getUploadSignedUrl(
  bucketName: string,
  filePath: string,
  tags?: string,
): Promise<UploadSignedUrlResponse> {
  try {
    devLog("[SharedServicesAPI] Requesting presigned URL:", {
      bucketName,
      filePath,
      tags,
      url: `${getSharedServicesApiUrl()}/s3/upload-signed-url`,
    });

    const response = await axios.post<UploadSignedUrlResponse>(
      `${getSharedServicesApiUrl()}/s3/upload-signed-url`,
      {
        bucketName,
        filePath,
        tags,
      },
    );

    devLog("[SharedServicesAPI] Presigned URL received:", {
      signedUrlLength: response.data.signedUrl.length,
      fileUrl: response.data.fileUrl,
    });

    return response.data;
  } catch (error) {
    devError("[SharedServicesAPI] Error getting upload signed URL:", {
      error: error instanceof Error ? error.message : String(error),
      bucketName,
      filePath,
    });
    throw error;
  }
}

/**
 * Get presigned URL for S3 download
 */
export async function getDownloadSignedUrl(
  bucketName: string,
  filePath: string,
): Promise<string> {
  try {
    devLog("[SharedServicesAPI] Requesting download signed URL:", {
      bucketName,
      filePath,
      url: `${getSharedServicesApiUrl()}/s3/download-signed-url`,
    });

    const response = await axios.get<string>(
      `${getSharedServicesApiUrl()}/s3/download-signed-url`,
      {
        params: {
          bucketName,
          filePath,
        },
      },
    );

    devLog("[SharedServicesAPI] Download signed URL received:", {
      urlLength: response.data.length,
      urlPreview: response.data.substring(0, 150) + "...",
    });

    return response.data;
  } catch (error) {
    devError("[SharedServicesAPI] Error getting download signed URL:", {
      error: error instanceof Error ? error.message : String(error),
      bucketName,
      filePath,
    });
    throw error;
  }
}

/**
 * Transcribe audio from S3 key
 * Backend will generate read URL internally
 */
export async function transcribeAudio(
  s3Key: string,
  bucketName: string,
): Promise<TranscribeAudioResponse> {
  try {
    devLog("[SharedServicesAPI] Requesting audio transcription:", {
      s3Key,
      bucketName,
      url: `${getSharedServicesApiUrl()}/audio/transcribe`,
    });

    const response = await axios.post<TranscribeAudioResponse>(
      `${getSharedServicesApiUrl()}/audio/transcribe`,
      {
        s3Key,
        bucketName,
      },
    );

    devLog("[SharedServicesAPI] Transcription response received:", {
      status: response.data.status,
      hasRawText: !!response.data.transcript.rawText,
      hasImprovedText: !!response.data.transcript.improvedText,
    });

    return response.data;
  } catch (error) {
    devError("[SharedServicesAPI] Error transcribing audio:", {
      error: error instanceof Error ? error.message : String(error),
      s3Key,
      bucketName,
      fullError: error,
    });

    if (axios.isAxiosError(error)) {
      const axiosError = error;
      if (axiosError.response) {
        devError("[SharedServicesAPI] API Error Details:", {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: JSON.stringify(axiosError.response.data, null, 2),
          headers: axiosError.response.headers,
        });
      } else if (axiosError.request) {
        devError("[SharedServicesAPI] Network Error:", {
          request: axiosError.request,
          message: axiosError.message,
        });
      }
    }

    throw error;
  }
}

/**
 * Process structured audio transcription with AI enhancement and schema parsing
 */
export async function processStructuredTranscription(
  request: ProcessStructuredTranscriptionRequest,
): Promise<StructuredTranscriptionResponse> {
  try {
    const requestBody = {
      audioS3Url: request.audioS3Url,
      expectedSchema: request.expectedSchema,
    };

    devLog(
      "[SharedServicesAPI] Requesting structured transcription - API URL:",
      `${getSharedServicesApiUrl()}/audio/process-structured`,
    );
    devLog(
      "[SharedServicesAPI] Request body (actual HTTP payload):",
      JSON.stringify(requestBody, null, 2),
    );
    devLog(
      "[SharedServicesAPI] Schema keys (for reference only):",
      Object.keys(request.expectedSchema),
    );

    const response =
      await axios.post<ProcessStructuredTranscriptionApiResponse>(
        `${getSharedServicesApiUrl()}/audio/process-structured`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    devLog(
      "[SharedServicesAPI] Full API response:",
      JSON.stringify(response.data, null, 2),
    );

    if (!response.data.success) {
      const errorData = response.data.error;
      devError("[SharedServicesAPI] API returned error:", errorData);
      throw new Error(
        errorData?.message || "API request failed without error details",
      );
    }

    const responseData = response.data.data;
    if (!responseData) {
      throw new Error("API response missing data field");
    }

    const structuredData = responseData.audioTranscriptStructured;

    devLog(
      "[SharedServicesAPI] Structured transcription response received:",
      {
        status: responseData.status,
        hasRawText: !!responseData.audioTranscriptRaw,
        hasEnrichedText: !!responseData.audioTranscriptEnriched,
        hasStructuredData: !!structuredData,
        structuredFields: structuredData ? Object.keys(structuredData) : null,
      },
    );

    // Ensure audioTranscriptStructured is never undefined - use null instead
    return {
      audioTranscriptRaw: responseData.audioTranscriptRaw || "",
      audioTranscriptEnriched: responseData.audioTranscriptEnriched || "",
      audioTranscriptStructured: structuredData || null,
      status: responseData.status,
    };
  } catch (error) {
    devError(
      "[SharedServicesAPI] Error processing structured transcription:",
      {
        error: error instanceof Error ? error.message : String(error),
        audioS3Url: request.audioS3Url,
        fullError: error,
      },
    );

    if (axios.isAxiosError(error)) {
      const axiosError = error;
      if (axiosError.response) {
        devError("[SharedServicesAPI] API Error Response:", {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          headers: axiosError.response.headers,
          data: JSON.stringify(axiosError.response.data, null, 2),
        });
      } else if (axiosError.request) {
        devError("[SharedServicesAPI] Network Error - No response:", {
          request: axiosError.request,
          message: axiosError.message,
        });
      } else {
        devError("[SharedServicesAPI] Request setup error:", {
          message: axiosError.message,
        });
      }
    }

    throw error;
  }
}

/**
 * Process structured image extraction with AI parsing.
 */
export async function processStructuredImage(
  request: ProcessStructuredImageRequest,
): Promise<StructuredImageResponse> {
  const derivedHttpsUrl = request.imageS3Url.startsWith("s3://")
    ? (() => {
        const withoutPrefix = request.imageS3Url.replace(/^s3:\/\//, "");
        const slashIndex = withoutPrefix.indexOf("/");
        if (slashIndex <= 0) return request.imageS3Url;
        const bucket = withoutPrefix.slice(0, slashIndex);
        const key = withoutPrefix.slice(slashIndex + 1);
        return `https://${bucket}.s3.amazonaws.com/${key}`;
      })()
    : request.imageS3Url;

  const endpoint = `${getSharedServicesApiUrl()}/image/process-structured`;
  const candidateBodies: Array<Record<string, unknown>> = [
    {
      imageS3Url: request.imageS3Url,
      imageUrl: derivedHttpsUrl,
      instruction: request.instruction,
      schema: request.expectedSchema,
    },
    {
      imageS3Url: request.imageS3Url,
      imageUrl: derivedHttpsUrl,
      instruction: request.instruction,
      instructions: request.instruction,
      expectedSchema: request.expectedSchema,
      schema: request.expectedSchema,
    },
    {
      imageS3Url: derivedHttpsUrl,
      imageUrl: derivedHttpsUrl,
      instruction: request.instruction,
      instructions: request.instruction,
      expectedSchema: request.expectedSchema,
      schema: request.expectedSchema,
    },
  ];

  try {
    devLog(
      "[SharedServicesAPI] Requesting structured image processing - API URL:",
      endpoint,
    );
    let lastError: unknown = null;
    for (let i = 0; i < candidateBodies.length; i++) {
      const requestBody = candidateBodies[i];
      try {
        devLog(
          `[SharedServicesAPI] Structured image payload attempt ${i + 1}:`,
          JSON.stringify(requestBody, null, 2),
        );

        const response = await axios.post<ProcessStructuredImageApiResponse>(
          endpoint,
          requestBody,
          {
            headers: { "Content-Type": "application/json" },
          },
        );

        if (!response.data.success) {
          throw new Error(
            response.data.error?.message ?? "Structured image request failed",
          );
        }

        const responseData = response.data.data;
        if (!responseData) {
          throw new Error("Structured image response missing data");
        }

        const imageStructured =
          responseData.imageTextStructured ??
          responseData.imageStructured ??
          responseData.structuredData ??
          responseData.result ??
          null;

        return {
          imageStructured,
          status: responseData.status ?? "SUCCESS",
        };
      } catch (attemptError) {
        lastError = attemptError;
        if (
          !axios.isAxiosError(attemptError) ||
          attemptError.response?.status !== 400
        ) {
          throw attemptError;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Structured image request failed");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | string
        | undefined;
      const responseMessage =
        typeof responseData === "string"
          ? responseData
          : responseData?.error?.message || responseData?.message;
      devError("[SharedServicesAPI] Error processing structured image:", {
        error: error.message,
        imageS3Url: request.imageS3Url,
        status: error.response?.status,
        responseData,
      });
      throw new Error(
        responseMessage || error.message || "Structured image request failed",
      );
    } else {
      devError("[SharedServicesAPI] Error processing structured image:", {
        error: error instanceof Error ? error.message : String(error),
        imageS3Url: request.imageS3Url,
      });
      throw error;
    }
  }
}
