export interface MediaProvider {
  createRoom(sessionId: string): Promise<{ roomName: string }>;
  generateToken(
    sessionId: string,
    userId: string,
    role: 'MENTOR' | 'CANDIDATE',
    participantName: string,
  ): Promise<string>;
}
