import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

// API base URL - set EXPO_PUBLIC_API_URL to hit local server (e.g. http://localhost:3001)
// Defaults to deployed dev API; use EXPO_PUBLIC_API_URL for local backend
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://pak-vets-dev.roundrocktennis.com";

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

    // Request interceptor: auth + dev logging (full payload as JSON)
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // TODO: Get token from auth store
        // const token = authStore.getToken();
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        if (__DEV__ && config.data != null) {
          const body =
            typeof config.data === "string"
              ? config.data
              : JSON.stringify(config.data, null, 2);
          console.log(
            `[API] REQUEST ${config.method?.toUpperCase()} ${config.url}`,
            "\n" + body,
          );
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor: log full response as JSON (no [Object] collapse)
    this.client.interceptors.response.use(
      (response) => {
        if (__DEV__) {
          console.log(
            `[API] RESPONSE ${response.config.method?.toUpperCase()} ${response.config.url} ${response.status}`,
            "\n" + JSON.stringify(response.data, null, 2),
          );
        }
        return response;
      },
      (error: AxiosError) => {
        if (__DEV__) {
          console.error(
            "[API Error]",
            error.config?.method,
            error.config?.url,
            error.response?.status,
            "\n" +
              JSON.stringify(error.response?.data ?? error.message, null, 2),
          );
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
