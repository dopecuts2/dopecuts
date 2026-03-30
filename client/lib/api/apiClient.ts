import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

/**
 * Main API client for all requests.
 * It's configured with the base URL, credentials, and automatic retries for network errors.
 */
const apiClient: AxiosInstance = axios.create({
  // Use the production API URL from environment variables, but fall back
  // to the local server address for development.
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000, // Requests will time out after 60 seconds
  withCredentials: true, // This allows cookies to be sent and received across domains
});

// --- Retry Logic ---
// Automatically retry failed requests up to 3 times with an exponential back-off delay.
// This helps with transient network issues.
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: error =>
    axiosRetry.isNetworkOrIdempotentRequestError(error),
});

export default apiClient;
