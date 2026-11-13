import { useCallback, useEffect, useRef } from "react";

/** 長押しと判定するまでの時間（manifests/nodes.md ジェスチャー表「about 300 ms」） */
export const LONG_PRESS_MS = 300;

/** 長押しのタイマー。start で開始し、時間内に cancel されなければ onFire を呼ぶ */
export function useLongPress() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (onFire: () => void) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        // 持ち上がったことを指に伝える（対応端末のみ）
        if ("vibrate" in navigator) navigator.vibrate(15);
        onFire();
      }, LONG_PRESS_MS);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);
  return { start, cancel, isPending: () => timer.current !== null };
}
