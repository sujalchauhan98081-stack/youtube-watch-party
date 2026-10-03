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

  canControl?: boolean;
}

declare global {
  interface Window {
    YT: any;
  }
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
      canControl = true,
    },
    ref
  ) => {
    const playerRef = useRef<any>(null);

    const containerRef =
      useRef<HTMLDivElement | null>(null);

    const onPlayRef =
      useRef(onPlay);

    const onPauseRef =
      useRef(onPause);

    const onSeekRef =
      useRef(onSeek);

    const remoteActionRef =
      useRef(false);

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

    const pendingSyncRef =
      useRef<{
        currentTime: number;
        isPlaying: boolean;
      } | null>(null);

    const videoIdRef =
      useRef(videoId);

    /* -------------------------------------------------------------------- */
    /*                              CALLBACKS                               */
    /* -------------------------------------------------------------------- */

    useEffect(() => {
      onPlayRef.current = onPlay;
    }, [onPlay]);

    useEffect(() => {
      onPauseRef.current = onPause;
    }, [onPause]);

    useEffect(() => {
      onSeekRef.current = onSeek;
    }, [onSeek]);

    useEffect(() => {
      videoIdRef.current = videoId;
    }, [videoId]);

    /* -------------------------------------------------------------------- */
    /*                           REMOTE SYNC                                */
    /* -------------------------------------------------------------------- */

    const applySyncState = (
      time: number,
      isPlaying: boolean
    ) => {
      const player =
        playerRef.current;

      if (
        !player ||
        !playerReadyRef.current
      ) {
        return;
      }

      remoteSeekRef.current = true;

      player.seekTo(
        Math.max(0, time),
        true
      );

      setTimeout(() => {
        remoteSeekRef.current = false;
      }, 100);

      if (isPlaying) {
        remoteActionRef.current = true;

        player.playVideo();

        setTimeout(() => {
          remoteActionRef.current = false;
        }, 100);
      } else {
        remoteActionRef.current = true;

        player.pauseVideo();

        setTimeout(() => {
          remoteActionRef.current = false;
        }, 100);
      }

      lastObservedTimeRef.current =
        Math.max(0, time);

      lastObservedAtRef.current =
        Date.now();
    };

    /* -------------------------------------------------------------------- */
    /*                         SYNC STATE PROP                              */
    /* -------------------------------------------------------------------- */

    useEffect(() => {
      if (!syncState) {
        return;
      }

      pendingSyncRef.current =
        syncState;

      if (playerReadyRef.current) {
        applySyncState(
          syncState.currentTime,
          syncState.isPlaying
        );

        pendingSyncRef.current =
          null;
      }
    }, [syncState]);

    /* -------------------------------------------------------------------- */
    /*                         IMPERATIVE API                               */
    /* -------------------------------------------------------------------- */

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
            playerRef.current?.getCurrentTime?.() ??
            0
          );
        },

        playFromRemote: () => {
          remoteActionRef.current = true;

          playerRef.current?.playVideo();

          setTimeout(() => {
            remoteActionRef.current = false;
          }, 100);
        },

        pauseFromRemote: () => {
          remoteActionRef.current = true;

          playerRef.current?.pauseVideo();

          setTimeout(() => {
            remoteActionRef.current = false;
          }, 100);
        },

        seekFromRemote: (
          time: number
        ) => {
          remoteSeekRef.current = true;

          playerRef.current?.seekTo(
            time,
            true
          );

          setTimeout(() => {
            remoteSeekRef.current = false;
          }, 100);
        },

        syncFromRemote: (
          time: number,
          isPlaying: boolean
        ) => {
          applySyncState(
            time,
            isPlaying
          );
        },
      }),
      []
    );

    /* -------------------------------------------------------------------- */
    /*                         CREATE PLAYER                                */
    /* -------------------------------------------------------------------- */

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const createPlayer = () => {
        if (
          !containerRef.current ||
          !window.YT
        ) {
          return;
        }

        playerRef.current =
          new window.YT.Player(
            containerRef.current,
            {
              videoId:
                videoIdRef.current,

              playerVars: {
                autoplay: 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
              },

              events: {
                onReady: () => {
                  console.log(
                    "YouTube player is ready"
                  );

                  playerReadyRef.current =
                    true;

                  if (
                    pendingSyncRef.current
                  ) {
                    const pending =
                      pendingSyncRef.current;

                    applySyncState(
                      pending.currentTime,
                      pending.isPlaying
                    );

                    pendingSyncRef.current =
                      null;
                  }
                },

                onStateChange: (
                  event: any
                ) => {
                  playerStateRef.current =
                    event.data;

                  if (
                    remoteActionRef.current
                  ) {
                    return;
                  }

                  if (
                    event.data ===
                    window.YT.PlayerState
                      .PLAYING
                  ) {
                    onPlayRef.current?.();
                  }

                  if (
                    event.data ===
                    window.YT.PlayerState
                      .PAUSED
                  ) {
                    onPauseRef.current?.();
                  }
                },
              },
            }
          );
      };

      if (window.YT) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady =
          createPlayer;

        const existingScript =
          document.querySelector(
            'script[src="https://www.youtube.com/iframe_api"]'
          );

        if (!existingScript) {
          const script =
            document.createElement(
              "script"
            );

          script.src =
            "https://www.youtube.com/iframe_api";

          script.async = true;

          document.body.appendChild(
            script
          );
        }
      }

      return () => {
        playerReadyRef.current =
          false;

        if (
          playerRef.current
        ) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore YouTube cleanup errors.
          }
        }

        playerRef.current = null;
      };
    }, []);

    /* -------------------------------------------------------------------- */
    /*                           SEEK DETECTION                             */
    /* -------------------------------------------------------------------- */

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

          if (
            remoteSeekRef.current
          ) {
            return;
          }

          const currentTime =
            player.getCurrentTime?.();

          if (
            typeof currentTime !==
            "number"
          ) {
            return;
          }

          const previousTime =
            lastObservedTimeRef.current;

          const previousObservedAt =
            lastObservedAtRef.current;

          const timeDifference =
            Math.abs(
              currentTime -
                previousTime
            );

          const elapsed =
            Date.now() -
            previousObservedAt;

          const playerState =
            player.getPlayerState?.();

          const isPlaying =
            playerState ===
            window.YT?.PlayerState
              ?.PLAYING;

          if (
            isPlaying &&
            timeDifference > 2 &&
            elapsed < 1500
          ) {
            onSeekRef.current?.(
              currentTime
            );
          }

          lastObservedTimeRef.current =
            currentTime;

          lastObservedAtRef.current =
            Date.now();
        }, 500);

      return () => {
        window.clearInterval(
          interval
        );
      };
    }, []);

    /* -------------------------------------------------------------------- */
    /*                           VIDEO CHANGE                               */
    /* -------------------------------------------------------------------- */

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

      lastObservedTimeRef.current =
        0;

      lastObservedAtRef.current =
        Date.now();

      pendingSyncRef.current =
        null;
    }, [videoId]);

    /* -------------------------------------------------------------------- */
    /*                                UI                                    */
    /* -------------------------------------------------------------------- */

    return (
      <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-black">
        <div
          ref={containerRef}
          className="absolute inset-0 h-full w-full"
        />

        {!canControl && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/20 cursor-default"
            aria-label="Watch only"
          >
            <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur">
              Watch only
            </span>
          </div>
        )}
      </div>
    );
  }
);

YouTubePlayer.displayName =
  "YouTubePlayer";

export default YouTubePlayer;