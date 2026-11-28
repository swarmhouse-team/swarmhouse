import { DetailedHTMLProps, HTMLAttributes, ReactNode } from 'react';
import { classNames, Mods } from '@/shared/lib/classNames/classNames';
import cls from './Flex.module.scss';
export type FlexJustify = 'start' | 'center' | 'end' | 'between';
export type FlexAlign = 'start' | 'center' | 'end';
export type FlexDirection = 'row' | 'column';
export type FlexGap = '4' | '8';
export type FlexWrap = 'nowrap' | 'wrap';

const justifyClasses: Record<FlexJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

const alignClasses: Record<FlexAlign, string> = {
  start: 'content-start',
  center: 'content-center',
  end: 'content-end',
};

const directionClasses: Record<FlexDirection, string> = {
  row: 'flex-row',
  column: 'flex-col',
};
const gapClasses: Record<FlexGap, string> = {
  4: 'gap-4',
  8: 'gap-8',
};

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export interface FlexProps extends DivProps {
  className?: string;
  children: ReactNode;
  justify?: FlexJustify;
  align?: FlexAlign;
  direction: FlexDirection;
  wrap?: FlexWrap;
  max?: boolean;
  gap?: FlexGap;
}

export const Flex = (props: FlexProps) => {
  const {
    className,
    children,
    justify = 'start',
    align = 'center',
    direction = 'row',
    wrap = 'nowrap',
    max,
    gap,
    ...otherProps
  } = props;

  const classes = [
    className,
    justifyClasses[justify],
    alignClasses[align],
    directionClasses[direction],
    cls[wrap],
    gap && gapClasses[gap],
  ];

  const mods: Mods = {
    ['w-100']: max,
  };

  return (
    <div className={classNames('flex', mods, classes)} {...otherProps}>
      {children}
    </div>
  );
};
