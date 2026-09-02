export class ProfileController {
  async updateProfile(currentUser: { id: string }, targetProfileId: string, data: any, db: any) {
    if (currentUser.id !== targetProfileId) {
      throw new Error("Forbidden: Cannot modify another user's profile");
    }
    return db.update('UserProfile', targetProfileId, data);
  }
}
