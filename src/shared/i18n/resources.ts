import type { HostPlatform, SkillScope, SkillSourceType } from '../types';

export const namespaces = ['common', 'workbench', 'settings', 'messages'] as const;
export const defaultNS = 'common' as const;

const zhCN = {
  common: {
    app: { title: 'Skills Manager Pro', home: 'Skills Manager Pro 首页', github: 'GitHub' },
    action: {
      close: '关闭', closeNotification: '关闭通知', cancel: '取消', confirm: '确认', back: '返回', save: '保存',
      remove: '移除', restore: '恢复', refresh: '刷新', open: '打开', edit: '编辑', add: '添加', test: '测试连接',
      create: '新建', clear: '清除', rescan: '重新扫描', continue: '继续确认', configure: '配置'
    },
    status: {
      never: '从未', enabled: '已启用', disabled: '已停用', editable: '可编辑', readOnly: '只读',
      healthy: '结构健康', current: '当前版本', stale: '内容已变化', loading: '正在加载…', none: '无'
    },
    locale: { system: '跟随系统', zhCN: '简体中文', enUS: 'English', current: '当前显示语言：{{locale}}' },
    host: { codex: 'Codex', claude: 'Claude', workbuddy: 'WorkBuddy', custom: '通用 / 自定义' },
    source: { user: '用户', project: '项目', plugin: '插件', builtin: '内置', marketplace: '市场', cache: '缓存', trash: '回收站', backup: '备份' },
    scope: { user: '用户级', project: '项目级', plugin: '插件级', system: '系统级' },
    category: {
      writing: '写作内容', visual: '视觉设计', development: '开发工程', automation: '自动化', data: '数据办公',
      research: '研究分析', publishing: '发布运营', compliance: '安全合规', finance: '商业金融', management: '平台管理', uncategorized: '未分类'
    },
    fileKind: { main: '主文件', metadata: '元数据', reference: '参考资料', asset: '素材', script: '脚本', other: '其他' }
  },
  workbench: {
    splash: '正在打开 Skill 索引…',
    topbar: {
      searchPlaceholder: '搜索名称、说明、正文或路径…', searchAria: '搜索 Skills', indexReady: '索引已就绪',
      scanRunning: '{{phase}} · {{count}}', manageRoots: '管理扫描根目录', rescanStarted: '后台扫描已开始', settings: '软件设置'
    },
    sidebar: {
      library: '资料库', all: '全部 Skills', editable: '可编辑', duplicates: '重复项', errors: '错误', review: '需检查', disabled: '已停用', trash: '回收站',
      disabledHelp: 'Claude / WorkBuddy 插件配置中 enabledPlugins 明确设为 false 的插件内 Skill',
      platforms: '平台', platformsHelp: '来源宿主，不是内容分类', customHelp: '用户添加且无法识别为 Codex、Claude 或 WorkBuddy 的扫描目录；无需导入 Skill', hostHelp: '{{host}} 宿主中发现的 Skill',
      categories: '分类', categoriesHelp: '仅用于工作台筛选', more: '下方还有内容', moreAria: '下方还有内容，继续查看',
      history: '操作历史', settings: '软件设置', roots: '扫描目录', privacy: '本地索引 · 密钥由系统保护'
    },
    list: {
      eyebrow: '技能目录', batchAi: '批量 AI', source: '来源', sourceType: '来源类型', clearSource: '清除来源筛选',
      editableCount: '可编辑 {{count}}', issueCount: '问题 {{count}}', duplicateCount: '重复 {{count}}', aria: 'Skill 列表',
      emptyTitle: '没有符合条件的 Skill', emptyDetail: '试试清除平台、状态或来源筛选。', noDescription: '暂无说明', disabled: '停用', error: '错误', review: '检查',
      titleTrash: '回收站', titleDisabled: '已停用 Skills', titleDuplicates: '重复项', titleErrors: '存在错误', titleReview: '需要检查', titleEditable: '可编辑 Skills', titleAll: '全部 Skills',
      configureAi: '请先配置并启用一个 AI 服务', narrowBatch: '当前结果有 {{count}} 个；请先用平台、来源或分类缩小到 20 个以内'
    },
    detail: {
      emptyTitle: '选择一个 Skill', emptyDetail: '右侧会显示说明、诊断、文件与修改历史。', openExplorer: '在资源管理器中打开', rescan: '重新检查', localUpdated: '本地检查已更新', more: '更多操作',
      renameDisplay: '修改显示名', renameInternal: '修改内部名称', moveTrash: '移入回收站', tabsAria: 'Skill 详情', overview: '概览', editor: '编辑', files: '文件', notes: '备注', ai: 'AI 分析',
      trashTitle: '移入工作台回收站', trashDescription: '不会永久删除，原路径和哈希会被记录，回收站也不会自动清空。', trashConfirm: '确认移入'
    },
    overview: {
      files: '文件', size: '体积', body: '正文', lines: '{{count}} 行', updated: '更新', identityEyebrow: '身份信息', identity: '身份与来源', displayName: '显示名', internalName: '内部名称', host: '宿主', source: '来源', hash: '主内容哈希', permission: '权限', writable: '原地可写', protected: '受保护只读', parentPlugin: '父插件',
      family: 'Skill 家族 {{count}} 个安装 · {{hosts}}', sameContent: '内容相同', manualReview: '需人工判断', organizeEyebrow: '分类管理', organize: '分类与标签', localSuggestion: '本地建议：{{category}}', organizeHelp: '仅用于工作台内筛选和整理；保存后不会移动 Skill、修改目录或影响宿主调用。', primaryCategory: '主分类', customTags: '自定义标签', tagsPlaceholder: '逗号分隔',
      auditEyebrow: '安全检查', audit: '本地检查', noIssues: '未发现结构问题', noIssuesHelp: '仍建议在真实宿主中验证触发与资源引用。', errors: '{{count}} 个错误', reviews: '{{count}} 项需检查', exactDuplicate: '发现精确重复', nearDuplicate: '发现近似重复', nameDuplicate: '发现同名副本', duplicateGroup: '组 {{group}} · 查看全部重复项',
      previewEyebrow: '内容预览', preview: '说明预览', emptyBody: '*暂无正文*'
    },
    editor: {
      protectedTitle: '此来源受保护', protectedDetail: '插件、内置、市场、缓存和备份仅供盘点。你仍可查看所有文本资源与本地诊断。', metadata: '结构化元数据', markdown: 'Markdown 正文', resources: '高级资源', safety: '安全编辑', metadataHelp: '未知 YAML 字段与注释会保留。显示名和内部名称通过独立的预检操作修改。', displayName: '显示名', internalName: '内部名称', change: '修改', previewRename: '预检改名', description: '说明 / description', descriptionPlaceholder: '说明这个 Skill 做什么，以及何时应该触发。', hashHelp: '保存前会展示差异，并校验磁盘版本。', previewSave: '预览并保存', bodyArea: '正文区域 · YAML 保持原样', readOnlyRibbon: '脚本和受保护资源保持只读', selectResource: '选择文本资源', selectResourceHelp: '可以查看 references、agents 元数据和其他文本；脚本始终只读。', textResources: '文本资源', viewableResources: '可查看的文本资源', confirmDescription: '确认修改说明', confirmBody: '确认修改 Markdown 正文', confirmFile: '确认修改 {{file}}', validateHash: '{{file}} · 写入前将再次校验哈希', backEdit: '返回编辑', confirmSave: '确认保存', saved: '修改已保存，并创建了可恢复快照'
    },
    files: { title: '文件清单', subtitle: '物理目录中的资源', count: '{{count}} 个文件 · {{size}}', openFolder: '打开目录', file: '文件', type: '类型', size: '大小', updated: '更新时间', editInEditor: '可在编辑页修改', emptyTitle: '没有已索引文件', emptyDetail: '重新扫描后再试。', text: '文本', readOnly: '只读', empty: '没有找到文件' },
    notes: {
      eyebrow: '个人补充', title: 'Skill 使用备注', help: '仅保存在工作台数据库中，不会改写、移动或影响原 Skill。', placeholder: '记录触发方式、使用技巧、注意事项或示例……', addImage: '插入图片', save: '保存备注', saved: '备注已保存到工作台', imageInserted: '图片已插入备注并保存', imageRemoved: '已移除图片：{{name}}', content: '备注内容', markdown: '支持 Markdown', preview: '实时预览', characters: '{{count}} 字符', previewEmpty: '这里会显示备注预览。插入的图片由工作台本地保存。', images: '备注图片', imageCount: '{{count}} 张 · 单张上限 8 MB', removeImage: '移除图片 {{name}}', removeConfirm: '移除备注图片“{{name}}”？此操作只删除数据库副本。', imageUnavailable: '图片不可用：{{name}}', unnamedImage: '未命名图片', defaultImageAlt: '备注图片', empty: '还没有备注'
    },
    ai: {
      privacyTitle: '由你决定何时、向哪里发送', privacyDetail: '本地规则始终先运行。AI 不会自动调用，也不会执行或改写 Skill；脚本和二进制永不发送。', onDemand: '按需分析', structured: '发起结构化分析', manual: '手动触发', configureTitle: '先配置一个 AI 服务', configureDetail: '支持 Chat Completions 与 Responses 兼容接口', providerModel: '服务与模型', preview: '预览待发送内容', refreshPreview: '刷新预览', required: '必须发送', optionalAttachments: '可选文本附件', excluded: '{{count}} 个文件不会发送', estimated: '预计字符 {{count}} + 附件', confirmTitle: '确认发送分析内容', confirmDetail: '这是一次外部网络请求。只会发送下列已确认文本，结果不会自动应用。', cancelRequest: '取消请求', backCheck: '返回检查', confirmSend: '确认发送', completed: 'AI 分析完成；结果只作为建议保存', resultEyebrow: 'AI 分析结果', latest: '最近分析', capabilities: '能力', improvements: '改进建议', compatibility: '兼容性', risks: '风险', recommendedCategory: '推荐分类', tags: '标签', confidence: '置信度', resultLanguage: '结果语言：{{locale}}', oldLanguage: '这份历史结果为 {{locale}}，可重新分析以生成当前语言版本。'
    },
    batch: {
      title: '批量 AI 分析确认', detail: '批量模式只发送下列 Skill 的 SKILL.md，不发送附件；每个结果都独立缓存，且不会自动应用。', progress: '进度 {{done}} / {{total}}', confirmFiles: '确认 {{count}} 个文件 · {{size}}', stop: '停止后续请求', confirm: '确认分析 {{count}} 个', privacy: '脚本、二进制和 references 附件不会进入本次批量请求。', provider: '服务', loading: '正在生成每个 Skill 的发送清单…', stopped: '批量分析已停止 · 完成 {{completed}}，失败 {{failed}}', finished: '批量分析结束 · 完成 {{completed}}，失败 {{failed}}'
    },
    history: {
      eyebrow: '操作审计', title: '操作历史', subtitle: '文本编辑前会保存快照；改名、回收和 AI 分析保留独立记录。', count: '{{count}} 条记录', emptyTitle: '还没有操作记录', emptyDetail: '首次编辑、改名或分析后会出现在这里。', change: '修改内容', restore: '恢复此前快照', fileOperation: '文件操作', noDiffTitle: '此操作没有文本差异', noDiffDetail: '目录移动、分类、回收或 AI 分析以操作元数据记录。', diff: '查看差异', restoreConfirm: '确认从快照恢复？当前内容会先保存为新快照。', irreversible: '不可直接恢复', path: '路径', time: '时间'
    },
    roots: {
      title: '扫描目录', detail: '原地索引这些目录；添加项目根不会迁移或修改其中的 Skill。', footer: '项目扫描会排除 node_modules、.git、会话缓存和备份。', add: '添加项目根目录', added: '项目根目录已添加，后台扫描已开始', removed: '已移除扫描配置：{{label}}', discovered: '自动发现', lastScan: '{{host}} · {{source}} · 上次扫描 {{date}}', open: '在资源管理器中打开', remove: '移除扫描配置', iconAutoMatched: '自动匹配的工具图标', skillCountUnit: '个 Skill',
      label: { codexShared: 'Codex 共享 Skills', codexUser: 'Codex 用户 Skills', claudeUser: 'Claude 用户 Skills', workbuddyUser: 'WorkBuddy 用户 Skills', codexPluginCache: 'Codex 插件缓存', claudePluginCache: 'Claude 插件缓存', claudeMarketplace: 'Claude 市场候选', workbuddyPlugins: 'WorkBuddy 插件', trash: '工作台回收站' }
    },
    rename: {
      displayTitle: '修改显示名', internalTitle: '修改内部名称', displayDetail: '只改变用户看到的标题；宿主不支持时保存为工作台别名。', internalDetail: '会同步检查目录、已知调用名称、Codex UI 元数据和自引用。', name: '新名称', preview: '预检差异', execute: '确认执行', target: '目标目录', aliasOnly: '不会修改文件；仅更新工作台本地别名。', warnings: '注意事项'
    },
    guide: {
      eyebrow: '首次使用', title: '先认识这张本地 Skill 地图', detail: '工作台会原地索引多个宿主的 Skill，不会把它们搬进自己的目录。', welcomeTitle: '欢迎来到 Skills Manager Pro', welcomeDetail: '先索引，再判断，最后由你确认每一次文件修改。', browse: '开始浏览', scan: '原地建立索引', scanDetail: '自动发现 Codex、Claude、WorkBuddy；项目目录可随时添加，不会迁移现有 Skill。', protect: '先看安全边界', protectDetail: '插件、内置、市场和缓存默认只读；脚本永不执行，删除统一进入工作台回收站。', ai: 'AI 完全按需', aiDetail: '本地规则始终先运行。只有主动点击时才发送已预览的文本，AI 建议不会自动改写文件。', manage: '管理扫描目录', start: '开始使用', note: '首次完整扫描在后台进行，缓存列表会优先显示；顶部状态区可以查看进度。'
    }
  },
  settings: {
    eyebrow: '软件设置', title: '软件设置', subtitle: '管理界面语言与 AI 服务连接。', generalTab: '常规', aiTab: 'AI 服务',
    language: { title: '语言与地区', label: '界面语言', detail: '切换后立即生效；跟随系统会使用首个受支持的系统语言。', saved: '语言设置已保存', saving: '正在切换语言…' },
    providers: {
      title: 'AI 服务', subtitle: '兼容 Chat Completions 与 Responses。密钥只在主进程解密。', create: '新建服务', configured: '已配置', empty: '尚未配置服务', edit: '编辑连接', newConnection: '新建连接', newService: '新建 AI 服务', name: '配置名称', namePlaceholder: '例如 OpenAI', protocol: '协议', baseUrl: '接口地址（Base URL）', baseUrlHint: '可填 https://api.example.com 或以 /v1 结尾的兼容地址。', model: '模型', modelPlaceholder: '模型 ID', timeout: '超时（秒）', apiKey: '接口密钥（API Key）', apiKeyExistingHint: '留空会保留原密钥；工作台不会将明文写入数据库或日志。', apiKeyNewHint: '由 Windows DPAPI 通过 Electron safeStorage 保护。', apiKeyKeep: '••••••••（保持不变）', apiKeyPlaceholder: '输入 API Key', headers: '自定义请求头（JSON）', headersHint: '空值会保留同名旧值；删除字段可移除请求头。', enable: '启用此服务', enableHint: '停用后不能发起新分析，历史仍保留。', remove: '移除', encryptedSave: '加密保存', updated: '上次修改 {{date}}', invalidHeaders: '可选请求头必须是 JSON 对象', saved: 'AI 服务配置已加密保存', removed: '服务配置已移除；已有分析历史会保留'
    }
  },
  messages: {
    dialog: { addRootTitle: '选择要扫描的项目根目录', insertNoteImageTitle: '选择要插入的备注图片', imageFilterName: '图片' },
    scan: { preparing: '准备扫描', scanningRoot: '扫描 {{rootLabel}}', ready: '索引就绪', failed: '扫描失败', idle: '尚未扫描' },
    diagnostic: {
      'yaml-invalid': { title: 'YAML 无法解析', message: '{{error}}' },
      'frontmatter-unclosed': { title: 'YAML 无法解析', message: 'YAML frontmatter 缺少结束分隔符。' },
      'frontmatter-missing': { title: '缺少 YAML 元数据', message: 'SKILL.md 顶部没有完整的 YAML frontmatter。' },
      'name-missing': { title: '缺少内部名称', message: '未找到 name 字段。' },
      'name-folder-mismatch': { title: '名称与目录不一致', message: '内部名称“{{name}}”与目录“{{folderName}}”不同。' },
      'description-missing': { title: '缺少说明', message: '没有可用于发现和触发此 Skill 的 description/summary。' },
      'workbuddy-legacy-metadata': { title: 'WorkBuddy 旧式元数据', message: '当前使用 title/summary 兼容字段，保存时不会自动删除它们。' },
      'main-file-large': { title: '主文件较大', message: 'SKILL.md 为 {{formattedSize}}，已超过默认 AI 附件上限。' },
      'scripts-present': { title: '包含脚本', message: '工作台只盘点脚本，绝不会执行；v1 中脚本保持只读。' },
      'binary-present': { title: '包含二进制资源', message: '发现 {{count}} 个二进制文件，不会发送给 AI。' },
      'agent-metadata-invalid': { title: 'Codex UI 元数据损坏', message: '{{error}}' },
      'link-outside-skill': { title: '引用越过 Skill 目录', message: '引用“{{path}}”指向 Skill 目录之外。' },
      'link-missing': { title: '引用文件不存在', message: '找不到引用“{{path}}”。' },
      'symlink-outside-root': { title: '符号链接越界', message: 'Skill 的真实路径位于配置根目录之外，已强制设为只读。' }
    },
    action: {
      edit_metadata: '编辑元数据', edit_body: '编辑正文', edit_file: '编辑文件', rename_display: '修改显示名', rename_internal: '修改内部名称', trash: '移入回收站', restore: '恢复 Skill', restore_snapshot: '恢复快照', organize: '更新分类与标签', ai_analyze: 'AI 分析',
      summary: { edit_metadata: '编辑结构化元数据', edit_body: '编辑 Markdown 正文', edit_file: '编辑文件：{{path}}', rename_display: '显示名：{{before}} → {{after}}', rename_internal: '内部名称：{{before}} → {{after}}', trash: '移入回收站：{{name}}', restore: '恢复：{{name}}', restore_snapshot: '从快照恢复：{{path}}', organize: '分类为 {{category}}', ai_analyze: '使用 {{provider}} 分析' }
    }
    ,attachment: { singleLarge: '单文件超过 200 KB，不能发送', hostMetadata: '宿主 UI 元数据，可选发送', textAttachment: '文本附件，由你确认后发送', scriptNever: '脚本永不发送', binaryNever: '二进制文件永不发送', overLimit: '超过 200 KB 上限' },
    main: {
      error: {
        userCancelled: '用户已取消请求',
        newRequestStarted: '新请求已开始，前一个请求已取消',
        skillChanged: 'Skill 已变化，已取消本次 AI 分析；请刷新输入预览',
        attachmentForbidden: '附件不可发送：{{path}}',
        attachmentBudget: '所选附件总量超过 200 KB',
        providerDisabled: '该 AI 服务已停用',
        aiCancelled: 'AI 分析已取消',
        analysisCacheMissing: 'AI 分析缓存不存在',
        aiOutputMissing: 'AI 服务返回中没有可读取的文本结果',
        aiInvalidJson: 'AI 服务返回了无效 JSON',
        aiInvalidPayload: 'AI 服务返回的数据结构无效',
        aiUnknownCategory: 'AI 返回了不支持的分类：{{category}}',
        frontmatterDamagedEdit: 'YAML frontmatter 已损坏，请先在高级文本编辑器中修复',
        frontmatterDamagedModify: 'YAML frontmatter 已损坏，无法安全修改',
        skillNotFound: 'Skill 不存在或已被外部移除',
        invalidFilePath: '文件路径无效',
        pathEscapesSkill: '文件路径越过了 Skill 目录',
        providerHeaderNewline: '请求头 {{name}} 包含非法换行',
        providerSaveFailed: 'AI 服务保存失败',
        providerMissing: 'AI 服务配置不存在',
        secureStorageSaveUnavailable: '系统安全存储当前不可用，已拒绝保存明文密钥',
        secureStorageReadUnavailable: '系统安全存储当前不可用，无法读取密钥',
        requestTimeout: '请求超过 {{seconds}} 秒，已取消',
        headerInvalid: '请求头名称无效：{{name}}',
        headerForbidden: '不允许设置请求头：{{name}}',
        skillRootMissing: 'Skill 根目录不存在',
        folderRequired: '请选择存在的目录',
        protectedRootRemove: '自动发现和回收站根目录不能移除',
        textReadOnly: '该文本资源为只读或不在已索引文件中',
        displayPreviewEmpty: '显示名预览为空',
        targetExists: '目标目录已存在：{{path}}',
        targetMissing: '缺少目标目录',
        renameRollback: '内部改名失败并已尝试回滚：{{error}}',
        trashSourceOnly: '只有用户和项目来源可以移入工作台回收站',
        trashTargetInvalid: '回收站目标路径无效',
        trashConflict: '回收站中已存在同一 Skill，请先恢复或处理冲突',
        trashRootMissing: '工作台回收站根目录未初始化',
        notInTrash: '该 Skill 不在工作台回收站中',
        trashManifestInvalid: '回收站清单无效',
        originalOccupied: '原位置已被占用：{{path}}',
        originalRootMissing: '原 Skill 根目录配置已移除，请重新添加项目根后再恢复',
        historyMissing: '历史记录不存在',
        snapshotMissing: '快照不存在',
        sourceReadOnly: '该来源为只读，不能修改文件',
        textMissing: '文本资源不存在',
        symlinkOutside: '符号链接指向 Skill 目录之外',
        skillReadOnly: '该 Skill 为只读',
        externalModified: '文件已被外部修改，已阻止覆盖。请刷新后比较冲突内容。',
        metadataYamlInvalid: 'agents/openai.yaml 无法解析：{{error}}',
        diskRootMove: '拒绝对磁盘根目录执行移动',
        crossDiskVerify: '跨盘复制校验失败，原目录保持不变',
        noteImageEmpty: '图片文件为空',
        noteImageTooLarge: '单张备注图片不能超过 8 MB',
        noteImageQuota: '单 Skill 备注图片总量不能超过 20 MB',
        noteImageType: '仅支持 PNG、JPEG、GIF 或 WebP 图片',
        noteImageMissing: '备注图片不存在',
        skillNotIndexed: 'Skill 不存在或尚未建立索引',
        openPathNotAllowed: '只能打开已配置根目录内的路径',
        validation: {
          invalidInput: '输入内容格式不正确，请检查后重试',
          pathInvalidCharacters: '路径包含非法字符',
          nameForbiddenCharacters: '名称包含 Windows 禁止字符',
          httpOnly: '仅支持 HTTP 或 HTTPS 地址'
        }
      },
      success: {
        providerConnected: '连接成功 · HTTP {{status}}',
        organizationSaved: '分类与标签已保存',
        displayRenamed: '显示名已修改',
        internalRenamed: '内部名称与目录已修改',
        movedTrash: '已移入工作台回收站，可随时恢复',
        restored: '已恢复到原位置',
        saved: '保存成功'
      },
      warning: {
        aliasOnly: '该宿主没有独立显示名字段；此名称只保存在工作台索引中，不修改 Skill 文件。',
        claudeRename: 'Claude 的斜杠命令通常由目录名决定，本操作会同步重命名目录。',
        oldNameText: '仍有旧名称文本，请在差异中确认是否属于普通说明。'
      }
    }
  }
} as const;

