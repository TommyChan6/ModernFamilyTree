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
    closeProject: '关闭项目'
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
    addPerson: '添加成员',
    style: '样式'
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
