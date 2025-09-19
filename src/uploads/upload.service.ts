import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { diskStorage } from 'multer';

export interface FileUploadResult {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
}

@Injectable()
export class UploadService {
  private uuidGenerator: () => string;

  constructor() {
    this.initializeUuidGenerator();
  }

  private initializeUuidGenerator() {
    // Use Node.js built-in crypto.randomUUID() as primary method
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      this.uuidGenerator = () => crypto.randomUUID();
    } else {
      // Fallback for environments without crypto.randomUUID
      this.uuidGenerator = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }

  createMulterOptions() {
    return {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const fileExtName = extname(file.originalname);
          const fileName = `${this.uuidGenerator()}${fileExtName}`;
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
