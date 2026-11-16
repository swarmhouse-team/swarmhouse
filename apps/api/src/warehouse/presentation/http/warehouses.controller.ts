import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type {
  CreateWarehouseResponse,
  GetWarehouseMapResponse,
  RenameWarehouseResponse,
} from '@robots/shared';

import { CreateWarehouse } from '../../application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../../application/commands/delete-warehouse/delete-warehouse.use-case';
import { UpdateWarehouse } from '../../application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from '../../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import {
  CreateWarehouseDto,
  RenameWarehouseDto,
  WarehousePathParamsDto,
} from './warehouse-http.dto';
import { WarehouseHttpExceptionFilter } from './warehouse-http-exception.filter';
import { toWarehouseMapBody } from './warehouse-map.body';

const NO_ACCESS_CHECK =
  'At this stage the endpoint does not check access: any client that can reach the API may call it.';

@ApiTags('warehouses')
@UseFilters(WarehouseHttpExceptionFilter)
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly createWarehouse: CreateWarehouse,
    private readonly updateWarehouse: UpdateWarehouse,
    private readonly deleteWarehouse: DeleteWarehouse,
    private readonly getWarehouseMap: GetWarehouseMap,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a warehouse', description: NO_ACCESS_CHECK })
  @ApiCreatedResponse({ description: 'The warehouse and an empty map were created' })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiUnprocessableEntityResponse({ description: 'The name failed the domain check' })
  create(@Body() body: CreateWarehouseDto): Promise<CreateWarehouseResponse> {
    return this.createWarehouse.execute({ name: body.name });
  }

  @Patch(':warehouseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename a warehouse', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'The warehouse was renamed' })
  @ApiBadRequestResponse({ description: 'Invalid path or body' })
  @ApiNotFoundResponse({ description: 'Warehouse was not found' })
  @ApiUnprocessableEntityResponse({ description: 'The name failed the domain check' })
  rename(
    @Param() params: WarehousePathParamsDto,
    @Body() body: RenameWarehouseDto,
  ): Promise<RenameWarehouseResponse> {
    return this.updateWarehouse.execute({
      warehouseId: params.warehouseId,
      name: body.name,
    });
  }

  @Delete(':warehouseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a warehouse', description: NO_ACCESS_CHECK })
  @ApiNoContentResponse({ description: 'The warehouse was deleted; there is no body' })
  @ApiBadRequestResponse({ description: 'Invalid path' })
  @ApiNotFoundResponse({ description: 'Warehouse was not found' })
  async remove(@Param() params: WarehousePathParamsDto): Promise<void> {
    await this.deleteWarehouse.execute({ warehouseId: params.warehouseId });
  }

  @Get(':warehouseId/map')
  @ApiOperation({ summary: 'Read the warehouse map', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'Flat map body' })
  @ApiBadRequestResponse({ description: 'Invalid path' })
  @ApiNotFoundResponse({ description: 'Warehouse map was not found' })
  @ApiInternalServerErrorResponse({ description: 'Stored map data is corrupted' })
  async getMap(@Param() params: WarehousePathParamsDto): Promise<GetWarehouseMapResponse> {
    const result = await this.getWarehouseMap.execute({ warehouseId: params.warehouseId });
    return toWarehouseMapBody(result.snapshot, result.version);
  }
}
