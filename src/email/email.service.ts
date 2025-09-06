import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@askfriendlearn.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; text-align: center;">Welcome to Ask Friend Learn! 🎉</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Hi ${username},
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Welcome to Ask Friend Learn! We're excited to have you join our AI-powered tutoring platform.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          You can now:
        </p>
        <ul style="font-size: 16px; line-height: 1.6; color: #666;">
          <li>Create and manage chat sessions with our AI tutor</li>
          <li>Access your learning history</li>
          <li>Track your progress</li>
        </ul>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          If you have any questions, feel free to reach out to our support team.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Happy learning! 📚
        </p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Start Learning
          </a>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Ask Friend Learn! 🎉',
      html,
      text: `Welcome to Ask Friend Learn, ${username}! Start your AI-powered learning journey today.`,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; text-align: center;">Password Reset Request</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          You requested a password reset for your Ask Friend Learn account.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #999;">
          This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
      text: `Reset your password: ${resetUrl}`,
    });
  }

  async sendChatSessionNotification(email: string, sessionCount: number): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; text-align: center;">Chat Session Milestone! 🎯</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Congratulations! You've completed ${sessionCount} chat sessions with our AI tutor.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #666;">
          Keep up the great work in your learning journey!
        </p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/chat"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Continue Learning
          </a>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: `Chat Session Milestone: ${sessionCount} Sessions! 🎯`,
      html,
      text: `Congratulations! You've completed ${sessionCount} chat sessions.`,
    });
  }
}
