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

    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });
  }

  async searchEducationalVideos(query: string, maxResults: number = 5): Promise<YouTubeVideo[]> {
    try {
      if (!process.env.YOUTUBE_API_KEY) {
        this.logger.warn('No YouTube API key available, returning empty results');
        return [];
      }

      // Search for videos with educational focus
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: `${query} tutorial education learn educational`,
        type: ['video'],
        maxResults,
        order: 'relevance',
        safeSearch: 'strict',
        relevanceLanguage: 'en',
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        this.logger.warn(`No videos found for query: ${query}`);
        return [];
      }

      const videoIds = searchResponse.data.items
        .map(item => item.id?.videoId)
        .filter(id => id) as string[];

      if (videoIds.length === 0) {
        return [];
      }

      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      });

      if (!videosResponse.data.items) {
        return [];
      }

      const videos: YouTubeVideo[] = videosResponse.data.items
        .map(video => {
          const snippet = video.snippet;
          const contentDetails = video.contentDetails;
          const statistics = video.statistics;

          if (!snippet || !video.id) {
            return null;
          }

          // Convert ISO 8601 duration to readable format
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
        })
        .filter(video => video !== null)
        .filter(video => {
          // Filter for educational channels and decent view counts
          const educationalChannels = [
            'khan academy',
            'crash course',
            'ted-ed',
            'ted education',
            'veritasium',
            '3blue1brown',
            'vsauce',
            'pbs space time',
            'physics girl',
            'minutephysics',
            'sci show',
            'numberphile',
            'smarter every day',
            'kurzgesagt',
            'wheezywaiter',
            'linus tech tips',
            'computerphile',
            'freeCodeCamp',
            'The Net Ninja',
            'Traversy Media',
            'Academind',
            'Programming with Mosh',
          ];

          const channelName = video!.channelName.toLowerCase();
          const isEducational = educationalChannels.some(edu =>
            channelName.includes(edu.toLowerCase())
          );

          // Accept videos with decent view counts or from known educational channels
          return isEducational || video!.viewCount > 10000;
        })
        .sort((a, b) => b.viewCount - a.viewCount) // Sort by view count descending
        .slice(0, 3); // Return top 3 results

      this.logger.log(`Found ${videos.length} educational videos for query: ${query}`);
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