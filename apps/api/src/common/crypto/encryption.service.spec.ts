import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

/** ConfigService minimal : renvoie une clé fixe quel que soit le défaut passé. */
const configWith = (secret: string): ConfigService =>
  ({ get: () => secret }) as unknown as ConfigService;

describe('EncryptionService', () => {
  const service = new EncryptionService(configWith('test-secret'));

  it('round-trip : decrypt(encrypt(x)) === x', () => {
    const plain = 'cookie-de-session-sensible';
    expect(service.decrypt(service.encrypt(plain))).toBe(plain);
  });

  it('gère les chaînes vides et l’unicode', () => {
    expect(service.decrypt(service.encrypt(''))).toBe('');
    expect(service.decrypt(service.encrypt('éàç 日本 🚀'))).toBe('éàç 日本 🚀');
  });

  it('produit un ciphertext différent à chaque appel (IV aléatoire)', () => {
    expect(service.encrypt('même valeur')).not.toBe(service.encrypt('même valeur'));
  });

  it('produit le format iv:authTag:data (3 segments hex)', () => {
    const parts = service.encrypt('x').split(':');
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
  });

  it('échoue au déchiffrement si le ciphertext est altéré (authTag GCM)', () => {
    const [iv, authTag, data] = service.encrypt('secret').split(':');
    const tampered = [iv, authTag, data.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))].join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('échoue au déchiffrement avec une clé différente (rotation de clé)', () => {
    const other = new EncryptionService(configWith('autre-secret'));
    expect(() => other.decrypt(service.encrypt('secret'))).toThrow();
  });
});
