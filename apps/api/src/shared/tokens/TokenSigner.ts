export type TokenPayload = { userId: string };

export interface TokenSigner {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
