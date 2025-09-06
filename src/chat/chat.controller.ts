import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { CreateChatSessionDto, UpdateChatSessionDto, ChatSessionsQueryDto, PaginatedChatSessionsDto } from './dto/chat-session.dto';

@ApiTags('chat')
@Controller('chat')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({ status: 201, description: 'Chat session created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(@Req() req, @Body() dto: CreateChatSessionDto) {
    return this.chatService.createChatSession(req.user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get paginated list of user chat sessions' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Paginated list of chat sessions', type: PaginatedChatSessionsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserSessions(@Req() req, @Query() query: ChatSessionsQueryDto) {
    return this.chatService.getUserChatSessions(req.user.id, query);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a specific chat session' })
  @ApiParam({ name: 'id', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Chat session details' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSession(@Req() req, @Param('id') sessionId: string) {
    return this.chatService.getChatSessionById(sessionId, req.user.id);
  }

  @Put('sessions/:id')
  @ApiOperation({ summary: 'Update a chat session' })
  @ApiParam({ name: 'id', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Chat session updated successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSession(
    @Req() req,
    @Param('id') sessionId: string,
    @Body() dto: UpdateChatSessionDto,
  ) {
    return this.chatService.updateChatSession(sessionId, req.user.id, dto);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiParam({ name: 'id', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Chat session deleted successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteSession(@Req() req, @Param('id') sessionId: string) {
    return this.chatService.deleteChatSession(sessionId, req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get chat session statistics for the user' })
  @ApiResponse({ status: 200, description: 'Chat session statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Req() req) {
    return this.chatService.getChatSessionStats(req.user.id);
  }
}
