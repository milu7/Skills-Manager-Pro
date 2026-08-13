import { HeartHandshake } from 'lucide-react';
import authorAvatar from '../assets/author-avatar.png';
import wechatContact from '../assets/wechat-contact.png';
import wechatOfficialAccount from '../assets/wechat-official-account.png';
import wechatRewardCode from '../assets/wechat-reward-code.jpg';
import { Modal } from './common';
import { useTranslation } from 'react-i18next';

export function AuthorModal({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('app.authorName')}
      description={t('workbench:author.description')}
      size="large"
      footer={(
        <>
          <span className="footer-note">{t('workbench:author.footer')}</span>
          <button className="button primary" type="button" onClick={() => onOpenChange(false)}>{t('workbench:author.done')}</button>
        </>
      )}
    >
      <div className="author-modal">
        <section className="author-intro">
          <div className="author-avatar">
            <img src={authorAvatar} alt={t('workbench:author.avatarAlt')} />
          </div>
          <div>
            <span>{t('workbench:author.label')}</span>
            <h3>{t('app.authorName')}</h3>
            <p>{t('workbench:author.intro')}</p>
          </div>
        </section>

        <section className="author-section">
          <header><h4>{t('workbench:author.contact')}</h4><p>{t('workbench:author.scanWechat')}</p></header>
          <div className="author-contact-grid">
            <CodeCard
              image={wechatContact}
              imageAlt={t('workbench:author.wechatAlt')}
              title={t('workbench:author.addWechat')}
              detail={t('workbench:author.addWechatDetail')}
              mediaClassName="is-square"
            />
            <CodeCard
              image={wechatOfficialAccount}
              imageAlt={t('workbench:author.accountAlt')}
              title={t('workbench:author.follow')}
              detail={t('workbench:author.followDetail')}
              mediaClassName="is-wide"
            />
          </div>
        </section>

        <section className="author-section author-support">
          <header><h4><HeartHandshake size={17} />{t('workbench:author.support')}</h4><p>{t('workbench:author.supportDetail')}</p></header>
          <article className="author-reward-card">
            <div className="author-reward-copy">
              <span>{t('workbench:author.reward')}</span>
              <strong>{t('workbench:author.coffee')}</strong>
              <p>{t('workbench:author.rewardDetail')}</p>
            </div>
            <div className="author-code-media is-reward">
              <img src={wechatRewardCode} alt={t('workbench:author.rewardAlt')} />
            </div>
          </article>
        </section>
      </div>
    </Modal>
  );
}

function CodeCard({
  image,
  imageAlt,
  title,
  detail,
  mediaClassName
}: {
  image: string;
  imageAlt: string;
  title: string;
  detail: string;
  mediaClassName: 'is-square' | 'is-wide';
}) {
  return (
    <article className={`author-code-card ${mediaClassName === 'is-square' ? 'is-contact-card' : 'is-account-card'}`}>
      <div className={`author-code-media ${mediaClassName}`}>
        <img src={image} alt={imageAlt} />
      </div>
      <div className="author-code-copy"><strong>{title}</strong><span>{detail}</span></div>
    </article>
  );
}