const enUS = {
  common: {
    app: { title: 'Skills Manager Pro', home: 'Home', github: 'GitHub' },
    action: { close: 'Close', closeNotification: 'Close notification', cancel: 'Cancel', confirm: 'Confirm', back: 'Back', save: 'Save', remove: 'Remove', restore: 'Restore', refresh: 'Refresh', open: 'Open', edit: 'Edit', add: 'Add', test: 'Test connection', create: 'New', clear: 'Clear', rescan: 'Rescan', continue: 'Continue', configure: 'Configure' },
    status: { never: 'Never', enabled: 'Enabled', disabled: 'Disabled', editable: 'Editable', readOnly: 'Read-only', healthy: 'Healthy structure', current: 'Current version', stale: 'Content changed', loading: 'Loading…', none: 'None' },
    locale: { system: 'Use system language', zhCN: '简体中文', enUS: 'English', current: 'Current display language: {{locale}}' },
    host: { codex: 'Codex', claude: 'Claude', workbuddy: 'WorkBuddy', custom: 'General / Custom' },
    source: { user: 'User', project: 'Project', plugin: 'Plugin', builtin: 'Built-in', marketplace: 'Marketplace', cache: 'Cache', trash: 'Trash', backup: 'Backup' },
    scope: { user: 'User scope', project: 'Project scope', plugin: 'Plugin scope', system: 'System scope' },
    category: { writing: 'Writing & Content', visual: 'Visual Design', development: 'Development', automation: 'Automation', data: 'Data & Office', research: 'Research & Analysis', publishing: 'Publishing & Operations', compliance: 'Security & Compliance', finance: 'Business & Finance', management: 'Platform Management', uncategorized: 'Uncategorized' },
    fileKind: { main: 'Main file', metadata: 'Metadata', reference: 'Reference', asset: 'Asset', script: 'Script', other: 'Other' }
  },
  workbench: {
    splash: 'Opening the Skill index…',
    topbar: { searchPlaceholder: 'Search names, descriptions, content, or paths…', searchAria: 'Search Skills', indexReady: 'Index ready', scanRunning: '{{phase}} · {{count}}', manageRoots: 'Manage scan roots', rescanStarted: 'Background scan started', settings: 'Settings' },
    sidebar: { library: 'Library', all: 'All Skills', editable: 'Editable', duplicates: 'Duplicates', errors: 'Errors', review: 'Needs review', disabled: 'Disabled', trash: 'Trash', disabledHelp: 'Skills inside Claude / WorkBuddy plugins whose enabledPlugins setting is explicitly false', platforms: 'Platforms', platformsHelp: 'Source hosts, not content categories', customHelp: 'A user-added scan directory not recognized as Codex, Claude, or WorkBuddy; no Skill import is needed', hostHelp: 'Skills found in the {{host}} host', categories: 'Categories', categoriesHelp: 'Used only for Workbench filters', more: 'More below', moreAria: 'More content below; continue', history: 'History', settings: 'Settings', roots: 'Scan folders', privacy: 'Local index · Keys protected by the system' },
    list: { eyebrow: 'Skill catalog', batchAi: 'Batch AI', source: 'Source', sourceType: 'Source type', clearSource: 'Clear source filter', editableCount: 'Editable {{count}}', issueCount: 'Issues {{count}}', duplicateCount: 'Duplicates {{count}}', aria: 'Skill list', emptyTitle: 'No matching Skills', emptyDetail: 'Try clearing platform, state, or source filters.', noDescription: 'No description', disabled: 'Disabled', error: 'Error', review: 'Review', titleTrash: 'Trash', titleDisabled: 'Disabled Skills', titleDuplicates: 'Duplicates', titleErrors: 'Skills with errors', titleReview: 'Needs review', titleEditable: 'Editable Skills', titleAll: 'All Skills', configureAi: 'Configure and enable an AI service first', narrowBatch: 'There are {{count}} results. Narrow the list to 20 or fewer by platform, source, or category.' },
    detail: { emptyTitle: 'Select a Skill', emptyDetail: 'Its description, diagnostics, files, and change history will appear here.', openExplorer: 'Open in File Explorer', rescan: 'Run checks again', localUpdated: 'Local checks updated', more: 'More actions', renameDisplay: 'Change display name', renameInternal: 'Change internal name', moveTrash: 'Move to Trash', tabsAria: 'Skill details', overview: 'Overview', editor: 'Editor', files: 'Files', notes: 'Notes', ai: 'AI analysis', trashTitle: 'Move to Workbench Trash', trashDescription: 'This does not permanently delete anything. The original path and hash are recorded, and Trash is never emptied automatically.', trashConfirm: 'Move to Trash' },
    overview: { files: 'Files', size: 'Size', body: 'Body', lines: '{{count}} lines', updated: 'Updated', identityEyebrow: 'Identity', identity: 'Identity and source', displayName: 'Display name', internalName: 'Internal name', host: 'Host', source: 'Source', hash: 'Main content hash', permission: 'Permission', writable: 'Writable in place', protected: 'Protected read-only', parentPlugin: 'Parent plugin', family: 'Skill family · {{count}} installations · {{hosts}}', sameContent: 'Same content', manualReview: 'Manual review', organizeEyebrow: 'Organization', organize: 'Category and tags', localSuggestion: 'Local suggestion: {{category}}', organizeHelp: 'Used only to filter and organize inside Workbench. Saving does not move the Skill, rename a folder, or affect host invocation.', primaryCategory: 'Primary category', customTags: 'Custom tags', tagsPlaceholder: 'Comma-separated', auditEyebrow: 'Safety checks', audit: 'Local checks', noIssues: 'No structural issues found', noIssuesHelp: 'You should still validate triggering and resource references in the real host.', errors: '{{count}} errors', reviews: '{{count}} items to review', exactDuplicate: 'Exact duplicate found', nearDuplicate: 'Near duplicate found', nameDuplicate: 'Same-name copy found', duplicateGroup: 'Group {{group}} · View all duplicates', previewEyebrow: 'Content preview', preview: 'Description preview', emptyBody: '*No body content*' },
    editor: { protectedTitle: 'This source is protected', protectedDetail: 'Plugin, built-in, marketplace, cache, and backup sources are for inventory only. You can still inspect text resources and local diagnostics.', metadata: 'Structured metadata', markdown: 'Markdown body', resources: 'Advanced resources', safety: 'Safe editing', metadataHelp: 'Unknown YAML fields and comments are preserved. Display and internal names use separate preview operations.', displayName: 'Display name', internalName: 'Internal name', change: 'Change', previewRename: 'Preview rename', description: 'Description', descriptionPlaceholder: 'Explain what this Skill does and when it should trigger.', hashHelp: 'A diff is shown and the disk version is checked before saving.', previewSave: 'Preview and save', bodyArea: 'Body only · YAML stays unchanged', readOnlyRibbon: 'Scripts and protected resources remain read-only', selectResource: 'Select a text resource', selectResourceHelp: 'You can inspect references, agent metadata, and other text. Scripts always remain read-only.', textResources: 'Text resources', viewableResources: 'Viewable text resources', confirmDescription: 'Confirm description edit', confirmBody: 'Confirm Markdown body edit', confirmFile: 'Confirm edit to {{file}}', validateHash: '{{file}} · The hash will be checked again before writing', backEdit: 'Back to editor', confirmSave: 'Confirm save', saved: 'Changes saved and a restorable snapshot was created' },
    files: { title: 'File inventory', subtitle: 'Resources in the physical directory', count: '{{count}} files · {{size}}', openFolder: 'Open folder', file: 'File', type: 'Type', size: 'Size', updated: 'Updated', editInEditor: 'Editable on the Editor tab', emptyTitle: 'No indexed files', emptyDetail: 'Run a new scan and try again.', text: 'Text', readOnly: 'Read-only', empty: 'No files found' },
    notes: { eyebrow: 'Personal notes', title: 'Skill usage notes', help: 'Stored only in the Workbench database. This never rewrites, moves, or affects the original Skill.', placeholder: 'Record triggers, usage tips, cautions, or examples…', addImage: 'Insert image', save: 'Save notes', saved: 'Notes saved to Workbench', imageInserted: 'Image inserted and notes saved', imageRemoved: 'Removed image: {{name}}', content: 'Notes', markdown: 'Markdown supported', preview: 'Live preview', characters: '{{count}} characters', previewEmpty: 'Your note preview will appear here. Inserted images are stored locally by Workbench.', images: 'Note images', imageCount: '{{count}} images · up to 8 MB each', removeImage: 'Remove image {{name}}', removeConfirm: 'Remove “{{name}}” from these notes? Only the database copy is deleted.', imageUnavailable: 'Image unavailable: {{name}}', unnamedImage: 'Unnamed image', defaultImageAlt: 'Note image', empty: 'No notes yet' },
    ai: { privacyTitle: 'You decide when and where data is sent', privacyDetail: 'Local rules always run first. AI is never called automatically and cannot execute or rewrite a Skill. Scripts and binaries are never sent.', onDemand: 'On-demand analysis', structured: 'Run structured analysis', manual: 'Manual trigger', configureTitle: 'Configure an AI service first', configureDetail: 'Supports Chat Completions and Responses-compatible APIs', providerModel: 'Service and model', preview: 'Preview content to send', refreshPreview: 'Refresh preview', required: 'Required', optionalAttachments: 'Optional text attachments', excluded: '{{count}} files will not be sent', estimated: 'About {{count}} characters + attachments', confirmTitle: 'Confirm analysis payload', confirmDetail: 'This makes an external network request. Only the confirmed text below is sent, and results are never applied automatically.', cancelRequest: 'Cancel request', backCheck: 'Back to review', confirmSend: 'Send for analysis', completed: 'AI analysis complete; the result was saved only as a suggestion', resultEyebrow: 'AI analysis result', latest: 'Latest analysis', capabilities: 'Capabilities', improvements: 'Suggested improvements', compatibility: 'Compatibility', risks: 'Risks', recommendedCategory: 'Recommended category', tags: 'Tags', confidence: 'Confidence', resultLanguage: 'Result language: {{locale}}', oldLanguage: 'This historical result is in {{locale}}. Run it again to generate a result in the current language.' },
    batch: { title: 'Confirm batch AI analysis', detail: 'Batch mode sends only each Skill’s SKILL.md, without attachments. Results are cached separately and never applied automatically.', progress: 'Progress {{done}} / {{total}}', confirmFiles: 'Confirm {{count}} files · {{size}}', stop: 'Stop remaining requests', confirm: 'Analyze {{count}}', privacy: 'Scripts, binaries, and reference attachments are excluded from this batch.', provider: 'Service', loading: 'Building a send manifest for each Skill…', stopped: 'Batch analysis stopped · {{completed}} complete, {{failed}} failed', finished: 'Batch analysis finished · {{completed}} complete, {{failed}} failed' },
    history: { eyebrow: 'Operation audit', title: 'Operation history', subtitle: 'Snapshots precede text edits; renames, Trash operations, and AI analyses have separate records.', count: '{{count}} records', emptyTitle: 'No operations yet', emptyDetail: 'Your first edit, rename, or analysis will appear here.', change: 'Changes', restore: 'Restore previous snapshot', fileOperation: 'File operation', noDiffTitle: 'No text diff for this operation', noDiffDetail: 'Moves, organization, Trash operations, and AI analysis are recorded as operation metadata.', diff: 'View diff', restoreConfirm: 'Restore from this snapshot? Current content will first be saved as a new snapshot.', irreversible: 'Cannot be directly restored', path: 'Path', time: 'Time' },
    roots: { title: 'Scan folders', detail: 'Index these folders in place. Adding a project root never migrates or modifies its Skills.', footer: 'Project scans exclude node_modules, .git, session caches, and backups.', add: 'Add project root', added: 'Project root added; a background scan has started', removed: 'Removed scan configuration: {{label}}', discovered: 'Auto-discovered', lastScan: '{{host}} · {{source}} · Last scanned {{date}}', open: 'Open in File Explorer', remove: 'Remove scan configuration', iconAutoMatched: 'Auto-matched tool icon', skillCountUnit: 'Skills', label: { codexShared: 'Codex shared Skills', codexUser: 'Codex user Skills', claudeUser: 'Claude user Skills', workbuddyUser: 'WorkBuddy user Skills', codexPluginCache: 'Codex plugin cache', claudePluginCache: 'Claude plugin cache', claudeMarketplace: 'Claude marketplace candidates', workbuddyPlugins: 'WorkBuddy plugins', trash: 'Workbench Trash' } },
    rename: { displayTitle: 'Change display name', internalTitle: 'Change internal name', displayDetail: 'Changes only the title shown to users. If the host does not support it, the value is saved as a Workbench alias.', internalDetail: 'Checks the directory, known invocation names, Codex UI metadata, and self-references together.', name: 'New name', preview: 'Preview changes', execute: 'Apply change', target: 'Target folder', aliasOnly: 'No files will change; only the local Workbench alias is updated.', warnings: 'Warnings' },
    guide: { eyebrow: 'First run', title: 'Meet your local Skill map', detail: 'Workbench indexes Skills in place across multiple hosts; it never moves them into its own folder.', welcomeTitle: 'Welcome to Skills Manager Pro', welcomeDetail: 'Index first, review the result, and confirm every file change yourself.', browse: 'Start browsing', scan: 'Index in place', scanDetail: 'Codex, Claude, and WorkBuddy are detected automatically. Project folders can be added anytime without moving existing Skills.', protect: 'See safety boundaries first', protectDetail: 'Plugin, built-in, marketplace, and cache sources default to read-only. Scripts are never run, and deletion moves items to Workbench Trash.', ai: 'AI stays fully on demand', aiDetail: 'Local rules always run first. Only previewed text is sent after you click, and AI suggestions never rewrite files automatically.', manage: 'Manage scan folders', start: 'Get started', note: 'The first full scan runs in the background while cached results appear first. Progress is shown in the top bar.' }
  },
  settings: {
    eyebrow: 'Software settings', title: 'Software settings', subtitle: 'Manage the interface language and AI service connections.', generalTab: 'General', aiTab: 'AI services',
    language: { title: 'Language and region', label: 'Interface language', detail: 'Changes apply immediately. System mode uses the first supported OS language.', saved: 'Language preference saved', saving: 'Switching language…' },
    providers: { title: 'AI services', subtitle: 'Compatible with Chat Completions and Responses. Keys are decrypted only in the main process.', create: 'New service', configured: 'Configured', empty: 'No services configured', edit: 'Edit connection', newConnection: 'New connection', newService: 'New AI service', name: 'Configuration name', namePlaceholder: 'For example, OpenAI', protocol: 'Protocol', baseUrl: 'Base URL', baseUrlHint: 'Enter https://api.example.com or a compatible URL ending in /v1.', model: 'Model', modelPlaceholder: 'Model ID', timeout: 'Timeout (seconds)', apiKey: 'API key', apiKeyExistingHint: 'Leave blank to keep the current key. Workbench never writes plaintext keys to the database or logs.', apiKeyNewHint: 'Protected by Windows DPAPI through Electron safeStorage.', apiKeyKeep: '•••••••• (unchanged)', apiKeyPlaceholder: 'Enter API key', headers: 'Custom request headers (JSON)', headersHint: 'Blank values retain matching old values; remove a field to delete that header.', enable: 'Enable this service', enableHint: 'Disabled services cannot start new analyses; history is retained.', remove: 'Remove', encryptedSave: 'Encrypt & save', updated: 'Last updated {{date}}', invalidHeaders: 'Optional request headers must be a JSON object', saved: 'AI service configuration saved securely', removed: 'Service configuration removed; existing analysis history was retained' }
  },
  messages: {
    dialog: { addRootTitle: 'Select a project root to scan', insertNoteImageTitle: 'Select an image for the note', imageFilterName: 'Images' },
    scan: { preparing: 'Preparing scan', scanningRoot: 'Scanning {{rootLabel}}', ready: 'Index ready', failed: 'Scan failed', idle: 'Not scanned yet' },
    diagnostic: {
      'yaml-invalid': { title: 'YAML could not be parsed', message: '{{error}}' },
      'frontmatter-unclosed': { title: 'YAML could not be parsed', message: 'YAML frontmatter is missing its closing delimiter.' },
      'frontmatter-missing': { title: 'YAML metadata is missing', message: 'SKILL.md does not begin with complete YAML frontmatter.' },
      'name-missing': { title: 'Internal name is missing', message: 'No name field was found.' },
      'name-folder-mismatch': { title: 'Name and folder do not match', message: 'Internal name “{{name}}” differs from folder “{{folderName}}”.' },
      'description-missing': { title: 'Description is missing', message: 'No description/summary is available for discovery and triggering.' },
      'workbuddy-legacy-metadata': { title: 'Legacy WorkBuddy metadata', message: 'This Skill uses compatible title/summary fields. Saving will not remove them automatically.' },
      'main-file-large': { title: 'Large main file', message: 'SKILL.md is {{formattedSize}}, above the default AI attachment limit.' },
      'scripts-present': { title: 'Scripts present', message: 'Workbench inventories scripts but never runs them. Scripts remain read-only in v1.' },
      'binary-present': { title: 'Binary assets present', message: '{{count}} binary files were found and will not be sent to AI.' },
      'agent-metadata-invalid': { title: 'Damaged Codex UI metadata', message: '{{error}}' },
      'link-outside-skill': { title: 'Reference escapes the Skill folder', message: 'Reference “{{path}}” points outside the Skill folder.' },
      'link-missing': { title: 'Referenced file does not exist', message: 'Reference “{{path}}” could not be found.' },
      'symlink-outside-root': { title: 'Symlink escapes the root', message: 'The Skill’s real path is outside its configured root, so it was forced to read-only.' }
    },
    action: {
      edit_metadata: 'Edit metadata', edit_body: 'Edit body', edit_file: 'Edit file', rename_display: 'Change display name', rename_internal: 'Change internal name', trash: 'Move to Trash', restore: 'Restore Skill', restore_snapshot: 'Restore snapshot', organize: 'Update category and tags', ai_analyze: 'AI analysis',
      summary: { edit_metadata: 'Edited structured metadata', edit_body: 'Edited Markdown body', edit_file: 'Edited file: {{path}}', rename_display: 'Display name: {{before}} → {{after}}', rename_internal: 'Internal name: {{before}} → {{after}}', trash: 'Moved to Trash: {{name}}', restore: 'Restored: {{name}}', restore_snapshot: 'Restored snapshot: {{path}}', organize: 'Category changed to {{category}}', ai_analyze: 'Analyzed with {{provider}}' }
    }
    ,attachment: { singleLarge: 'A single file exceeds 200 KB and cannot be sent', hostMetadata: 'Optional host UI metadata', textAttachment: 'Text attachment; sent only after you confirm', scriptNever: 'Scripts are never sent', binaryNever: 'Binary files are never sent', overLimit: 'Above the 200 KB limit' },
    main: {
      error: {
        userCancelled: 'The request was cancelled by the user',
        newRequestStarted: 'A new request started, so the previous request was cancelled',
        skillChanged: 'The Skill changed, so this AI analysis was cancelled. Refresh the input preview.',
        attachmentForbidden: 'This attachment cannot be sent: {{path}}',
        attachmentBudget: 'The selected attachments exceed the 200 KB limit',
        providerDisabled: 'This AI service is disabled',
        aiCancelled: 'AI analysis was cancelled',
        analysisCacheMissing: 'The AI analysis cache entry does not exist',
        aiOutputMissing: 'The AI service response did not contain readable text',
        aiInvalidJson: 'The AI service returned invalid JSON',
        aiInvalidPayload: 'The AI service returned an invalid data structure',
        aiUnknownCategory: 'The AI returned an unsupported category: {{category}}',
        frontmatterDamagedEdit: 'The YAML frontmatter is damaged. Repair it in an advanced text editor first.',
        frontmatterDamagedModify: 'The YAML frontmatter is damaged and cannot be modified safely',
        skillNotFound: 'The Skill does not exist or was removed externally',
        invalidFilePath: 'The file path is invalid',
        pathEscapesSkill: 'The file path escapes the Skill folder',
        providerHeaderNewline: 'Request header {{name}} contains an invalid newline',
        providerSaveFailed: 'Failed to save the AI service',
        providerMissing: 'The AI service configuration does not exist',
        secureStorageSaveUnavailable: 'Secure system storage is unavailable, so the plaintext key was not saved',
        secureStorageReadUnavailable: 'Secure system storage is unavailable, so the key cannot be read',
        requestTimeout: 'The request exceeded {{seconds}} seconds and was cancelled',
        headerInvalid: 'Invalid request header name: {{name}}',
        headerForbidden: 'This request header is not allowed: {{name}}',
        skillRootMissing: 'The Skill root does not exist',
        folderRequired: 'Select an existing folder',
        protectedRootRemove: 'Auto-discovered and Trash roots cannot be removed',
        textReadOnly: 'This text resource is read-only or is not in the index',
        displayPreviewEmpty: 'The display-name preview is empty',
        targetExists: 'The target folder already exists: {{path}}',
        targetMissing: 'The target folder is missing',
        renameRollback: 'The internal rename failed and a rollback was attempted: {{error}}',
        trashSourceOnly: 'Only user and project sources can be moved to Workbench Trash',
        trashTargetInvalid: 'The Trash destination is invalid',
        trashConflict: 'The same Skill already exists in Trash. Restore it or resolve the conflict first.',
        trashRootMissing: 'The Workbench Trash root has not been initialized',
        notInTrash: 'This Skill is not in Workbench Trash',
        trashManifestInvalid: 'The Trash manifest is invalid',
        originalOccupied: 'The original location is occupied: {{path}}',
        originalRootMissing: 'The original Skill root was removed. Add the project root again before restoring.',
        historyMissing: 'The history record does not exist',
        snapshotMissing: 'The snapshot does not exist',
        sourceReadOnly: 'This source is read-only and its files cannot be modified',
        textMissing: 'The text resource does not exist',
        symlinkOutside: 'The symbolic link points outside the Skill folder',
        skillReadOnly: 'This Skill is read-only',
        externalModified: 'The file was modified externally, so it was not overwritten. Refresh to compare the conflict.',
        metadataYamlInvalid: 'agents/openai.yaml could not be parsed: {{error}}',
        diskRootMove: 'Moving a disk root is not allowed',
        crossDiskVerify: 'Cross-disk copy verification failed; the original folder was left unchanged',
        noteImageEmpty: 'The image file is empty',
        noteImageTooLarge: 'A note image cannot exceed 8 MB',
        noteImageQuota: 'Note images for one Skill cannot exceed 20 MB in total',
        noteImageType: 'Only PNG, JPEG, GIF, or WebP images are supported',
        noteImageMissing: 'The note image does not exist',
        skillNotIndexed: 'The Skill does not exist or has not been indexed',
        openPathNotAllowed: 'Only paths inside configured roots can be opened',
        validation: {
          invalidInput: 'Some input fields are invalid. Check them and try again.',
          pathInvalidCharacters: 'The path contains invalid characters',
          nameForbiddenCharacters: 'The name contains characters that Windows does not allow',
          httpOnly: 'Only HTTP or HTTPS addresses are supported'
        }
      },
      success: {
        providerConnected: 'Connected successfully · HTTP {{status}}',
        organizationSaved: 'Category and tags saved',
        displayRenamed: 'Display name changed',
        internalRenamed: 'Internal name and folder changed',
        movedTrash: 'Moved to Workbench Trash; it can be restored at any time',
        restored: 'Restored to the original location',
        saved: 'Saved successfully'
      },
      warning: {
        aliasOnly: 'This host has no separate display-name field. The name is stored only as a Workbench alias and does not modify Skill files.',
        claudeRename: 'Claude slash commands usually follow the folder name. This operation renames the folder as well.',
        oldNameText: 'Some text still contains the old name. Review the diff to confirm whether it is ordinary prose.'
      }
    }
  }
};

export const resources = { 'zh-CN': zhCN, 'en-US': enUS } as const;

const categoryKeys: Record<string, string> = {
  '写作内容': 'common:category.writing', '视觉设计': 'common:category.visual', '开发工程': 'common:category.development',
  '自动化': 'common:category.automation', '数据办公': 'common:category.data', '研究分析': 'common:category.research',
  '发布运营': 'common:category.publishing', '安全合规': 'common:category.compliance', '商业金融': 'common:category.finance',
  '平台管理': 'common:category.management', '未分类': 'common:category.uncategorized'
};

export function categoryLabelKey(category: string): string | undefined { return categoryKeys[category]; }
export function sourceLabelKey(source: SkillSourceType): string { return `common:source.${source}`; }
export function hostLabelKey(host: HostPlatform): string { return `common:host.${host}`; }
export function scopeLabelKey(scope: SkillScope): string { return `common:scope.${scope}`; }
