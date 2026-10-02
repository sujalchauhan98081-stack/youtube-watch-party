import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

interface YouTubePlayerProps {
  videoId: string;
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
}

const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(({ videoId }, ref) => {
  // This stores the ACTUAL YouTube player
  const youtubePlayerRef = useRef<YT.Player | null>(null);

  // This stores the HTML div where YouTube is created
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      youtubePlayerRef.current?.playVideo();
    },

    pause: () => {
      youtubePlayerRef.current?.pauseVideo();
    },

    seek: (seconds: number) => {
      youtubePlayerRef.current?.seekTo(seconds, true);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    const createPlayer = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.YT
      ) {
        return;
      }

      // Destroy previous player if it exists
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }

      youtubePlayerRef.current = new YT.Player(
        containerRef.current,
        {
          videoId,

          width: "100%",
          height: "400",

          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
          },

          events: {
            onReady: () => {
              console.log("YouTube player is ready");
            },

            onStateChange: (event: YT.OnStateChangeEvent) => {
              console.log(
                "YouTube player state:",
                event.data
              );
            },
          },
        }
      );
    };

    // YouTube API already loaded
    if (window.YT) {
      createPlayer();
    } else {
      const previousCallback =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        createPlayer();
      };

      // Load YouTube API only if not already loaded
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        )
      ) {
        const script = document.createElement("script");

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;

      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div className="w-full overflow-hidden rounded-xl">
      <div ref={containerRef} />
    </div>
  );
});

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;