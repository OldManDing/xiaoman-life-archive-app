import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { CreateRecordDto } from './dto/create-record.dto';
import { ListRecordsDto } from './dto/list-records.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordsService } from './records.service';

@Controller('records')
@UseGuards(UserJwtAuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecordDto) {
    return this.recordsService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() dto: ListRecordsDto) {
    return this.recordsService.list(user.id, dto);
  }

  @Get(':record_no')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('record_no') recordNo: string) {
    return this.recordsService.detail(user.id, recordNo);
  }

  @Put(':record_no')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('record_no') recordNo: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.recordsService.update(user.id, recordNo, dto);
  }

  @Delete(':record_no')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('record_no') recordNo: string) {
    return this.recordsService.remove(user.id, recordNo);
  }
}
