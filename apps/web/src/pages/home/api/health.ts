import { healthResponseSchema } from '@robots/shared';
import { queryOptions } from '@tanstack/react-query';

import { http } from '@/shared/api';

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: ({ signal }) => http('/health', { schema: healthResponseSchema, signal }),
  retry: false,
});
