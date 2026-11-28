import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Следит за шириной элемента через ResizeObserver.
 * Возвращает ref для элемента и его текущую ширину в пикселях (0, пока элемент не смонтирован).
 */
export const useElementWidth = <T extends HTMLElement>(): [RefObject<T | null>, number] => {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
};
