import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildrenService } from './children.service';

@Controller('children')
@UseGuards(UserJwtAuthGuard)
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildDto) {
    return this.childrenService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.childrenService.list(user.id);
  }

  @Get(':child_no')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('child_no') childNo: string) {
    return this.childrenService.detail(user.id, childNo);
  }

  @Put(':child_no')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('child_no') childNo: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childrenService.update(user.id, childNo, dto);
  }
}
