import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ExampleRequestDto } from '../../example/example.dto';
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
}

describe('Формат ошибок API', () => {
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

  it('пропускает валидный запрос', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: 'Приёмка', size: 20 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Приёмка', size: 20 });
  });

  it('невалидный запрос → 400 с ошибками по полям', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: '', size: 'big' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        { path: 'name', message: expect.any(String) },
        { path: 'size', message: expect.any(String) },
      ],
    });
  });

  it('HttpException → её статус и сообщение', async () => {
    const response = await request(app.getHttpServer()).get('/test/not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Warehouse not found' });
  });

  it('неизвестный маршрут → 404 в том же формате', async () => {
    const response = await request(app.getHttpServer()).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Cannot GET /nope' });
  });

  it('непредвиденная ошибка → 500 без деталей и стека', async () => {
    const response = await request(app.getHttpServer()).get('/test/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
