import {
  Profiler,
  useEffect,
  useRef,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from "react";

const PROFILE_DM_KEY = "nostrill:profile-dm";

function profilingEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.localStorage.getItem(PROFILE_DM_KEY) === "1";
}

const onProfilerRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!profilingEnabled()) return;
  console.log(
    `[render:${id}] ${phase}`,
    {
      actualMs: Number(actualDuration.toFixed(2)),
      baseMs: Number(baseDuration.toFixed(2)),
      startMs: Number(startTime.toFixed(2)),
      commitMs: Number(commitTime.toFixed(2)),
    },
  );
};

export function ProfiledRender({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  if (!profilingEnabled()) return <>{children}</>;
  return (
    <Profiler id={id} onRender={onProfilerRender}>
      {children}
    </Profiler>
  );
}

export function useRenderCount(label: string, details?: () => Record<string, unknown>) {
  const count = useRef(0);
  count.current += 1;

  useEffect(() => {
    if (!profilingEnabled()) return;
    console.log(`[render-count:${label}]`, {
      count: count.current,
      ...(details ? details() : {}),
    });
  });
}

export function useDmProfileToggle() {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const helper = {
      enable() {
        window.localStorage.setItem(PROFILE_DM_KEY, "1");
        console.info("DM render profiling enabled. Reloading...");
        window.location.reload();
      },
      disable() {
        window.localStorage.removeItem(PROFILE_DM_KEY);
        console.info("DM render profiling disabled. Reloading...");
        window.location.reload();
      },
      status() {
        const enabled = profilingEnabled();
        console.info(`DM render profiling is ${enabled ? "enabled" : "disabled"}.`);
        return enabled;
      },
    };
    (window as typeof window & { nostrillProfileDM?: typeof helper }).nostrillProfileDM = helper;
    if (profilingEnabled()) {
      console.info("DM render profiling enabled. Type in the chat composer to record renders.");
    } else {
      console.info("DM render profiling available: run nostrillProfileDM.enable()");
    }
  }, []);
}
