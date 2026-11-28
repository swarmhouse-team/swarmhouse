import { HStack } from '@/shared/ui/Stack';
import { Button } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { memo } from 'react';

export const ModeBtns = memo(function ModeBtns() {
  const t = useTranslations('mapEditor.modes');

  return (
    <HStack role="group" aria-label={t('groupLabel')} className="ml-4 flex-1 ">
      <HStack className="self-center gap-0.5 rounded-[9px] bg-[#F4F4F5] p-[3px]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-current="page"
          className="h-[30px] cursor-pointer rounded-md bg-white px-3 text-[13px] font-medium text-[#09090B] shadow-[0_1px_2px_rgba(9,9,11,0.08)] hover:bg-white"
        >
          {t('editor')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-[30px] cursor-pointer rounded-md px-3 text-[13px] font-medium text-[#52525B]"
        >
          {t('dispatcher')}
        </Button>
      </HStack>
    </HStack>
  );
});
