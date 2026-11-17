import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ExampleRequest } from '@robots/shared';

import { Public } from '../common/auth/public.decorator';

import { ExampleRequestDto } from './example.dto';

@ApiTags('example')
@Controller('example')
export class ExampleController {
  /** Возвращает тело запроса, если оно прошло валидацию. */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ExampleRequestDto })
  echo(@Body() body: ExampleRequestDto): ExampleRequest {
    return body;
  }
}
