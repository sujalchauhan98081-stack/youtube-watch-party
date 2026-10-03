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

  playFromRemote: () => void;
  pauseFromRemote: () => void;
  seekFromRemote: (time: number) => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
}

const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(({ videoId, onPlay, onPause, onSeek }, ref) => {
  // Stores the actual YouTube player
  const playerRef = useRef<YT.Player | null>(null);

  // Stores the HTML element where YouTube player is created
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest callback references
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onSeekRef = useRef(onSeek);

  // Used to ignore state changes caused by remote actions
  const remoteActionRef = useRef<
    "play" | "pause" | null
  >(null);

  // Used to ignore seek detection caused by remote seek
  const remoteSeekRef = useRef(false);

  // Playback tracking
  const lastObservedTimeRef = useRef(0);
  const lastObservedAtRef = useRef(Date.now());

  /*
   * IMPORTANT:
   * Do NOT use YT here.
   *
   * The YouTube API loads asynchronously, so YT may not
   * exist when this component first renders.
   */
  const playerStateRef = useRef<number>(-1);

  // Keep callback refs updated
  useEffect(() => {
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekRef.current = onSeek;
  }, [onPlay, onPause, onSeek]);

  /*
   * Expose player controls to App.tsx
   */
  useImperativeHandle(ref, () => ({
    // --------------------------------
    // LOCAL PLAY
    // --------------------------------
    play: () => {
      const player = playerRef.current;

      if (!player) {
        console.log("PLAY FAILED: player not ready");
        return;
      }

      player.playVideo();
    },

    // --------------------------------
    // LOCAL PAUSE
    // --------------------------------
    pause: () => {
      const player = playerRef.current;

      if (!player) {
        console.log("PAUSE FAILED: player not ready");
        return;
      }

      player.pauseVideo();
    },

    // --------------------------------
    // LOCAL SEEK
    // --------------------------------
    seek: (time: number) => {
      const player = playerRef.current;

      if (!player) {
        console.log("SEEK FAILED: player not ready");
        return;
      }

      player.seekTo(time, true);
    },

    // --------------------------------
    // GET CURRENT TIME
    // --------------------------------
    getCurrentTime: () => {
      return playerRef.current?.getCurrentTime() ?? 0;
    },

    // --------------------------------
    // REMOTE PLAY
    // --------------------------------
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

      // Tell onStateChange that this PLAY came
      // from another participant.
      remoteActionRef.current = "play";

      player.playVideo();
    },

    // --------------------------------
    // REMOTE PAUSE
    // --------------------------------
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

      // Tell onStateChange that this PAUSE came
      // from another participant.
      remoteActionRef.current = "pause";

      player.pauseVideo();
    },

    // --------------------------------
    // REMOTE SEEK
    // --------------------------------
    seekFromRemote: (time: number) => {
      const player = playerRef.current;

      if (!player) {
        console.log(
          "REMOTE SEEK FAILED: player not ready"
        );
        return;
      }

      console.log(
        "PLAYER: executing remote SEEK:",
        time
      );

      // Tell our seek detector that this seek
      // came from another participant.
      remoteSeekRef.current = true;

      player.seekTo(time, true);

      // Update our tracking immediately.
      lastObservedTimeRef.current = time;
      lastObservedAtRef.current = Date.now();
    },
  }));

  /*
   * Initialize YouTube IFrame API
   * and create the player.
   */
  useEffect(() => {
    let destroyed = false;

    const createPlayer = () => {
      /*
       * IMPORTANT:
       * Always check window.YT before using it.
       */
      if (
        destroyed ||
        !containerRef.current ||
        !window.YT
      ) {
        return;
      }

      console.log(
        "Creating YouTube player..."
      );

      // Destroy previous player if it exists
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      /*
       * YouTube API is now guaranteed to exist.
       */
      playerRef.current = new window.YT.Player(
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
            // --------------------------------
            // PLAYER READY
            // --------------------------------
            onReady: (event) => {
              console.log(
                "YouTube player is ready"
              );

              lastObservedTimeRef.current =
                event.target.getCurrentTime();

              lastObservedAtRef.current =
                Date.now();

              // Reset state
              playerStateRef.current =
                window.YT?.PlayerState
                  ?.UNSTARTED ?? -1;
            },

            // --------------------------------
            // PLAYER STATE CHANGE
            // --------------------------------
            onStateChange: (event) => {
              console.log(
                "YouTube state changed:",
                event.data
              );

              playerStateRef.current =
                event.data;

              const currentTime =
                event.target.getCurrentTime();

              lastObservedTimeRef.current =
                currentTime;

              lastObservedAtRef.current =
                Date.now();

              /*
               * PLAYING
               */
              if (
                window.YT &&
                event.data ===
                  window.YT.PlayerState.PLAYING
              ) {
                /*
                 * Ignore PLAY generated by remote
                 * participant.
                 */
                if (
                  remoteActionRef.current ===
                  "play"
                ) {
                  console.log(
                    "Ignoring remote PLAY state change"
                  );

                  remoteActionRef.current = null;

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
                window.YT &&
                event.data ===
                  window.YT.PlayerState.PAUSED
              ) {
                /*
                 * Ignore PAUSE generated by remote
                 * participant.
                 */
                if (
                  remoteActionRef.current ===
                  "pause"
                ) {
                  console.log(
                    "Ignoring remote PAUSE state change"
                  );

                  remoteActionRef.current = null;

                  return;
                }

                console.log(
                  "LOCAL YOUTUBE PAUSE DETECTED"
                );

                onPauseRef.current?.();
              }
            },
          },
        }
      );
    };

    /*
     * -----------------------------------------
     * CASE 1:
     * YouTube API is already loaded
     * -----------------------------------------
     */
    if (window.YT) {
      createPlayer();
    } else {
      /*
       * -----------------------------------------
       * CASE 2:
       * YouTube API is still loading
       * -----------------------------------------
       */

      const previousCallback =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        // Preserve any previous callback
        previousCallback?.();

        if (!destroyed) {
          createPlayer();
        }
      };

      /*
       * Check whether the YouTube API script
       * already exists.
       */
      const existingScript =
        document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

      /*
       * If it doesn't exist, load it.
       */
      if (!existingScript) {
        const script =
          document.createElement("script");

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        document.body.appendChild(script);
      }
    }

    /*
     * Cleanup
     */
    return () => {
      destroyed = true;

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      remoteActionRef.current = null;
      remoteSeekRef.current = false;
    };
  }, [videoId]);

  /*
   * -----------------------------------------
   * SEEK DETECTION
   *
   * YouTube doesn't provide a dedicated
   * "seek" event, so we detect it by comparing
   * expected playback time with actual time.
   * -----------------------------------------
   */
  useEffect(() => {
    const interval =
      window.setInterval(() => {
        const player = playerRef.current;

        if (!player) {
          return;
        }

        /*
         * YouTube API should already be available
         * because the player exists.
         */
        if (!window.YT) {
          return;
        }

        const currentTime =
          player.getCurrentTime();

        const now = Date.now();

        const previousTime =
          lastObservedTimeRef.current;

        const previousAt =
          lastObservedAtRef.current;

        const elapsedSeconds =
          (now - previousAt) / 1000;

        const isPlaying =
          playerStateRef.current ===
          window.YT.PlayerState.PLAYING;

        /*
         * Calculate where the video should be
         * if normal playback occurred.
         */
        let expectedTime = previousTime;

        if (isPlaying) {
          expectedTime += elapsedSeconds;
        }

        const difference = Math.abs(
          currentTime - expectedTime
        );

        /*
         * Small differences are normal because
         * browser/player timing isn't exact.
         */
        const seekThreshold = isPlaying
          ? 1.5
          : 0.75;

        /*
         * Detect seek
         */
        if (
          difference >= seekThreshold
        ) {
          /*
           * Ignore seek caused by remote user.
           */
          if (remoteSeekRef.current) {
            console.log(
              "Ignoring remote SEEK detection"
            );

            remoteSeekRef.current = false;
          } else {
            /*
             * This was a LOCAL seek.
             */
            console.log(
              "LOCAL YOUTUBE SEEK DETECTED:",
              currentTime
            );

            onSeekRef.current?.(
              currentTime
            );
          }
        }

        /*
         * Update tracking values.
         */
        lastObservedTimeRef.current =
          currentTime;

        lastObservedAtRef.current = now;
      }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /*
   * -----------------------------------------
   * RENDER
   * -----------------------------------------
   */
  return (
    <div className="w-full overflow-hidden rounded-xl">
      <div ref={containerRef} />
    </div>
  );
});

YouTubePlayer.displayName =
  "YouTubePlayer";

export default YouTubePlayer;