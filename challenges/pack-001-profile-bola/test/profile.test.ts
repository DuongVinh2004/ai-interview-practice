import { ProfileController } from '../src/profile.controller';

describe('ProfileController', () => {
  it('should instantiate and be defined', () => {
    const ctrl = new ProfileController();
    expect(ctrl).toBeDefined();
  });
});
