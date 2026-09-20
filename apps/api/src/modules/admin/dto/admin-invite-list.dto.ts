import { IsIn, IsOptional } from 'class-validator';

import { AdminListDto } from './admin-list.dto';

// expired 不是库里的状态，而是「pending 且已过期」的派生值（见 statusToInviteLabel），
// 因此这里把四个展示态都列出来，由服务端翻译成对应的 where 条件。
const inviteStatuses = ['pending', 'accepted', 'revoked', 'expired'] as const;

export class AdminInviteListDto extends AdminListDto {
  @IsOptional()
  @IsIn(inviteStatuses)
  status?: (typeof inviteStatuses)[number];
}
