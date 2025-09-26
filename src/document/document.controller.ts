import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { DocumentService } from './document.service';
import { UploadDocumentDto, GenerateQuestionDto } from './dto/document.dto';

@Controller('document')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  // @UseGuards(AdminGuard) // Temporarily disabled for debugging
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 15 * 1024 * 1024, // 15MB limit
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.includes('pdf')) {
        return callback(new Error('Only PDF files are allowed!'), false);
      }
      callback(null, true);
    },
  }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Request() req: any,
  ) {
    console.log('=== UPLOAD ATTEMPT DEBUG ===');
    console.log('File:', file ? {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer ? `Buffer(${file.buffer.length} bytes)` : null
    } : 'NO FILE');
    console.log('Raw body keys:', Object.keys(req.body));
    console.log('Raw body values:', req.body);
    console.log('DTO after transform:', dto);
    console.log('User:', req.user);
    console.log('=== END DEBUG ===');

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

  @Get('list')
  @UseGuards(AdminGuard)
  async getDocuments() {
    return this.documentService.getDocuments();
  }
}
