import { Body, Controller, Post } from '@nestjs/common';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { HeartbeatSessionDto } from './dto/heartbeat-session.dto';

@Controller('sessions')
@RequireApiKey()
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Post('start')
  start(@Body() dto: StartSessionDto) {
    return this.sessions.startSession(dto);
  }

  @Post('end')
  end(@Body() dto: EndSessionDto) {
    return this.sessions.endSession(dto);
  }

  @Post('heartbeat')
  heartbeat(@Body() dto: HeartbeatSessionDto) {
    return this.sessions.heartbeat(dto);
  }
}
