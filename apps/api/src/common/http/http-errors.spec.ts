import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ExampleRequestDto } from '../../example/example.dto';
import { ApplicationError } from '../application/application.error';
import { DomainError } from '../domain/domain.error';
import { httpProviders } from './http.providers';

@Controller('test')
class TestController {
  @Post('validate')
  validate(@Body() body: ExampleRequestDto): ExampleRequestDto {
    return body;
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Warehouse not found');
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection string: postgresql://user:secret@db');
  }

  @Get('domain')
  domain(): never {
    throw new HiddenNameError();
  }

  @Get('hidden')
  hidden(): never {
    throw new HiddenFailure();
  }
}

class HiddenNameError extends DomainError {
  constructor() {
    super('INVALID_NAME', 'Invalid name');
  }
}

class HiddenFailure extends ApplicationError {
  constructor() {
    super('SAMPLE', 'postgres://user:secret@db');
  }
}

describe('API error format', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [...httpProviders],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid request', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: 'Приёмка', size: 20 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Приёмка', size: 20 });
  });

  it('invalid request → 400 with field errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: '', size: 'big' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        { path: 'name', code: 'too_small', message: expect.any(String) },
        { path: 'size', code: 'invalid_type', message: expect.any(String) },
      ],
    });
  });

  it('HttpException → its status and message', async () => {
    const response = await request(app.getHttpServer()).get('/test/not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Warehouse not found' });
  });

  it('unknown route → 404 in the same format', async () => {
    const response = await request(app.getHttpServer()).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Cannot GET /nope' });
  });

  it('unexpected error → 500 without details or a stack', async () => {
    const response = await request(app.getHttpServer()).get('/test/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  it('DomainError → 422 with its code and message', async () => {
    const response = await request(app.getHttpServer()).get('/test/domain');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ code: 'INVALID_NAME', message: 'Invalid name' });
  });

  it('ApplicationError without a client status → 500 and the log skips the message', async () => {
    const logged: unknown[][] = [];
    const spy = vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });

    try {
      const response = await request(app.getHttpServer()).get('/test/hidden');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
      expect(JSON.stringify(logged)).not.toContain('secret');
      expect(JSON.stringify(logged)).toContain('HiddenFailure');
    } finally {
      spy.mockRestore();
    }
  });
});
