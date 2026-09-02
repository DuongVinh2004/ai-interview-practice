import { TokenService } from '../src/token.service';

describe('TokenService', () => {
  it('should instantiate and be defined', () => {
    const service = new TokenService();
    expect(service).toBeDefined();
  });
});
