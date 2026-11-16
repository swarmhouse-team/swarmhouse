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
  'На текущем этапе endpoint не проверяет доступ: он доступен любому клиенту, который может обратиться к API.';

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
  @ApiOperation({ summary: 'Создать склад', description: NO_ACCESS_CHECK })
  @ApiCreatedResponse({ description: 'Склад и пустая карта созданы' })
  @ApiBadRequestResponse({ description: 'Некорректное тело запроса' })
  @ApiUnprocessableEntityResponse({ description: 'Имя не прошло доменную проверку' })
  create(@Body() body: CreateWarehouseDto): Promise<CreateWarehouseResponse> {
    return this.createWarehouse.execute({ name: body.name });
  }

  @Patch(':warehouseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Переименовать склад', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'Склад переименован' })
  @ApiBadRequestResponse({ description: 'Некорректный path или тело' })
  @ApiNotFoundResponse({ description: 'Склад не найден' })
  @ApiUnprocessableEntityResponse({ description: 'Имя не прошло доменную проверку' })
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
  @ApiOperation({ summary: 'Удалить склад', description: NO_ACCESS_CHECK })
  @ApiNoContentResponse({ description: 'Склад удалён, тела нет' })
  @ApiBadRequestResponse({ description: 'Некорректный path' })
  @ApiNotFoundResponse({ description: 'Склад не найден' })
  async remove(@Param() params: WarehousePathParamsDto): Promise<void> {
    await this.deleteWarehouse.execute({ warehouseId: params.warehouseId });
  }

  @Get(':warehouseId/map')
  @ApiOperation({ summary: 'Прочитать карту склада', description: NO_ACCESS_CHECK })
  @ApiOkResponse({ description: 'Плоское тело карты' })
  @ApiBadRequestResponse({ description: 'Некорректный path' })
  @ApiNotFoundResponse({ description: 'Карта не найдена' })
  @ApiInternalServerErrorResponse({ description: 'Повреждённые данные карты' })
  async getMap(@Param() params: WarehousePathParamsDto): Promise<GetWarehouseMapResponse> {
    const result = await this.getWarehouseMap.execute({ warehouseId: params.warehouseId });
    return toWarehouseMapBody(result.snapshot, result.version);
  }
}
