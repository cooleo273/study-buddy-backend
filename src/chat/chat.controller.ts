import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update a chat session with PATCH (for frontend compatibility)' })
  @ApiParam({ name: 'id', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Chat session updated successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async patchSession(
    @Req() req,
    @Param('id') sessionId: string,
    @Body() body: any,
  ) {
    console.log('=== PATCH SESSION REQUEST ===');
    console.log('Session ID:', sessionId);
    console.log('Request body:', body);

    // If the body contains messages, delegate to addMessageToSession
    if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMessage = body.messages[body.messages.length - 1];
      console.log('Delegating to addMessageToSession with message:', lastMessage);

      return this.chatService.addMessageToSession(sessionId, req.user.id, {
        content: lastMessage.content,
        role: lastMessage.role,
        conversationId: lastMessage.conversationId
      });
    }

    // Otherwise, treat as regular update
    return this.chatService.updateChatSession(sessionId, req.user.id, body);
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

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Add a message to a chat session' })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addMessage(
    @Req() req,
    @Param('sessionId') sessionId: string,
    @Body() messageData: { content: string; role: 'user' | 'assistant'; conversationId?: string },
  ) {
    return this.chatService.addMessageToSession(sessionId, req.user.id, messageData);
  }

  @Get('sessions/:sessionId/messages/grouped')
  @ApiOperation({ summary: 'Get messages from a chat session grouped by conversation' })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Grouped messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessagesGrouped(@Req() req, @Param('sessionId') sessionId: string) {
    return this.chatService.getSessionMessagesGrouped(sessionId, req.user.id);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations across all user sessions' })
  @ApiResponse({ status: 200, description: 'All conversations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllConversations(@Req() req) {
    return this.chatService.getAllUserConversations(req.user.id);
  }

  @Get('debug/sessions')
  @ApiOperation({ summary: 'Debug endpoint to check all sessions and their message counts' })
  @ApiResponse({ status: 200, description: 'Debug information retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async debugSessions(@Req() req) {
    return this.chatService.debugUserSessions(req.user.id);
  }

  @Get('sessions/:sessionId/verify')
  @ApiOperation({ summary: 'Verify messages are saved correctly in a session' })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  @ApiResponse({ status: 200, description: 'Session verification completed' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifySessionMessages(@Req() req, @Param('sessionId') sessionId: string) {
    return this.chatService.verifySessionMessages(sessionId, req.user.id);
  }

  @Post('sessions/:sessionId/test-message')
  @ApiOperation({ summary: 'Add a test message to verify message saving works' })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  @ApiResponse({ status: 201, description: 'Test message added successfully' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addTestMessage(@Req() req, @Param('sessionId') sessionId: string) {
    const testMessage = {
      content: `Test message at ${new Date().toISOString()}`,
      role: 'user' as const
    };
    return this.chatService.addMessageToSession(sessionId, req.user.id, testMessage);
  }
}
