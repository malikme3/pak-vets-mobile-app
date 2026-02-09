/**
 * Shared Services API Client
 * Handles interactions with the shared-services-api for S3 operations and audio transcription
 */

import axios from "axios";

// Shared Services API base URL
const SHARED_SERVICES_API_URL =
  process.env.EXPO_PUBLIC_SHARED_SERVICES_API_URL ||
  "https://shared-dev.roundrocktennis.com";

/**
 * Get the current stage from environment or API URL
 * Extracts stage from URLs like: pak-vets-dev.roundrocktennis.com -> dev
 * Or uses EXPO_PUBLIC_STAGE environment variable
 */
function getStage(): string {
  // Check for explicit stage environment variable
  if (process.env.EXPO_PUBLIC_STAGE) {
    return process.env.EXPO_PUBLIC_STAGE;
  }

  // Extract stage from API URL
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL || "https://pak-vets-dev.roundrocktennis.com";
  const match = apiUrl.match(/pak-vets-(\w+)\.roundrocktennis\.com/);
  if (match && match[1]) {
    return match[1];
  }

  // Default to dev if unable to determine
  return "dev";
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
      url: `${SHARED_SERVICES_API_URL}/s3/upload-signed-url`,
    });

    const response = await axios.post<UploadSignedUrlResponse>(
      `${SHARED_SERVICES_API_URL}/s3/upload-signed-url`,
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
      url: `${SHARED_SERVICES_API_URL}/s3/download-signed-url`,
    });

    const response = await axios.get<string>(
      `${SHARED_SERVICES_API_URL}/s3/download-signed-url`,
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
      url: `${SHARED_SERVICES_API_URL}/audio/transcribe`,
    });

    const response = await axios.post<TranscribeAudioResponse>(
      `${SHARED_SERVICES_API_URL}/audio/transcribe`,
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
