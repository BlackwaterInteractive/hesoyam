import 'reflect-metadata';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { JwtGuard } from '../guards/jwt.guard';
import { RequireApiKey } from './api-key.decorator';
import { RequireJwt } from './jwt-auth.decorator';

// `__guards__` is the metadata key NestJS's UseGuards() writes to. Inlined as
// a literal so the test doesn't depend on a NestJS internal export path.
const GUARDS_METADATA = '__guards__';

describe('auth decorators — composed metadata chain', () => {
  describe('RequireApiKey', () => {
    it('attaches ApiKeyGuard to the decorated method', () => {
      class FakeController {
        @RequireApiKey()
        handler() {}
      }
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        FakeController.prototype.handler,
      );
      expect(guards).toEqual([ApiKeyGuard]);
    });

    it('attaches ApiKeyGuard to the decorated class', () => {
      @RequireApiKey()
      class FakeController {}
      const guards = Reflect.getMetadata(GUARDS_METADATA, FakeController);
      expect(guards).toEqual([ApiKeyGuard]);
    });
  });

  describe('RequireJwt', () => {
    it('attaches JwtGuard to the decorated method', () => {
      class FakeController {
        @RequireJwt()
        handler() {}
      }
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        FakeController.prototype.handler,
      );
      expect(guards).toEqual([JwtGuard]);
    });

    it('attaches JwtGuard to the decorated class', () => {
      @RequireJwt()
      class FakeController {}
      const guards = Reflect.getMetadata(GUARDS_METADATA, FakeController);
      expect(guards).toEqual([JwtGuard]);
    });
  });
});
