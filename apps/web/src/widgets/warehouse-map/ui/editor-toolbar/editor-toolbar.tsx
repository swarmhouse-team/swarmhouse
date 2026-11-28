'use client';
import { Fragment, type FC, type SVGProps } from 'react';
import { useTranslations } from 'next-intl';
import SelectIcon from '@/shared/assets/icons/select.svg';
import ObstacleIcon from '@/shared/assets/icons/obstacle.svg';
import StationIcon from '@/shared/assets/icons/station.svg';
import RobotIcon from '@/shared/assets/icons/robot.svg';
import EraserIcon from '@/shared/assets/icons/eraser.svg';
import { EditorTool } from '../../model/types';

interface EditorToolbarProps {
  value: EditorTool;
  onChange: (tool: EditorTool) => void;
  className?: string;
}

type ToolKey = 'select' | 'obstacle' | 'station' | 'robot' | 'erase';

interface ToolItem {
  value: EditorTool;
  key: ToolKey;
  hotkey: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
}

const toolList: ToolItem[] = [
  { value: EditorTool.SELECT, key: 'select', hotkey: 'V', Icon: SelectIcon },
  { value: EditorTool.OBSTACLE, key: 'obstacle', hotkey: 'O', Icon: ObstacleIcon },
  { value: EditorTool.STATION, key: 'station', hotkey: 'S', Icon: StationIcon },
  { value: EditorTool.ROBOT, key: 'robot', hotkey: 'R', Icon: RobotIcon },
  { value: EditorTool.ERASE, key: 'erase', hotkey: 'E', Icon: EraserIcon },
];

const dividerAfter: EditorTool[] = [EditorTool.SELECT, EditorTool.ROBOT];

export const EditorToolbar = (props: EditorToolbarProps) => {
  const { value, onChange, className } = props;
  const t = useTranslations('mapEditor');

  return (
    <div
      role="toolbar"
      aria-label={t('tools.groupLabel')}
      className={`flex items-center gap-0.5 rounded-[10px] border border-[#E4E4E7] bg-white p-1 shadow-[0_2px_8px_rgba(9,9,11,0.08)]${className ? ` ${className}` : ''}`}
    >
      {toolList.map((tool) => {
        const active = tool.value === value;
        return (
          <Fragment key={tool.value}>
            <button
              type="button"
              aria-label={t(`tools.${tool.key}`)}
              aria-pressed={active}
              title={t('tools.titleWithHotkey', {
                label: t(`tools.${tool.key}`),
                hotkey: tool.hotkey,
              })}
              onClick={() => onChange(tool.value)}
              className={`flex size-9 cursor-pointer items-center justify-center rounded-[7px] transition-colors ${
                active ? 'bg-[#18181B] text-white' : 'text-[#09090B] hover:bg-[#F4F4F5]'
              }`}
            >
              <tool.Icon width={17} height={17} aria-hidden="true" />
            </button>
            {dividerAfter.includes(tool.value) && (
              <span aria-hidden="true" className="mx-[3px] my-1 w-px self-stretch bg-[#E4E4E7]" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};
