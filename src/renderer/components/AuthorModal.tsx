import { HeartHandshake } from 'lucide-react';
import authorAvatar from '../assets/author-avatar.png';
import wechatContact from '../assets/wechat-contact.png';
import wechatOfficialAccount from '../assets/wechat-official-account.png';
import wechatRewardCode from '../assets/wechat-reward-code.jpg';
import { Modal } from './common';

export function AuthorModal({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="暴论哥3.0"
      description="认识作者，也可以扫码添加微信、关注公众号或赞赏支持。"
      size="large"
      footer={(
        <>
          <span className="footer-note">联系与赞赏图片均由作者提供，请使用微信扫码。</span>
          <button className="button primary" type="button" onClick={() => onOpenChange(false)}>知道了</button>
        </>
      )}
    >
      <div className="author-modal">
        <section className="author-intro">
          <div className="author-avatar">
            <img src={authorAvatar} alt="暴论哥3.0头像" />
          </div>
          <div>
            <span>作者</span>
            <h3>暴论哥3.0</h3>
            <p>你好，我是暴论哥3.0。这是我为本地 Skill 整理、检索和安全管理制作的工作台。更多更新与使用分享，可关注同名公众号。</p>
          </div>
        </section>

        <section className="author-section">
          <header><h4>联系与关注</h4><p>使用微信扫码</p></header>
          <div className="author-contact-grid">
            <CodeCard
              image={wechatContact}
              imageAlt="添加作者微信二维码"
              title="添加作者微信"
              detail="扫码添加好友，交流使用问题与建议。"
              mediaClassName="is-square"
            />
            <CodeCard
              image={wechatOfficialAccount}
              imageAlt="暴论哥3.0公众号二维码"
              title="关注公众号"
              detail="微信扫码，或搜索“暴论哥3.0”。"
              mediaClassName="is-wide"
            />
          </div>
        </section>

        <section className="author-section author-support">
          <header><h4><HeartHandshake size={17} />支持创作</h4><p>一份心意，就是继续更新的动力</p></header>
          <article className="author-reward-card">
            <div className="author-reward-copy">
              <span>微信赞赏</span>
              <strong>觉得好用，可以请作者喝杯咖啡</strong>
              <p>扫码后可自行填写赞赏金额。感谢你支持这款本地 Skill 管理工具继续完善。</p>
            </div>
            <div className="author-code-media is-reward">
              <img src={wechatRewardCode} alt="Harry的微信赞赏码" />
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
