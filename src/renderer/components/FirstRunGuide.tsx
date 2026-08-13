import { FolderSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { Modal } from './common';

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
      title="欢迎来到 Skill 管理工作台"
      description="先索引，再判断，最后由你确认每一次文件修改。"
      size="large"
      footer={(
        <>
          <button type="button" className="button" onClick={close}>开始浏览</button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              close();
              onManageRoots();
            }}
          >
            <FolderSearch size={15} />管理扫描目录
          </button>
        </>
      )}
    >
      <div className="onboarding-grid">
        <article>
          <span><FolderSearch size={20} /></span>
          <b>原地建立索引</b>
          <p>自动发现 Codex、Claude、WorkBuddy；项目目录可随时添加，不会迁移现有 Skill。</p>
        </article>
        <article>
          <span><ShieldCheck size={20} /></span>
          <b>先看安全边界</b>
          <p>插件、内置、市场和缓存默认只读；脚本永不执行，删除统一进入工作台回收站。</p>
        </article>
        <article>
          <span><Sparkles size={20} /></span>
          <b>AI 完全按需</b>
          <p>本地规则始终先运行。只有主动点击时才发送已预览的文本，AI 建议不会自动改写文件。</p>
        </article>
      </div>
      <p className="onboarding-note">首次完整扫描在后台进行，缓存列表会优先显示；顶部状态区可以查看进度。</p>
    </Modal>
  );
}
