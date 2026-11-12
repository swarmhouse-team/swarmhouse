import { describe, expect, it } from 'vitest';

import { validTasks } from './fixtures';
import { createTaskRequestSchema, taskSchema, type Task } from './task';

function taskByStatus(status: Task['status']): Task {
  const task = validTasks.find((item) => item.status === status);
  if (!task) {
    throw new Error(`В фикстурах нет задания со статусом ${status}`);
  }
  return JSON.parse(JSON.stringify(task)) as Task;
}

describe('taskSchema', () => {
  it('принимает валидное задание', () => {
    const task = taskByStatus('completed');

    expect(taskSchema.parse(task)).toEqual(task);
  });

  it('отклоняет одинаковые станции', () => {
    const task = taskByStatus('completed');
    task.toStationId = task.fromStationId;

    expect(taskSchema.safeParse(task).success).toBe(false);
  });

  it('отклоняет failed без failureReason', () => {
    const task = taskByStatus('failed');
    delete task.failureReason;

    expect(taskSchema.safeParse(task).success).toBe(false);
  });
});

describe('createTaskRequestSchema', () => {
  it('отклоняет запрос без idempotencyKey', () => {
    const result = createTaskRequestSchema.safeParse({
      fromStationId: 'st-reception',
      toStationId: 'st-shipping',
    });

    expect(result.success).toBe(false);
  });
});
