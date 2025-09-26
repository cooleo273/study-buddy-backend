import { Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  channelName: string;
  channelId: string;
  duration: string;
  description: string;
  viewCount: number;
  publishedAt: string;
  thumbnailUrl: string;
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);
  private youtube: youtube_v3.Youtube;

  constructor() {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      this.logger.warn('YOUTUBE_API_KEY not found in environment variables');
    }

    // Use API key authentication
    const auth = google.auth.fromAPIKey(apiKey);
    this.youtube = google.youtube({
      version: 'v3',
      auth: auth,
    });
  }

  async searchEducationalVideos(query: string, maxResults: number = 5): Promise<YouTubeVideo[]> {
    try {
      if (!process.env.YOUTUBE_API_KEY) {
        this.logger.warn('No YouTube API key available, returning empty results');
        return [];
      }

      // Create more specific search queries for better results
      const searchQueries = [
        `${query} explained tutorial`,
        `${query} for beginners complete guide`,
        `${query} fundamentals basics`,
        `${query} introduction overview`,
      ];

      let allVideoIds: string[] = [];

      // Search with multiple queries to get better results
      for (const searchQuery of searchQueries) {
        try {
          this.logger.log(`Searching YouTube with query: "${searchQuery}"`);
          const searchResponse = await this.youtube.search.list({
            part: ['snippet'],
            q: searchQuery,
            type: ['video'],
            maxResults: Math.ceil(maxResults / 2), // Get fewer per query
            order: 'relevance',
            safeSearch: 'strict',
            relevanceLanguage: 'en',
            regionCode: 'US', // Prefer US region content
          });

          if (searchResponse.data.items) {
            const videoIds = searchResponse.data.items
              .map(item => item.id?.videoId)
              .filter(id => id) as string[];
            this.logger.log(`Found ${videoIds.length} video IDs for query "${searchQuery}"`);
            allVideoIds = [...allVideoIds, ...videoIds];
          }
        } catch (error) {
          this.logger.warn(`Search failed for query "${searchQuery}":`, error);
        }
      }

      // Remove duplicates and limit
      allVideoIds = [...new Set(allVideoIds)].slice(0, maxResults * 2);

      if (allVideoIds.length === 0) {
        this.logger.warn(`No videos found for query: ${query}`);
        return [];
      }

      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: allVideoIds,
      });

      if (!videosResponse.data.items) {
        return [];
      }

      this.logger.log(`Retrieved ${videosResponse.data.items.length} video details`);

      const videos: YouTubeVideo[] = videosResponse.data.items
        .map(video => {
          const snippet = video.snippet;
          const contentDetails = video.contentDetails;
          const statistics = video.statistics;

          if (!snippet || !video.id) {
            return null;
          }

          // Convert ISO 8601 duration to seconds for filtering
          const durationInSeconds = this.parseDurationToSeconds(contentDetails?.duration || 'PT0S');
          const duration = this.parseDuration(contentDetails?.duration || 'PT0S');

          return {
            id: video.id,
            title: snippet.title || 'Untitled Video',
            url: `https://www.youtube.com/watch?v=${video.id}`,
            channelName: snippet.channelTitle || 'Unknown Channel',
            channelId: snippet.channelId || '',
            duration,
            durationInSeconds,
            description: snippet.description || '',
            viewCount: parseInt(statistics?.viewCount || '0'),
            publishedAt: snippet.publishedAt || '',
            thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
          };
        })
        .filter(video => video !== null)
        .filter(video => {
          // Premium educational channels (higher quality)
          const premiumChannels = [
            'Khan Academy',
            'Crash Course',
            'TED-Ed',
            'TED',
            'Veritasium',
            '3Blue1Brown',
            'Vsauce',
            'PBS Space Time',
            'Physics Girl',
            'MinutePhysics',
            'SciShow',
            'Numberphile',
            'Smarter Every Day',
            'Kurzgesagt',
            'WheezyWaiter',
            'Linus Tech Tips',
            'Computerphile',
            'freeCodeCamp',
            'The Net Ninja',
            'Traversy Media',
            'Academind',
            'Programming with Mosh',
            'CS Dojo',
            'sentdex',
            'Corey Schafer',
            'Tech With Tim',
            'Fireship',
            'Web Dev Simplified',
            'Kevin Powell',
            'Coder Coder',
            'DesignCourse',
            'The Coding Train',
            'Ben Awad',
            'Jack Herrington',
            'Hussein Nasser',
            'ByteByteGo',
            'AWS',
            'Google Cloud Tech',
            'Microsoft Developer',
            'IBM Technology',
            'Oracle Learning',
            'MIT OpenCourseWare',
            'Stanford Online',
            'Harvard Online',
            'Coursera',
            'edX',
            'Udacity',
          ];

          const channelName = video!.channelName.toLowerCase();
          const isPremiumChannel = premiumChannels.some(premium =>
            channelName.includes(premium.toLowerCase()) ||
            premium.toLowerCase().includes(channelName)
          );

          // Relaxed filtering criteria for testing
          const meetsCriteria =
            video!.durationInSeconds >= 60 && // At least 1 minute (was 5 minutes)
            video!.viewCount >= 1000 && // At least 1K views (was 50K)
            isPremiumChannel; // Must be from premium educational channels

          this.logger.log(`Video "${video!.title}" by ${video!.channelName}: ${video!.durationInSeconds}s, ${video!.viewCount} views, premium: ${isPremiumChannel}, meets criteria: ${meetsCriteria}`);

          return meetsCriteria;
        })
        .sort((a, b) => {
          // Sort by a combination of view count and duration (longer, more popular videos first)
          const scoreA = a!.viewCount * Math.log(a!.durationInSeconds + 1);
          const scoreB = b!.viewCount * Math.log(b!.durationInSeconds + 1);
          return scoreB - scoreA;
        })
        .slice(0, 3); // Return top 3 best results

      this.logger.log(`Found ${videos.length} high-quality educational videos for query: ${query}`);
      return videos;

    } catch (error) {
      this.logger.error(`Error searching YouTube videos for query "${query}":`, error);
      return [];
    }
  }

  private parseDuration(duration: string): string {
    // Parse ISO 8601 duration (PT4M13S) to readable format (4:13)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    if (!match) return '0:00';

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  async getVideoById(videoId: string): Promise<YouTubeVideo | null> {
    try {
      if (!process.env.YOUTUBE_API_KEY) {
        return null;
      }

      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId],
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const video = response.data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;
      const statistics = video.statistics;

      if (!snippet || !video.id) {
        return null;
      }

      const duration = this.parseDuration(contentDetails?.duration || 'PT0S');

      return {
        id: video.id,
        title: snippet.title || 'Untitled Video',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        channelName: snippet.channelTitle || 'Unknown Channel',
        channelId: snippet.channelId || '',
        duration,
        description: snippet.description || '',
        viewCount: parseInt(statistics?.viewCount || '0'),
        publishedAt: snippet.publishedAt || '',
        thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
      };

    } catch (error) {
      this.logger.error(`Error getting video ${videoId}:`, error);
      return null;
    }
  }
}