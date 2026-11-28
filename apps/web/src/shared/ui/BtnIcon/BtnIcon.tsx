'use client';

import React, { ButtonHTMLAttributes, memo } from 'react';

const iconButtonClass =
  'flex size-9 cursor-pointer items-center justify-center rounded-lg text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-40';

interface BtnIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  Svg?: React.FC<React.SVGProps<SVGSVGElement>> | undefined;
}

export const BtnIcon = memo((props: BtnIconProps) => {
  const { Svg, ...otherProps } = props;

  return (
    <button type="button" className={iconButtonClass} {...otherProps}>
      {Svg && <Svg />}
    </button>
  );
});

BtnIcon.displayName = 'BtnIcon';
