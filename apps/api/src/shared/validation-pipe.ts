import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

type FieldValidationError = {
  field: string;
  reason: string;
};

const fieldLabels: Record<string, string> = {
  credential: '账号',
  password: '密码',
  password_confirm: '确认密码',
  invite_code: '邀请码',
  login_type: '登录方式',
  mobile: '手机号',
  nickname: '昵称',
  avatar_url: '头像',
  birthday: '生日',
  gender: '性别',
  role: '角色',
  confirm_text: '确认文本',
};

const formatValidationReason = (field: string, constraint: string, rawReason: string) => {
  if (field === 'credential') {
    if (constraint === 'minLength') return '账号至少需要 3 位';
    if (constraint === 'maxLength') return '账号不能超过 64 位';
    if (constraint === 'matches') return '账号不能包含空格';
  }

  if (field === 'password') {
    if (constraint === 'isString') return '密码不能为空';
    return '密码需为 8 到 72 位';
  }

  if (field === 'password_confirm') {
    if (constraint === 'isString') return '确认密码不能为空';
    return '确认密码需为 8 到 72 位';
  }

  if (field === 'invite_code') {
    if (constraint === 'isString') return '邀请码不能为空';
    return '邀请码需为 6 到 128 位';
  }

  const label = fieldLabels[field] ?? field;
  if (constraint === 'isString') return `${label}格式不正确`;
  if (constraint === 'isNotEmpty') return `${label}不能为空`;

  return rawReason;
};

const flattenValidationErrors = (errors: ValidationError[]): FieldValidationError[] => {
  const fields: FieldValidationError[] = [];

  for (const error of errors) {
    if (error.constraints) {
      for (const [constraint, reason] of Object.entries(error.constraints)) {
        fields.push({
          field: error.property,
          reason: formatValidationReason(error.property, constraint, reason),
        });
      }
    }

    if (error.children?.length) {
      fields.push(...flattenValidationErrors(error.children));
    }
  }

  return fields;
};

export const createAppValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) =>
      new BadRequestException({
        message: '参数校验失败',
        fields: flattenValidationErrors(errors),
      }),
  });
