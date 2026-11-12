import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ArenaCollaborativeGateway } from '../gateways/arena-collaborative.gateway';
import { ArenaSessionRepository } from '../repositories/arena-session.repository';
import { AuthService } from '../../auth/auth.service';
import { ArenaCollaborativeRole, ArenaRunStatus } from '@ai-interview/contracts';

describe('ArenaCollaborativeGateway (3.3 Live Collaborative Engineering Arena)', () => {
  let gateway: ArenaCollaborativeGateway;
  let testingModule: TestingModule;
  let authService: AuthService;
  let jwtService: JwtService;

  const mockAuthService = {
    validateAccessToken: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'jwt.accessSecret') return 'test-collab-secret';
      return defaultValue;
    }),
  };

  const mockSessionRepo = {
    findById: jest.fn().mockImplementation((id: string) => {
      if (id === 'non-existent') return Promise.resolve(null);
      return Promise.resolve({
        id,
        userId: 'candidate-user-1',
        challengeSlug: 'sample-challenge',
      });
    }),
  };

  // Mock Socket.IO server and sockets
  let mockServer: any;
  const createdSockets: Map<string, any> = new Map();

  function createMockSocket(id: string, token?: string, userData?: any) {
    const emittedToCaller: { event: string; data: any }[] = [];
    const joinedRooms = new Set<string>();

    const socket: any = {
      id,
      handshake: {
        auth: token ? { token } : {},
        headers: token ? { authorization: `Bearer ${token}` } : {},
        query: {},
      },
      data: userData || {},
      emit: jest.fn((event: string, data: any) => {
        emittedToCaller.push({ event, data });
      }),
      join: jest.fn((room: string) => {
        joinedRooms.add(room);
      }),
      leave: jest.fn((room: string) => {
        joinedRooms.delete(room);
      }),
      disconnect: jest.fn(),
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, data: any) => {
          // Broadcast to mock sockets in room except this one
          for (const [sockId, sock] of createdSockets.entries()) {
            if (sockId !== id && sock.joinedRooms.has(room)) {
              sock.emit(event, data);
            }
          }
        }),
      })),
      joinedRooms,
      emittedToCaller,
    };
    createdSockets.set(id, socket);
    return socket;
  }

  beforeEach(async () => {
    createdSockets.clear();

    mockServer = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, data: any) => {
          for (const [, sock] of createdSockets.entries()) {
            if (sock.joinedRooms.has(room)) {
              sock.emit(event, data);
            }
          }
        }),
      })),
      emit: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
      providers: [
        ArenaCollaborativeGateway,
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ArenaSessionRepository, useValue: mockSessionRepo },
      ],
    }).compile();

    gateway = testingModule.get<ArenaCollaborativeGateway>(ArenaCollaborativeGateway);
    gateway.server = mockServer;
    authService = testingModule.get<AuthService>(AuthService);
    jwtService = testingModule.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('Authentication & Handshake (Security)', () => {
    it('disconnects socket if no token is provided', async () => {
      const socket = createMockSocket('sock-unauth');

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data.user).toBeUndefined();
    });

    it('disconnects socket if token validation fails', async () => {
      const socket = createMockSocket('sock-invalid', 'bad-token');
      mockAuthService.validateAccessToken.mockRejectedValue(new Error('Invalid token'));
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('JWT verification failed');
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates socket successfully with valid token and attaches user identity', async () => {
      const socket = createMockSocket('sock-valid', 'valid-jwt-token');
      mockAuthService.validateAccessToken.mockResolvedValue({
        id: 'candidate-user-1',
        email: 'alice@example.com',
        displayName: 'Alice Candidate',
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.user).toBeDefined();
      expect(socket.data.user.id).toBe('candidate-user-1');
      expect(socket.data.user.displayName).toBe('Alice Candidate');
    });
  });

  describe('Room Isolation & Presence Management', () => {
    let hostSocket: any;
    let mentorSocket: any;
    let foreignSocket: any;

    beforeEach(async () => {
      hostSocket = createMockSocket('host-sock', 'token-host', {
        user: { id: 'user-host', displayName: 'Host Candidate' },
      });
      mentorSocket = createMockSocket('mentor-sock', 'token-mentor', {
        user: { id: 'user-mentor', displayName: 'Mentor Bob' },
      });
      foreignSocket = createMockSocket('foreign-sock', 'token-foreign', {
        user: { id: 'user-foreign', displayName: 'Stranger' },
      });
    });

    it('allows Host and Mentor to join room and broadcasts presence updates', async () => {
      const roomId = 'room-101';

      // Host joins
      await gateway.handleJoinRoom(hostSocket, {
        roomId,
        role: ArenaCollaborativeRole.HOST,
      });

      expect(hostSocket.join).toHaveBeenCalledWith(roomId);
      expect(hostSocket.emit).toHaveBeenCalledWith(
        'arena:room-joined',
        expect.objectContaining({
          roomId,
          participants: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user-host',
              role: ArenaCollaborativeRole.HOST,
            }),
          ]),
        }),
      );

      // Mentor joins same room
      await gateway.handleJoinRoom(mentorSocket, {
        roomId,
        role: ArenaCollaborativeRole.MENTOR,
      });

      expect(mentorSocket.join).toHaveBeenCalledWith(roomId);
      expect(mentorSocket.emit).toHaveBeenCalledWith(
        'arena:room-joined',
        expect.objectContaining({
          roomId,
          participants: expect.arrayContaining([
            expect.objectContaining({ userId: 'user-host' }),
            expect.objectContaining({
              userId: 'user-mentor',
              role: ArenaCollaborativeRole.MENTOR,
            }),
          ]),
        }),
      );

      // Host should have received presence update when Mentor joined
      expect(hostSocket.emit).toHaveBeenCalledWith(
        'arena:user-joined',
        expect.objectContaining({
          participant: expect.objectContaining({
            userId: 'user-mentor',
            role: ArenaCollaborativeRole.MENTOR,
          }),
        }),
      );
    });

    it('handles leaveRoom and updates presence for remaining users', async () => {
      const roomId = 'room-101';
      await gateway.handleJoinRoom(hostSocket, {
        roomId,
        role: ArenaCollaborativeRole.HOST,
      });
      await gateway.handleJoinRoom(mentorSocket, {
        roomId,
        role: ArenaCollaborativeRole.MENTOR,
      });

      // Mentor leaves room
      await gateway.handleLeaveRoom(mentorSocket, { roomId });

      expect(mentorSocket.leave).toHaveBeenCalledWith(roomId);
      expect(hostSocket.emit).toHaveBeenCalledWith(
        'arena:user-left',
        expect.objectContaining({
          roomId,
          userId: 'user-mentor',
        }),
      );
    });

    it('automatically cleans up presence when socket disconnects', async () => {
      const roomId = 'room-101';
      await gateway.handleJoinRoom(hostSocket, {
        roomId,
        role: ArenaCollaborativeRole.HOST,
      });
      await gateway.handleJoinRoom(mentorSocket, {
        roomId,
        role: ArenaCollaborativeRole.MENTOR,
      });

      // Disconnect mentor
      await gateway.handleDisconnect(mentorSocket);

      expect(hostSocket.emit).toHaveBeenCalledWith(
        'arena:user-left',
        expect.objectContaining({
          roomId,
          userId: 'user-mentor',
        }),
      );
    });
  });

  describe('Real-time Cursor Movement & Room Isolation', () => {
    let room1Host: any;
    let room1Mentor: any;
    let room2User: any;
    const room1 = 'room-alpha';
    const room2 = 'room-beta';

    beforeEach(async () => {
      room1Host = createMockSocket('r1-host', 't1', {
        user: { id: 'u-host', displayName: 'Host' },
      });
      room1Mentor = createMockSocket('r1-mentor', 't2', {
        user: { id: 'u-mentor', displayName: 'Mentor' },
      });
      room2User = createMockSocket('r2-user', 't3', {
        user: { id: 'u-other', displayName: 'Other' },
      });

      await gateway.handleJoinRoom(room1Host, { roomId: room1, role: ArenaCollaborativeRole.HOST });
      await gateway.handleJoinRoom(room1Mentor, {
        roomId: room1,
        role: ArenaCollaborativeRole.MENTOR,
      });
      await gateway.handleJoinRoom(room2User, { roomId: room2, role: ArenaCollaborativeRole.HOST });
    });

    it('broadcasts cursor coordinates to peer in same room, isolated from other rooms', async () => {
      const cursorPayload = {
        roomId: room1,
        file: 'src/solution.ts',
        line: 25,
        column: 10,
        timestamp: Date.now(),
      };

      await gateway.handleCursorMove(room1Mentor, cursorPayload);

      // Mentor in room 1 sent cursor -> room1Host receives it
      expect(room1Host.emit).toHaveBeenCalledWith(
        'arena:cursor-broadcast',
        expect.objectContaining({
          roomId: room1,
          userId: 'u-mentor',
          line: 25,
          column: 10,
        }),
      );

      // room2User in room 2 must NOT receive cursor from room 1
      expect(room2User.emit).not.toHaveBeenCalledWith('arena:cursor-broadcast', expect.anything());
    });
  });

  describe('Real-time Code Sync & Role-based Permissions', () => {
    let hostSocket: any;
    let pairCoderSocket: any;
    let mentorSocket: any;
    const roomId = 'room-code-sync';

    beforeEach(async () => {
      hostSocket = createMockSocket('s-host', 't1', {
        user: { id: 'u-host', displayName: 'Host' },
      });
      pairCoderSocket = createMockSocket('s-pair', 't2', {
        user: { id: 'u-pair', displayName: 'Pair Coder' },
      });
      mentorSocket = createMockSocket('s-mentor', 't3', {
        user: { id: 'u-mentor', displayName: 'Mentor' },
      });

      await gateway.handleJoinRoom(hostSocket, { roomId, role: ArenaCollaborativeRole.HOST });
      await gateway.handleJoinRoom(pairCoderSocket, {
        roomId,
        role: ArenaCollaborativeRole.PAIR_CODER,
      });
      await gateway.handleJoinRoom(mentorSocket, {
        roomId,
        role: ArenaCollaborativeRole.MENTOR,
      });
    });

    it('permits HOST and PAIR_CODER to broadcast code edits', async () => {
      const codePayload = {
        roomId,
        file: 'src/solution.ts',
        content: 'export function solve() { return 42; }',
        version: 1,
        timestamp: Date.now(),
      };

      await gateway.handleCodeChange(hostSocket, codePayload);

      expect(pairCoderSocket.emit).toHaveBeenCalledWith(
        'arena:code-broadcast',
        expect.objectContaining({
          roomId,
          userId: 'u-host',
          content: 'export function solve() { return 42; }',
          version: 1,
        }),
      );
      expect(mentorSocket.emit).toHaveBeenCalledWith(
        'arena:code-broadcast',
        expect.objectContaining({
          content: 'export function solve() { return 42; }',
        }),
      );
    });

    it('blocks MENTOR from emitting code edits (Read-only observer role enforcement)', async () => {
      const mentorEditPayload = {
        roomId,
        file: 'src/solution.ts',
        content: 'mentor trying to edit code',
        version: 2,
        timestamp: Date.now(),
      };

      await gateway.handleCodeChange(mentorSocket, mentorEditPayload);

      // Mentor should receive error event
      expect(mentorSocket.emit).toHaveBeenCalledWith(
        'arena:error',
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          message: expect.stringContaining('Mentor'),
        }),
      );

      // Host must NOT receive any code broadcast from Mentor
      expect(hostSocket.emit).not.toHaveBeenCalledWith(
        'arena:code-broadcast',
        expect.objectContaining({
          content: 'mentor trying to edit code',
        }),
      );
    });
  });

  describe('Shared Test Run Broadcast', () => {
    let hostSocket: any;
    let mentorSocket: any;
    const roomId = 'room-tests';

    beforeEach(async () => {
      hostSocket = createMockSocket('s-host', 't1', {
        user: { id: 'u-host', displayName: 'Candidate Alice' },
      });
      mentorSocket = createMockSocket('s-mentor', 't2', {
        user: { id: 'u-mentor', displayName: 'Mentor Bob' },
      });

      await gateway.handleJoinRoom(hostSocket, { roomId, role: ArenaCollaborativeRole.HOST });
      await gateway.handleJoinRoom(mentorSocket, {
        roomId,
        role: ArenaCollaborativeRole.MENTOR,
      });
    });

    it('broadcasts shared test status and results to all participants in the room', async () => {
      const testPayload = {
        roomId,
        commandId: 'cmd-unit-tests',
        status: ArenaRunStatus.PASSED,
        stdout: 'All 5 tests passed',
        stderr: '',
        durationMs: 350,
        testsTotal: 5,
        testsPassed: 5,
        testsFailed: 0,
        testResults: [
          {
            suiteName: 'solution.test.ts',
            testName: 'handles concurrency',
            passed: true,
            durationMs: 70,
          },
        ],
        timestamp: Date.now(),
      };

      await gateway.handleRunTests(hostSocket, testPayload);

      // All members in room receive shared test status
      expect(mentorSocket.emit).toHaveBeenCalledWith(
        'arena:test-status',
        expect.objectContaining({
          roomId,
          status: ArenaRunStatus.PASSED,
          testsPassed: 5,
          triggeredBy: expect.objectContaining({
            userId: 'u-host',
            role: ArenaCollaborativeRole.HOST,
          }),
        }),
      );
    });
  });
});
