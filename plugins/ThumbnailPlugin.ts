import { registerPlugin, WebPlugin } from '@capacitor/core';

export interface ThumbnailOptions {
  /**
   * The file path. Can be absolute or relative to ExternalStorage.
   */
  path: string;
  /**
   * Hint for the file type to optimize generation.
   * Default: 'image'
   */
  type?: 'image' | 'video' | 'apk';
  /**
   * Target width of the thumbnail.
   * Default: 256
   */
  width?: number;
  /**
   * Target height of the thumbnail.
   * Default: 256
   */
  height?: number;
}

export interface ThumbnailResult {
  /**
   * The Base64 string of the thumbnail, including the data prefix (data:image/jpeg;base64,...)
   */
  base64: string;
  /**
   * Duration of the video in milliseconds (only returned for video type).
   */
  duration?: number;
}

export interface ThumbnailPluginContract {
  getThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult>;
}

export class ThumbnailWeb extends WebPlugin implements ThumbnailPluginContract {
  async getThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
    console.warn('Thumbnail generation is not fully supported on Web. Returning placeholder or attempting blob load.');
    
    // Attempt to generate a thumb if it's a blob/http URL, otherwise return a generic placeholder
    if (options.path.startsWith('blob:') || options.path.startsWith('http')) {
        return this.generateWebThumbnail(options.path, options.width || 256, options.height || 256);
    }

    // Return a 1x1 transparent pixel for unsupported local paths on web
    return {
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    };
  }

  private async generateWebThumbnail(src: string, w: number, h: number): Promise<ThumbnailResult> {
      return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if(ctx) {
                  // Maintain aspect ratio cover
                  const scale = Math.max(w / img.width, h / img.height);
                  const x = (w / 2) - (img.width / 2) * scale;
                  const y = (h / 2) - (img.height / 2) * scale;
                  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                  resolve({ base64: canvas.toDataURL('image/jpeg', 0.8) });
              } else {
                  resolve({ base64: '' });
              }
          };
          img.onerror = () => resolve({ base64: '' });
          img.src = src;
      });
  }
}

export const Thumbnail = registerPlugin<ThumbnailPluginContract>('Thumbnail', {
  web: () => new ThumbnailWeb(),
});
