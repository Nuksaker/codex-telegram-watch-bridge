export function isAuthorizedIdentity(
  actual: { userId: number; chatId: number },
  allowed: { userId: number; chatId: number },
): boolean {
  return actual.userId === allowed.userId && actual.chatId === allowed.chatId;
}
