import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;

  // Used only when a command comes from another client.
  playFromRemote: () => void;
  pauseFromRemote: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onPlay?: () => void;
  onPause?: () => void;
}

const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(({ videoId, onPlay, onPause }, ref) => {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);

  /*
   * When another client sends us a play/pause command,
   * YouTube itself will fire onStateChange.
   *
   * This ref tells us that the state change was caused
   * by a remote command, so we must NOT send it back
   * through Socket.IO.
   */
  const remoteActionRef = useRef<
    "play" | "pause" | null
  >(null);

  useEffect(() => {
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
  }, [onPlay, onPause]);

  useImperativeHandle(ref, () => ({
    play: () => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "PLAY FAILED: player not ready"
        );
        return;
      }

      player.playVideo();
    },

    pause: () => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "PAUSE FAILED: player not ready"
        );
        return;
      }

      player.pauseVideo();
    },

    seek: (time: number) => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "SEEK FAILED: player not ready"
        );
        return;
      }

      player.seekTo(time, true);
    },

    getCurrentTime: () => {
      return (
        playerRef.current?.getCurrentTime() ?? 0
      );
    },

    /*
     * Remote PLAY
     */
    playFromRemote: () => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "REMOTE PLAY FAILED: player not ready"
        );
        return;
      }

      console.log(
        "PLAYER: executing remote PLAY"
      );

      remoteActionRef.current = "play";

      player.playVideo();
    },

    /*
     * Remote PAUSE
     */
    pauseFromRemote: () => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "REMOTE PAUSE FAILED: player not ready"
        );
        return;
      }

      console.log(
        "PLAYER: executing remote PAUSE"
      );

      remoteActionRef.current = "pause";

      player.pauseVideo();
    },
  }));

  useEffect(() => {
    let destroyed = false;

    const createPlayer = () => {
      if (
        !containerRef.current ||
        destroyed
      ) {
        return;
      }

      console.log(
        "Creating YouTube player..."
      );

      playerRef.current = new YT.Player(
        containerRef.current,
        {
          videoId,

          width: "100%",
          height: "400",

          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            playsinline: 1,
          },

          events: {
            onReady: () => {
              console.log(
                "YouTube player is ready"
              );
            },

            onStateChange: (event) => {
              console.log(
                "YouTube state changed:",
                event.data
              );

              /*
               * PLAYING
               */
              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {
                /*
                 * If this PLAYING state was caused
                 * by a remote command, consume it
                 * and DO NOT emit another socket event.
                 */
                if (
                  remoteActionRef.current ===
                  "play"
                ) {
                  console.log(
                    "Ignoring remote PLAY state change"
                  );

                  remoteActionRef.current =
                    null;

                  return;
                }

                console.log(
                  "LOCAL YOUTUBE PLAY DETECTED"
                );

                onPlayRef.current?.();

                return;
              }

              /*
               * PAUSED
               */
              if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {
                /*
                 * If this PAUSED state was caused
                 * by a remote command, consume it.
                 */
                if (
                  remoteActionRef.current ===
                  "pause"
                ) {
                  console.log(
                    "Ignoring remote PAUSE state change"
                  );

                  remoteActionRef.current =
                    null;

                  return;
                }

                console.log(
                  "LOCAL YOUTUBE PAUSE DETECTED"
                );

                onPauseRef.current?.();

                return;
              }
            },
          },
        }
      );
    };

    /*
     * YouTube API already loaded
     */
    if (window.YT) {
      createPlayer();
    } else {
      const previousCallback =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady =
        () => {
          previousCallback?.();

          createPlayer();
        };

      const existingScript =
        document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

      if (!existingScript) {
        const script =
          document.createElement("script");

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        document.body.appendChild(script);
      }
    }

    return () => {
      destroyed = true;

      if (playerRef.current) {
        playerRef.current.destroy();

        playerRef.current = null;
      }

      remoteActionRef.current = null;
    };
  }, [videoId]);

  return (
    <div className="w-full overflow-hidden rounded-xl">
      <div ref={containerRef} />
    </div>
  );
});

YouTubePlayer.displayName =
  "YouTubePlayer";

export default YouTubePlayer;