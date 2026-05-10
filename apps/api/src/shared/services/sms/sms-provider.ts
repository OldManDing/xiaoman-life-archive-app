export interface SmsProvider {
  sendLoginCode(mobile: string, code: string): Promise<void>;
}
