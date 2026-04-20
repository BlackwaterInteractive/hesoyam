import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { HeartbeatSessionDto } from './dto/heartbeat-session.dto';

@ApiTags('Sessions')
@Controller('sessions')
@RequireApiKey()
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start a game session',
    description: `**Called by:** Discord bot only.

Fired when Discord Rich Presence first reports a game is running. Resolves the game name to a catalog row and inserts a new \`game_sessions\` row with \`ended_at = NULL\`.`,
  })
  start(@Body() dto: StartSessionDto) {
    return this.sessions.startSession(dto);
  }

  @Post('end')
  @ApiOperation({
    summary: 'End a game session',
    description: `**Called by:** Discord bot only.

Fired when Rich Presence stops reporting the game. Sets \`ended_at\` on the user's active session and aggregates duration into \`user_games\` totals.`,
  })
  end(@Body() dto: EndSessionDto) {
    return this.sessions.endSession(dto);
  }

  @Post('heartbeat')
  @ApiOperation({
    summary: 'Keep a session alive',
    description: `**Called by:** Discord bot only.

Sent every 30 seconds while a game is running. Keeps the session marked as active and rebroadcasts presence to the mobile app so the live timer stays visible.`,
  })
  heartbeat(@Body() dto: HeartbeatSessionDto) {
    return this.sessions.heartbeat(dto);
  }
}
