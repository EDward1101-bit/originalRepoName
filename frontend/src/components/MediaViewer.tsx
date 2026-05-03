import { useState } from 'react';

interface MediaViewerProps {
  url: string;
}

export default function MediaViewer({ url }: MediaViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isVideo = url.match(/\.(mp4|webm|ogg)(\?.*)?$/i);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <>
      {/* Inline Media */}
      <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-tertiary)] shadow-sm">
        {isVideo ? (
          <video 
            src={url} 
            controls 
            className="w-full max-h-[300px] object-contain bg-black" 
          />
        ) : (
          <img 
            src={url} 
            alt="Attachment" 
            className="w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
            onClick={toggleFullscreen}
          />
        )}
      </div>

      {/* Fullscreen Modal (Mainly for images, or video fallback if needed) */}
      {isFullscreen && !isVideo && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={toggleFullscreen}
        >
          {/* Close Button */}
          <button
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </button>

          {/* Media Container */}
          <div
            className="max-w-6xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={url}
              alt="Attachment Fullscreen"
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
