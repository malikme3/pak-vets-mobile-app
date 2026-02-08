import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

// API base URL - should be set via environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiError {
  message: string;
  fieldErrors?: Record<string, string>;
  status: number;
  code?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // TODO: Get token from auth store
        // const token = authStore.getToken();
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Log response in dev mode for debugging
        if (__DEV__) {
          console.log(
            `[API] ${response.config.method?.toUpperCase()} ${response.config.url}`,
            {
              status: response.status,
              data: response.data,
            },
          );
        }
        return response;
      },
      (error: AxiosError) => {
        // Log error in dev mode for debugging
        if (__DEV__) {
          console.error("[API Error]", {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });
        }
        return Promise.reject(this.normalizeError(error));
      },
    );
  }

  private normalizeError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error
      const response = error.response.data as {
        success?: boolean;
        error?: {
          code: string;
          message: string;
          details: Record<string, unknown>;
        };
      };

      const apiError: ApiError = {
        message:
          response.error?.message || error.message || "An error occurred",
        status: error.response.status,
        code: response.error?.code,
      };

      // Extract field errors from details if available
      if (response.error?.details) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(response.error.details).forEach(([key, value]) => {
          if (typeof value === "string") {
            fieldErrors[key] = value;
          }
        });
        if (Object.keys(fieldErrors).length > 0) {
          apiError.fieldErrors = fieldErrors;
        }
      }

      return apiError;
    } else if (error.request) {
      // Request made but no response
      return {
        message: "Network error. Please check your connection.",
        status: 0,
      };
    } else {
      // Something else happened
      return {
        message: error.message || "An unexpected error occurred",
        status: 0,
      };
    }
  }

  get instance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient();
