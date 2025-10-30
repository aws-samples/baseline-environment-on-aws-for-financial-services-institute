import { CoreApiResponse } from './types';

export const createCoreResponse = <T>(statusCode: number, body: CoreApiResponse<T>): any => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});
