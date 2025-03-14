import { hash, compare } from 'bcryptjs';

export class PasswordEncrypter {
  private static readonly SALT_ROUNDS = 10;

  static async encrypt(password: string): Promise<string> {
    const hashedPassword = (await hash(password, this.SALT_ROUNDS)) as string;
    return hashedPassword;
  }

  static async compare(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    const isMatch = (await compare(plainPassword, hashedPassword)) as boolean;
    return isMatch;
  }
}
