import { BaseApiClient } from './api-client';
import { axiosConfig } from './axios-config';

// Map each service to its circuit breaker key
const serviceCircuitMap = {
  github: 'github',
  openAI: 'openAI',
  googleCalendar: 'googleCalendar',
  sendGrid: 'sendGrid',
} as const;

type ServiceName = keyof typeof serviceCircuitMap;

export const createServiceClient = (service: ServiceName, authToken?: string): BaseApiClient => {
  let baseURL: string;
  let timeout: number;
  let headers: Record<string, string> | undefined;

  switch (service) {
    case 'github':
      baseURL = 'https://api.github.com';
      timeout = 10000;
      headers = authToken ? { Authorization: `token ${authToken}` } : undefined;
      break;

    case 'openAI':
      baseURL = 'https://api.openai.com/v1';
      timeout = 30000;
      headers = { Authorization: `Bearer ${authToken}` };
      break;

    case 'googleCalendar':
      baseURL = 'https://www.googleapis.com/calendar/v3';
      timeout = 15000;
      headers = { Authorization: `Bearer ${authToken}` };
      break;

    case 'sendGrid':
      baseURL = 'https://api.sendgrid.com/v3';
      timeout = 10000;
      headers = { Authorization: `Bearer ${authToken}` };
      break;

    default:
      throw new Error(`Unknown service: ${service}`);
  }

  const client = axiosConfig.createClient(service, {
    baseURL,
    timeout,
    headers,
  });

  // Wrap the client with the corresponding circuit breaker
  const breakerKey = serviceCircuitMap[service];

  return new BaseApiClient(service, client, true);
};
