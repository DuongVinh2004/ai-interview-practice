export class ProfileController {
  async updateProfile(currentUser: { id: string }, targetProfileId: string, data: any, db: any) {
    // BUG: Missing authorization check! Directly updating without checking ownership
    return db.update('UserProfile', targetProfileId, data);
  }
}
