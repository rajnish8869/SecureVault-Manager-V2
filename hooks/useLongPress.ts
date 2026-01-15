import { useCallback, useRef, useState } from 'react';
export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { shouldPreventDefault = true, delay = 500 } = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<any>(undefined);
  const target = useRef<EventTarget | undefined>(undefined);
  const start = useCallback(
    (event: any) => {
      if (shouldPreventDefault && event.target) {
        target.current = event.target;
      }
      setLongPressTriggered(false);
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );
  const clear = useCallback(
    (event: any, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);
      if (shouldTriggerClick && !longPressTriggered) {
        onClick(event);
      }
      setLongPressTriggered(false);
      target.current = undefined;
    },
    [shouldPreventDefault, onClick, longPressTriggered]
  );
  return {
    onMouseDown: (e: any) => start(e),
    onTouchStart: (e: any) => start(e),
    onMouseUp: (e: any) => clear(e),
    onMouseLeave: (e: any) => clear(e, false),
    onTouchEnd: (e: any) => clear(e)
  };
};