import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const COMPACT_LAYOUT_BREAKPOINT = 1024;

function useViewportMatch(maxWidth: number) {
  const [isMatch, setIsMatch] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const onChange = () => {
      setIsMatch(window.innerWidth < maxWidth);
    };

    mql.addEventListener("change", onChange);
    onChange();

    return () => mql.removeEventListener("change", onChange);
  }, [maxWidth]);

  return !!isMatch;
}

export function useIsMobile() {
  return useViewportMatch(MOBILE_BREAKPOINT);
}

export function useIsCompactLayout() {
  return useViewportMatch(COMPACT_LAYOUT_BREAKPOINT);
}
