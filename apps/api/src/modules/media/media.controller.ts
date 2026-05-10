import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { ConfirmMediaDto } from './dto/confirm-media.dto';
import { CreateUploadTokenDto } from './dto/create-upload-token.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(UserJwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-token')
  createUploadToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadTokenDto) {
    return this.mediaService.createUploadToken(user.id, dto);
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmMediaDto) {
    return this.mediaService.confirm(user.id, dto);
  }

  @Get(':media_no/access-url')
  accessUrl(@CurrentUser() user: AuthenticatedUser, @Param('media_no') mediaNo: string) {
    return this.mediaService.accessUrl(user.id, mediaNo);
  }
}
