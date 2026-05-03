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
      {/* Inline Thumbnail */}
      <div
        className="mt-2 max-w-sm rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-tertiary)] cursor-pointer hover:opacity-90 transition-opacity"
        onClick={toggleFullscreen}
      >
        {isVideo ? (
          <video src={url} className="w-full max-h-64 object-cover" />
        ) : (
          <img src={url} alt="Attachment" className="w-full max-h-64 object-cover" />
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={toggleFullscreen}
        >
          {/* Close Button */}
          <button
            className="absolute top-6 right-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Media Container */}
          <div
            className="max-w-5xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to the backdrop
          >
            {isVideo ? (
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={url}
                alt="Attachment Fullscreen"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
