import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

declare global {
  interface Window {
    YT: typeof YT | undefined;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;

  playFromRemote: () => void;
  pauseFromRemote: () => void;
  seekFromRemote: (time: number) => void;

  syncFromRemote: (
    time: number,
    isPlaying: boolean
  ) => void;
}

interface YouTubePlayerProps {
  videoId: string;

  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;

  syncState?: {
    currentTime: number;
    isPlaying: boolean;
  } | null;
}

const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(
  (
    {
      videoId,
      onPlay,
      onPause,
      onSeek,
      syncState,
    },
    ref
  ) => {
    const playerRef =
      useRef<YT.Player | null>(null);

    const containerRef =
      useRef<HTMLDivElement | null>(null);

    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekRef = useRef(onSeek);

    const remoteActionRef =
      useRef<"play" | "pause" | null>(null);

    const remoteSeekRef =
      useRef(false);

    const lastObservedTimeRef =
      useRef(0);

    const lastObservedAtRef =
      useRef(Date.now());

    const playerStateRef =
      useRef<number>(-1);

    const playerReadyRef =
      useRef(false);

    /*
     * Pending synchronization state.
     *
     * If sync_state arrives before YouTube is ready,
     * we keep it here and apply it from onReady.
     */
    const pendingSyncRef =
      useRef<{
        currentTime: number;
        isPlaying: boolean;
      } | null>(null);

    /*
     * Keep the latest video ID for initial player creation.
     */
    const videoIdRef =
      useRef(videoId);

    useEffect(() => {
      onPlayRef.current = onPlay;
    }, [onPlay]);

    useEffect(() => {
      onPauseRef.current = onPause;
    }, [onPause]);

    useEffect(() => {
      onSeekRef.current = onSeek;
    }, [onSeek]);

    /*
     * Keep the latest video ID available for player creation.
     *
     * IMPORTANT:
     * This must NOT be used to decide whether a video changed,
     * because updating this ref before the video-change effect
     * would make the comparison always equal.
     */
    useEffect(() => {
      videoIdRef.current = videoId;
    }, [videoId]);

    /*
     * Apply synchronization state received from server.
     */
    useEffect(() => {
      if (!syncState) {
        return;
      }

      console.log(
        "YouTubePlayer received sync state:",
        syncState
      );

      pendingSyncRef.current = syncState;

      /*
       * If player is already ready, apply immediately.
       */
      if (
        playerReadyRef.current &&
        playerRef.current
      ) {
        applySyncState(syncState);
      }
    }, [syncState]);

    /*
     * Apply synchronization to YouTube.
     */
    const applySyncState = useCallback(
      (state: {
        currentTime: number;
        isPlaying: boolean;
      }) => {
        const player = playerRef.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          console.log(
            "SYNC WAITING: YouTube player is not ready"
          );

          return;
        }

        console.log(
          "========== APPLY SYNC =========="
        );

        console.log(
          "Sync time:",
          state.currentTime
        );

        console.log(
          "Sync playing:",
          state.isPlaying
        );

        pendingSyncRef.current = null;

        remoteSeekRef.current = true;

        player.seekTo(
          Math.max(0, state.currentTime),
          true
        );

        lastObservedTimeRef.current =
          state.currentTime;

        lastObservedAtRef.current =
          Date.now();

        window.setTimeout(() => {
          remoteSeekRef.current = false;
        }, 500);

        if (state.isPlaying) {
          remoteActionRef.current = "play";

          player.playVideo();

          window.setTimeout(() => {
            if (
              remoteActionRef.current ===
              "play"
            ) {
              remoteActionRef.current = null;
            }
          }, 500);
        } else {
          remoteActionRef.current = "pause";

          player.pauseVideo();

          window.setTimeout(() => {
            if (
              remoteActionRef.current ===
              "pause"
            ) {
              remoteActionRef.current = null;
            }
          }, 500);
        }
      },
      []
    );

    /*
     * Keep the callback stable in a ref.
     */
    const applySyncStateRef =
      useRef(applySyncState);

    useEffect(() => {
      applySyncStateRef.current =
        applySyncState;
    }, [applySyncState]);

    /*
     * Public controls.
     */
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          playerRef.current?.playVideo();
        },

        pause: () => {
          playerRef.current?.pauseVideo();
        },

        seek: (time: number) => {
          playerRef.current?.seekTo(
            time,
            true
          );
        },

        getCurrentTime: () => {
          return (
            playerRef.current?.getCurrentTime() ??
            0
          );
        },

        playFromRemote: () => {
          remoteActionRef.current = "play";

          playerRef.current?.playVideo();

          window.setTimeout(() => {
            if (
              remoteActionRef.current ===
              "play"
            ) {
              remoteActionRef.current = null;
            }
          }, 500);
        },

        pauseFromRemote: () => {
          remoteActionRef.current = "pause";

          playerRef.current?.pauseVideo();

          window.setTimeout(() => {
            if (
              remoteActionRef.current ===
              "pause"
            ) {
              remoteActionRef.current = null;
            }
          }, 500);
        },

        seekFromRemote: (time: number) => {
          remoteSeekRef.current = true;

          playerRef.current?.seekTo(
            time,
            true
          );

          lastObservedTimeRef.current =
            time;

          lastObservedAtRef.current =
            Date.now();

          window.setTimeout(() => {
            remoteSeekRef.current = false;
          }, 500);
        },

        syncFromRemote: (
          time: number,
          isPlaying: boolean
        ) => {
          const state = {
            currentTime: time,
            isPlaying,
          };

          pendingSyncRef.current = state;

          if (
            playerReadyRef.current &&
            playerRef.current
          ) {
            applySyncStateRef.current(state);
          } else {
            console.log(
              "SYNC STORED: waiting for YouTube player"
            );
          }
        },
      }),
      []
    );

    /*
     * Create YouTube player.
     */
    useEffect(() => {
      let destroyed = false;

      const createPlayer = () => {
        if (
          destroyed ||
          !containerRef.current ||
          !window.YT
        ) {
          return;
        }

        /*
         * Avoid creating the player twice.
         */
        if (playerRef.current) {
          return;
        }

        console.log(
          "Creating YouTube player..."
        );

        playerRef.current =
          new window.YT.Player(
            containerRef.current,
            {
              videoId: videoIdRef.current,

              playerVars: {
                autoplay: 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
              },

              events: {
                onReady: () => {
                  if (destroyed) {
                    return;
                  }

                  console.log(
                    "YouTube player is ready"
                  );

                  playerReadyRef.current =
                    true;

                  const currentTime =
                    playerRef.current?.getCurrentTime() ??
                    0;

                  lastObservedTimeRef.current =
                    currentTime;

                  lastObservedAtRef.current =
                    Date.now();

                  /*
                   * Apply late-join synchronization.
                   */
                  const pendingSync =
                    pendingSyncRef.current;

                  if (pendingSync) {
                    console.log(
                      "Applying pending sync:",
                      pendingSync
                    );

                    applySyncStateRef.current(
                      pendingSync
                    );
                  }
                },

                onStateChange: (
                  event: YT.OnStateChangeEvent
                ) => {
                  playerStateRef.current =
                    event.data;

                  if (
                    event.data ===
                    window.YT?.PlayerState
                      .PLAYING
                  ) {
                    if (
                      remoteActionRef.current ===
                      "play"
                    ) {
                      remoteActionRef.current =
                        null;

                      return;
                    }

                    onPlayRef.current?.();
                  }

                  if (
                    event.data ===
                    window.YT?.PlayerState
                      .PAUSED
                  ) {
                    if (
                      remoteActionRef.current ===
                      "pause"
                    ) {
                      remoteActionRef.current =
                        null;

                      return;
                    }

                    onPauseRef.current?.();
                  }
                },
              },
            }
          );
      };

      /*
       * YouTube API already loaded.
       */
      if (window.YT) {
        createPlayer();
      } else {
        /*
         * Wait for YouTube API.
         */
        window.onYouTubeIframeAPIReady =
          createPlayer;

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

        playerReadyRef.current = false;

        pendingSyncRef.current = null;

        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore cleanup errors.
          }
        }

        playerRef.current = null;
      };
    }, []);

    /*
     * Detect local seeking.
     */
    useEffect(() => {
      const interval =
        window.setInterval(() => {
          const player =
            playerRef.current;

          if (
            !player ||
            !playerReadyRef.current
          ) {
            return;
          }

          const currentTime =
            player.getCurrentTime();

          const now = Date.now();

          const previousTime =
            lastObservedTimeRef.current;

          const previousAt =
            lastObservedAtRef.current;

          const elapsed =
            (now - previousAt) / 1000;

          const expectedTime =
            playerStateRef.current ===
            window.YT?.PlayerState.PLAYING
              ? previousTime + elapsed
              : previousTime;

          const difference =
            Math.abs(
              currentTime - expectedTime
            );

          const threshold =
            playerStateRef.current ===
            window.YT?.PlayerState.PLAYING
              ? 1.5
              : 0.75;

          if (
            difference > threshold &&
            !remoteSeekRef.current
          ) {
            console.log(
              "LOCAL SEEK DETECTED:",
              currentTime
            );

            onSeekRef.current?.(
              currentTime
            );
          }

          lastObservedTimeRef.current =
            currentTime;

          lastObservedAtRef.current =
            now;
        }, 500);

      return () => {
        window.clearInterval(interval);
      };
    }, []);

    /*
     * Change video when videoId changes.
     *
     * IMPORTANT:
     * We intentionally do NOT compare with videoIdRef here.
     * videoIdRef is updated in a separate effect and therefore
     * would already contain the new ID by the time this effect runs.
     */
    useEffect(() => {
      const player =
        playerRef.current;

      if (
        !player ||
        !playerReadyRef.current
      ) {
        return;
      }

      if (!videoId.trim()) {
        return;
      }

      console.log(
        "========== LOADING NEW VIDEO =========="
      );

      console.log(
        "New video ID:",
        videoId
      );

      player.loadVideoById(
        videoId.trim()
      );

      /*
       * New video always starts from the beginning.
       */
      lastObservedTimeRef.current =
        0;

      lastObservedAtRef.current =
        Date.now();

      /*
       * Clear any previous pending synchronization
       * because this is now a new video.
       */
      pendingSyncRef.current = null;
    }, [videoId]);

    return (
      <div className="w-full overflow-hidden rounded-2xl bg-black">
        <div
          ref={containerRef}
          className="aspect-video w-full"
        />
      </div>
    );
  }
);

YouTubePlayer.displayName =
  "YouTubePlayer";

export default YouTubePlayer;