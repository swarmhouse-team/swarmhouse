import { describe, expect, it } from 'vitest';

import { validTasks } from '../fixtures';

import { createTaskRequestSchema, taskSchema, type Task } from './task';

function taskByStatus(status: Task['status']): Task {
  const task = validTasks.find((item) => item.status === status);
  if (!task) {
    throw new Error(`Fixture has no task with status ${status}`);
  }
  return JSON.parse(JSON.stringify(task)) as Task;
}

describe('taskSchema', () => {
  it('accepts a valid task', () => {
    const task = taskByStatus('completed');

    expect(taskSchema.parse(task)).toEqual(task);
  });

  it('rejects identical stations', () => {
    const task = taskByStatus('completed');
    task.toStationId = task.fromStationId;

    expect(taskSchema.safeParse(task).success).toBe(false);
  });

  it('rejects failed status without failureReason', () => {
    const task = taskByStatus('failed');
    delete task.failureReason;

    expect(taskSchema.safeParse(task).success).toBe(false);
  });
});

describe('createTaskRequestSchema', () => {
  it('rejects a request without idempotencyKey', () => {
    const result = createTaskRequestSchema.safeParse({
      fromStationId: 'st-reception',
      toStationId: 'st-shipping',
    });

    expect(result.success).toBe(false);
  });
});
