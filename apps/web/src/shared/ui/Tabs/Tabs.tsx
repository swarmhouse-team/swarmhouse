import { HStack, VStack } from '@/shared/ui/Stack';
import { classNames } from '@/shared/lib/classNames/classNames';
import { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { EditorTabType, TabItem } from './model';

interface TabsProps {
  data: TabItem[];
  onTabClick: (item: TabItem) => void;
  value: EditorTabType;
}

export const Tabs = memo(function Tabs(props: TabsProps) {
  const { data, value, onTabClick } = props;
  const t = useTranslations('tabs');
  const clickHandle = useCallback(
    (item: TabItem) => () => {
      onTabClick(item);
    },
    [onTabClick],
  );
  return (
    <VStack>
      <HStack
        role="tablist"
        aria-label={t('label')}
        className="flex-none gap-0 border-b border-[#E4E4E7] px-3"
      >
        {data.map((item: TabItem) => (
          <button
            type="button"
            role="tab"
            key={item.value}
            aria-selected={item.value === value ? true : false}
            onClick={clickHandle(item)}
            className={classNames(
              'cursor-pointer h-11 flex-1 text-[13px] text-[#09090B]',
              {
                ['shadow-[inset_0_-2px_0_#18181B] font-medium ']:
                  item.value === value ? true : false,
              },
              [],
            )}
          >
            {item.content}
          </button>
        ))}
      </HStack>
      {value}
    </VStack>
  );
});
