import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { EditWarehouseMapResponse } from '@robots/shared';

import { EditWarehouseMap } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { EditWarehouseMapDto, WarehouseMapPathParamsDto } from './warehouse-http.dto';
import { WarehouseHttpExceptionFilter } from './warehouse-http-exception.filter';
import { toWarehouseMapBody } from './warehouse-map.body';

const NO_ACCESS_CHECK =
  'На текущем этапе endpoint не проверяет доступ: он доступен любому клиенту, который может обратиться к API.';

@ApiTags('warehouse-maps')
@UseFilters(WarehouseHttpExceptionFilter)
@Controller('maps')
export class WarehouseMapsController {
  constructor(private readonly editWarehouseMap: EditWarehouseMap) {}

  @Post(':mapId/operations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Изменить карту одной операцией', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'Операция применена или оказалась no-op' })
  @ApiBadRequestResponse({ description: 'Некорректный path или тело' })
  @ApiNotFoundResponse({ description: 'Карта не найдена' })
  @ApiConflictResponse({ description: 'Версия карты устарела, клиент перечитывает карту' })
  @ApiUnprocessableEntityResponse({ description: 'Операция нарушила правило карты' })
  @ApiInternalServerErrorResponse({ description: 'Повреждённые данные карты' })
  async edit(
    @Param() params: WarehouseMapPathParamsDto,
    @Body() body: EditWarehouseMapDto,
  ): Promise<EditWarehouseMapResponse> {
    const result = await this.editWarehouseMap.execute({
      mapId: params.mapId,
      expectedVersion: body.expectedVersion,
      operation: body.operation,
    });
    const map = toWarehouseMapBody(result.snapshot, result.version);

    if (result.createdId === undefined) {
      return { changed: result.changed, map };
    }

    return { changed: result.changed, createdId: result.createdId, map };
  }
}
