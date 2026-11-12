import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Injectable, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../../auth/auth.service';
import { ArenaSessionRepository } from '../repositories/arena-session.repository';
import {
  ArenaCollaborativeRole,
  ArenaCollaborativeParticipant,
  ArenaRoomPresence,
  ArenaCursorCoordinatePayload,
  ArenaCodeChangePayload,
  ArenaSharedTestBroadcast,
} from '@ai-interview/contracts';

const PARTICIPANT_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

interface RoomState {
  roomId: string;
  hostUserId: string;
  activeFile?: string;
  participants: Map<string, ArenaCollaborativeParticipant>;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/arena-collab',
})
export class ArenaCollaborativeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ArenaCollaborativeGateway.name);

  @WebSocketServer()
  server!: Server;

  private readonly rooms = new Map<string, RoomState>();
  private readonly socketToRooms = new Map<string, Set<string>>();

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly arenaSessionRepo?: ArenaSessionRepository,
  ) {}

  /**
   * Handshake authentication using JWT.
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Handshake rejected: No token provided for socket ${client.id}`);
        client.disconnect(true);
        return;
      }

      let user: any = null;
      try {
        user = await this.authService.validateAccessToken(token);
      } catch {
        const secret =
          this.configService.get<string>('jwt.accessSecret') ||
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'default-secret';
        user = this.jwtService.verify(token, { secret });
      }

      if (!user || (!user.id && !user.sub)) {
        this.logger.warn(`Handshake rejected: Invalid user payload for socket ${client.id}`);
        client.disconnect(true);
        return;
      }

      client.data.user = {
        id: user.id || user.sub,
        email: user.email,
        displayName:
          user.displayName || user.name || (user.email ? user.email.split('@')[0] : 'User'),
        role: user.role,
      };

      this.socketToRooms.set(client.id, new Set<string>());
      this.logger.log(`Authenticated socket ${client.id} for user ${client.data.user.id}`);
    } catch (err: any) {
      this.logger.error(`Handshake error on socket ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  /**
   * Handle socket disconnect: clean up presence across all rooms.
   */
  async handleDisconnect(client: Socket) {
    const joinedRooms = this.socketToRooms.get(client.id);
    if (joinedRooms) {
      for (const roomId of joinedRooms) {
        this.removeParticipantFromRoom(client, roomId);
      }
      this.socketToRooms.delete(client.id);
    }
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  /**
   * Join Collaborative Arena Room
   */
  @SubscribeMessage('arena:join-room')
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; role?: ArenaCollaborativeRole; passcode?: string },
  ) {
    const { roomId, role = ArenaCollaborativeRole.HOST } = payload || {};
    if (!roomId) {
      client.emit('arena:error', { code: 'INVALID_PAYLOAD', message: 'roomId is required' });
      return;
    }

    const user = client.data.user || {
      id: 'anonymous-' + client.id,
      displayName: 'Anonymous',
    };

    let roomState = this.rooms.get(roomId);
    if (!roomState) {
      roomState = {
        roomId,
        hostUserId: role === ArenaCollaborativeRole.HOST ? user.id : user.id,
        participants: new Map<string, ArenaCollaborativeParticipant>(),
      };
      this.rooms.set(roomId, roomState);
    }

    const assignedColor =
      PARTICIPANT_COLORS[roomState.participants.size % PARTICIPANT_COLORS.length];

    const participant: ArenaCollaborativeParticipant = {
      socketId: client.id,
      userId: user.id,
      displayName: user.displayName,
      role,
      color: assignedColor,
      joinedAt: new Date().toISOString(),
    };

    roomState.participants.set(client.id, participant);

    let joinedSet = this.socketToRooms.get(client.id);
    if (!joinedSet) {
      joinedSet = new Set<string>();
      this.socketToRooms.set(client.id, joinedSet);
    }
    joinedSet.add(roomId);

    client.join(roomId);

    const presence: ArenaRoomPresence = {
      roomId,
      hostUserId: roomState.hostUserId,
      activeFile: roomState.activeFile,
      participants: Array.from(roomState.participants.values()),
      updatedAt: new Date().toISOString(),
    };

    // Acknowledge joining user
    client.emit('arena:room-joined', presence);

    // Broadcast presence & user-joined to existing peers in room
    client.to(roomId).emit('arena:user-joined', {
      roomId,
      participant,
    });
    client.to(roomId).emit('arena:presence-sync', presence);
  }

  /**
   * Leave Collaborative Arena Room
   */
  @SubscribeMessage('arena:leave-room')
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const { roomId } = payload || {};
    if (!roomId) return;

    this.removeParticipantFromRoom(client, roomId);
    client.leave(roomId);

    const joinedSet = this.socketToRooms.get(client.id);
    if (joinedSet) {
      joinedSet.delete(roomId);
    }
  }

  /**
   * Broadcast Cursor Coordinate
   */
  @SubscribeMessage('arena:cursor-move')
  @SubscribeMessage('cursor-move')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<ArenaCursorCoordinatePayload>,
  ) {
    const { roomId, file, line, column, selectionEndLine, selectionEndColumn } = payload || {};
    if (!roomId || !file || line === undefined || column === undefined) return;

    const user = client.data.user || {};
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(client.id);

    const cursorEvent = {
      roomId,
      userId: user.id || participant?.userId || client.id,
      displayName: user.displayName || participant?.displayName || 'Peer',
      role: participant?.role || ArenaCollaborativeRole.HOST,
      color: participant?.color || '#3B82F6',
      file,
      line,
      column,
      selectionEndLine,
      selectionEndColumn,
      timestamp: Date.now(),
    };

    // Broadcast to room peers only (Room isolation)
    client.to(roomId).emit('arena:cursor-broadcast', cursorEvent);
  }

  /**
   * Synchronize Code Changes (Diff/Full text)
   * Role enforcement: Mentors are read-only observers!
   */
  @SubscribeMessage('arena:code-change')
  @SubscribeMessage('code-change')
  async handleCodeChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<ArenaCodeChangePayload>,
  ) {
    const { roomId, file, content, patch, version = 1 } = payload || {};
    if (!roomId || !file || content === undefined) return;

    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(client.id);

    // Role check: MENTOR cannot modify workspace code
    if (participant && participant.role === ArenaCollaborativeRole.MENTOR) {
      client.emit('arena:error', {
        code: 'PERMISSION_DENIED',
        message: 'Mentors are in observer/review mode and cannot edit workspace code',
      });
      return;
    }

    if (room) {
      room.activeFile = file;
    }

    const user = client.data.user || {};
    const codeBroadcast = {
      roomId,
      userId: user.id || participant?.userId || client.id,
      file,
      content,
      patch,
      version,
      timestamp: Date.now(),
    };

    client.to(roomId).emit('arena:code-broadcast', codeBroadcast);
  }

  /**
   * Broadcast Shared Test Run Status
   */
  @SubscribeMessage('arena:run-tests')
  @SubscribeMessage('run-tests')
  async handleRunTests(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<ArenaSharedTestBroadcast>,
  ) {
    const { roomId } = payload || {};
    if (!roomId) return;

    const user = client.data.user || {};
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(client.id);

    const testBroadcast: ArenaSharedTestBroadcast = {
      roomId,
      triggeredBy: {
        userId: user.id || participant?.userId || client.id,
        displayName: user.displayName || participant?.displayName || 'User',
        role: participant?.role || ArenaCollaborativeRole.HOST,
      },
      commandId: payload.commandId || 'test',
      status: payload.status!,
      stdout: payload.stdout || '',
      stderr: payload.stderr || '',
      durationMs: payload.durationMs || 0,
      testsTotal: payload.testsTotal || 0,
      testsPassed: payload.testsPassed || 0,
      testsFailed: payload.testsFailed || 0,
      testResults: payload.testResults || [],
      timestamp: Date.now(),
    };

    // Emit to ALL participants in the room
    if (this.server) {
      this.server.to(roomId).emit('arena:test-status', testBroadcast);
    }
  }

  /**
   * Helper: Remove participant and update presence.
   */
  private removeParticipantFromRoom(client: Socket, roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    const participant = roomState.participants.get(client.id);
    if (!participant) return;

    roomState.participants.delete(client.id);

    const presence: ArenaRoomPresence = {
      roomId,
      hostUserId: roomState.hostUserId,
      activeFile: roomState.activeFile,
      participants: Array.from(roomState.participants.values()),
      updatedAt: new Date().toISOString(),
    };

    client.to(roomId).emit('arena:user-left', {
      roomId,
      userId: participant.userId,
      socketId: client.id,
    });
    client.to(roomId).emit('arena:presence-sync', presence);

    if (roomState.participants.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * Extract JWT from handshake auth, headers, or query
   */
  private extractToken(client: Socket): string | null {
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    if (client.handshake.query && client.handshake.query.token) {
      const qToken = client.handshake.query.token;
      return Array.isArray(qToken) ? qToken[0] : qToken;
    }
    return null;
  }
}
