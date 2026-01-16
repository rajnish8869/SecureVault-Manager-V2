import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Thumbnail } from '../plugins/ThumbnailPlugin';

interface UseThumbnailOptions {
  path: string;
  mimeType?: string;
  disabled?: boolean;
  width?: number;
  height?: number;
}

export const useThumbnail = ({ path, mimeType = '', disabled = false, width = 256, height = 256 }: UseThumbnailOptions) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    if (!path || disabled) return;

    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        let type: 'image' | 'video' | 'apk' = 'image';
        
        if (mimeType.startsWith('video/') || path.endsWith('.mp4') || path.endsWith('.mkv')) {
            type = 'video';
        } else if (mimeType === 'application/vnd.android.package-archive' || path.endsWith('.apk')) {
            type = 'apk';
        }

        // On Native: Use the Java Plugin
        if (Capacitor.isNativePlatform()) {
            const result = await Thumbnail.getThumbnail({
                path,
                type,
                width,
                height
            });
            
            if (active) {
                setThumbnail(result.base64);
                if (result.duration) setDuration(result.duration);
            }
        } 
        // On Web: If it's a blob/url, the Web implementation handles it. 
        // If it's a raw path, we can't read it, but we try anyway to trigger the plugin's web fallback.
        else {
             const result = await Thumbnail.getThumbnail({ path, type, width, height });
             if (active && result.base64) setThumbnail(result.base64);
        }

      } catch (err) {
        if (active) {
            console.warn('Failed to load thumbnail for', path, err);
            setError(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [path, mimeType, disabled, width, height]);

  return { thumbnail, loading, error, duration };
};
