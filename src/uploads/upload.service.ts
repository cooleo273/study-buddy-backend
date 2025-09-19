import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';

export interface FileUploadResult {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
}

@Injectable()
export class UploadService {
  createMulterOptions() {
    return {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const fileExtName = extname(file.originalname);
          const fileName = `${uuid()}${fileExtName}`;
          callback(null, fileName);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow only images and documents
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf|doc|docx)$/)) {
          return callback(new Error('Only image and document files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    };
  }

  getFileUrl(filename: string): string {
    return `${process.env.APP_URL || 'http://localhost:3000'}/uploads/${filename}`;
  }
}
