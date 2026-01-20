import { useCallback, useRef } from 'react';

export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { delay = 500 } = {}
) => {
  const timeout = useRef<any>(null);
  const startCoord = useRef<{ x: number; y: number } | null>(null);
  const isScrolling = useRef(false);
  const isLongPress = useRef(false);

  const start = useCallback(
    (event: any) => {
      // Ignore right/middle clicks
      if (event.type === 'mousedown' && event.button !== 0) return;
      
      // Store coordinates
      if (event.touches) {
        startCoord.current = { 
            x: event.touches[0].clientX, 
            y: event.touches[0].clientY 
        };
      } else {
        startCoord.current = { x: event.clientX, y: event.clientY };
      }

      isScrolling.current = false;
      isLongPress.current = false;
      
      if (timeout.current) clearTimeout(timeout.current);
      
      timeout.current = setTimeout(() => {
        if (!isScrolling.current) {
            isLongPress.current = true;
            onLongPress(event);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const move = useCallback((event: any) => {
      if (isScrolling.current || !startCoord.current) return;

      const { clientX, clientY } = event.touches ? event.touches[0] : event;
      
      const deltaX = Math.abs(clientX - startCoord.current.x);
      const deltaY = Math.abs(clientY - startCoord.current.y);

      // Threshold for scrolling detection
      if (deltaX > 10 || deltaY > 10) {
          isScrolling.current = true;
          if (timeout.current) clearTimeout(timeout.current);
      }
  }, []);

  const end = useCallback(
    (event: any) => {
      if (timeout.current) clearTimeout(timeout.current);
      
      // If it wasn't a long press and we didn't scroll, treat as click
      if (!isLongPress.current && !isScrolling.current) {
        onClick(event);
        
        // Prevent ghost clicks on touch devices if handled here
        if (event.cancelable && event.type === 'touchend') {
            // Note: preventDefault might block some native behaviors, use with caution.
            // For list items, it usually prevents the delayed 'click' event.
            // We rely on this touch handler for the action.
        }
      }
      
      isScrolling.current = false;
      startCoord.current = null;
      isLongPress.current = false;
    },
    [onClick]
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onTouchMove: move,
    onMouseUp: end,
    onTouchEnd: end,
    onMouseLeave: end,
    onContextMenu: (e: any) => {
        // Prevent native context menu if we are handling long press
        // This is important for Android 'select text' or 'image options' context menus
        e.preventDefault();
    }
  };
};