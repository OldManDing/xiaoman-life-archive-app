import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';

import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // fail-closed：没有显式声明 @AdminRoles 的后台路由一律拒绝。
    //
    // 此前这里是 `return true`（fail-open），意味着任何「忘了标注角色」的新路由
    // 会对**所有已登录管理员（含 viewer）**放行 —— 一个静默的越权口子。
    // 当前 41 条后台路由里只有 auth/login 没有标注，而它本身不挂这个守卫
    // （只挂 ThrottlerGuard），所以改成默认拒绝不会影响任何现有功能，
    // 只是让「新增路由忘记标注」从静默放开变成显式报错。
    if (!roles?.length) {
      throw new ForbiddenException('该后台路由未声明所需角色，已按默认拒绝处理');
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.user as { role?: AdminRole } | undefined;
    if (!admin?.role || !roles.includes(admin.role)) {
      throw new ForbiddenException('无权限访问该后台资源');
    }

    return true;
  }
}
