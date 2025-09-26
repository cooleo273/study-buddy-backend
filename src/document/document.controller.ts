import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';
import { UploadDocumentDto, GenerateQuestionDto } from './dto/document.dto';

@Controller('document')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.uploadDocument(file, dto);
  }

  @Post('generate-question')
  async generateQuestion(
    @Request() req: any,
    @Body() dto: GenerateQuestionDto,
  ) {
    return this.documentService.generateQuestion(req.user.id, dto);
  }

  @Get('my-questions')
  async getUserQuestions(@Request() req: any) {
    return this.documentService.getUserQuestions(req.user.id);
  }
}
