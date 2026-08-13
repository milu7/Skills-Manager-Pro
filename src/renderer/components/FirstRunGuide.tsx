import { FolderSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { Modal } from './common';
import { useTranslation } from 'react-i18next';

const SEEN_KEY = 'skill-workbench:onboarding:v1';

export function hasSeenFirstRunGuide(): boolean {
  return window.localStorage.getItem(SEEN_KEY) === 'seen';
}

export function FirstRunGuide({
  open,
  onOpenChange,
  onManageRoots
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onManageRoots(): void;
}) {
  const { t } = useTranslation();
  const close = () => {
    window.localStorage.setItem(SEEN_KEY, 'seen');
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t('workbench:guide.welcomeTitle')}
      description={t('workbench:guide.welcomeDetail')}
      size="large"
      footer={(
        <>
          <button type="button" className="button" onClick={close}>{t('workbench:guide.browse')}</button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              close();
              onManageRoots();
            }}
          >
            <FolderSearch size={15} />{t('workbench:guide.manage')}
          </button>
        </>
      )}
    >
      <div className="onboarding-grid">
        <article>
          <span><FolderSearch size={20} /></span>
          <b>{t('workbench:guide.scan')}</b>
          <p>{t('workbench:guide.scanDetail')}</p>
        </article>
        <article>
          <span><ShieldCheck size={20} /></span>
          <b>{t('workbench:guide.protect')}</b>
          <p>{t('workbench:guide.protectDetail')}</p>
        </article>
        <article>
          <span><Sparkles size={20} /></span>
          <b>{t('workbench:guide.ai')}</b>
          <p>{t('workbench:guide.aiDetail')}</p>
        </article>
      </div>
      <p className="onboarding-note">{t('workbench:guide.note')}</p>
    </Modal>
  );
}
