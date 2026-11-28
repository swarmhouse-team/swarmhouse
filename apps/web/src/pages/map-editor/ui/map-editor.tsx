'use client';
import { Link } from '@/shared/i18n';
import { Button, Text } from '@robots/ui';
import { ArrIcon, RedoIcon, UndoIcon } from '@/shared/icons';
import { BtnIcon } from '@/shared/ui/BtnIcon';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EditorTabType, TabItem } from '@/shared/ui/Tabs';
import { Tabs } from '@/shared/ui/Tabs';
import { WarehouseMap } from '@/widgets/warehouse-map';
import { validWarehouseMap } from '@robots/shared';
import { ModeBtns } from './mode-btns';

type SaveState = 'saved' | 'unsaved';

const saveStateDot: Record<SaveState, string> = {
  saved: 'bg-[#52525B]',
  unsaved: 'bg-[#EA580C]',
};

const iconButtonClass =
  'flex size-9 cursor-pointer items-center justify-center rounded-lg text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-40';

export const MapEditor = () => {
  const t = useTranslations('mapEditor');
  const [activeTab, setActiveTab] = useState<EditorTabType>(EditorTabType.ADD);
  const [saveState] = useState<SaveState>('saved');

  const tabList: TabItem[] = [
    { value: EditorTabType.ADD, content: t('panel.tabs.add') },
    { value: EditorTabType.OBJECT, content: t('panel.tabs.object') },
    { value: EditorTabType.LIST, content: t('panel.tabs.list') },
    { value: EditorTabType.CHECK, content: t('panel.tabs.check') },
  ];

  const onTabClick = useCallback((tab: TabItem) => {
    setActiveTab(tab.value);
  }, []);

  return (
    <VStack className="app-editor h-screen min-h-[760px] bg-white font-sans text-[#09090B]">
      <HStack align="center" gap="4" className="h-14 border-b border-[#E4E4E7] px-4">
        <HStack gap="4" className="items-center ">
          <Link href="/" aria-label={t('backToWarehouses')} className={iconButtonClass}>
            <ArrIcon aria-hidden="true" width={18} height={18} />
          </Link>

          <VStack className="whitespace-nowrap">
            <Text size="sm" weight="semibold" className="whitespace-nowrap">
              {t('warehouseName')}
            </Text>
            <HStack className="items-center gap-1.5 whitespace-nowrap text-xs text-[#52525B]">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${saveStateDot[saveState]}`}
              />
              {t(`saveState.${saveState}`)}
            </HStack>
          </VStack>
        </HStack>
        <ModeBtns />
        <HStack max justify="end" className="items-center gap-2">
          <HStack className="items-center gap-1">
            <BtnIcon
              Svg={UndoIcon}
              type="button"
              aria-label={t('history.undo')}
              title={t('history.undoTitle')}
              disabled
            />
            <BtnIcon
              Svg={RedoIcon}
              type="button"
              aria-label={t('history.redo')}
              title={t('history.redoTitle')}
              disabled
            />
          </HStack>
          <Button variant="secondary" disabled>
            {t('save')}
          </Button>
        </HStack>
      </HStack>
      <HStack className="min-h-0 flex-1">
        <WarehouseMap map={validWarehouseMap} />
        <aside
          aria-label={t('panel.label')}
          className="flex min-h-[520px] w-[360px] flex-none flex-col border-l border-[#E4E4E7] bg-white"
        >
          <Tabs onTabClick={onTabClick} data={tabList} value={activeTab} />
        </aside>
      </HStack>
    </VStack>
  );
};
