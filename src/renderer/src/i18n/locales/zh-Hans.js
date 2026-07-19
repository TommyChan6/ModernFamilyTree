// 简体中文 (Simplified Chinese)
export default {
  topbar: {
    search: '跳转到某个人',
    export: '导出',
    exportImage: '导出家谱图片',
    mode: '模式',
    modeHint: '程序模式 — 决定显示多少功能',
    labs: '实验室',
    labsOn: '实验室已开启 — 可使用实验性功能',
    labsOff: '实验室 — 开启实验性功能',
    settings: '设置',
    settingsHint: '设置、语言、帮助与反馈',
    lightMode: '浅色模式',
    darkMode: '深色模式',
    newProject: '新建项目',
    closeProject: '关闭项目',
    undo: '撤销上一次数据编辑',
    redo: '重做已撤销的编辑'
  },
  history: {
    undid: '已撤销{what}',
    redid: '已重做{what}',
    kind: {
      persons: '人物编辑',
      relationships: '关系编辑',
      fields: '特征编辑',
      relTypes: '关系类型编辑',
      tags: '标签编辑',
      entity_tags: '标签变更',
      scene_tags: '分组变更',
      images: '照片变更',
      characters: '角色编辑',
      generic: '一次变更'
    }
  },
  mode: {
    simple: '简易',
    standard: '标准',
    advanced: '高级'
  },
  rail: {
    graph: '关系图',
    directory: '名录',
    relationships: '关系',
    timeline: '时间线',
    groups: '分组',
    character: '角色',
    addPerson: '添加成员',
    style: '样式'
  },
  character: {
    experimental: '实验性',
    person: '成员',
    style: '风格',
    labelPh: '为这个形象命名…',
    lookName: '形象 {n}',
    addLook: '新形象',
    deleteLook: '删除此形象',
    confirmDelete: '删除「{name}」？此形象将永久消失。',
    create: '创建角色',
    emptyTitle: '为 {name} 画一张脸',
    emptyHint: '用可更换的部件搭建肖像 — 挑选部件、改颜色和大小，然后设为其在整个应用中的头像。',
    noPersons: '请先添加一位成员，然后回来为 TA 画像。',
    randomize: '随机生成',
    mirror: '镜像',
    undo: '撤销',
    redo: '重做',
    zoomIn: '放大',
    zoomOut: '缩小',
    setPortrait: '设为肖像',
    portraitBadge: '此形象是当前肖像',
    none: '无',
    size: '大小',
    colors: '颜色',
    body: '身体',
    height: '身高',
    build: '体型',
    headSize: '头部',
    ages: '年龄',
    ageHint: '可选：将此形象绑定到一个年龄段，例如年轻与年老各一张肖像。',
    ageFrom: '从',
    ageTo: '到',
    slots: {
      head: '脸型',
      hair: '发型',
      eyes: '眼睛',
      brows: '眉毛',
      mouth: '嘴巴',
      torso: '上装',
      legs: '下装',
      feet: '鞋子',
      headwear: '头饰',
      accessory: '配饰'
    },
    palette: {
      skin: '肤色',
      hair: '发色',
      eyes: '瞳色',
      outfitA: '上装',
      outfitB: '下装',
      accent: '点缀'
    }
  },
  settings: {
    title: '设置',
    tabs: {
      general: '常规',
      help: '帮助与文档',
      feedback: '反馈',
      about: '关于'
    },
    language: {
      title: '语言',
      desc: '选择应用的显示语言。此设置将应用于整个程序并保存以供下次使用。'
    },
    appearance: {
      title: '外观'
    },
    theme: {
      title: '主题',
      desc: '在深色与浅色界面之间切换。',
      light: '浅色',
      dark: '深色'
    },
    programMode: {
      title: '程序模式',
      desc: '控制显示多少功能。简易模式保持界面精简；高级模式解锁所有工具。'
    },
    noun: {
      title: '成员的称呼',
      desc: '此项目对条目的称呼——人物、角色、船舰、家族……仅应用于此项目。',
      placeholder: 'Person'
    },
    close: '关闭'
  },
  help: {
    title: '帮助与文档',
    intro: '家谱帮助你梳理人物、他们之间的关系，以及这些关系随时间的变化。以下是使用指南。',
    gettingStarted: {
      title: '快速上手',
      steps: [
        '使用左侧栏的 ＋ 按钮添加成员，或点击“添加成员”按钮。',
        '打开某个成员以填写日期、照片和备注。',
        '在关系图视图中连接两个人以建立关系。',
        '从左侧栏切换视图，以关系图、名录、时间线或分组方式查看你的家庭。',
        '按 Ctrl+S 保存一个可随时回退的存档 — 其余更改都会自动保存。'
      ]
    },
    views: {
      title: '五种视图',
      items: [
        { name: '关系图', desc: '人物与关系的交互式网络。可拖动重新排列。' },
        { name: '名录', desc: '可搜索的成员卡片列表。' },
        { name: '关系', desc: '在一个清晰的列表中查看所有关系。' },
        { name: '时间线', desc: '按年份排列的生命线 — 出生、婚姻等。' },
        { name: '分组', desc: '按共享的标签将人物聚类。' }
      ]
    },
    shortcuts: {
      title: '键盘快捷键',
      items: [
        { keys: 'Ctrl / ⌘ + K', desc: '跳转到某个人' },
        { keys: 'Ctrl / ⌘ + S', desc: '保存存档' },
        { keys: 'Esc', desc: '关闭对话框' }
      ]
    }
  },
  feedback: {
    title: '发送反馈',
    intro: '发现了问题或有好点子？本程序的作者很乐意听取你的意见。',
    typeLabel: '类型',
    type: {
      bug: '问题报告',
      idea: '功能建议',
      praise: '我喜欢的地方',
      other: '其他'
    },
    messageLabel: '你的留言',
    placeholder: '描述你喜欢什么、哪里出了问题，或希望应用能做到什么……',
    send: '通过邮件发送',
    note: '这将打开你的邮件应用并预填留言 — 不会自动发送任何内容。',
    empty: '请先写一段简短的留言，再发送。'
  },
  account: {
    myProfile: '我的主页',
    back: '返回应用',
    memberSince: '注册于 {date}',
    planFree: '免费版',
    profile: {
      title: '个人资料',
      desc: '你在应用中的展示形象 — 分享功能上线后，也会展示给你分享的对象。',
      displayName: '显示名称',
      displayNamePh: '希望我们如何称呼你？',
      bio: '关于你',
      bioPh: '简单介绍一下你自己或你的家谱研究……',
      avatar: '头像颜色',
      auto: '自动 — 根据用户名生成',
      save: '保存资料',
      saved: '已保存'
    },
    security: {
      title: '安全',
      desc: '你的登录信息。修改密码后，其他设备将被退出登录。',
      username: '用户名',
      usernameNote: '用户名无法更改。',
      currentPassword: '当前密码',
      newPassword: '新密码',
      confirmPassword: '再次输入新密码',
      change: '修改密码',
      changed: '密码已修改 — 你的其他设备已退出登录。',
      mismatch: '两次输入的新密码不一致',
      signOut: '退出登录'
    },
    usage: {
      title: '套餐与用量',
      desc: '当前套餐包含的内容以及你已使用的额度。',
      people: '成员',
      projects: '项目',
      photos: '照片'
    },
    projects: {
      title: '你的项目',
      desc: '你创建的所有内容都在这里。点击项目即可打开。',
      open: '打开',
      current: '当前打开',
      updated: '更新于 {date}',
      new: '新建项目'
    },
    sharing: {
      title: '分享',
      soon: '即将推出',
      desc: '分享项目的只读链接，或发布家谱的快照图片。功能上线后，你将在这里管理所有已分享的内容。',
      kindProject: '项目链接',
      kindImage: '图片快照',
      visibility: {
        private: '私密',
        link: '拥有链接的任何人',
        public: '公开'
      },
      copyLink: '复制链接',
      mockNote: '这是计划功能的预览 — 目前尚未分享任何内容，你的所有数据仍保存在本地设备上。'
    }
  },
  about: {
    title: '关于家谱',
    tagline: '一款本地优先的家庭与关系图谱工具。',
    versionLabel: '版本',
    creatorLabel: '作者',
    contactLabel: '联系方式',
    tech: '使用 Vue 3、Three.js 与 Electron 构建。',
    privacy: '你的数据保存在本地设备上 — 本地使用无需账户。'
  }
}
