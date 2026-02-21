/**
 * Shared Services API Client
 * Handles interactions with the shared-services-api for S3 operations and audio transcription
 */

import axios from "axios";

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

/**
 * Get presigned URL for S3 upload
 */
export async function getUploadSignedUrl(
  bucketName: string,
  filePath: string,
  tags?: string,
): Promise<UploadSignedUrlResponse> {
  try {
    console.log("[SharedServicesAPI] Requesting presigned URL:", {
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

    console.log("[SharedServicesAPI] Presigned URL received:", {
      signedUrlLength: response.data.signedUrl.length,
      fileUrl: response.data.fileUrl,
    });

    return response.data;
  } catch (error) {
    console.error("[SharedServicesAPI] Error getting upload signed URL:", {
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
    console.log("[SharedServicesAPI] Requesting download signed URL:", {
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

    console.log("[SharedServicesAPI] Download signed URL received:", {
      urlLength: response.data.length,
      urlPreview: response.data.substring(0, 150) + "...",
    });

    return response.data;
  } catch (error) {
    console.error("[SharedServicesAPI] Error getting download signed URL:", {
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
    console.log("[SharedServicesAPI] Requesting audio transcription:", {
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

    console.log("[SharedServicesAPI] Transcription response received:", {
      status: response.data.status,
      hasRawText: !!response.data.transcript.rawText,
      hasImprovedText: !!response.data.transcript.improvedText,
    });

    return response.data;
  } catch (error) {
    console.error("[SharedServicesAPI] Error transcribing audio:", {
      error: error instanceof Error ? error.message : String(error),
      s3Key,
      bucketName,
      fullError: error,
    });

    if (axios.isAxiosError(error)) {
      const axiosError = error;
      if (axiosError.response) {
        console.error("[SharedServicesAPI] API Error Details:", {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: JSON.stringify(axiosError.response.data, null, 2),
          headers: axiosError.response.headers,
        });
      } else if (axiosError.request) {
        console.error("[SharedServicesAPI] Network Error:", {
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

    console.log(
      "[SharedServicesAPI] Requesting structured transcription - API URL:",
      `${getSharedServicesApiUrl()}/audio/process-structured`,
    );
    console.log(
      "[SharedServicesAPI] Request body (actual HTTP payload):",
      JSON.stringify(requestBody, null, 2),
    );
    console.log(
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

    console.log(
      "[SharedServicesAPI] Full API response:",
      JSON.stringify(response.data, null, 2),
    );

    if (!response.data.success) {
      const errorData = response.data.error;
      console.error("[SharedServicesAPI] API returned error:", errorData);
      throw new Error(
        errorData?.message || "API request failed without error details",
      );
    }

    const responseData = response.data.data;
    if (!responseData) {
      throw new Error("API response missing data field");
    }

    const structuredData = responseData.audioTranscriptStructured;

    console.log(
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
    console.error(
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
        console.error("[SharedServicesAPI] API Error Response:", {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          headers: axiosError.response.headers,
          data: JSON.stringify(axiosError.response.data, null, 2),
        });
      } else if (axiosError.request) {
        console.error("[SharedServicesAPI] Network Error - No response:", {
          request: axiosError.request,
          message: axiosError.message,
        });
      } else {
        console.error("[SharedServicesAPI] Request setup error:", {
          message: axiosError.message,
        });
      }
    }

    throw error;
  }
}
