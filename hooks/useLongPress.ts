import { useCallback, useRef, useState } from 'react';

export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { delay = 500 } = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<any>(undefined);
  const startCoord = useRef<{ x: number; y: number } | null>(null);
  const isScrolling = useRef(false);

  const start = useCallback(
    (event: any) => {
      // Ignore non-primary mouse buttons
      if (event.type === 'mousedown' && event.button !== 0) return;
      
      // Track start position
      if (event.touches && event.touches.length > 0) {
        startCoord.current = { 
            x: event.touches[0].clientX, 
            y: event.touches[0].clientY 
        };
      } else {
        startCoord.current = { x: event.clientX, y: event.clientY };
      }

      isScrolling.current = false;
      setLongPressTriggered(false);
      
      timeout.current = setTimeout(() => {
        // Only trigger if we haven't started scrolling
        if (!isScrolling.current) {
            onLongPress(event);
            setLongPressTriggered(true);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const move = useCallback((event: any) => {
      // If already scrolling or no start coord, ignore
      if (isScrolling.current || !startCoord.current) return;

      const { clientX, clientY } = event.touches ? event.touches[0] : event;
      
      const deltaX = Math.abs(clientX - startCoord.current.x);
      const deltaY = Math.abs(clientY - startCoord.current.y);

      // If moved more than 10px, treat as scroll/drag
      if (deltaX > 10 || deltaY > 10) {
          isScrolling.current = true;
          if (timeout.current) clearTimeout(timeout.current);
      }
  }, []);

  const clear = useCallback(
    (event: any) => {
      timeout.current && clearTimeout(timeout.current);
      
      // Trigger click ONLY if:
      // 1. Long press didn't trigger
      // 2. We didn't scroll/drag
      if (!longPressTriggered && !isScrolling.current) {
        // Prevent ghost clicks if needed, but usually not required here if we handle logic manually
        onClick(event);
      }
      
      setLongPressTriggered(false);
      isScrolling.current = false;
      startCoord.current = null;
    },
    [onClick, longPressTriggered]
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onTouchMove: move,
    onMouseUp: clear,
    onMouseLeave: (e: any) => {
        if (timeout.current) clearTimeout(timeout.current);
        isScrolling.current = false;
        startCoord.current = null;
    },
    onTouchEnd: clear
  };
};