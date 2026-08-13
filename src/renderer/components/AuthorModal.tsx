import { HeartHandshake, MessageCircle, QrCode, Radio } from 'lucide-react';
import { Modal } from './common';

export function AuthorModal({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="戳戳作者👽"
      description="认识作者、找到同名公众号，二维码素材准备好后会补充到这里。"
      size="large"
      footer={(
        <>
          <span className="footer-note">当前所有二维码区域均为设计占位，不包含可扫描内容。</span>
          <button className="button primary" type="button" onClick={() => onOpenChange(false)}>知道了</button>
        </>
      )}
    >
      <div className="author-modal">
        <section className="author-intro">
          <div className="author-avatar" aria-hidden="true">暴</div>
          <div>
            <span>作者</span>
            <h3>暴论哥3.0</h3>
            <p>你好，我是暴论哥3.0。这是我为本地 Skill 整理、检索和安全管理制作的工作台。更多更新与使用分享，可关注同名公众号。</p>
          </div>
        </section>

        <section className="author-section">
          <header><h4>联系与关注</h4><p>二维码图片待补充，名称和位置已经预留。</p></header>
          <div className="author-contact-grid">
            <QrPlaceholder icon={<MessageCircle size={22} />} title="作者微信" detail="微信号与二维码待补充" />
            <QrPlaceholder icon={<Radio size={22} />} title="公众号" detail="暴论哥3.0（公众号同名）" />
          </div>
        </section>

        <section className="author-section author-support">
          <header><h4><HeartHandshake size={17} />支持创作</h4><p>三个打赏档位先保留版位，金额与二维码以后补充。</p></header>
          <div className="author-reward-grid">
            <QrPlaceholder compact icon={<QrCode size={20} />} title="打赏档位 1" detail="金额待设置" />
            <QrPlaceholder compact icon={<QrCode size={20} />} title="打赏档位 2" detail="金额待设置" />
            <QrPlaceholder compact icon={<QrCode size={20} />} title="打赏档位 3" detail="金额待设置" />
          </div>
        </section>
      </div>
    </Modal>
  );
}

function QrPlaceholder({ icon, title, detail, compact = false }: { icon: React.ReactNode; title: string; detail: string; compact?: boolean }) {
  return (
    <article className={compact ? 'qr-placeholder-card is-compact' : 'qr-placeholder-card'}>
      <div className="qr-placeholder" role="img" aria-label={`${title}二维码待补充`}>
        {icon}<span>二维码待补充</span>
      </div>
      <div className="qr-placeholder-copy"><strong>{title}</strong><span>{detail}</span></div>
    </article>
  );
}
