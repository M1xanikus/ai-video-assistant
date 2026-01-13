import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, Maximize, SkipBack, SkipForward, Upload } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string | null;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
}

export function VideoPlayer({
  videoUrl,
  currentTime,
  duration,
  onTimeUpdate,
  onDurationChange
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Синхронизация громкости
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Синхронизация времени видео при внешнем изменении (например, из таймлайна)
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      onDurationChange(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    onTimeUpdate(newTime);
  };

  const skipForward = () => {
    const newTime = Math.min(currentTime + 5, duration);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const skipBackward = () => {
    const newTime = Math.max(currentTime - 5, 0);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const toggleFullScreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-white p-4">
      {/* Label */}
      <div className="mb-2 text-sm font-medium text-[#5F6368]">Source Video</div>

      {/* Video Container */}
      <div className="flex-1 bg-black rounded-lg overflow-hidden relative group flex items-center justify-center">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={handlePlayPause}
          />
        ) : (
          /* Empty State */
          <div className="text-center text-white/50">
            <Upload className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <div className="text-sm">No video selected</div>
            <div className="text-xs mt-2">Click "Upload" in the toolbar to begin</div>
          </div>
        )}

        {/* Video Controls Overlay (только если видео загружено) */}
        {videoUrl && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Progress Bar */}
            <div
              className="w-full h-1.5 bg-white/30 rounded-full mb-3 cursor-pointer group/progress relative"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-[#1A73E8] rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform" />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={skipBackward}
                  className="text-white hover:text-[#1A73E8] transition-colors"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={handlePlayPause}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={skipForward}
                  className="text-white hover:text-[#1A73E8] transition-colors"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <div className="text-white text-sm ml-2 font-mono">
                  {formatTime(currentTime)} <span className="opacity-50">/ {formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 group/volume">
                  <Volume2 className="w-5 h-5 text-white" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-0 group-hover/volume:w-20 transition-all duration-300 accent-[#1A73E8] cursor-pointer"
                  />
                </div>
                <button
                  onClick={toggleFullScreen}
                  className="text-white hover:text-[#1A73E8] transition-colors"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}