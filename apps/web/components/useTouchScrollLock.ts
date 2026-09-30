import { useEffect, useRef } from "react";

const CLASS = "touch-scroll-locked";

/**
 * Ref-counted lock that stops the page scrolling while a touch drag is in
 * progress. Returns a setter; each `true` must be paired with a `false`.
 * Clears the lock on unmount.
 */
export function useTouchScrollLock() {
  const countRef = useRef(0);

  useEffect(() => {
    return () => {
      countRef.current = 0;
      document.documentElement.classList.remove(CLASS);
      document.body.classList.remove(CLASS);
    };
  }, []);

  return (locked: boolean) => {
    const html = document.documentElement;
    const body = document.body;
    if (locked) {
      countRef.current += 1;
      if (countRef.current === 1) {
        html.classList.add(CLASS);
        body.classList.add(CLASS);
      }
      return;
    }
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      html.classList.remove(CLASS);
      body.classList.remove(CLASS);
    }
  };
}
