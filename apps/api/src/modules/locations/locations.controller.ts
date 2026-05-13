import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { SearchLocationsDto } from './dto/search-locations.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(UserJwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  search(@Query() dto: SearchLocationsDto) {
    return this.locationsService.search(dto);
  }
}
