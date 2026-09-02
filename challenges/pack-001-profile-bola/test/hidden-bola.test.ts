import { ProfileController } from '../src/profile.controller';

describe('Hidden BOLA Verification', () => {
  it('rejects cross-user profile modification with 403 Forbidden error', async () => {
    const ctrl = new ProfileController();
    const mockDb = { update: jest.fn() };
    const currentUser = { id: 'user-alice' };
    const targetProfileId = 'user-bob';

    await expect(
      ctrl.updateProfile(currentUser, targetProfileId, { bio: 'Hacked' }, mockDb),
    ).rejects.toThrow(/Forbidden/i);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
