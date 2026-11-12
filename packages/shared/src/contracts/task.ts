import { z } from 'zod';

const idSchema = z.string().min(1);

export const taskStatusSchema = z.enum(['queued', 'in_progress', 'completed', 'failed']);

export type TaskStatus = z.infer<typeof taskStatusSchema>;

function rejectSameStations(
  fromStationId: string,
  toStationId: string,
  ctx: z.RefinementCtx,
): void {
  if (fromStationId === toStationId) {
    ctx.addIssue({
      code: 'custom',
      message: 'Source and destination stations must differ',
      path: ['toStationId'],
    });
  }
}

export const taskSchema = z
  .object({
    id: idSchema,
    warehouseId: idSchema,
    fromStationId: idSchema,
    toStationId: idSchema,
    status: taskStatusSchema,
    robotId: idSchema.optional(),
    failureReason: z.string().min(1).optional(),
    createdBy: idSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((task, ctx) => {
    rejectSameStations(task.fromStationId, task.toStationId, ctx);

    if (task.status === 'failed' && task.failureReason === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'failureReason is required when status is failed',
        path: ['failureReason'],
      });
    }
  });

export type Task = z.infer<typeof taskSchema>;

export const createTaskRequestSchema = z
  .object({
    fromStationId: idSchema,
    toStationId: idSchema,
    idempotencyKey: idSchema,
  })
  .superRefine((request, ctx) => {
    rejectSameStations(request.fromStationId, request.toStationId, ctx);
  });

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const createTaskResponseSchema = taskSchema;
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const listTasksResponseSchema = z.object({
  items: z.array(taskSchema),
  total: z.number().int().min(0),
});

export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;
