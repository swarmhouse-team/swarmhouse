import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
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
import { toWarehouseMapBody } from './warehouse-map.body';

const NO_ACCESS_CHECK =
  'At this stage the endpoint does not check access: any client that can reach the API may call it.';

@ApiTags('warehouse-maps')
@Controller('maps')
export class WarehouseMapsController {
  constructor(private readonly editWarehouseMap: EditWarehouseMap) {}

  @Post(':mapId/operations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit the map with one operation', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'The operation was applied or was a no-op' })
  @ApiBadRequestResponse({ description: 'Invalid path or body' })
  @ApiNotFoundResponse({ description: 'Warehouse map was not found' })
  @ApiConflictResponse({
    description: 'The map version is stale; the client reads the map again',
  })
  @ApiUnprocessableEntityResponse({ description: 'The operation broke a map rule' })
  @ApiInternalServerErrorResponse({ description: 'Stored map data is corrupted' })
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
