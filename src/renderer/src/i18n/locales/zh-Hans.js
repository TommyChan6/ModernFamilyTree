// 简体中文 (Simplified Chinese)
export default {
  // 关系动态 —— 情感层 + 图谱的「动态」透镜
  sentiment: {
    lens: '动态',
    lensHint: '按情感把每段关系染成暖 ↔ 冷；线宽表示感情的强烈程度',
    legendTitle: '动态',
    close: '关闭动态透镜',
    cold: '冷',
    neutral: '中性',
    warm: '暖',
    faint: '淡',
    strong: '浓',
    widthNote: '线宽 = 强度',
    ringNote: '圆环 = 每个人的整体温度',
    counts: '{warm} 暖 · {neutral} 中性 · {cold} 冷',
    feeling: '情感',
    intensity: '强度',
    feelingAria: '情感，从冷到暖',
    intensityAria: '强度，从淡到浓',
    fromType: '沿用类型',
    fromTypeTitle: '使用该类型的默认情感',
    defaultIntensity: '默认',
    defaultIntensityTitle: '使用默认强度',
    typeFeelingHint: '这类关系默认的情感 —— 动态透镜会按冷 ↔ 暖为它着色。单段关系可以单独覆盖。',
    levels: {
      hostile: '敌对',
      cool: '冷淡',
      neutral: '中性',
      warm: '温暖',
      loving: '深爱'
    },
    style: {
      title: '动态透镜',
      warm: '暖色情感',
      cold: '冷色情感'
    }
  },
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
    inkOn: '水墨画主题',
    inkOff: '退出水墨主题',
    medievalOn: '中世纪手抄本主题',
    medievalOff: '退出中世纪主题',
    newProject: '新建项目',
    closeProject: '关闭项目',
    undo: '撤销上一次数据编辑',
    redo: '重做已撤销的编辑',
    projects: '项目',
    projectsHint: '浏览并管理你的全部项目'
  },
  billing: {
    title: '让你的森林长大',
    eyebrow: '套餐',
    subtitle:
      '你喜欢的一切都永久免费。升级即可获得更多空间、告别广告，并陆续解锁专业工具——也帮助这片森林继续生长。',
    close: '关闭',
    monthly: '按月',
    yearly: '按年',
    save: '省 {pct}%',
    popular: '最受欢迎',
    perMonth: '/ 月',
    forever: '永久',
    noCard: '无需绑卡，没有套路',
    billedYearly: '每年一次性支付 {amount}',
    billedMonthly: '按月计费 · 随时取消',
    freeIncludes: '所有视图、所有布局、实验室',
    soon: '即将推出',
    compare: '比较全部功能',
    faqTitle: '常见问题',
    faq: {
      cancel: {
        q: '可以随时取消吗？',
        a: '可以。取消后不再续费；在已付费周期结束前仍可使用当前套餐，之后回到免费版。'
      },
      downgrade: {
        q: '回到免费版后我的家谱会怎样？',
        a: '不会删除任何内容。所有项目、人物和照片都会保留——只是超出免费额度时无法继续新增。'
      },
      secure: {
        q: '付款安全吗？',
        a: '付款由我们的支付合作方在其安全页面完成。你的银行卡信息永远不会经过我们的应用或服务器。'
      },
      discounts: {
        q: '有优惠吗？',
        a: '按年付费约可节省四分之一；上线活动、学校和社区的优惠码可在结账时使用。'
      }
    },
    fine: '价格以美元计。依法可能需另缴税费。',
    sandboxChip: '沙盒模式 — 不会真实扣款',
    notLiveChip: '付款即将开放',
    reason: {
      quota: '你已达到免费版的上限',
      ads: '无广告地畅游森林。',
      feature: '该功能需要更高的套餐。'
    },
    plans: {
      free: { name: '免费版', tagline: '开始种树所需的一切。' },
      plus: { name: 'Plus', tagline: '十倍人物上限、零广告，外加支持者徽章。' },
      pro: { name: 'Pro', tagline: '为王朝、研究者与世界构建者打造。' },
      guest: { name: '访客', tagline: '' }
    },
    limits: { maxProjects: '个项目', maxPersons: '位人物', maxImages: '张照片' },
    perks: {
      adFree: '全站无广告',
      moreProjects: '更多项目',
      morePeople: '更大的家谱',
      morePhotos: '更多照片',
      supporterBadge: '支持者徽章',
      earlyLabs: '抢先体验实验室',
      coEdit: '共同编辑共耕林',
      hiresExport: '高清与打印导出',
      gedcom: 'GEDCOM 导入导出',
      aiCredits: 'AI 家谱生成额度',
      prioritySupport: '优先支持'
    },
    cta: {
      guest: '请先创建账户',
      current: '当前套餐',
      included: '已包含',
      switchInterval: '切换计费周期',
      upgrade: '升级到 {plan}',
      switch: '切换到 {plan}'
    },
    backToPlans: '全部套餐',
    reviewTitle: '确认订单',
    couponPh: '优惠码',
    apply: '使用',
    couponOk: '已使用 {code}',
    couponErr: { unknown: '该优惠码不存在。', interval: '该优惠码仅适用于按年付费。' },
    annualSavings: '相比按月节省',
    dueToday: '今日应付',
    renews: '将于 {date} 以 {amount} 续费，可随时取消。',
    agree: '我同意服务条款，并了解套餐会自动续费，直至我取消。',
    continue: '前往安全结账',
    notifyMe: '付款开放时提醒我',
    waitlisted: '已加入等候名单',
    notLiveBody: '付费套餐尚未开售。你的意向已保存在本设备上，结账开放后套餐会在这里等你。',
    waitlistToast: '已保存 — 付款开放后可在这里找到。',
    secureNote: '结账在支付合作方的安全页面进行，我们永远看不到你的银行卡。',
    sandboxRibbon: '测试模式 — 不会产生真实资金流动',
    contacting: '正在连接支付合作方…',
    sandboxBrand: '支付合作方（沙盒）',
    sandboxBody: '在正式付款功能完成前，这里代替真实的托管结账页面。选择一个结果来测试流程。',
    simSuccess: '模拟付款成功',
    simFail: '模拟银行卡被拒',
    simCancel: '取消并返回',
    welcome: '欢迎加入 {plan}！',
    welcomeBody: '感谢你帮助森林成长。以下功能已为你解锁：',
    startExploring: '回到我的家谱',
    declined: '付款被拒',
    declinedBody: '未扣任何费用，你的套餐也没有变化。随时可以再试一次。',
    tryAgain: '再试一次',
    yearWord: '年',
    monthWord: '月',
    upgradeShort: '升级 Plus',
    upgradeHint: '查看套餐 — 更多空间、无广告',
    limitToast: '这已超出免费版的额度。',
    seePlans: '查看套餐',
    menu: {
      title: '升级 Plus',
      body: '十倍人物上限 · 无广告',
      billing: '套餐与账单'
    },
    panel: {
      title: '套餐与账单',
      desc: '你的套餐、续费与付款记录。',
      renewsOn: '{date} 续费',
      endsOn: '{date} 到期 — 不再续费',
      free: '免费版 — 未绑定付款方式。',
      guest: '创建账户后即可选择套餐。',
      change: '更换套餐',
      upgrade: '升级',
      cancel: '取消套餐',
      resume: '保留我的套餐',
      sandboxNote: '沙盒计费：此版本中的付款均为模拟。',
      history: '账单记录',
      date: '日期',
      number: '发票',
      item: '套餐',
      amount: '金额',
      status: '状态',
      inv: { paid: '已支付', failed: '失败' },
      noInvoices: '暂无付款记录。',
      cancelTitle: '确定取消套餐？',
      cancelBody: '在 {date} 前一切照常；之后账户会回到免费版，不会删除任何内容。',
      cancelConfirm: '取消套餐',
      keep: '继续保留',
      canceledToast: '你的套餐将不再续费。感谢你对森林的支持',
      resumedToast: '欢迎回来 — 套餐将照常续费。'
    }
  },
  ads: {
    label: '广告',
    houseSponsor: '来自 FamilyTree',
    remove: '去除广告',
    dismiss: '隐藏此广告',
    house: {
      goPlus: {
        title: '升级 Plus，告别广告',
        body: '无广告、十倍人物上限，外加支持者徽章——每月低至 $3。',
        cta: '了解 Plus'
      },
      room: {
        title: '容纳 25,000 位人物',
        body: '大王朝需要大家谱。Plus 让每个项目都有成长空间。',
        cta: '获取更多空间'
      },
      pro: {
        title: 'Pro：为王朝而生',
        body: '最高额度、抢先体验实验室，专业导出与 GEDCOM 陆续上线。',
        cta: '认识 Pro'
      },
      browse: {
        title: '漫游家谱森林',
        body: '探索动漫家族、王室贵胄与中国皇朝——还能嫁接到你的项目里。',
        cta: '浏览家谱'
      }
    }
  },
  browse: {
    button: '发现',
    buttonHint: '浏览社区分享的家谱',
    back: '返回',
    brand: '发现',
    eyebrow: '社区森林',
    title: '漫游家谱森林',
    subtitle:
      '其他创作者分享的家谱：动漫家族、王室贵胄、中国历代皇朝与情景喜剧一家人。随便逛逛、带一份回家，或者一起种一棵。',
    searchPh: '搜索家谱、人物、标签或 @创作者',
    try: '试试',
    surprise: '随便看看',
    mockNote: '预览版 — 在托管社区上线前，这些创作者和家谱均为示例。下载与嫁接是真实可用的。',
    ladderTitle: '别人的家谱，我能做什么？',
    ladderHint: '每位创作者决定访客能带走多少，每一级都包含之前所有权限。点击模式即可筛选。',
    modes: {
      glasshouse: {
        name: '温室',
        short: '仅浏览',
        desc: '隔着玻璃观赏：每根枝条都能细看，但什么也带不走。'
      },
      seedbank: {
        name: '种子库',
        short: '浏览·下载',
        desc: '把种子带回家：下载项目文件，收藏、研究或离线打开。'
      },
      graft: {
        name: '可嫁接',
        short: '复制到我的项目',
        desc: '嫁接到你自己的树上：复制进你的项目，从此归你所有。'
      },
      grove: {
        name: '共耕林',
        short: '一起编辑',
        desc: '共享的树林：以园丁身份加入，和创作者一起把它种大。'
      }
    },
    caps: { view: '浏览', export: '下载', fork: '嫁接', edit: '共同编辑' },
    capsYes: {
      view: '查看家谱、人物与关系',
      export: '保存项目文件',
      fork: '复制到你的项目',
      edit: '以园丁身份加入'
    },
    capsNo: { view: '', export: '留在温室里', fork: '创作者保留唯一副本', edit: '仅创作者可编辑' },
    genres: {
      all: '全部',
      anime: '动漫',
      tv: '影视剧',
      history: '王室贵胄',
      dynasty: '中国皇朝',
      sitcom: '情景喜剧',
      myth: '神话'
    },
    sizeLabel: '家谱规模',
    sizes: { any: '不限', cozy: '小家', clan: '家族', dynasty: '王朝' },
    sizesHint: { any: '不限人数', cozy: '最多 15 人', clan: '16–21 人', dynasty: '22 人以上' },
    langs: {
      any: '所有语言',
      en: 'English',
      'zh-Hans': '简体中文',
      'zh-Hant': '繁體中文',
      ja: '日本語'
    },
    sortLabel: '排序',
    sort: {
      forYou: '为你推荐',
      relevance: '最佳匹配',
      trending: '热门',
      loved: '最受喜爱',
      fresh: '最近更新',
      largest: '人数最多',
      deepest: '代数最多',
      ancient: '源远流长'
    },
    shelves: {
      forYou: '为你精选',
      forYouHint: '根据你的点赞、收藏、关注和浏览不断学习',
      collections: '专题合集',
      collectionsHint: '由官方园丁精心挑选',
      creators: '值得关注的创作者',
      creatorsHint: '种下这片森林的人',
      yours: '你在森林里的家谱',
      yoursHint: '访客眼中的你的公开项目',
      all: '全部家谱'
    },
    reasons: {
      because: '因为你喜欢《{title}》',
      creator: '来自你关注的 {name}',
      yours: '与你的“{word}”项目相关',
      lang: '你的语言',
      trending: '正在流行'
    },
    results: '{n} 个家谱',
    resultsFor: '“{q}” 找到 {n} 个家谱',
    clear: '清除筛选',
    emptyTitle: '这里还什么都没长出来…',
    emptyBody: '换个关键词，或放宽筛选条件试试。',
    yoursEmpty: '分享你的家谱',
    yoursManage: '管理分享',
    yoursPrivate: '{n} 个私密 — 在项目页中设为公开',
    badges: { staff: '官方精选', trending: '热门', new: '新作' },
    stats: { people: '人物', gens: '代', likes: '点赞', forks: '嫁接', views: '浏览' },
    card: { like: '点赞', unlike: '取消点赞', save: '稍后再看', unsave: '取消收藏', found: '找到' },
    activity: {
      grafted: '嫁接了',
      liked: '点赞了',
      joined: '加入了共耕林',
      downloaded: '下载了',
      commented: '评论了'
    },
    detail: {
      close: '关闭',
      updated: '{ago}更新',
      saved: '已收藏',
      zoomIn: '放大',
      zoomOut: '缩小',
      fit: '适应',
      zoomHint: '滚轮缩放 · 拖动平移 · 点击人物',
      legend: { parent: '亲子', spouse: '伴侣', rival: '对手', other: '其他关系' },
      bonds: '关系',
      noBonds: '暂无记录的关系。',
      cast: '人物',
      castPh: '查找人物…',
      access: '你可以在这里做什么',
      download: '下载项目文件',
      downloaded: '已保存 {file} — 随时可通过 项目菜单 → 导入 打开。',
      graft: '嫁接到我的项目',
      grafting: '嫁接中…',
      grafted: '“{name}”已嫁接到你的项目',
      graftFailed: '嫁接失败：{error}',
      openCopy: '打开我的副本',
      join: '以园丁身份加入',
      pending: '申请已发送，等待创作者通过…',
      member: '你已成为园丁',
      memberNote:
        '实时协作编辑将随托管社区上线。在此之前，可以先嫁接一份副本，并在评论区分享想法。',
      glassNote: '创作者把这棵树留在了温室里 — 想要一份的话，留言告诉 TA 吧。',
      facts: '趣味发现',
      comments: '评论',
      commentPh: '说点友善的话…',
      post: '发布',
      you: '你',
      similar: '你可能也会喜欢'
    },
    facts: {
      longest: '{name} 最长寿 — {n} 岁',
      children: '{name} 子女最多（{n} 位）',
      married: '{name} 结婚 {n} 次',
      connected: '{name} 关系最广 — {n} 条关系',
      rivals: '记录在案的对手关系 {n} 组',
      span: '横跨 {n} 年历史',
      gens: '共 {n} 代'
    },
    bonds: {
      parent_child: { fwd: '父母 →', back: '子女 ←' },
      adopted: { fwd: '养父母 →', back: '被收养 ←' },
      spouse: { fwd: '配偶', back: '配偶' },
      partner: { fwd: '伴侣', back: '伴侣' },
      sibling: { fwd: '兄弟姐妹', back: '兄弟姐妹' },
      friends: { fwd: '朋友', back: '朋友' },
      likes: { fwd: '暗恋', back: '被暗恋' },
      rival: { fwd: '对手', back: '对手' },
      mentor: { fwd: '师父 →', back: '弟子 ←' },
      subordinate: { fwd: '上级 →', back: '效力于' }
    },
    profile: {
      follow: '关注',
      following: '已关注',
      followers: '粉丝',
      followingN: '关注',
      trees: '家谱',
      likes: '获赞',
      theirTrees: 'TA 的家谱',
      joined: '{date} 加入',
      badges: { staff: '官方', historian: '史学家', otaku: '宅', critic: '评论家', pioneer: '先锋' }
    }
  },
  projectsPage: {
    title: '你的宇宙',
    subtitle: '你正在构建的每一个世界，都汇聚在这里。',
    back: '返回',
    new: '新建项目',
    quota: '{used} / {max} 个项目',
    stats: {
      projects: '项目',
      people: '人物',
      bonds: '关系',
      photos: '照片'
    },
    searchPh: '搜索项目…',
    filters: {
      all: '全部',
      favorites: '收藏',
      public: '公开',
      private: '私密'
    },
    sort: {
      updated: '最近更新',
      nameAsc: '名称 A–Z',
      nameDesc: '名称 Z–A',
      people: '人数最多',
      newest: '最新创建',
      oldest: '最早创建'
    },
    view: {
      grid: '网格视图',
      list: '列表视图'
    },
    live: '当前',
    open: '打开',
    favorite: '收藏',
    actions: '项目操作',
    noDesc: '还没有简介 — 可在 ⋯ → 编辑详情 中添加。',
    updated: '更新于 {date}',
    visibility: {
      private: '私密',
      public: '公开'
    },
    visibilityHint: '切换公开 / 私密',
    publicNote: '公开分享将随托管版本上线 — 你的选择会先保存下来。',
    menu: {
      open: '打开',
      rename: '重命名',
      edit: '编辑详情',
      duplicate: '创建副本',
      delete: '删除'
    },
    deleteTitle: '删除“{name}”？',
    deleteBody: '这将永久删除其中的 {persons} 位人物、{relationships} 条关系和 {images} 张照片。',
    deleteCancel: '保留',
    deleteConfirm: '永久删除',
    editTitle: '项目详情',
    editName: '名称',
    editDesc: '简介',
    editDescPh: '这个世界讲述了什么？',
    editColor: '卡片颜色',
    editVisibility: '可见性',
    editAccess: '访客可以',
    save: '保存',
    cancel: '取消',
    saved: '项目详情已保存',
    created: '项目已创建 — 正在网格中等你',
    duplicated: '已创建副本（照片保留在原项目中）',
    deleted: '项目已删除',
    emptyTitle: '没有匹配的项目',
    emptySub: '换个搜索词或筛选条件试试。'
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
      generic: '一次变更',
      layout_move: '一次移动',
      layout_curve: '一次连线调整',
      layout_style: '一次节点样式',
      layout_layout: '一次布局刷新'
    }
  },
  dialog: {
    confirm: '确认',
    cancel: '取消',
    ok: '好',
    delete: '删除',
    dismiss: '关闭',
    notice: '提示',
    areYouSure: '确定吗？',
    undo: '撤销',
    undoHint: '可以用 Ctrl+Z 撤销。'
  },
  confirm: {
    deletePerson: '删除 {name}？',
    deletePersonBody: '其关系、特征和标签会一并删除。',
    deletePeople: '删除 {count} 个人？',
    deletePeopleBody: '他们的所有关系会一并删除。',
    deleteSelection: '删除 {people} 个人和 {bonds} 条关系？',
    deleteBonds: '删除 {count} 条关系？',
    deleteBond: '删除这条“{kind}”关系？',
    deleteBondBetween: '{a} 与 {b} 之间的关系将被删除；两人都会保留。',
    deleteScene: '删除场景“{name}”？',
    deleteSceneBody: '只删除这个布局——人物和群组都会保留。',
    deleteSceneGroups: '其中 {count} 个群组摆放会一并删除——人物和群组都会保留。',
    deleteGroup: '删除群组“{name}”？',
    deleteGroupBody: '其 {count} 名成员仍保留在项目中。',
    deleteTrait: '删除特征“{name}”？',
    deleteTraitBody: '它在 {count} 个人身上的值也会被删除。',
    deleteRelType: '删除关系类型“{name}”？',
    deleteRelTypeBody: '此类型的 {count} 条关系也会被删除。',
    revert: '恢复到上一个存档？',
    revertBody: '上次保存之后的更改将被丢弃。',
    revertConfirm: '恢复',
    deleteLook: '删除此造型',
    deleteMap: '删除此地图'
  },
  toasts: {
    deletedPerson: '已删除 {name}',
    deletedPeople: '已删除 {count} 个人',
    deletedBond: '已删除关系',
    deletedSelection: '已删除所选内容',
    deleted: '已删除',
    saved: '存档已保存',
    reverted: '已恢复到上一个存档',
    exported: '项目已导出 — {file}',
    imported: '已将“{name}”导入为新项目',
    importFailed: '导入失败：{error}',
    importPhotos: '项目文件不包含照片。',
    accent: '强调色已更新'
  },
  fingerprint: {
    title: '家族指纹',
    menu: '家族指纹',
    open: '查看家族指纹',
    ariaOf: '{name}的家族指纹',
    close: '关闭',
    subtitle: '一枚由这棵树的结构绘成的徽记。它为本项目独有，并随家族成长而重新绘制。',
    partial: '仅根据数量绘制——此处无法获取完整结构。',
    downloadPng: '下载 PNG',
    downloadSvg: '下载 SVG',
    saved: '已保存 {name}',
    failed: '无法生成图片',
    living: '同一棵树，同一枚徽记：添加一个人，它只会轻轻变化。',
    legend: {
      rings: {
        label: '环',
        text: '每一代一环，每颗珠代表其中一人（{n} 代，{m} 人）'
      },
      petals: {
        label: '花瓣',
        text: '每个家庭一片，在星形的每个尖角重复，从父母所在的环生出（{n} 个家庭）'
      },
      shape: {
        label: '花瓣形状',
        text: '越长表示每个家庭的子女越多（平均 {n}）；越尖表示家庭规模越不均'
      },
      symmetry: {
        label: '星形',
        text: '每条始祖支系一个尖角，至少三个（{m} 条始祖支系）'
      },
      rosette: {
        label: '玫瑰花饰',
        text: '交织的圆代表夫妻，菱形代表再婚（{n} 对夫妻，{m} 人再婚）'
      },
      core: {
        label: '核心',
        text: '按性别比例分割（{n}% / {m}%）'
      },
      threads: {
        label: '丝线',
        text: '友谊、竞争及其他社会关系（{n}）'
      },
      halo: {
        label: '光环',
        text: '跨越的每个十年一颗珠，世纪处为大珠（{n} 个十年）'
      },
      satellites: {
        label: '卫星',
        text: '未与主树相连的群体；火花代表没有任何关系的人（{n} 个群体，{m} 人独处）'
      },
      tints: {
        label: '颜色',
        text: '花瓣采用最常用的标签颜色（{m} 个标签中的 {n} 个）'
      }
    }
  },
  projectMenu: {
    button: '项目',
    unsavedDot: '有未保存的更改',
    save: '保存',
    saveHint: '提交一个可以恢复的存档（Ctrl+S）',
    unsaved: '未保存',
    revert: '恢复到已保存',
    revertHint: '恢复上一个存档保存的布局',
    exportJson: '导出项目文件',
    exportHint: '将整个项目（人物、特征、关系、群组、场景、地图）下载为 JSON',
    importJson: '导入项目文件',
    importHint: '将本应用导出的项目文件作为新项目打开',
    present: '当前',
    presentPh: '输入年份…',
    presentReset: '重置为数据中的最新年份',
    presentAuto: '自动 · 数据中的最新年份',
    stats: '统计',
    members: '成员',
    relationships: '关系',
    couples: '夫妻',
    generations: '代数',
    generationsHint: '此项目中最长的父母 → 子女世系'
  },
  mode: {
    simple: '简易',
    standard: '标准',
    advanced: '高级'
  },
  rail: {
    views: '视图',
    graph: '关系图',
    directory: '名录',
    relationships: '关系',
    timeline: '时间线',
    groups: '分组',
    character: '角色',
    map: '地图',
    addPerson: '添加成员',
    style: '样式'
  },
  map: {
    time: {
      play: '播放时间 (P)',
      pause: '暂停 (P)',
      prevEvent: '上一个时刻',
      nextEvent: '下一个时刻',
      stepBack: '后退一年 ([)',
      stepFwd: '前进一年 (])',
      typeYear: '输入年份以跳转',
      year: '年份',
      speed: '播放速度'
    },
    groups: {
      select: '选择',
      terrain: '地形',
      realm: '疆域',
      lines: '路线与线条',
      places: '地点',
      events: '事件',
      text: '文字'
    },
    tools: {
      select: '选择与移动',
      pan: '平移',
      measure: '测距',
      erase: '橡皮擦',
      land: '陆地',
      water: '水域 / 湖泊',
      forest: '森林',
      mountains: '山脉',
      hills: '丘陵',
      grass: '草原',
      desert: '沙漠',
      swamp: '沼泽',
      snow: '冰雪',
      territory: '王国 / 势力',
      river: '河流',
      road: '道路',
      rail: '铁路',
      searoute: '海路',
      wall: '城墙',
      border: '边界',
      place_capital: '首都',
      place_city: '城市',
      place_town: '城镇',
      place_village: '村庄',
      place_castle: '城堡',
      place_port: '港口',
      place_temple: '寺庙',
      place_tower: '塔楼',
      place_ruin: '遗迹',
      place_cave: '洞穴',
      place_camp: '营地',
      place_mine: '矿场',
      place_station: '车站',
      place_landmark: '地标',
      event_battle: '战役',
      event_fire: '灾难',
      event_crown: '加冕',
      event_heart: '相遇',
      event_skull: '死亡',
      event_star: '发现',
      event_flag: '建立',
      arrow: '行军箭头',
      zone: '事件区域',
      label: '标签'
    },
    kinds: {
      land: '陆地',
      water: '水域',
      forest: '森林',
      mountains: '山脉',
      hills: '丘陵',
      desert: '沙漠',
      grass: '草原',
      swamp: '沼泽',
      snow: '冰雪',
      territory: '王国 / 势力',
      zone: '事件区域',
      river: '河流',
      road: '道路',
      rail: '铁路',
      wall: '城墙',
      border: '边界',
      searoute: '海路',
      arrow: '行军箭头',
      place: '地点',
      label: '标签',
      event: '事件'
    },
    people: {
      toggle: '人物 — 将他们放到地图上 (G)',
      title: '放置{noun}',
      search: '搜索…',
      hint: '把人物拖到地图上，或点击将其放在中央。',
      autoPlace: '按「所在地」放置 {n} 人',
      flyTo: '已在地图上 — 点击飞过去',
      dragOrTap: '拖到地图上，或点击放置',
      none: '没有匹配的人。',
      unnamed: '未命名'
    },
    inspector: {
      namePh: '起个名字…',
      length: '长度 {d}',
      area: '面积 {a} · 周长 {d}',
      close: '关闭',
      type: '类型',
      icon: '图标',
      group: '分组',
      noGroup: '— 未关联 —',
      groupHint: '关联一个分组后，疆域会使用它的颜色；若没有名字也会沿用分组名。',
      color: '颜色',
      styleColor: '风格默认',
      custom: '自定义颜色',
      size: '大小',
      rotate: '旋转',
      when: '存在时间',
      from: '起',
      to: '止',
      always: '始终',
      fromNow: '自 {y} 年',
      untilNow: '至 {y} 年',
      whenHint: '留空则在任何时间都显示。时间轴播放时会淡入淡出。',
      notes: '备注',
      notesPh: '传说、历史、谁住在这里…',
      duplicate: '复制 (Ctrl+D)',
      front: '移到最前',
      back: '移到最后',
      newEra: '自 {y} 年开启新时代',
      newEraHint: '在前一年结束当前版本，并创建一个可编辑的副本 — 适合变动的边界或重建的道路。',
      delete: '删除 (Del)',
      onMap: '在地图上',
      journey: '行程',
      stopNotePh: '这里发生了什么？',
      goTo: '前往此站',
      removeStop: '移除此站',
      journeyHint:
        '把时间轴移到另一年，再拖动人物头像 — 每次拖动都会记录一站。按住 Alt 拖动可整体移动行程。',
      follow: '跟随',
      following: '跟随中',
      profile: '资料',
      removeFromMap: '从地图移除'
    },
    new: {
      kickerFirst: '地图视图',
      kicker: '新地图',
      titleFirst: '绘制你的人物所生活的世界',
      title: '新建地图',
      sub: '绘制陆地、疆域、河流与道路，再放置人物，看他们穿越时间旅行。',
      start: '起点',
      starts: {
        generate: '生成一个世界',
        ocean: '广阔海洋',
        land: '广袤陆地'
      },
      startsBlurb: {
        generate: '一片拥有王国、城市、道路和铁路的大陆 — 全部可编辑。',
        ocean: '一片空旷的海。自己绘制海岸线。',
        land: '一片实地。绘制湖泊、海洋与一切。'
      },
      shapes: {
        landscape: '横向',
        wide: '宽幅',
        square: '方形',
        portrait: '纵向'
      },
      reroll: '重新生成',
      style: '选择风格 — 随时可以切换',
      namePh: '为地图命名（如「已知世界」）',
      create: '创建地图',
      defaultName: '已知世界'
    },
    styles: {
      parchment: '羊皮纸',
      fantasy: '奇幻',
      ink: '水墨',
      shanshui: '山水',
      qinglu: '青绿',
      hightech: '科技',
      atlas: '地图集'
    },
    stylesBlurb: {
      parchment: '探险家的褐墨海图。',
      fantasy: '云雾飘动的童话地图集。',
      ink: '宣纸上的中国水墨。',
      shanshui: '装裱成卷的宋人水墨山水。',
      qinglu: '王希孟笔下的青绿山水，设色于绢。',
      hightech: '全息战术显示屏。',
      atlas: '简洁现代的政区图。'
    },
    menu: {
      yourMaps: '你的地图',
      rename: '重命名',
      new: '新建地图…',
      duplicate: '复制地图',
      delete: '删除地图',
      style: '风格',
      ground: '未绘制的区域是…',
      groundSea: '海洋',
      groundLand: '陆地',
      export: '导出为 PNG',
      copyName: '{name}（副本）',
      confirmDelete: '删除地图「{name}」？此操作无法撤销。'
    },
    toast: {
      created: '{name} 已就绪',
      undo: '已撤销',
      minPoints: '无法删除——形状至少保留 3 个角，线条至少 2 个点',
      copied: '已复制 {name}——按 Ctrl+V 可粘贴到任意地图',
      nothingToPaste: '还没有复制任何内容——先选中一项再按 Ctrl+C',
      layerShown: '已重新显示“{layer}”图层',
      exportFailed: '无法生成图片——请改为导出当前视图',
      redo: '已重做',
      nothingToUndo: '没有可撤销的操作',
      nothingToRedo: '没有可重做的操作',
      deleted: '已删除 — 按 Ctrl+Z 可恢复',
      forkTooEarly: '请先把时间轴移到它的起始年份之后',
      forked: '自 {y} 年的新时代 — 可以自由调整',
      autoPlaced: '已按所在地放置 {n} 人',
      noLater: '此地图上没有更晚的时刻',
      noEarlier: '此地图上没有更早的时刻',
      firstJourney: '行程开始 — 按“播放”观看',
      tooSmall: '太小了 — 请画大一点',
      exported: '地图已保存为 PNG'
    },
    zoom: {
      in: '放大 (+)',
      undo: '撤销 (Ctrl+Z)',
      redo: '重做 (Ctrl+X)',
      out: '缩小 (−)',
      fit: '显示整张地图 (0)'
    },
    hover: {
      stops: '行程共 {n} 站',
      dragHint: '拖动以移动 · 双击查看资料'
    },
    defaults: {
      label: '标签'
    },
    find: {
      title: '在此地图中查找 (Ctrl+F)',
      placeholder: '查找地点、国度或人物…',
      none: '此地图上没有这个名字。',
      empty: '还没有命名的内容——给地点和国度起名后会显示在这里。',
      foot: '↑ ↓ 选择 · Enter 飞往',
      person: '在地图上'
    },
    layers: {
      title: '图层',
      terrain: '地形',
      realms: '国度',
      routes: '路线与线条',
      places: '地点',
      events: '事件',
      text: '标注',
      people: '人物',
      journeys: '旅程',
      names: '名称',
      snap: '吸附到地点和角点',
      snapHint: '绘制的线条和形状会吸附到附近的地点和角点。按住 Alt 可自由绘制。',
      showAll: '全部显示'
    },
    export: {
      sheet: '整张地图',
      sheetHint: '{y} 年时的完整图纸',
      view: '当前视图',
      viewHint: '与屏幕所见一致，2 倍清晰度'
    },
    keys: {
      title: '键盘快捷键',
      tools: '工具',
      edit: '编辑',
      view: '视图与时间',
      undo: '撤销',
      redo: '重做',
      copy: '复制',
      paste: '粘贴到指针处',
      duplicate: '创建副本',
      delete: '删除所选',
      nudge: '微移（Shift = 10 倍）',
      finish: '完成线条或测量',
      cancel: '取消 / 取消选择',
      removePoint: '删除角点',
      noSnap: '不吸附绘制（按住）',
      pan: '平移',
      zoom: '放大 / 缩小',
      fit: '显示整张地图',
      find: '查找',
      people: '人物抽屉',
      play: '播放 / 暂停时间',
      step: '后退 / 前进一年',
      sheet: '本快捷键表'
    },
    units: {
      league: '{n} 里格',
      league2: '{n} 平方里格',
      li: '{n} 里',
      li2: '{n} 平方里',
      km: '{n} 公里',
      km2: '{n} 平方公里'
    },
    ctx: {
      deletePoint: '删除此角点',
      rename: '重命名',
      duplicate: '创建副本',
      copy: '复制',
      delete: '删除',
      pasteHere: '粘贴到这里',
      labelHere: '在此添加标注',
      measureFrom: '从这里测量'
    },
    hint: {
      select: '点击选择 · 拖动移动 · 拖动空白处平移 · 滚轮缩放 · 双击陆地或海洋进行编辑',
      pan: '拖动平移 · 滚轮缩放',
      measure: '点击开始测量 · 继续点击可测量路线 · 双击或按 Enter 结束',
      measuring: '目前 {d} · 点击添加停靠点 · 双击或按 Enter 结束 · Esc 清除',
      measured: '总计 {d} · 点击重新测量 · Esc 清除',
      shape: '拖动方块可移动角点 · 拖动边上的圆点可添加角点 · Alt+点击角点可将其删除',
      erase: '点击或拖过要擦除的内容',
      area: '{name}：拖动绘制形状 — 或逐点点击后按 Enter',
      line: '{name}：拖动绘制 — 或逐点点击后双击结束',
      point: '点击放置{name}',
      clickMode: '点击添加点 · Enter 或双击结束 · Backspace 删除一点 · Esc 取消',
      token: '拖动{name}以记录其在 {y} 年的位置 · 按住 Alt 拖动整体移动行程'
    }
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
    newLookTitle: '新的形象',
    chooseStyle: '选择一种画风 — 随时可以切换。',
    startRandom: '从随机形象开始',
    startInherit: '继承父母的样貌',
    emptyHint: '用可更换的部件搭建肖像 — 挑选部件、改颜色和大小，然后设为其在整个应用中的头像。',
    noPersons: '请先添加一位成员，然后回来为 TA 画像。',
    randomize: '随机生成',
    mirror: '镜像',
    undo: '撤销',
    redo: '重做',
    zoomIn: '放大',
    zoomOut: '缩小',
    setPortrait: '设为肖像',
    portraitSet: '肖像已在各处更新',
    portraitBadge: '此形象是当前肖像',
    none: '无',
    size: '大小',
    colors: '颜色',
    body: '身体',
    height: '身高',
    build: '体型',
    headSize: '头部',
    age: '年龄',
    ageStages: {
      child: '儿童',
      teen: '少年',
      adult: '成年',
      middle: '中年',
      elder: '老年'
    },
    resetHint: '双击滑块可重置。',
    ages: '年龄段',
    ageHint: '可选：将此形象绑定到一个年龄段，例如年轻与年老各一张肖像。',
    ageFrom: '从',
    ageTo: '到',
    flipPart: '翻转此部件',
    lockHint: '锁定 — 随机时保留',
    customColor: '自定义颜色',
    presets: '配色方案',
    applyPreset: '应用此配色',
    harmony: '服装配色',
    harmonyHint: '以上装颜色为基础重新搭配服装颜色。',
    harmonies: {
      complementary: '互补色',
      analogous: '邻近色',
      triad: '三角色',
      mono: '单色'
    },
    groupColors: '穿上群组颜色',
    groupColorsHint: '用 TA 所属群组的颜色打扮。',
    fxToggle: '环境动画与粒子',
    tabs: {
      parts: '部件',
      colors: '颜色',
      body: '身体',
      genes: '基因'
    },
    groups: {
      face: '面部',
      hair: '头发',
      outfit: '服装',
      extras: '其他'
    },
    cams: {
      auto: '自动',
      full: '全身',
      portrait: '半身',
      face: '脸部'
    },
    backdrops: {
      studio: '影棚',
      sunset: '日落',
      night: '星夜',
      sakura: '樱花',
      forest: '萤火森林',
      arcade: '街机',
      paper: '纸张',
      none: '纯色'
    },
    expr: {
      neutral: '平静',
      happy: '开心',
      laugh: '大笑',
      surprised: '惊讶',
      angry: '生气',
      sad: '难过',
      smug: '得意',
      shy: '害羞'
    },
    styleNames: {
      anime: '动漫',
      realistic: '写实',
      simple: '简约',
      cartoon: '卡通',
      human3d: '写实 3D'
    },
    styleBlurbs: {
      anime: '赛璐珞上色、闪亮大眼，抽卡游戏主角风。',
      realistic: '绘画般的光影与自然比例。',
      simple: '扁平、几何、亲切 — 纯粹的形状。',
      cartoon: '粗描边与开朗的大头。',
      human3d: '可自由捏塑的 3D 真人 — 数百个脸部与身体滑杆、发丝级头发、服装、姿势与影棚灯光。'
    },
    new3d: '全新 · 写实 3D 捏人',
    inherit: '继承父母的样貌',
    resemblance: '相似度',
    rollChild: '生成家族面孔',
    inherited: '有家族相似感的面孔',
    noParents: '此成员尚未关联父母。',
    parentsNoLooks: '请先为 TA 的父母创建形象 — 然后才能遗传特征。',
    genePool: '基因池',
    genePoolHint: '混合本项目中两个随机形象，让新面孔属于这个世界。',
    rollGenePool: '从基因池生成',
    dna: '角色代码',
    dnaHint: '将此形象复制为代码，或粘贴代码在此载入。',
    copyDna: '复制代码',
    pasteDna: '粘贴代码…',
    apply: '应用',
    dnaCopied: '代码已复制',
    dnaShown: '代码已放入输入框 — 请从那里复制',
    dnaApplied: '形象已载入',
    dnaBad: '这不是有效的角色代码',
    export: '导出',
    photo: {
      open: '拍照模式',
      portrait: '半身',
      full: '全身',
      download: '下载卡片',
      setFramed: '用作带背景的肖像',
      close: '关闭'
    },
    slots: {
      back: '背部',
      head: '脸型',
      hair: '发型',
      eyes: '眼睛',
      brows: '眉毛',
      nose: '鼻子',
      mouth: '嘴巴',
      facialHair: '胡须',
      marks: '印记',
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
      desc: '在深色、浅色、水墨画与中世纪泥金手抄本界面之间切换。',
      light: '浅色',
      dark: '深色',
      ink: '水墨',
      medieval: '中世纪'
    },
    accent: {
      title: '强调色',
      desc: '为整个应用的按钮、高亮和选中状态着色。',
      inkNote: '水墨主题始终使用朱砂印泥红。',
      medievalNote: '中世纪主题始终以青金石蓝与金箔装饰。',
      custom: '自定义颜色',
      reset: '恢复默认',
      presets: {
        periwinkle: '长春花蓝',
        violet: '紫罗兰',
        rose: '玫瑰',
        coral: '珊瑚',
        amber: '琥珀',
        emerald: '翡翠',
        teal: '青绿',
        sky: '天蓝'
      }
    },
    programMode: {
      title: '程序模式',
      desc: '控制显示多少功能。简易模式保持界面精简；高级模式解锁所有工具。'
    },
    noun: {
      title: '成员的称呼',
      desc: '此项目对条目的称呼——人物、角色、船舰、家族……仅应用于此项目。',
      placeholder: '人物'
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
        { keys: 'Ctrl / ⌘ + Z', desc: '撤销上一次数据编辑' },
        { keys: 'Ctrl / ⌘ + X · Ctrl + Y · Ctrl + Shift + Z', desc: '重做' },
        { keys: 'Alt + 1 … 7', desc: '切换视图（关系图、名录、关系……）' },
        { keys: 'Alt + N', desc: '添加人物' },
        { keys: '按住 Tab', desc: '关系图操作轮盘' },
        { keys: 'Shift + 点击两个人', desc: '追踪两人之间的联系' },
        { keys: '?', desc: '显示此帮助' },
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
    privacy: '你的数据保存在本地设备上 — 本地使用无需账户。',
    copyright: '{holder} — 保留所有权利。'
  },
  // The 3D character creator (Character view, 3D style)
  human3d: {
    categories: '分类',
    loading: '正在塑造你的角色…',
    loadFailed: '无法加载 3D 模型。',
    camera: '镜头',
    lighting: '灯光',
    dragToSculpt: '拖动以塑形 · 点击以编辑',
    handleDepthHint: '转到侧面可拖动深度',
    handle: {
      crown: '头顶',
      headSide: '头侧',
      forehead: '额头',
      temple: '太阳穴',
      brow: '眉毛',
      browTail: '眉尾',
      eyeInner: '内眼角',
      eyeOuter: '外眼角',
      lid: '上眼睑',
      noseBridge: '鼻梁',
      noseTip: '鼻尖',
      noseWing: '鼻翼',
      cheekbone: '颧骨',
      cheek: '脸颊',
      upperLip: '上唇',
      lowerLip: '下唇',
      mouthCorner: '嘴角',
      chin: '下巴',
      chinSide: '下巴侧',
      jawCorner: '下颌角',
      ear: '耳朵',
      neck: '脖子',
      shoulder: '肩膀',
      bust: '胸部',
      waist: '腰部',
      belly: '腹部',
      hip: '胯部',
      glutes: '臀部',
      upperArm: '上臂',
      thigh: '大腿',
      calf: '小腿'
    },
    clickToEdit: '点击编辑',
    expression: '表情',
    undo: '撤销',
    redo: '重做',
    randomizeAll: '全部随机',
    sculptMode: '捏脸模式：直接拖动脸部特征',
    turntable: '自动旋转',
    gaze: '注视镜头',
    photo: '保存照片',
    setPortrait: '设为头像',
    searchSliders: '搜索滑块…',
    asymmetry: '左右分别调整',
    resetGroup: '重置此组',
    randomizeGroup: '随机此组',
    archetypes: '原型',
    family: '家族相似度',
    familyHint: '根据父母的 3D 外观混合出这张脸。',
    resemblance: '相似度',
    end: {
      'Wild card': '随机',
      'Spitting image': '酷似',
      Narrow: '窄',
      Wide: '宽',
      Smaller: '小',
      Bigger: '大',
      Less: '少',
      More: '多',
      Younger: '年轻',
      Older: '年长',
      In: '内',
      Out: '外',
      Down: '下',
      Up: '上',
      Back: '后',
      Forward: '前',
      Low: '低',
      High: '高',
      Hollow: '凹陷',
      Full: '饱满',
      Close: '近',
      Apart: '远',
      Open: '开',
      Short: '短',
      Long: '长',
      Flat: '平',
      Prominent: '突出',
      Concave: '凹',
      Convex: '凸',
      Pinched: '收紧',
      Relaxed: '放松',
      Thin: '瘦',
      Soft: '柔',
      Receding: '后缩',
      Strong: '硬朗',
      Pointed: '尖',
      Triangle: '三角',
      Square: '方',
      Round: '圆',
      Thick: '粗',
      Slim: '细',
      Slender: '纤细',
      Spread: '张开',
      Bowed: 'O 型',
      Knock: 'X 型',
      Female: '女',
      Male: '男',
      Tall: '高',
      Heavy: '胖',
      Athletic: '健硕',
      Uncommon: '独特',
      Ideal: '理想',
      Small: '小',
      Firm: '挺',
      Straight: '直',
      Coily: '卷',
      Left: '左',
      Right: '右',
      Petite: '矮'
    },
    rollChild: '随机生成家族脸',
    noParents3d: '先为此人的父母设定 3D 外观，才能继承他们的特征。',
    randomize: '随机',
    randomizeHint: '锁定的部分在随机时会保持原样。',
    reset: '重新开始',
    resetFace: '中性脸',
    resetAll: '默认人物',
    heritage: '血统混合',
    heritageHint: '影响脸型与体型；三者之和始终为 100%。',
    left: '左',
    right: '右',
    noMatches: '没有匹配的滑块。',
    skinTone: '肤色',
    style: '款式',
    fringeTitle: '刘海',
    hairColor: '发色',
    ombre: '渐变发梢',
    highlights: '挑染',
    brows: {
      thickness: '粗细',
      density: '浓密度',
      arch: '弧度'
    },
    beard: {
      length: '长度',
      density: '浓密度',
      stubble: '胡茬',
      none: '无胡须',
      'short-beard': '短胡',
      'full-beard': '络腮胡',
      goatee: '山羊胡',
      'van-dyke': '范戴克胡',
      mustache: '小胡子',
      chevron: '一字胡',
      handlebar: '翘角胡',
      'chin-strap': '下颌线胡',
      mutton: '连鬓胡'
    },
    iris: '虹膜',
    irisRing: '外环',
    hetero: '右眼异色（异色瞳）',
    mainColor: '主色',
    secondColor: '副色',
    patternTitle: '图案',
    metal: '金属与饰边',
    poseTitle: '姿势',
    qualityTitle: '渲染质量',
    qualityHint: '高画质会开启环境光遮蔽、4× 抗锯齿和完整发量。',
    photoPortrait: '肖像',
    photoFull: '全身',
    photoView: '当前视角',
    transparent: '透明背景',
    credits: '关于此模型',
    creditsText:
      '人体基础网格、变形目标与骨骼绑定来自 MakeHuman（CC0）。头发、皮肤、眼睛和服装均为程序化生成。',
    group: {
      shape: '比例',
      head: '头型',
      forehead: '额头',
      eyes: '眼睛',
      nose: '鼻子',
      mouth: '嘴唇',
      cheeks: '脸颊',
      jaw: '下颌与下巴',
      ears: '耳朵',
      neck: '颈部',
      torso: '躯干',
      hips: '臀部',
      arms: '手臂与手',
      legs: '腿与脚'
    },
    sub: {
      hair: '发型',
      brows: '眉毛',
      beard: '胡须',
      top: '上装',
      bottom: '下装',
      shoes: '鞋子',
      acc: '配饰'
    },
    years: '岁',
    slider: {
      'head-oval': '椭圆',
      'head-round': '圆形',
      'head-rectangular': '长方',
      'head-square': '方形',
      'head-triangular': '三角',
      'head-invertedtriangular': '倒三角',
      'head-diamond': '菱形',
      'head-scale-horiz-decr-incr': '宽度',
      'head-scale-vert-decr-incr': '高度',
      'head-scale-depth-decr-incr': '深度',
      'head-back-scale-depth-decr-incr': '后脑',
      'head-fat-decr-incr': '饱满度',
      'head-age-decr-incr': '面部年龄',
      'head-angle-in-out': '倾斜',
      'head-trans-down-up': '头部高度',
      'head-trans-backward-forward': '头部前后',
      'head-trans-in-out': '头部左右',
      'forehead-scale-vert-decr-incr': '高度',
      'forehead-trans-backward-forward': '倾斜度',
      'forehead-nubian-decr-incr': '额头隆起',
      'forehead-temple-decr-incr': '太阳穴',
      'eyebrows-trans-down-up': '眉毛高度',
      'eyebrows-trans-backward-forward': '眉骨',
      'eyebrows-angle-down-up': '眉毛角度',
      'eye-scale-decr-incr': '大小',
      'eye-trans-in-out': '眼距',
      'eye-trans-down-up': '高度',
      'eye-height1-decr-incr': '内侧开度',
      'eye-height2-decr-incr': '中部开度',
      'eye-height3-decr-incr': '外侧开度',
      'eye-corner1-down-up': '外眼角（倾斜）',
      'eye-corner2-down-up': '内眼角',
      'eye-push1-in-out': '内侧深度',
      'eye-push2-in-out': '外侧深度',
      'eye-epicanthus-in-out': '内眦赘皮',
      'eye-eyefold-down-up': '眼皮褶',
      'eye-eyefold-concave-convex': '眼皮饱满度',
      'eye-eyefold-angle-down-up': '眼皮角度',
      'eye-bag-decr-incr': '眼袋',
      'eye-bag-height-decr-incr': '眼袋高度',
      'eye-bag-in-out': '眼袋深度',
      'nose-scale-vert-decr-incr': '长度',
      'nose-scale-horiz-decr-incr': '宽度',
      'nose-scale-depth-decr-incr': '挺度',
      'nose-trans-down-up': '高度',
      'nose-trans-backward-forward': '深度',
      'nose-trans-in-out': '左右位置',
      'nose-width1-decr-incr': '鼻梁宽度',
      'nose-width2-decr-incr': '中段宽度',
      'nose-width3-decr-incr': '鼻底宽度',
      'nose-hump-decr-incr': '驼峰',
      'nose-curve-concave-convex': '侧面弧度',
      'nose-greek-decr-incr': '希腊鼻线',
      'nose-point-width-decr-incr': '鼻尖宽度',
      'nose-point-down-up': '鼻尖角度',
      'nose-volume-decr-incr': '体积',
      'nose-nostrils-width-decr-incr': '鼻孔宽度',
      'nose-nostrils-angle-down-up': '鼻孔角度',
      'nose-flaring-decr-incr': '鼻翼张开',
      'nose-base-down-up': '鼻底',
      'nose-septumangle-decr-incr': '鼻中隔角度',
      'nose-compression-compress-uncompress': '压缩',
      'mouth-scale-horiz-decr-incr': '宽度',
      'mouth-scale-vert-decr-incr': '高度',
      'mouth-scale-depth-decr-incr': '深度',
      'mouth-trans-down-up': '位置',
      'mouth-trans-backward-forward': '突出度',
      'mouth-trans-in-out': '左右位置',
      'mouth-upperlip-volume-decr-incr': '上唇厚度',
      'mouth-lowerlip-volume-decr-incr': '下唇厚度',
      'mouth-upperlip-height-decr-incr': '上唇高度',
      'mouth-lowerlip-height-decr-incr': '下唇高度',
      'mouth-upperlip-width-decr-incr': '上唇宽度',
      'mouth-lowerlip-width-decr-incr': '下唇宽度',
      'mouth-upperlip-middle-down-up': '上唇中部',
      'mouth-lowerlip-middle-down-up': '下唇中部',
      'mouth-upperlip-ext-down-up': '上唇两端',
      'mouth-lowerlip-ext-down-up': '下唇两端',
      'mouth-cupidsbow-decr-incr': '唇峰',
      'mouth-cupidsbow-width-decr-incr': '唇峰宽度',
      'mouth-angles-down-up': '嘴角',
      'mouth-philtrum-volume-decr-incr': '人中',
      'mouth-dimples-in-out': '酒窝',
      'mouth-laugh-lines-in-out': '法令纹',
      'cheek-bones-decr-incr': '颧骨',
      'cheek-volume-decr-incr': '饱满度',
      'cheek-inner-decr-incr': '内颊',
      'cheek-trans-down-up': '高度',
      'chin-width-decr-incr': '下巴宽度',
      'chin-height-decr-incr': '下巴高度',
      'chin-prominent-decr-incr': '下巴突出度',
      'chin-cleft-decr-incr': '下巴沟',
      'chin-jaw-drop-decr-incr': '下颌深度',
      'chin-bones-decr-incr': '下颌宽度',
      'chin-prognathism-decr-incr': '地包天',
      'ear-scale-decr-incr': '大小',
      'ear-scale-vert-decr-incr': '高度',
      'ear-scale-depth-decr-incr': '深度',
      'ear-trans-down-up': '位置',
      'ear-trans-backward-forward': '前后',
      'ear-rot-backward-forward': '旋转',
      'ear-lobe-decr-incr': '耳垂',
      'ear-shape-pointed-triangle': '尖 ↔ 三角',
      'ear-shape-square-round': '方 ↔ 圆',
      'ear-wing-decr-incr': '招风耳',
      'ear-flap-decr-incr': '耳廓',
      'neck-scale-horiz-decr-incr': '宽度',
      'neck-scale-depth-decr-incr': '深度',
      'neck-scale-vert-decr-incr': '长度',
      'neck-double-decr-incr': '双下巴',
      'neck-back-scale-depth-decr-incr': '后颈',
      'neck-trans-backward-forward': '前后',
      'neck-trans-down-up': '高度',
      'measure-neck-circ-decr-incr': '粗细',
      'measure-shoulder-dist-decr-incr': '肩宽',
      'torso-vshape-decr-incr': 'V 形',
      'torso-scale-horiz-decr-incr': '躯干宽度',
      'torso-scale-depth-decr-incr': '躯干厚度',
      'torso-scale-vert-decr-incr': '躯干长度',
      'measure-napetowaist-dist-decr-incr': '背长',
      'torso-muscle-pectoral-decr-incr': '胸肌',
      'torso-muscle-dorsi-decr-incr': '背阔肌',
      'measure-bust-circ-decr-incr': '胸围',
      'measure-underbust-circ-decr-incr': '下胸围',
      'measure-frontchest-dist-decr-incr': '胸宽',
      'breast-dist-decr-incr': '胸距',
      'breast-point-decr-incr': '胸型',
      'breast-trans-down-up': '胸部高度',
      'breast-volume-vert-down-up': '胸部上提',
      'measure-waist-circ-decr-incr': '腰围',
      'stomach-pregnant-decr-incr': '腹部',
      'stomach-tone-decr-incr': '腹部紧实',
      'stomach-navel-down-up': '肚脐高度',
      'measure-hips-circ-decr-incr': '臀围',
      'hip-scale-horiz-decr-incr': '髋宽',
      'hip-scale-depth-decr-incr': '髋部厚度',
      'hip-scale-vert-decr-incr': '髋部高度',
      'hip-waist-down-up': '腰线',
      'measure-waisttohip-dist-decr-incr': '腰臀距离',
      'buttocks-volume-decr-incr': '臀部',
      'hip-trans-backward-forward': '骨盆倾斜',
      'measure-upperarm-length-decr-incr': '上臂长度',
      'measure-lowerarm-length-decr-incr': '前臂长度',
      'measure-upperarm-circ-decr-incr': '上臂围度',
      'upperarm-muscle-decr-incr': '二头肌',
      'upperarm-shoulder-muscle-decr-incr': '三角肌',
      'upperarm-fat-decr-incr': '上臂赘肉',
      'lowerarm-muscle-decr-incr': '前臂肌肉',
      'lowerarm-fat-decr-incr': '前臂赘肉',
      'measure-wrist-circ-decr-incr': '手腕',
      'hand-scale-decr-incr': '手掌大小',
      'hand-fingers-length-decr-incr': '手指长度',
      'hand-fingers-diameter-decr-incr': '手指粗细',
      'hand-fingers-distance-decr-incr': '手指间距',
      'upperlegs-height-decr-incr': '大腿长度',
      'lowerlegs-height-decr-incr': '小腿长度',
      'measure-thigh-circ-decr-incr': '大腿围',
      'upperleg-muscle-decr-incr': '股四头肌',
      'upperleg-fat-decr-incr': '大腿赘肉',
      'measure-knee-circ-decr-incr': '膝盖',
      'measure-calf-circ-decr-incr': '小腿围',
      'lowerleg-muscle-decr-incr': '小腿肌肉',
      'measure-ankle-circ-decr-incr': '脚踝',
      'leg-valgus-decr-incr': '膝盖角度',
      'foot-scale-decr-incr': '脚掌大小'
    },
    macro: {
      gender: '性别',
      age: '年龄',
      height: '身高',
      weight: '体重',
      muscle: '肌肉',
      proportions: '比例',
      breastSize: '胸部',
      breastFirmness: '胸部挺度',
      ideal: '美化'
    },
    anc: {
      african: '非洲',
      asian: '东亚',
      caucasian: '欧洲'
    },
    cat: {
      presets: '预设',
      body: '体型',
      face: '脸部',
      skin: '皮肤',
      makeup: '妆容',
      hair: '头发',
      eyes: '眼睛',
      outfit: '服装',
      pose: '姿势',
      studio: '摄影棚'
    },
    cam: {
      full: '全身',
      torso: '半身',
      portrait: '肖像',
      eyes: '特写'
    },
    quality: {
      high: '高',
      balanced: '均衡',
      fast: '流畅'
    },
    skin: {
      flush: '红润',
      freckles: '雀斑',
      moles: '痣与美人痣',
      circles: '黑眼圈',
      wrinkles: '细纹与皱纹',
      sheen: '水光感',
      detail: '毛孔与纹理',
      sss: '通透感'
    },
    makeup: {
      lips: '口红',
      eyes: '眼妆',
      cheeks: '脸颊',
      gloss: '光泽',
      shadow: '眼影',
      liner: '眼线',
      mascara: '睫毛膏',
      blush: '腮红'
    },
    hair: {
      length: '长度',
      volume: '蓬松度',
      curl: '卷度',
      frizz: '毛躁',
      part: '分缝',
      density: '发量',
      gloss: '光泽',
      grey: '白发'
    },
    eyes: {
      pupil: '瞳孔大小',
      pattern: '虹膜细节',
      scleraRed: '血丝',
      lashLength: '睫毛长度',
      lashDensity: '睫毛浓密度'
    },
    pattern: {
      solid: '纯色',
      stripes: '条纹',
      pinstripe: '细条纹',
      plaid: '格纹',
      dots: '波点',
      gradient: '渐变',
      camo: '迷彩'
    },
    lock: {
      body: '体型',
      face: '脸部',
      skin: '皮肤',
      hair: '头发',
      eyes: '眼睛',
      makeup: '妆容',
      outfit: '服装'
    },
    hairStyle: {
      bald: '光头',
      buzz: '寸头',
      crew: '板寸',
      'side-part': '侧分',
      'slick-back': '背头',
      pompadour: '飞机头',
      undercut: '两侧铲青',
      messy: '凌乱',
      'curly-short': '短卷发',
      mohawk: '莫西干头',
      pixie: '精灵短发',
      bob: '波波头',
      shoulder: '齐肩发',
      long: '长直发',
      'long-wavy': '长波浪',
      'curly-long': '长卷发',
      hime: '公主切',
      afro: '爆炸头',
      ponytail: '高马尾',
      'low-ponytail': '低马尾',
      'twin-tails': '双马尾',
      bun: '丸子头',
      'man-bun': '男士丸子头',
      braid: '辫子'
    },
    fringe: {
      none: '无',
      blunt: '齐刘海',
      side: '斜刘海',
      curtain: '八字刘海',
      wispy: '空气刘海'
    },
    brow: {
      natural: '自然',
      straight: '一字眉',
      arched: '弯眉',
      thick: '粗眉',
      thin: '细眉',
      bushy: '浓眉',
      none: '无'
    },
    pose: {
      apose: 'A 字姿势',
      relaxed: '放松',
      contrapposto: '对立式平衡',
      wave: '挥手',
      thinking: '思考',
      heroic: '英姿',
      shy: '害羞',
      clasped: '双手交握'
    },
    expr: {
      neutral: '平静',
      smile: '微笑',
      grin: '咧嘴笑',
      laugh: '大笑',
      sad: '悲伤',
      angry: '愤怒',
      surprised: '惊讶',
      fear: '恐惧',
      disgust: '厌恶',
      smirk: '坏笑',
      pout: '噘嘴',
      determined: '坚定',
      sleepy: '困倦',
      wink: '眨眼'
    },
    light: {
      studio: '影棚',
      atelier: '画室',
      cinematic: '电影感',
      daylight: '日光',
      golden: '黄金时刻',
      moonlight: '月光',
      neon: '霓虹',
      noir: '黑色电影',
      candle: '烛光'
    },
    preset: {
      'young-woman': '年轻女性',
      'young-man': '年轻男性',
      elder: '长者',
      child: '孩童',
      athlete: '运动员',
      scholar: '学者',
      royal: '皇室',
      knight: '骑士'
    },
    region: {
      portrait: '肖像',
      head: '头部',
      forehead: '额头与眉毛',
      eyes: '眼睛',
      nose: '鼻子',
      mouth: '嘴巴',
      cheeks: '脸颊',
      jaw: '下颌与下巴',
      ears: '耳朵',
      neck: '颈部',
      torso: '躯干',
      hips: '臀部',
      arms: '手臂',
      legs: '腿部',
      hair: '头发'
    },
    top: {
      none: '无',
      tank: '背心',
      tee: 'T 恤',
      longsleeve: '长袖',
      shirt: '衬衫',
      sweater: '毛衣',
      turtleneck: '高领毛衣',
      vneck: 'V 领',
      crop: '露脐上衣',
      dress: '连衣裙',
      gown: '礼服',
      robe: '长袍',
      armor: '板甲'
    },
    bottom: {
      none: '内裤',
      trousers: '长裤',
      jeans: '牛仔裤',
      shorts: '短裤',
      leggings: '打底裤',
      skirt: '短裙',
      'midi-skirt': '中长裙',
      'long-skirt': '长裙'
    },
    shoes: {
      none: '赤脚',
      sneakers: '运动鞋',
      boots: '靴子',
      loafers: '乐福鞋',
      socks: '袜子'
    },
    acc: {
      glasses: '眼镜',
      sunglasses: '墨镜',
      earrings: '耳环',
      necklace: '项链',
      beanie: '毛线帽',
      cap: '鸭舌帽',
      crown: '王冠',
      headband: '发带',
      watch: '手表'
    }
  },
  data: {
    relTypes: {
      parent_child: '父母 / 子女',
      adopted: '收养',
      spouse: '配偶',
      sibling: '兄弟姐妹',
      partner: '伴侣',
      friends: '朋友',
      likes: '爱慕',
      rival: '对手',
      mentor: '师徒',
      subordinate: '上下级'
    },
    relRoles: {
      parent_child: {
        a: '父母',
        b: '子女'
      },
      adopted: {
        a: '养父母',
        b: '养子女'
      },
      likes: {
        a: '爱慕者',
        b: '心上人'
      },
      mentor: {
        a: '师父',
        b: '徒弟'
      },
      subordinate: {
        a: '上级',
        b: '下属'
      }
    },
    relStatus: {
      active: '进行中',
      engaged: '订婚',
      divorced: '离婚',
      widowed: '丧偶',
      ended: '已结束',
      estranged: '疏远',
      resolved: '已和解'
    },
    fields: {
      name: '全名',
      gender: '性别',
      birth: '出生',
      death: '去世',
      occupation: '职业',
      location: '所在地',
      bio: '简介'
    },
    gender: {
      male: '男',
      female: '女'
    },
    noun: {
      person: '人物'
    },
    defaults: {
      untitledEvent: '未命名事件',
      untitledEra: '未命名时代',
      untitledMap: '未命名地图',
      newTag: '新标签',
      unnamedProject: '未命名项目',
      newScene: '新场景',
      scene1: '场景 1',
      guest: '访客',
      timeline: '时间线'
    }
  },
  graph: {
    searchPh: '搜索家族成员…',
    nameThis: '为{noun}命名…',
    newNoun: '新{noun}',
    unnamed: '未命名',
    spot: {
      on: '聚光灯下',
      choose: '选择聚光灯下的人物',
      put: '让{name}站到聚光灯下',
      titles: '称谓——每个人与主角的关系',
      titlesAria: '显示称谓',
      pickerPh: '谁站到聚光灯下？',
      takes: '{name}成为焦点'
    },
    ctrl: {
      tiltOffTitle: '回到平面视图（T）',
      tiltOnTitle: '倾斜成 3D——把画面平放，让每个人站起来（T · Q/E 旋转 · 按住 Alt 拖动调整）',
      tilt: '3D 倾斜',
      zoomIn: '放大',
      zoomOut: '缩小',
      stretchWideTitle: '水平放大——把布局拉宽（或按住 X 滚动）',
      stretchWide: '拉宽',
      squeezeNarrowTitle: '水平缩小——把布局压窄',
      squeezeNarrow: '压窄',
      stretchTallTitle: '垂直放大——把布局拉高（或按住 Z 滚动）',
      stretchTall: '拉高',
      squeezeShortTitle: '垂直缩小——把布局压矮',
      squeezeShort: '压矮',
      fitAll: '全部显示',
      resetView: '重置视图',
      refreshTitle: '刷新布局——重新运行家谱算法',
      refresh: '刷新布局',
      lockNodes: '锁定节点点击',
      unlockNodes: '解锁节点点击',
      lockLines: '锁定连线点击',
      unlockLines: '解锁连线点击',
      autoRotateTitle: '自动旋转（R）',
      autoRotate: '自动旋转',
      layersTitle: '世代分层（G）',
      layers: '世代分层',
      help3dTitle: '如何在 3D 中浏览（?）',
      help3d: '如何在 3D 中浏览'
    },
    modes: {
      free: {
        label: '自由',
        title: '自由——节点停留在你放置的位置'
      },
      organic: {
        label: '有机',
        title: '有机——力导向布局'
      },
      birth: {
        label: '出生',
        title: '出生——按出生日期纵向排列'
      },
      generations: {
        label: '世代',
        title: '世代——自上而下的层级'
      },
      spotlight: {
        label: '聚光灯',
        title: '聚光灯——主角居中，其他人按亲疏排成圆环'
      },
      space: {
        label: '空间',
        title: '空间——实验性 3D 布局（实验室）'
      }
    },
    scenes: {
      label: '场景',
      add: '新建场景',
      duplicate: '复制当前场景',
      delete: '删除场景',
      nameN: '场景 {n}'
    },
    hud: {
      customize: '自定义轮盘',
      exit: '退出编辑模式（Esc）',
      exitAria: '退出编辑模式',
      linkNext: '再点击要与{name}建立关系的人',
      deleteConfirm: '再次点击以确认',
      pinOrganic: '固定仅在有机布局中起作用'
    },
    path: {
      armedHint: 'Ctrl+点击另一个人以追溯关系',
      cancel: '取消（Esc）',
      dismiss: '关闭（Esc）',
      clear: '清除（Esc）',
      clearAria: '清除',
      noConnPre: '',
      noConnMid: '与',
      noConnPost: '之间没有关联',
      title: '关系链',
      hopOne: '{n} 步',
      hopOther: '{n} 步',
      view: '查看{name}',
      roleOf: '是…的{role}'
    },
    focus: {
      title: '聚焦',
      lineage: '世系',
      marriage: '婚姻',
      deceased: '已故',
      orbit: '环绕',
      default: '默认',
      paternal: '父系',
      maternal: '母系',
      married: '已婚',
      single: '单身',
      living: '在世',
      needDate: '请先设置当前日期再使用此筛选',
      needSel: '请先选择一个人',
      off: '关',
      orbitOne: '选中者周围 {n} 步',
      orbitOther: '选中者周围 {n} 步'
    },
    rel: {
      rowTitle: '已使用 {count} 条——点击以在画布上单独显示',
      weight: '权重——向右为结构性，向左为排斥',
      romance: '恋情',
      pinesFor: '暗恋',
      vieFor: '争夺',
      gravityTitle: '增强有机布局中社交连线的弹力',
      gravity: '社交引力',
      hintSolo: '正在单独显示一种类型——再次点击以重置',
      hint: '点击类型以单独显示 · Ctrl+点击两个人以追溯关系'
    },
    legend: {
      title: '图例',
      nodes: '节点',
      lines: '连线'
    },
    flash: {
      curveReset: '曲线已重置',
      unavailable: '当前不可用',
      emptySpot: '请点击空白处',
      bondNotNode: '请点击连线，而不是节点',
      typeGone: '该关系类型已不存在',
      alreadyLinked: '已经关联',
      linked: '已关联——{type}',
      node: '节点',
      released: '{name}已解除固定',
      pinned: '{name}已固定',
      tagAdded: '已添加“{tag}”',
      tagRemoved: '已移除“{tag}”',
      alreadyEnded: '已经结束',
      needYear: '请先设置当前年份',
      ended: '于 {year} 年结束',
      noDirection: '该关系没有方向',
      flipped: '方向已翻转',
      restored: '已恢复{type}布局',
      curveHint: '拖动连线或其控制柄 · 双击重置',
      timeDrag: '上下拖动人物以更改出生年份'
    },
    canvas: {
      gen: '第{n}代',
      newGen: '新世代',
      now: '现在 · {year}'
    },
    rings: {
      main: '主角',
      inner: '核心圈',
      close: '近亲',
      extended: '大家族',
      distant: '远亲',
      far: '远方',
      edge: '故事边缘',
      outside: '无关联'
    },
    timeDrag: {
      badge: '生于 {year}（{delta}）',
      badgeMany: '{n} 人 · {delta} 年',
      movedManyLater: '{count} 人的一生推后了 {n} 年',
      movedManyEarlier: '{count} 人的一生提前了 {n} 年',
      badgeBirths: '{n} 人出生 · {delta} 年',
      birthsLater: '{count} 人的出生推后了 {n} 年',
      birthsEarlier: '{count} 人的出生提前了 {n} 年'
    },
    toggles: {
      aria: '画布叠加层',
      select: '选择',
      edit: '编辑',
      modeTitle: '{label}——{hint}',
      gear: '自定义编辑模式（或按住 Tab 打开轮盘）',
      gearAria: '自定义编辑模式',
      focus: '聚焦——突出显示人物',
      legend: '图例',
      relTypes: '关系——类型、权重与透镜',
      chronicle: '编年史——时代与故事事件',
      style: '样式——生命线外观、画布与氛围',
      kinship: '亲属——称呼每位亲人，以其视角观看',
      clean: '简洁视图——隐藏画布叠加层',
      box: '框选——按住 Shift 在画布上拖动',
      lasso: '套索选择——按住 Shift 拖出任意形状',
      timeDrag: '时间拖动——上下拖动人物以更改出生年份（寿命随之平移）'
    }
  },
  graphWheel: {
    addMode: '添加模式…',
    hubIdle: '编辑',
    tipRelease: '松开以选择',
    tipCustomize: '自定义',
    tipCancel: '取消',
    empty: {
      label: '空',
      hint: '这里什么也没有'
    },
    kinds: {
      add: {
        label: '添加{noun}',
        hint: '点击空白处添加{noun}'
      },
      delete: {
        label: '删除',
        hint: '点击节点或连线——再次点击以确认'
      },
      pin: {
        label: '固定',
        hint: '点击人物以固定 / 解除固定'
      },
      end: {
        label: '结束关系',
        hint: '点击连线将其标记为已结束'
      },
      swap: {
        label: '翻转关系',
        hint: '点击有向连线以反转方向'
      },
      retime: {
        label: '调整时间',
        hint: '上下拖动人物以更改出生年份'
      },
      paint: {
        label: '上色',
        hint: '点击人物为其上色——再次使用同一颜色可清除',
        disabled: '节点样式需要标准模式'
      },
      tag: {
        hint: '点击人物以切换“{tag}”',
        disabled: '标签需要标准模式'
      },
      link: {
        hint: '依次点击两个人，将其关联为{type}',
        disabled: '此关系类型需要标准模式'
      }
    },
    config: {
      aria: '自定义操作轮盘',
      title: '操作轮盘',
      subPre: '在画布上按住',
      subPost: '后朝某个模式划动并松开。在下方选择一个方向，为它指定功能。',
      close: '关闭（Esc）',
      closeAria: '关闭',
      emptySlot: '空槽位',
      mode: '模式',
      forge: '建立关系',
      forgeNote: '依次点击两个人即可将其关联。',
      paint: '节点上色',
      paintTitle: '将人物涂成 {color}',
      tag: '切换标签',
      reset: '恢复默认',
      done: '完成'
    },
    dirs: {
      N: '北',
      NE: '东北',
      E: '东',
      SE: '东南',
      S: '南',
      SW: '西南',
      W: '西',
      NW: '西北'
    }
  },
  graph3d: {
    badge: '实验性 · 空间',
    help: {
      close: '关闭',
      title: '在空间中浏览',
      sub: '三维中的家谱——同样的人物与连线，多了一个维度。操作遵循常见的 3D 习惯：',
      mouse: '鼠标',
      keys: '按键',
      leftDrag: {
        key: '左键拖动',
        desc: '环绕家族旋转'
      },
      rightDrag: {
        key: '右键拖动',
        desc: '平移'
      },
      scroll: {
        key: '滚轮',
        desc: '放大 / 缩小'
      },
      dragPerson: {
        key: '拖动人物',
        desc: '在空间中移动'
      },
      click: {
        key: '单击',
        desc: '选择人物或连线'
      },
      dblClick: {
        key: '双击',
        desc: '飞向某人'
      },
      frame: '显示全部',
      rotate: '自动旋转 开 / 关',
      layers: '世代分层',
      hints: '显示这些提示',
      tipLabel: '提示：',
      tipMid: '（工具栏中的图层按钮，或',
      tipEnd: '）会把每一代叠放在各自的楼层上——最年长的在最上层。',
      gotIt: '知道了'
    }
  },
  minimap: {
    title: '概览——拖动以移动视图'
  },
  styleStudio: {
    title: '风格工作室',
    close: '关闭风格工作室',
    search: '查找风格设置…',
    noResults: '没有与“{q}”匹配的风格设置',
    reach: '此图层作用的视图',
    tuned: '已调整 {n} 项 · 重置',
    resetChapterHint: '将本章节恢复为默认值',
    layers: {
      app: '整个应用',
      appTag: '全局',
      appDesc: '所有视图共用的基础',
      viewTag: '当前视图',
      viewDesc: '只影响{view}视图',
      viewNone: '没有自己的风格 — 沿用应用风格',
      bringForward: '将此图层置于前方'
    },
    chapters: {
      theme: '主题',
      palette: '调色板',
      profiles: '档案',
      looks: '风格预设',
      nodes: '节点',
      lines: '连线',
      effects: '特效',
      air: '氛围',
      camera: '镜头',
      physics: '物理',
      lifelines: '生命线',
      time: '时间',
      canvas: '画布',
      cards: '卡片',
      mapStyle: '地图风格',
      shapes: '形状',
      auras: '特效'
    },
    saved: {
      deviceAll: '保存在此设备 · 所有项目、所有视图',
      projectAll: '随此项目保存 · 所有视图',
      projectView: '随此项目保存 · 仅{view}',
      mapView: '随此地图保存 · 每张地图各自独立'
    },
    results: {
      app: '整个应用',
      view: '当前视图 · {view}',
      other: '其他视图'
    },
    inherit: {
      title: '{view}沿用应用风格',
      body: '此视图暂时没有自己的风格，使用应用图层：主题、强调色和共享调色板。',
      cta: '设置整个应用的风格'
    },
    palette: {
      intro: '所有视图都用这些颜色绘制人物及其关系。',
      specimen: '用共享调色板绘制的小家庭',
      people: '人物',
      bonds: '关系',
      lookNote: '选择图谱风格预设也会重绘此调色板。'
    },
    profile: {
      title: '档案呈现方式',
      intro: '在任意视图中打开人物档案时的样式。'
    },
    looks: {
      paletteNote: '每个风格预设也会重绘共享调色板。',
      openPalette: '打开调色板'
    },
    lines: {
      colorsNote: '连线颜色由所有视图共享。'
    },
    air: {
      quality: '渲染质量'
    },
    map: {
      none: '打开一张地图即可设置其风格。'
    },
    directory: {
      cardModesOnly: '卡片样式在网格和卡片舞台模式中显示。'
    },
    groups: {
      shape: '分组形状',
      shapeSub: '分组的绘制方式，以及它如何显示与其他分组共有的成员。',
      ringsBlurb: '固定的圆圈。共有成员位于各分组之间，并以连线牵向每个分组。',
      vennBlurb: '有生命的薄膜。每个分组都会伸展包住自己的成员，共有成员便落在分组重叠之处。',
      preview: '{style}样式预览',
      softness: '柔软度',
      softTaut: '紧绷',
      softFluid: '流动',
      lens: '透镜光晕',
      lensHint: '将重叠部分绘成发光的透镜',
      arrangeTip: '工具栏中的“排列”会让共有成员的分组彼此重叠，其余分组则保持分开。',
      ringsTip: '切换到维恩样式，以重叠而非连线来显示共有成员。'
    }
  },
  auras: {
    intro: '给标签或特征加上特效。拥有它的每个人都会在关系图和时间线中带上这个特效。',
    active: '已启用的特效',
    add: '添加特效',
    addTitle: '为谁添加特效…',
    cancel: '取消',
    kinds: { tag: '标签', trait: '特征' },
    searchTags: '查找标签…',
    searchTraits: '查找特征…',
    noTags: '还没有标签。先在{noun}的资料中添加标签，再在这里给标签加特效。',
    noTraits: '还没有特征。',
    noMatch: '没有与“{q}”匹配的结果',
    hasEffect: '已有特效',
    ruleCount: '特效：{n}',
    empty: {
      title: '还没有特效',
      body: '为王族戴上王冠，让法师燃起火焰，让北境之民覆上寒霜。选择一个标签或特征开始吧。',
      cta: '添加第一个特效'
    },
    bearersNone: '暂无',
    bearersOne: '{n}个{noun}',
    bearersOther: '{n}个{noun}',
    draft: '未保存',
    draftHint: '这是推荐的样式。可以随意修改，或直接保留。',
    keep: '保留',
    edit: '编辑此特效',
    collapse: '收起',
    remove: '移除此特效',
    discard: '放弃',
    removed: '已从“{name}”移除特效',
    saveFailed: '无法保存特效',
    tagMembers: '带此标签的所有人',
    preview: {
      label: '实时预览',
      replay: '重新点燃',
      sample: '一个带有此特效的示例{noun}'
    },
    presets: {
      title: '预设',
      royal: '王族',
      saint: '圣者',
      inferno: '烈焰',
      frostborn: '霜裔',
      arcane: '奥秘',
      cursed: '诅咒',
      stormcaller: '唤雷者',
      blossom: '花开',
      bloodline: '血脉'
    },
    ornament: '装饰',
    ornaments: {
      none: { label: '无', hint: '不加装饰——只有线条和着色' },
      halo: { label: '光轮', hint: '头后一圈圣者的光轮' },
      flame: { label: '火焰', hint: '节点周围升腾的火焰' },
      frost: { label: '寒霜', hint: '冰晶爬满边缘' },
      sparkle: { label: '星光', hint: '闪烁的星星环绕飘动' },
      crown: { label: '王冠', hint: '顶上戴着一顶王冠' },
      shadow: { label: '暗影', hint: '身后卷起的黑烟' },
      storm: { label: '雷暴', hint: '边缘噼啪作响的闪电' },
      bloom: { label: '花瓣', hint: '花瓣缓缓环绕飘落' },
      aura: { label: '光环', hint: '边缘闪烁的双层金环' },
      runes: { label: '符文', hint: '缓缓旋转的符文环' },
      orbit: { label: '环绕', hint: '绕着节点飞行的火花' },
      burst: { label: '星芒', hint: '节点身后的尖角星芒' },
      pulse: { label: '脉动', hint: '向外扩散的回声波纹' }
    },
    color: '颜色',
    tint: '着色',
    tintHint: '用此颜色给节点描边、为生命线上色',
    line: '线条特效',
    lineHint: '沿生命线流动，也会出现在两位持有者之间的关系线上。',
    noLine: '普通',
    when: {
      title: '谁会带上它',
      any: '任意值',
      is: '是其中之一',
      contains: '包含',
      range: '范围内',
      checkedNote: '勾选了此项的每个人都会带上特效。',
      pickOptions: '请至少选择一个选项。',
      noOptions: '此特征还没有选项。',
      containsPh: '输入一个词，按回车',
      addWord: '添加',
      removeWord: '移除“{v}”',
      needWord: '请至少添加一个词。',
      needBound: '请设置下限或上限。',
      min: '从',
      max: '到',
      minYear: '起始年份',
      maxYear: '结束年份',
      scale: '随数值增强',
      scaleHint: '数值越高，装饰越强烈',
      sumAny: '有任意值',
      sumChecked: '勾选时',
      sumIs: '是 {v}',
      sumContains: '包含“{v}”',
      sumBetween: '{min} 至 {max}',
      sumAtLeast: '{min} 及以上',
      sumAtMost: '最多 {max}',
      sumYearBetween: '{min}–{max} 年',
      sumYearFrom: '{min} 年起',
      sumYearUntil: '至 {max} 年',
      sumScaled: '随数值增强'
    },
    entry: {
      trait: '特效…',
      traitHint: '让拥有它的每个人发光',
      tag: '特效'
    }
  },
  graphStyle: {
    tiltHint:
      '把布局像从上方俯视的棋盘一样平放，每个人都站在上面。T 切换；Q / E 旋转棋盘；按住 Alt 上下拖动调整倾斜、左右拖动旋转。',
    title: '样式',
    close: '关闭样式面板',
    quality: '画质',
    qualityHint: '全分辨率，含装饰、氛围与环境动效',
    performance: '性能',
    performanceHint: '降低分辨率，装饰静止，关闭氛围——适合低配置电脑',
    groups: {
      perspective: '透视',
      themes: '主题',
      nodes: '节点外观',
      colors: '节点颜色',
      lines: '关系连线',
      fx: '连线特效',
      atmosphere: '氛围',
      physics: '物理 / 布局'
    },
    chips: {
      custom: '自定义',
      live: '已启用',
      off: '关闭'
    },
    atmosphereOffHint: '性能模式下氛围效果已关闭',
    inkNote:
      '水墨——在水墨主题下，所有外观都以笔墨晕染绘于宣纸之上；形状、连线与氛围仍沿用你所选的主题。',
    labels: {
      tiltYaw: '旋转',
      tiltAngle: '角度',
      tilt: '3D 倾斜',
      shape: '形状',
      ornament: '装饰',
      ornamentColor: '装饰颜色',
      nodeSize: '节点大小',
      nodeOpacity: '节点不透明度',
      labelSize: '标签大小',
      showLabels: '显示标签',
      showAge: '显示年龄',
      glowOnHover: '悬停发光',
      starTwinkle: '逝者之星闪烁',
      unknown: '未知',
      lineStyle: '连线样式',
      lineOpacity: '连线不透明度',
      lineCurvature: '连线弯曲度',
      color: '颜色',
      width: '粗细',
      appliesTo: '应用于',
      palette: '配色',
      effectColors: '特效配色',
      relColors: '关系配色',
      speed: '速度',
      glow: '辉光',
      effect: '效果',
      colors: '颜色',
      density: '密度',
      linkDistance: '连线距离',
      repulsion: '斥力'
    },
    brushOwns: '目前连线由笔触绘制——切换到其他连线样式后特效即恢复。',
    starHint: '星越亮越大，后代越多。悬停时显示照片。',
    useOrganic: '改用自然曲线',
    reset: '全部重置',
    shapes: {
      gravestone: '墓碑',
      plate: '立牌',
      flatplate: '简约立牌',
      star: '星辰',
      circle: '圆形',
      square: '方形',
      diamond: '菱形',
      hexagon: '六边形',
      shield: '盾形',
      oval: '椭圆',
      octagon: '八边形',
      heart: '心形'
    },
    decors: {
      none: '无',
      aura: '光环',
      runes: '符文',
      orbit: '轨道',
      burst: '星芒',
      pulse: '脉冲',
      enso: '圆相'
    },
    routes: {
      organic: {
        label: '自然',
        hint: '柔和的曲线，每条线自然弯曲'
      },
      straight: {
        label: '直线',
        hint: '笔直的连线'
      },
      arc: {
        label: '弧线',
        hint: '舒展的半月形曲线'
      },
      elbow: {
        label: '折线',
        hint: '直角走线，类似流程图'
      },
      trident: {
        label: '族谱',
        hint: '经典族谱：夫妻横杠 → 竖线 → 兄弟姐妹横轨 → 子女'
      },
      circuit: {
        label: '电路',
        hint: '先沿轴线再转45°，类似电路板走线'
      },
      wave: {
        label: '波浪',
        hint: '人物之间蜿蜒的波纹'
      },
      bezier: {
        label: '贝塞尔',
        hint: '由你亲手塑形的平滑曲线——选中一条线，再拖动它或其控制柄（双击复位）'
      },
      brush: {
        label: '笔触',
        hint: '水墨——书法笔触，带枯笔飞白'
      }
    },
    ambients: {
      none: '无',
      fireflies: '萤火',
      stars: '星辰',
      petals: '花瓣',
      snow: '飘雪',
      embers: '余烬',
      rain: '雨',
      motes: '微尘',
      mist: '山岚',
      plum: '梅花',
      nightsky: '夜空'
    },
    fxScopes: {
      lineage: {
        label: '血脉',
        hint: '父母 → 子女连线（所有纵向关系类型）'
      },
      family: {
        label: '家庭',
        hint: '血脉连线加上夫妻'
      },
      all: {
        label: '全部',
        hint: '所有关系，包括社交关系'
      }
    },
    fx: {
      none: {
        label: '经典',
        hint: '普通连线'
      },
      blood: {
        label: '血脉流',
        hint: '一条鲜活的血管——红细胞随心跳沿世代流淌'
      },
      river: {
        label: '河流',
        hint: '流水——焦散光影、水流纹路、岸边浪花'
      },
      neon: {
        label: '霓虹',
        hint: '赛博导管——白热核心、数据包飞驰、电路刻痕'
      },
      helix: {
        label: '双螺旋',
        hint: 'DNA双螺旋沿线扭转，碱基对闪闪发光'
      },
      ember: {
        label: '烈焰',
        hint: '一道火线——火舌舔舐，火星飞入黑暗'
      },
      aurora: {
        label: '极光',
        hint: '北极光——绿紫交织的光幕缓缓变幻'
      },
      storm: {
        label: '雷暴',
        hint: '噼啪作响的闪电，在你眼前反复劈落'
      },
      stars: {
        label: '星光',
        hint: '一片星座——闪烁的星辰串在银线上'
      },
      gilded: {
        label: '鎏金',
        hint: '一条皇家金绳，光泽沿着它流转'
      },
      starline: {
        label: '星图',
        hint: '星座连线——纤细的银线，在每颗星前留出空隙'
      }
    },
    themes: {
      constellation: {
        name: '星座',
        tagline: '一片夜空——后代越多，星越亮'
      },
      graveyard: {
        name: '墓园',
        tagline: '墓碑立在各自出生年份的土地上——在出生布局中最佳'
      },
      heraldry: {
        name: '纹章',
        tagline: '盾徽 — 鎏金线上的盾牌，风中余烬'
      },
      illuminated: {
        name: '泥金手抄本',
        tagline: '手抄本书页 — 青金石与金箔，烛光中的微尘'
      },
      classic: {
        name: '经典',
        tagline: '招牌外观——简洁圆点，自然连线'
      },
      lineage: {
        name: '族谱',
        tagline: '正式族谱——兄弟姐妹横轨与夫妻横杠'
      },
      storybook: {
        name: '童话书',
        tagline: '奇幻——黑暗中的鎏金盾牌与萤火'
      },
      neon: {
        name: '霓虹电路',
        tagline: '科幻——星光下发光走线上的六边形单元'
      },
      noir: {
        name: '黑色电影',
        tagline: '犯罪剧——硬朗线条，黑白画面，无尽的雨'
      },
      dynasty: {
        name: '朝代',
        tagline: '朝代——朱红、翠玉与金；花瓣随风'
      },
      wuxia: {
        name: '武侠',
        tagline: '武侠——笔意从容，墨点在水中漂浮'
      },
      shuimo: {
        name: '水墨',
        tagline: '水墨——笔触、墨晕，远山云雾'
      },
      qinglu: {
        name: '青绿',
        tagline: '青绿——石青石绿晕染，云雾遮掩的峰峦'
      },
      meihua: {
        name: '墨梅',
        tagline: '墨梅——枯笔枝干，梅花随风'
      },
      celestial: {
        name: '仙侠',
        tagline: '仙侠——弧形排布的玉晶，灵气袅袅上升'
      },
      rosewater: {
        name: '玫瑰水',
        tagline: '浪漫——爱心、红晕弧线与飘落的花瓣'
      },
      winter: {
        name: '冬堡',
        tagline: '北境史诗——星芒王冠与静静落雪'
      },
      minimal: {
        name: '极简',
        tagline: '现代而安静——简洁线条，没有装饰'
      },
      heirloom: {
        name: '传家宝',
        tagline: '家族档案——棕褐浮雕与飘浮的尘埃'
      },
      blueprint: {
        name: '蓝图',
        tagline: '制图桌——直角走线上清晰的八边形'
      },
      wildwood: {
        name: '野林',
        tagline: '魔法森林——蜿蜒藤蔓上的符文环'
      },
      harvest: {
        name: '丰收',
        tagline: '秋天——炉火旁闪耀的琥珀纹章'
      },
      sakura: {
        name: '樱花',
        tagline: '樱——春风中环绕飞舞的花瓣'
      },
      pharaoh: {
        name: '时光之沙',
        tagline: '古老帝国——流沙上的青金石与黄金'
      },
      ember: {
        name: '余烬王座',
        tagline: '黑暗奇幻战争——燃烧的纹章与升腾的火星'
      },
      nocturne: {
        name: '夜曲',
        tagline: '哥特——月光雨下的深红纹章'
      },
      grimoire: {
        name: '魔典',
        tagline: '奥术——符印缚定的晶体与游荡的灵光'
      },
      abyss: {
        name: '深渊',
        tagline: '深海——浮游生物间的生物荧光脉冲'
      },
      nebula: {
        name: '星云',
        tagline: '太空歌剧——紫色星空中环绕运行的星球'
      }
    }
  },
  graphActions: {
    dismissHint: '关闭（Esc）',
    clearSelHint: '清除选择（Esc）',
    clearSel: '清除选择',
    status: '状态',
    pick: '选取',
    size: '大小',
    color: '颜色',
    link: '连接',
    swap: '对调',
    swapHint: '对调这段关系中双方的角色',
    isolate: '单独显示',
    isolateHint: '在画布上只显示这种关系类型',
    allBonds: '所有关系',
    allBondsHint: '打开关系视图',
    deleteBond: '删除关系',
    filters: {
      both: {
        label: '全部',
        title: '同时选取节点和关系'
      },
      nodes: {
        label: '节点',
        title: '只选取人物'
      },
      bonds: {
        label: '关系',
        title: '只选取关系'
      }
    },
    setAllStatus: '将全部{count}条关系设为{status}',
    sizes: {
      s: {
        label: '小',
        title: '小'
      },
      m: {
        label: '中',
        title: '默认'
      },
      l: {
        label: '大',
        title: '大'
      },
      xl: {
        label: '特大',
        title: '特大'
      }
    },
    autoColor: '自动——按性别渐变着色',
    delete: '删除',
    deleteN: '删除 {n}',
    clear: '清除',
    clearKeepAll: '保留所有内容，只取消选择',
    clearKeepPeople: '保留所有人，只取消选择',
    details: '详情',
    detailsHint: '打开资料卡',
    edit: '编辑',
    editHint: '编辑此{noun}',
    focus: '聚焦',
    focusHint: '将镜头移到此节点',
    trace: '追溯',
    traceHint: '追溯关联——然后点击另一个人',
    kin: '亲属',
    kinHint: '亲属透镜——按与此人的关系标注每个人',
    spotlight: '主角',
    spotlightHint: '主角——将此人设为主角，其他人环绕四周',
    pin: '固定',
    unpin: '取消固定',
    pinHint: '将节点固定在原位',
    unpinHint: '将节点交还给物理模拟',
    pairKinHint: '显示他们的亲属关系',
    swapDirHint: '对调方向（对父母 → 子女、仰慕者 → 心上人等有影响）',
    linked: '已连接——{label}',
    traceConnection: '追溯关联',
    traceConnectionHint: '点亮两人之间最短的关系链',
    selected: '已选 {n} 项',
    nounCountOne: '{n}个{noun}',
    nounCountOther: '{n}个{noun}',
    bondCountOne: '{n}条关系',
    bondCountOther: '{n}条关系',
    nothingInRange: '范围内没有内容',
    pairTitle: '{a}与{b}',
    born: '生于 {year}',
    died: '卒于 {year}',
    pairSub: '建立关系，或一起设置样式',
    multiSub: '样式将应用于所有已选对象',
    unnamed: '未命名',
    alreadyLinked: '已连接',
    becomes: '{a}成为{b}的{role}',
    linkAs: '将{a}和{b}连接为{type}',
    married: '已婚',
    marriedYear: '{year}年结婚',
    sinceYear: '始于{year}年',
    range: '{from} — {to}',
    endedYear: '{year}年结束'
  },
  relTypesPanel: {
    title: '关系类型',
    close: '关闭',
    hint: '每段关系都指向一种类型。可在此调整类型的外观',
    hintAffinityPre: '——以及它的',
    hintAffinityBold: '结构 ↔ 亲和',
    hintAffinityPost:
      '权重：结构型类型对布局有很强的拉力（家族骨架），亲和型类型只是装饰性叠加，负权重会把人推开（如对手）。',
    symmetric: '对称',
    typeColor: '类型颜色',
    styleColor: '由样式面板着色',
    deleteType: '删除此类型（同时删除其所有关系）',
    deleteTypeAria: '删除类型',
    builtinHint: '内置——可调整，不可删除',
    builtin: '内置',
    generations: '世代',
    generationsHint: '世代布局如何处理这种类型的连线',
    repel: '排斥',
    structural: '结构',
    newTitle: '新建自定义类型',
    labelPh: '名称（如：死敌）',
    hideIcons: '隐藏图标',
    chooseIcon: '选择图标',
    directed: '有方向',
    roleAPh: '角色A（如：主人）',
    roleBPh: '角色B（如：仆人）',
    addType: '添加类型',
    typeIcon: '类型图标',
    roles: {
      vertical: {
        label: '跨代',
        hint: '父母 → 子女——子女位于下一代。'
      },
      horizontal: {
        label: '同代',
        hint: '夫妻——双方并排在同一行。'
      },
      none: {
        label: '不分代',
        hint: '世代布局会忽略它（仍会绘制，并在力导向布局中产生拉力）。'
      }
    }
  },
  timeline: {
    undated: '{n} 人无日期',
    undatedHint: '没有出生年份的人物无法放上时间线。在其资料中添加出生年份即可显示。',
    hint: '拖动生命线以移动 · 拖动空白处平移 · 滚轮缩放 · 1–6：编辑工具',
    empty: {
      noDatable: '没有可定年的人物',
      noPeople: '还没有人物',
      noDatableText: '为家庭成员添加出生年份，即可在时间线上看到他们的一生。',
      noPeopleText: '在关系图视图中添加家庭成员后，即可在此看到他们。'
    },
    searchPh: '搜索人物…',
    zoomIn: '放大',
    zoomOut: '缩小',
    fitAll: '全部适配',
    refresh: '刷新布局——重新运行家谱算法',
    refreshAria: '刷新布局',
    warpToggle: '拉伸密集年份——出生集中处放宽时间轴',
    tiltToggle: '将时间线倾斜为 3D（T）',
    modes: {
      lanes: {
        label: '泳道',
        title: '每个人独占一条泳道——家族主干与跨线分支标明谁是谁的后代'
      },
      sprout: {
        label: '萌芽',
        title: '生命线从父母的家族主干中萌发，并在前一位主人离世后复用泳道——紧凑而流畅'
      },
      rivers: {
        label: '家河',
        title: '家庭河流——每个家庭是一条河道：孩子在父母的河道中出生，生命线只在结婚或离家时跨越'
      }
    },
    river: {
      household: '{names}的家庭',
      own: '{name}自己的家',
      joined: '迁入：{names}'
    },
    bond: {
      born: '生于 {year}',
      childOf: '{names} 之子女',
      adoptedBy: '由 {names} 收养',
      ageAt: '{name} 时年 {age} 岁',
      oneChild: '1 个子女',
      children: '{n} 个子女'
    },
    zoomAxes: '时间轴 {v} · 泳道 {h}',
    focus: {
      title: '聚焦',
      gender: '性别',
      life: '生死',
      all: '全部',
      unknown: '未知',
      living: '在世',
      remembered: '已故',
      needYear: '请先设置当前年份'
    },
    legend: {
      title: '图例',
      people: '人物',
      lines: '连线',
      marriage: '婚姻',
      divorced: '离婚',
      birth: '出生',
      adopted: '收养'
    },
    tip: {
      dragToMove: '拖动以移动',
      clickToEdit: '点击编辑',
      undated: '无日期',
      now: '至今'
    },
    marriage: {
      year: '年份',
      married: '已婚',
      divorced: '离婚',
      save: '保存'
    },
    traceArmed: '按住 Ctrl 点击另一条生命线以追溯关系',
    hud: {
      exit: '退出工具（Esc）',
      exitAria: '退出工具',
      linkPick: '选择两人的关系——交换可反转方向',
      linkNext: '现在点击与{name}相连的生命线——在关系开始的年份处'
    },
    tools: {
      add: {
        label: '添加',
        hint: '点击任意位置——新的生命从该年份开始'
      },
      child: {
        label: '子女',
        hint: '在孩子出生的年份点击一条生命线'
      },
      link: {
        label: '连接',
        hint: '先点击一条生命线，再点击另一条——选择两人的关系'
      },
      event: {
        label: '事件',
        hint: '点击添加时刻 · 上下拖动添加时段'
      },
      retime: {
        label: '调整时间',
        hint: '拖动出生、去世、婚姻或事件——或整段生命'
      },
      delete: {
        label: '删除',
        hint: '点击生命线、婚姻或事件即可删除'
      }
    },
    bubble: {
      namePh: '为此{noun}命名…',
      with: '与',
      create: '创建',
      createHint: '创建（Enter）',
      newLife: '新的生命 · 生于 {year}',
      childOf: '{name}的孩子 · 生于 {year}'
    },
    link: {
      swap: '交换方向（父母 → 子女…）',
      swapAria: '交换方向',
      directed: '{a}是{b}的{role}',
      failed: '无法连接他们'
    },
    scenes: {
      label: '场景',
      add: '新建场景',
      duplicate: '复制当前场景',
      delete: '删除场景'
    },
    ghost: {
      born: '生于 {year}',
      died: '卒于 {year}',
      stillLiving: '仍在世',
      dragToDate: '拖动以设定日期',
      dragToEnd: '向上拖动以结束此生命',
      shiftLife: '平移整段生命',
      between: '{a}与{b}之间',
      after: '{name}之后',
      before: '{name}之前',
      firstLane: '第一条泳道',
      lives: '{n} 条生命 · {where}'
    },
    confirm: {
      deleteMarriage: '移除 {names} 的婚姻？',
      deleteMarriageBody: '两人都会保留——只移除这段关系。',
      deleteEvent: '删除“{name}”？'
    },
    toasts: {
      marriageRemoved: '婚姻已移除',
      bornIn: '{name}现在生于 {year}',
      diesIn: '{name}现在卒于 {year}',
      movedLater: '{name}的一生推后了 {n} 年',
      movedEarlier: '{name}的一生提前了 {n} 年',
      marriedIn: '于 {year} 结婚',
      eventMoved: '“{name}”已移至 {year}',
      calendarUnsupported: '该日期使用的历法暂时无法在时间线上移动'
    },
    canvas: {
      unnamed: '未命名',
      yearsDead: '{b}–{d} · 享年{age}',
      yearsLiving: '生于 {b} · {age}岁',
      addYear: '添加年份',
      now: '至今'
    },
    style: {
      title: '样式',
      reset: '重置',
      resetHint: '恢复默认设置',
      tabs: {
        lines: '生命线',
        canvas: '画布',
        air: '氛围'
      },
      inkLines: '水墨主题下生命线为笔刷效果——外观在其他主题中生效。',
      inkAir: '水墨主题自带云雾——氛围在其他主题中生效。',
      thickness: '粗细',
      portraits: '头像',
      shadows: '投影',
      shadowsHint: '投影仅适用于实体、有光照的外观',
      flowSpeed: '流动速度',
      glow: '辉光',
      palette: '配色',
      paletteEffect: '特效',
      palettePerson: '人物',
      ageTicks: '年龄刻度',
      ageTicksHint: '每段生命每十年一个刻度',
      eraWash: '时代底色',
      leaveHome: '离家年龄',
      leaveHomeHint: '家庭河流：未婚的成年人在这个年龄迁入自己的河道',
      ageYears: '{n} 岁',
      timeWarp: '拉伸密集年份',
      timeWarpHint: '相隔一年出生的兄弟姐妹得以分开；空白的年代被压缩',
      warpStrength: '拉伸强度',
      warpNote:
        '网格仍按真实年份绘制——只是在时间被拉伸处更密。年份栏边的色条标示：强调色为拉伸，灰色为压缩。',
      tilt: '倾斜为 3D',
      tiltAngle: '倾斜角度',
      tiltYaw: '旋转',
      arcLift: '弧线高度',
      tiltHint:
        'T 倾斜，Q / E 旋转，按住 Alt 拖动可调角度与旋转。家族弧线会从平面升起——转动视角即可分开重叠的弧线。',
      density: '密度',
      colours: '颜色',
      segs: {
        connectors: '关系线',
        grid: '年份网格',
        labels: '姓名',
        eventMarkers: '事件'
      },
      opts: {
        curve: '曲线',
        straight: '直线',
        hidden: '隐藏',
        bands: '色带',
        lines: '线条',
        none: '无',
        full: '完整',
        fullHint: '姓名 + 年份',
        compact: '紧凑',
        compactHint: '仅显示简短姓名',
        pills: '标签',
        dots: '图标'
      },
      ambients: {
        none: '无',
        fireflies: '萤火虫',
        stars: '星空',
        petals: '花瓣',
        snow: '飘雪',
        embers: '余烬',
        rain: '雨',
        motes: '光尘',
        mist: '雾',
        plum: '梅花'
      },
      looks: {
        clean: {
          label: '简洁',
          hint: '平面线条，无氛围'
        },
        bloodline: {
          label: '血脉',
          hint: '血液沿每段生命脉动，余烬飘散'
        },
        tides: {
          label: '潮汐',
          hint: '飘雾下的时间之河'
        },
        cosmos: {
          label: '星河',
          hint: '闪烁夜空中的星光人生'
        },
        neon: {
          label: '霓虹都市',
          hint: '数据流、雨与硬朗线条'
        },
        gilded: {
          label: '鎏金',
          hint: '金箔王朝，点点光尘'
        },
        glasshouse: {
          label: '玻璃房',
          hint: '映光的玻璃棒，轻柔飘雪'
        },
        sakura: {
          label: '樱花',
          hint: '飘落花瓣下的发光管线'
        }
      },
      lifelines: {
        classic: {
          label: '经典',
          hint: '平面简洁的线条'
        },
        tube: {
          label: '管状',
          hint: '带阴影的立体光照圆柱'
        },
        glass: {
          label: '玻璃',
          hint: '玻璃棒——光泽沿每段生命流动'
        },
        glow: {
          label: '辉光',
          hint: '彩色辉光中的炽白核心'
        }
      }
    }
  },
  timeSlider: {
    activeHint: '时间旅行进行中',
    presentHint: '正在显示现在',
    capYear: '年份',
    capNow: '现在',
    from: '自 {year}',
    trackHint: '拖动任一手柄以框选时间段',
    pause: '暂停',
    playBack: '倒放',
    play: '播放时间流逝',
    stop: '停止——回到现在',
    stopAria: '停止',
    prevEvent: '上一个事件',
    nextEvent: '下一个事件',
    backYear: '后退一年',
    fwdYear: '前进一年',
    speed: '播放速度——{speed}',
    reverse: '反转播放方向',
    loop: '循环播放'
  },
  census: {
    toggle: '人口普查：这一年的实时人口统计',
    title: '人口普查',
    close: '关闭人口普查',
    emptyTitle: '暂时无人可统计',
    emptyBody: '为人物填写出生年份，人口普查就会统计你穿越到的每一年有谁在世。',
    alive: '在世',
    couples: '伴侣',
    meanAge: '平均年龄',
    medianAge: '年龄中位数',
    nobody: '{year} 年无人在世',
    trend: '与十年前相比 {delta}',
    genderSplit: '男：{male} · 女：{female} · 其他或未知：{other}',
    decade: '{decade}年代',
    decadeSpan: '{from}–{to}',
    bornIn: '{decade}出生',
    diedIn: '{decade}去世',
    generations: '在世世代',
    oldest: '在世最年长者',
    ageShort: '{age} 岁',
    selectPerson: '选择{name}',
    population: '人口',
    populationAria: '人口随时间变化。点击可穿越到某一年。',
    mortality: '每十年死亡人数',
    noDeaths: '暂无死亡记录',
    mortalityAria: '每十年有记录的死亡人数。点击可穿越到某一年。',
    hoverValue: '{year}：{value}',
    hoverDeaths: '{decade}：{value}'
  },
  chronicle: {
    now: '至今',
    undated: '无日期',
    deleted: '已删除“{name}”',
    pane: {
      title: '编年史',
      era: '时代',
      event: '事件',
      eras: '时代',
      events: '事件',
      quickStart: '快速开始',
      erasEmpty:
        '为故事中的各个阶段命名——一场战争、一个王朝、一段黄金时代——它们会以色带标注在时间线和出生布局上。',
      searchPh: '搜索事件…',
      noMatch: '没有匹配项。',
      eventsEmpty: '战役、加冕、迁徙、初遇——添加塑造了人物命运的时刻。',
      nothingNew: '“{pack}”在 {min}–{max} 期间没有新的时代',
      addedOne: '已添加 {n} 个时代',
      addedMany: '已添加 {n} 个时代',
      addFailed: '无法添加时代'
    },
    editor: {
      newEra: '新建时代',
      editEra: '编辑时代',
      newEvent: '新建事件',
      editEvent: '编辑事件',
      close: '关闭（Esc）',
      closeAria: '关闭',
      eraNamePh: '为这个时代命名——“摄政时期”“巨龙时代”…',
      from: '始于',
      until: '止于',
      beginning: '时间的开端',
      open: '不限',
      ongoing: '持续中',
      colour: '颜色',
      anyColour: '自定义颜色',
      icon: '图标',
      eraIcon: '时代图标',
      eventTitlePh: '发生了什么？——“漫长的冬天”“奶奶抵达纽约”…',
      when: '时间',
      lasts: '持续一段时间',
      weight: '重要性',
      importance: {
        minor: '次要',
        minorHint: '放大时显示',
        notable: '值得注意',
        notableHint: '大多数缩放级别下显示',
        major: '重大',
        majorHint: '始终显示，加粗'
      },
      who: '人物',
      remove: '移除',
      removeName: '移除{name}',
      addNoun: '添加{noun}',
      whoPh: '谁参与了？',
      where: '地点',
      placePh: '地点（可选）',
      eraDescPh: '这个时代有何特征？',
      eventDescPh: '事情的经过…',
      add: '加入编年史',
      save: '保存',
      saveEraFailed: '无法保存时代',
      saveEventFailed: '无法保存事件',
      added: '已添加{name}',
      saved: '已保存{name}',
      deleteEra: '删除时代“{name}”？',
      deleteEvent: '删除事件“{name}”？',
      deleteEraBody: '该色带将从所有视图中移除，人物不受影响。',
      deleteEventBody: '它将从时间线和所有人物资料中移除。'
    },
    date: {
      year: '年份',
      month: '月份',
      day: '日',
      months: [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月'
      ]
    },
    kinds: {
      milestone: '里程碑',
      battle: '战役',
      war: '战争',
      coronation: '加冕',
      founding: '建立',
      migration: '迁徙',
      journey: '旅程',
      meeting: '初遇',
      wedding: '婚礼',
      treaty: '条约',
      discovery: '发现',
      disaster: '灾难',
      betrayal: '背叛',
      prophecy: '预言',
      celebration: '庆典',
      loss: '离世',
      custom: '其他'
    },
    packs: {
      world: {
        label: '世界历史',
        hint: '战争、王朝与革命，1700 → 今天'
      },
      generations: {
        label: '世代',
        hint: '迷惘的一代 → 阿尔法世代'
      },
      centuries: {
        label: '世纪',
        hint: '在整个项目中每个世纪一条色带'
      },
      fantasy: {
        label: '奇幻纪元',
        hint: '神话 → 王者 → 黑铁 → 黄昏，按你的年份分配'
      }
    },
    presets: {
      century: '{n}世纪',
      eras: {
        ageOfEnlightenment: {
          name: '启蒙时代',
          description: '理性、科学与人权。'
        },
        industrialRevolution: {
          name: '工业革命',
          description: '蒸汽、工厂与城市化。'
        },
        napoleonicWars: {
          name: '拿破仑战争',
          description: '欧洲与拿破仑为敌，也为他而战。'
        },
        victorianEra: {
          name: '维多利亚时代',
          description: '维多利亚女王统治时期。'
        },
        theGildedAge: {
          name: '镀金时代',
          description: '铁路、财富与急剧变革。'
        },
        worldWarI: {
          name: '第一次世界大战',
          description: '一战。'
        },
        theRoaringTwenties: {
          name: '咆哮的二十年代',
          description: '爵士乐、繁荣与新的自由。'
        },
        theGreatDepression: {
          name: '大萧条',
          description: '全球经济困顿。'
        },
        worldWarII: {
          name: '第二次世界大战',
          description: '二战。'
        },
        coldWar: {
          name: '冷战',
          description: '核阴影下的东西方对峙。'
        },
        spaceAge: {
          name: '太空时代',
          description: '从人造卫星到登月。'
        },
        digitalAge: {
          name: '数字时代',
          description: '互联网改变一切。'
        },
        lostGeneration: {
          name: '迷惘的一代',
          description: '在一战中成年。'
        },
        greatestGeneration: {
          name: '最伟大的一代',
          description: '在大萧条中长大，经历了二战。'
        },
        silentGeneration: {
          name: '沉默的一代',
          description: '大萧条与战争中的孩子。'
        },
        babyBoomers: {
          name: '婴儿潮一代',
          description: '战后婴儿潮。'
        },
        generationX: {
          name: 'X世代',
          description: '冷战后期的“钥匙儿童”。'
        },
        millennials: {
          name: '千禧一代',
          description: '伴随互联网成年。'
        },
        generationZ: {
          name: 'Z世代',
          description: '首批真正的数字原住民。'
        },
        generationAlpha: {
          name: '阿尔法世代',
          description: '生于智能手机与人工智能时代。'
        },
        ageOfMyth: {
          name: '神话纪元',
          description: '传说行走于大地之时。'
        },
        ageOfKings: {
          name: '王者纪元',
          description: '王冠崛起，家族建立。'
        },
        ageOfIron: {
          name: '黑铁纪元',
          description: '战争、征服与钢铁。'
        },
        ageOfTwilight: {
          name: '黄昏纪元',
          description: '旧日力量逐渐消逝。'
        }
      }
    }
  },
  groups: {
    title: '分组',
    hint: '把成员拖入圆环 · 拖动圆环排列 · 点击成员进行管理',
    arrangeTitle: '将分组排成一圈',
    arrangeVennTitle: '让共有成员的分组彼此重叠，其余保持分开',
    style: {
      label: '分组样式',
      rings: '圆环',
      venn: '维恩',
      ringsHint: '固定的圆圈，共有成员以连线牵在中间',
      vennHint: '圆圈伸展包住共有成员，像维恩图一样重叠'
    },
    arrange: '排列',
    newGroup: '新建分组',
    emptySceneTitle: '此场景中没有分组',
    emptyTitle: '还没有分组',
    emptyText:
      '把成员分成家族、公司、学校、行会——任何你喜欢的阵营。同属多个分组的成员会停留在它们之间的中间地带。',
    createGroup: '创建分组',
    createFirstGroup: '创建第一个分组',
    zoomIn: '放大',
    zoomOut: '缩小',
    fitAll: '显示全部',
    focus: '聚焦',
    gender: '性别',
    life: '生死',
    all: '全部',
    unknown: '未知',
    living: '在世',
    remembered: '已故',
    showGroup: '显示分组',
    hideGroup: '隐藏分组',
    editGroup: '编辑分组',
    sharedCount: '{n}人属于多个分组',
    unassigned: '未分组',
    trayHint: '拖到圆环上',
    trayMoreTitle: '在右侧成员列表中筛选，再从那里拖入成员',
    trayMore: '另有{n}人',
    groupName: '分组名称',
    groupIcon: '分组图标',
    save: '保存',
    unnamed: '未命名',
    removeFromGroup: '移出分组',
    addToGroup: '加入分组…',
    openProfile: '查看资料',
    close: '关闭',
    scenes: '场景',
    scenesHint: '每个场景保留各自的分组位置——成员归属是共享的',
    addScene: '新建空白场景',
    duplicateScene: '复制当前场景',
    deleteScene: '删除场景',
    defaultGroupName: '分组{n}',
    unnamedGroup: '未命名分组',
    sceneGroupsOne: '{n}个分组',
    sceneGroupsOther: '{n}个分组',
    sceneTooltip: '{groups} · 场景中{n}人',
    defaultSceneName: '场景{n}'
  },
  kinship: {
    title: '亲属',
    unnamed: '未命名',
    tabs: {
      lens: '视角',
      walk: '推算',
      insights: '洞察'
    },
    pane: {
      quizTitle: '亲属测验——你有多了解这个家族？',
      quiz: '测验',
      throughEyes: '视角人物',
      startingFrom: '起点',
      selectToBegin: '在关系图上选择一个人开始',
      useName: '改用{name}',
      lensOn: '视角已开启',
      lensOff: '以此人的视角看家族',
      lensOnSub: '每个节点都标出与{name}的关系',
      lensOffSub: '为每个人标注亲属关系',
      closestKin: '最近亲属'
    },
    filters: {
      all: {
        label: '全部',
        title: '所有人，均已标注'
      },
      blood: {
        label: '血亲',
        title: '仅血亲'
      },
      marriage: {
        label: '姻亲',
        title: '配偶、姻亲和继亲'
      },
      ancestors: {
        label: '祖先',
        title: '向上的直系'
      },
      descendants: {
        label: '后代',
        title: '此人的所有后代'
      }
    },
    classes: {
      blood: '血亲',
      spouse: '配偶',
      marriage: '姻亲',
      step: '继亲',
      social: '社交',
      distant: '更远'
    },
    walk: {
      up: '向上',
      across: '平辈',
      down: '向下',
      married: '婚姻',
      removeStep: '移除这一步',
      tapSteps: '点击步骤组成关系链…',
      clear: '清空关系链',
      found: '找到{n}人',
      nobody: '没有符合的人'
    },
    insights: {
      family: '家族',
      islands: '孤岛',
      linchpinsStat: '关键人物',
      tangledStat: '交缠',
      linchpinsTitle: '移除其中任何一人，家族就会分裂',
      linchpins: '关键人物',
      cutOffOne: '没有{name}，{n}人将被隔断',
      cutOffOther: '没有{name}，{n}人将被隔断',
      holds: '维系{n}人',
      founders: '家族始祖',
      founderStat: '{d}名后代 · {g}代',
      tangledTitle: '同时也是血亲的伴侣',
      tangled: '交缠的根',
      islandsTitle: '彼此毫无联系的群体',
      islandsHead: '孤岛',
      islandOne: '{n}人——{name}…',
      islandOther: '{n}人——{name}…',
      empty: '添加一些父母和子女，即可看到家族结构。'
    },
    quiz: {
      title: '亲属测验',
      score: '得分',
      streak: '连对',
      closeEsc: '关闭（Esc）',
      close: '关闭',
      emptyTitle: '先让家族树长大一点',
      emptyText: '测验需要一些父母、子女和配偶才能出题。',
      correct: '答对',
      bestStreak: '最佳连对：',
      playAgain: '再玩一次',
      kinds: {
        name: '说出关系',
        who: '找出亲属',
        hops: '六度分隔'
      },
      questions: {
        name: '{b}是{a}的什么人？',
        who: '谁是{a}的{rel}？',
        hops: '从{a}到{b}要经过几层关系？'
      },
      notQuite: '不太对——',
      hopsNoteOne: '相隔{n}层关系——在关系图上追溯即可看到整条链。',
      hopsNoteOther: '相隔{n}层关系——在关系图上追溯即可看到整条链。',
      seeResults: '查看结果',
      next: '下一题',
      cheers: ['完全正确！', '答对了！', '家族史专家！', '一点不差！', '没错！'],
      grades: {
        keeper: {
          title: '家谱守护者',
          sub: '没人比你更了解这个家族。'
        },
        historian: {
          title: '家族史学家',
          sub: '家族聚会可以交给你主持了。'
        },
        cousin: {
          title: '表亲计数员',
          sub: '不错——隔代的亲戚确实难算。'
        },
        distant: {
          title: '远房亲戚',
          sub: '认得人，却分不清关系。'
        },
        stranger: {
          title: '失散多年的陌生人',
          sub: '该好好研究一下亲属视角了！'
        }
      }
    },
    card: {
      flip: '反过来问',
      notFamily: '{b}和{a}不是亲属——相隔{n}层关系',
      noConnection: '{b}和{a}之间毫无联系',
      degree: '亲等',
      degreeValue: '{n}亲等亲属',
      sharedDna: '共享DNA',
      dnaNoneStep: '无——继亲关系',
      dnaNoneMarriage: '无——姻亲关系',
      also: '亦为',
      bloodline: '血缘',
      commonAncestors: '共同祖先',
      commonAncestor: '共同祖先',
      through: '经由',
      explicitSibling: '明确的兄弟姐妹关系',
      directLine: '直系'
    },
    section: {
      groups: {
        ancestors: '祖先',
        siblings: '兄弟姐妹',
        descendants: '后代',
        collateral: '叔伯姑姨与侄甥',
        cousins: '堂表亲',
        marriage: '配偶与姻亲',
        step: '继亲'
      },
      less: '收起',
      empty: '尚无家族记录。',
      pedigreeKnown: '已知世系',
      generationsBack: '上溯代数',
      collapseTitle: '祖先位置中由已在别处出现的人填补的比例',
      collapse: '世系重叠',
      inbreeding: '自身近交系数（F）'
    },
    trace: {
      armedHint: '按住Shift点击另一人以追溯关系',
      cancelEsc: '取消（Esc）',
      dismissEsc: '关闭（Esc）',
      clearEsc: '清除（Esc）',
      clear: '清除',
      noConnection: '{a}和{b}之间没有联系',
      connection: '关系链',
      hopsOne: '{n}步',
      hopsOther: '{n}步',
      view: '查看{name}',
      roleOf: '{role}'
    },
    blood: {
      none: {
        label: '无共同血缘',
        note: '他们的孩子不会有近交。'
      },
      echo: {
        label: '遥远回声',
        note: '约为第三代表亲——在任何古老村落都很常见。'
      },
      distant: {
        label: '远房表亲',
        note: '约为第二代表亲（1.56%）。'
      },
      cousins: {
        label: '表亲婚',
        note: '堂表兄弟姐妹为6.25%。'
      },
      close: {
        label: '近亲',
        note: '相当于叔侄或双重表亲（12.5%）。'
      },
      royal: {
        label: '王室级别',
        note: '只有世代内婚才会这么高。'
      },
      habsburg: {
        label: '哈布斯堡下巴',
        note: '西班牙卡洛斯二世：25.4%。'
      }
    },
    fan: {
      aria: '祖先扇形图',
      dup: '{name}——出现不止一次',
      unknown: '未知'
    },
    lang: {
      aria: '亲属称谓语言',
      nameIn: '用{lang}称呼亲属'
    }
  },
  profile: {
    viewPortrait: '查看肖像',
    present: '至今',
    ageYears: '{n}岁',
    ageYrs: '{n}岁',
    datesUnrecorded: '生卒不详',
    inscription: '题字',
    scrollToUnroll: '滚动展开',
    unroll: '展开',
    leaves: {
      story: '传记',
      family: '家庭',
      bonds: '关系',
      kin: '亲属',
      traits: '特征',
      chron: '编年',
      gallery: '画廊'
    },
    withinTwoBonds: '两层关系内{n}人',
    endedYear: '{year}年结束',
    familyNamed: '家人称谓',
    yes: '是',
    no: '否',
    primary: '主图',
    blankTitle: '一卷待墨',
    blankText: '还没有特征、关系或照片——打开编辑器，为{name}落墨。',
    blankTextAnon: '还没有特征、关系或照片——打开编辑器开始落墨。',
    startEditing: '开始编辑',
    unnamed: '未命名',
    stats: {
      bonds: '关系',
      circle: '亲友圈',
      traits: '特征',
      photos: '照片'
    },
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dateDay: '{y}年{mn}月{d}日',
    dateMonth: '{y}年{mn}月'
  },
  directory: {
    toolbar: {
      search: '搜索成员…',
      filters: '筛选'
    },
    sort: {
      name: 'A–Z',
      year: '年份',
      age: '年龄'
    },
    filters: {
      life: '生平',
      all: '全部',
      living: '在世',
      remembered: '已故',
      gender: '性别',
      unknown: '未知',
      ties: '联系',
      everyone: '所有人',
      connected: '有联系',
      unlinked: '无联系',
      clearOne: '清除{n}个筛选',
      clearOther: '清除{n}个筛选'
    },
    empty: {
      noMatches: '无匹配结果',
      noPeople: '还没有成员',
      noMatchesHint: '试试其他搜索词。',
      noPeopleHint: '在关系图视图中添加家庭成员后，会显示在这里。'
    },
    modes: {
      switchLabel: '名录视图模式',
      showcaseViews: '展示视图',
      showcase: '展示',
      showcaseSub: '换个方式认识每个人',
      showcaseTitle: '展示 — 更多查看所有人的方式',
      grid: {
        label: '网格',
        blurb: '经典的滚动卡片墙'
      },
      wheel: {
        label: '转盘',
        blurb: '3D卡片环 — 拖动即可旋转'
      },
      flow: {
        label: '封面流',
        blurb: '带地面倒影的封面流'
      },
      fan: {
        label: '手牌',
        blurb: '扇形展开的一手牌'
      },
      deck: {
        label: '牌堆',
        blurb: '逐张滑过整副牌'
      },
      hive: {
        label: '蜂巢',
        blurb: '蜂巢 — 每人一个六边形'
      },
      reel: {
        label: '胶片',
        blurb: '旋转的胶片滚筒'
      },
      sheet: {
        label: '表格',
        blurb: '电子表格 — 输入、粘贴并排序每项特征'
      },
      roster: {
        label: '阵容',
        blurb: '格斗游戏的选人画面'
      },
      codex: {
        label: '图鉴',
        blurb: '逐页翻阅的插图图鉴'
      },
      board: {
        label: '线索板',
        blurb: '软木板上的拍立得和红线'
      },
      elements: {
        label: '元素',
        blurb: '家族元素周期表'
      },
      ranks: {
        label: '排行',
        blurb: '领奖台与排行榜竞赛'
      },
      bubbles: {
        label: '气泡',
        blurb: '可重新分组的密集气泡'
      },
      handscroll: {
        label: '长卷',
        blurb: '长卷 — 整个家族绘于一幅画卷，自右向左阅读'
      }
    },
    common: {
      unnamed: '未命名',
      born: '生于{year}',
      died: '卒于{year}',
      deceased: '已故'
    },
    stage: {
      emptyTitle: '没有可发的牌',
      emptyText: '没有匹配的成员 — 请清除搜索或添加成员。',
      prev: '上一个',
      prevHint: '上一个（左方向键）',
      next: '下一个',
      nextHint: '下一个（右方向键）'
    },
    cardStyle: {
      current: '卡片样式：{style}',
      title: '卡片样式',
      sub: '名录如何发牌',
      styles: {
        classic: {
          label: '经典',
          blurb: '原版 — 横幅、头像和数据。'
        },
        poster: {
          label: '全图',
          blurb: '照片铺满卡片，信息浮于其上。'
        },
        holo: {
          label: '闪卡',
          blurb: '烫金集换卡，附HP、招式和稀有度。'
        },
        neon: {
          label: '霓虹',
          blurb: '赛博朋克档案 — 扫描线、故障效果、条形码。'
        },
        arcana: {
          label: '塔罗',
          blurb: '家族塔罗 — 鎏金边框与星光。'
        },
        scroll: {
          label: '立轴',
          blurb: '立轴 — 配有书法与印章的水墨挂轴。'
        },
        moonfan: {
          label: '团扇',
          blurb: '团扇 — 绘有梅、竹与明月的圆形绢扇。'
        }
      }
    },
    hive: {
      emptyTitle: '蜂巢是空的'
    },
    reel: {
      emptyTitle: '胶片是空白的',
      relations: '关系数',
      prevHint: '上一个（上方向键）',
      nextHint: '下一个（下方向键）'
    },
    board: {
      emptyTitle: '暂无线索',
      emptyText: '没有匹配的人物——请清除搜索或添加成员。',
      evidence: '证物',
      subjects: {
        one: '{n}位人物',
        other: '{n}位人物'
      },
      strings: {
        one: '{n}条线',
        other: '{n}条线'
      },
      zoomIn: '放大',
      zoomOut: '缩小',
      fit: '全览',
      fitTitle: '让所有人显示在屏幕上',
      tidy: '整理',
      tidyTitle: '把每张照片放回家族位置',
      hint: '拖动面板平移 · 滚轮缩放 · 拖动照片重新排列',
      deceasedStamp: '已故',
      unnamed: '未命名',
      born: '生于{year}',
      died: '卒于{year}',
      diedAt: '享年{age}岁',
      age: '{age}岁',
      kin: '{n}位亲属',
      children: {
        one: '{n}个子女',
        other: '{n}个子女'
      }
    },
    bubbles: {
      emptyTitle: '没有可吹的泡泡',
      emptyText: '没有匹配的人物——请清除搜索或添加成员。',
      unnamed: '未命名',
      size: '大小',
      group: '分组',
      sizeModes: {
        kin: '关系数',
        children: '子女',
        age: '年龄',
        equal: '等大'
      },
      groupModes: {
        gender: '性别',
        decade: '年代',
        tag: '分组',
        life: '生死',
        family: '家族',
        none: '无'
      },
      everyone: '所有人',
      zoomIn: '放大',
      zoomOut: '缩小',
      fitTitle: '显示全部 (Esc)',
      fitAria: '显示全部',
      foot: {
        people: {
          one: '人',
          other: '人'
        },
        groups: {
          one: '个分组',
          other: '个分组'
        }
      },
      footHint: '滚轮缩放 · 拖动平移 · 点击圆圈深入查看',
      deceased: '已故',
      born: '生于{year}',
      died: '卒于{year}',
      datesUnknown: '日期未知',
      metric: {
        ageUnknown: '年龄未知',
        age: '{n}岁',
        children: {
          one: '{n}个子女',
          other: '{n}个子女'
        },
        connections: {
          one: '{n}个关系',
          other: '{n}个关系'
        }
      },
      groups: {
        other: '其他 / 未知',
        deceased: '已故',
        living: '在世',
        unknownBirth: '出生未知',
        decade: '{n}年代',
        ungrouped: '未分组',
        unconnected: '无关联',
        surnameFamily: '{name}家族',
        familyN: '家族{n}'
      }
    },
    card: {
      unnamed: '未命名',
      datesUnknown: '生卒不详',
      born: '生于 {year}',
      died: '卒于 {year}',
      yr: '岁',
      yrDeceased: '岁†',
      ageYr: '{age} 岁',
      relations: '关系',
      children: '子女',
      deceased: '已故',
      ties: {
        one: '条关系',
        other: '条关系'
      },
      heirs: {
        one: '位后嗣',
        other: '位后嗣'
      },
      tiesCount: {
        one: '{n} 条关系',
        other: '{n} 条关系'
      },
      childrenCount: {
        one: '{n} 个子女',
        other: '{n} 个子女'
      },
      holo: {
        legend: '传奇',
        basic: '基础',
        kinship: '亲缘',
        kinshipText: '从每一段羁绊中汲取力量。',
        legacy: '传承',
        legacyText: '将故事传给下一代。',
        rarity: '稀有度 {n}/5'
      },
      neon: {
        archived: '已归档',
        online: '在线',
        unnamed: '未命名',
        age: '年龄',
        links: '关系',
        heirs: '后嗣',
        origin: '籍贯',
        unknown: '未知'
      }
    },
    handscroll: {
      emptyTitle: '长卷空白',
      emptyText: '没有匹配的成员——清除搜索或添加成员。',
      decade: '{year}年代',
      undated: '年代不详',
      people: {
        one: '{n} 人',
        other: '{n} 人'
      },
      scenes: {
        one: '{n} 个场景',
        other: '{n} 个场景'
      },
      hint: '拖动 · 滚轮 · 方向键'
    },
    codex: {
      title: '图鉴',
      emptyTitle: '图鉴尚未落笔',
      emptyText: '没有匹配的条目——清除搜索或添加人物。',
      entries: {
        one: '{n}条',
        other: '{n}条'
      },
      chronicledCount: '{n}条已立传',
      jumpTo: '跳到 {ch}',
      jumpNo: '编号',
      jumpToNumber: '跳到条目编号',
      entryNo: '第{n}号',
      unnamed: '未命名',
      deceased: '已故',
      living: '在世',
      openProfile: '打开完整档案',
      born: '出生',
      died: '去世',
      age: '年龄',
      unrecorded: '未记载',
      lifespan: '寿命',
      spanUnrecorded: '寿命未记载',
      ageUnknown: '未知',
      ageYears: '{n}岁',
      ageLiving: '{n}岁 · 在世',
      captionUnrecorded: '未记载',
      caption: '{from} – {to} · {age}/{max}岁',
      now: '至今',
      kinship: '亲属',
      kinCap: '亲属',
      groups: {
        parents: '父母',
        partners: '伴侣',
        children: '子女',
        siblings: '兄弟姐妹'
      },
      bond: '关系',
      turnTo: '翻到{name}',
      notInFilter: '不在当前筛选中',
      more: '另有{n}人',
      noBonds: '孑然一身——没有记录任何关系。',
      chronicle: '纪事',
      noBio: '此人的事迹未有记载，这一页仍在等待执笔之人。',
      prev: '上一条',
      prevTitle: '上一条（上或左方向键）',
      next: '下一条',
      nextTitle: '下一条（下或右方向键）',
      folio: '— {i} / {n} —',
      seal: {
        undated: '年代不详',
        discovered: '收录',
        discoveredBce: '收录 · 公元前'
      },
      date: {
        months: [
          '1月',
          '2月',
          '3月',
          '4月',
          '5月',
          '6月',
          '7月',
          '8月',
          '9月',
          '10月',
          '11月',
          '12月'
        ],
        year: '{y}年',
        month: '{y}年{m}',
        day: '{y}年{m}{d}日',
        bce: '公元前{y}'
      }
    },
    roster: {
      emptyTitle: '没有挑战者',
      emptyText: '没有匹配的人物——清除搜索或添加人物。',
      no: '第{n}号',
      departed: '已故',
      unnamed: '未命名',
      selected: '已选定！',
      lockIn: '锁定',
      selectTitle: '选择你的角色',
      keys: {
        left: '左',
        up: '上',
        down: '下',
        right: '右'
      },
      hintMove: '移动',
      hintLock: '锁定',
      fighters: {
        one: '{n}名斗士',
        other: '{n}名斗士'
      },
      life: {
        span: '{b} – {d}',
        born: '生于{y}',
        died: '卒于{y}'
      },
      diedAged: '享年{n}岁',
      ageN: '{n}岁',
      stats: {
        age: '年龄',
        kin: '亲属',
        children: '子女'
      }
    },
    ranks: {
      metricAria: '排名指标',
      metrics: {
        age: {
          label: '年龄',
          blurb: '参考年份时的年龄；已故者按终年计',
          unit: {
            one: '岁',
            other: '岁'
          }
        },
        connections: {
          label: '关系数',
          blurb: '此人参与的全部关系',
          unit: {
            one: '条',
            other: '条'
          }
        },
        children: {
          label: '子女',
          blurb: '记录在案的直系子女',
          unit: {
            one: '人',
            other: '人'
          }
        },
        descendants: {
          label: '后代',
          blurb: '子女、孙辈及以下每一代',
          unit: {
            one: '人',
            other: '人'
          }
        },
        depth: {
          label: '世系',
          blurb: '其上有记录的祖先代数',
          unit: {
            one: '代',
            other: '代'
          }
        },
        siblings: {
          label: '兄弟姐妹',
          blurb: '至少有一位共同父母的人',
          unit: {
            one: '人',
            other: '人'
          }
        }
      },
      ranked: '人上榜',
      unranked: '人未上榜',
      avg: '平均',
      emptyTitle: '暂无竞争者',
      emptyText: '没有匹配的成员——清除搜索或添加成员。',
      topThree: '前三名',
      unnamed: '未命名',
      deceased: '已故',
      podiumNote: '还没有人在“{metric}”上得分',
      colName: '姓名',
      unrankedDivider: '未上榜 · {n}——没有“{metric}”记录',
      tied: '并列',
      deltaNew: '新',
      bornShort: '生于{year}',
      diedShort: '卒于{year}'
    },
    elements: {
      emptyTitle: '尚未发现元素',
      emptyText: '没有匹配的成员——清除搜索或添加成员。',
      deceased: '已故',
      unnamed: '未命名',
      stats: {
        born: '出生',
        died: '去世',
        age: '年龄',
        kin: '亲属',
        children: '子女',
        group: '族'
      },
      groupByAria: '列分组依据',
      groupsLabel: '族',
      colourByAria: '方块着色依据',
      colourLabel: '颜色',
      groupings: {
        decade: '出生年代',
        generation: '世代',
        tag: '分组标签'
      },
      colorings: {
        gender: '性别',
        life: '生存状态',
        group: '分组'
      },
      cats: {
        other: '其他 / 未知',
        living: '在世',
        deceased: '已故',
        undated: '无日期',
        untagged: '无标签'
      },
      tagFallback: '标签',
      hint: '{elements} 个元素 · {groups} 个族 · {periods} 个周期——悬停查看，点击打开',
      gen: '第{n}代',
      decade: '{d}年代',
      massYears: '{age}岁',
      ageAtDeath: '{age}（终年）',
      periodShort: '第{n}周期',
      monthsShort: [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月'
      ],
      dateDay: '{y}年{m}{d}日',
      dateMonth: '{y}年{m}'
    }
  },
  dock: {
    expand: '展开面板',
    collapse: '收起面板',
    inspector: '检查器',
    noDates: '未记录日期',
    tags: '标签',
    openProfile: '打开档案',
    edit: '编辑',
    emptyHint: '在画布上选择一位成员（或从“名录”标签页中挑选），即可在此查看和编辑。',
    noPeopleFound: '未找到成员',
    addNoun: '添加{noun}'
  },
  sheet: {
    aria: '电子表格',
    bar: {
      addRowTitle: '添加一行（空表时按 Enter）',
      addTraitTitle: '添加特征列',
      trait: '特征',
      columnsTitle: '显示或隐藏列',
      columns: '列',
      hidden: '已隐藏 {n}',
      fillDownTitle: '向下填充（Ctrl+D）',
      confirmDelete: '再次点击以删除'
    },
    deleteRows: '删除 {n} 个{nouns}',
    head: {
      selectAll: '全选（Ctrl+A）',
      options: '列选项',
      resize: '拖动调整宽度 · 双击自动适应',
      titleAge: '{year} 年时的年龄（自动计算）— 点击排序',
      titleTies: '关系数量（自动计算）— 点击排序',
      titleGroups: '所属分组 — 点击排序',
      titleField: '{label}（{type}）— 点击排序',
      titleFieldSlot: '{label}（{type} · {slot}槽位）— 点击排序'
    },
    typeNames: {
      text: '文本',
      boolean: '是/否',
      number: '数字',
      number_range: '数值范围',
      select: '选项',
      slider: '滑块',
      date: '日期',
      date_range: '日期范围',
      custom_date: '自定义日期',
      custom_date_range: '自定义日期范围'
    },
    slots: {
      name: '姓名',
      gender: '性别',
      birth: '出生',
      death: '去世',
      highlight: '高亮'
    },
    types: {
      text: '文本',
      number: '数字',
      date: '日期',
      select: '选项',
      boolean: '是 / 否',
      slider: '滑块',
      number_range: '数值范围',
      date_range: '日期范围'
    },
    cols: {
      age: '年龄',
      ties: '关系数',
      groups: '分组',
      showAll: '显示所有列'
    },
    people: {
      one: '人',
      other: '人'
    },
    customNoun: {
      one: '{noun}',
      other: '{noun}'
    },
    addNoun: '添加{noun}',
    addRowHint: '或将多行粘贴到最后一行下方',
    unnamed: '未命名',
    empty: {
      noMatches: '无匹配结果',
      emptyTitle: '空白表格',
      noMatchesText: '没有人符合当前的搜索或筛选条件。',
      emptyText: '添加第一行，或从任意电子表格粘贴一列姓名。'
    },
    status: {
      rows: '{n} 个{nouns}',
      cols: {
        one: '{n} 列',
        other: '{n} 列'
      },
      resort: '重新排序',
      resortTitle: '排序后数据已有变化',
      hint: 'Enter 编辑 · Tab 下一格 · Ctrl+C / Ctrl+V · Del 清除 · Ctrl+D 向下填充 · 右键查看更多',
      saving: '正在保存…',
      notSaved: '未保存',
      saved: '所有更改已保存'
    },
    addCol: {
      title: '新建特征列',
      placeholder: '特征名称，例如：昵称',
      add: '添加列'
    },
    menu: {
      confirm: '再次点击以确认',
      sortAsc: '升序排序',
      sortDesc: '降序排序',
      clearSort: '清除排序',
      fit: '按内容调整宽度',
      selectColumn: '选择整列',
      rename: '重命名特征',
      hide: '隐藏列',
      deleteTrait: '为所有人删除此特征',
      deleteTraitArmed: '再次点击 — 将删除所有值',
      copy: '复制',
      paste: '粘贴',
      clear: '清除内容',
      fillDown: '向下填充',
      openProfile: '打开资料页',
      editForm: '在完整表单中编辑',
      deleteRowsArmed: '再次点击以删除 {n} 个'
    },
    summary: {
      cells: '{n} 个单元格',
      count: '计数 {n}',
      sum: '求和 {n}',
      avg: '平均 {n}',
      min: '最小 {n}',
      max: '最大 {n}'
    },
    fx: {
      selectCell: '选择一个单元格',
      pickGroups: '双击单元格以选择分组',
      calculated: '自动计算',
      pick: '双击以选择',
      empty: '空 — 输入以填写'
    },
    ref: {
      cells: '单元格',
      row: '{name} · 第 {n} 行'
    },
    notice: {
      genericError: '出了点问题',
      saveFailed: '无法保存 — {error}',
      projectChanged: '此编辑保存前项目已切换',
      calculated: '{label}为自动计算，无法直接输入',
      cleared: '已清除 {n} 个单元格',
      cantClear: '计算列和分组单元格无法在此清除',
      filled: {
        one: '已向下填充 {n} 个单元格',
        other: '已向下填充 {n} 个单元格'
      },
      copied: {
        one: '已复制 {n} 个单元格',
        other: '已复制 {n} 个单元格'
      },
      pressCopy: '请按 Ctrl+C 复制',
      pressPaste: '请按 Ctrl+V 粘贴',
      pasted: {
        one: '已粘贴 {n} 个单元格',
        other: '已粘贴 {n} 个单元格'
      },
      pastedAdded: '新增 {n} 个{nouns}',
      pastedBad: '{n} 个不符合特征类型',
      pastedSkipped: '{n} 个落在计算列上',
      nothing: '没有需要更改的内容',
      deletedRows: '已删除 {n} 个{nouns} — Ctrl+Z 撤销',
      colAdded: '已添加“{label}”— 现在每个{noun}都有此特征',
      traitDeleted: '已删除“{label}”— Ctrl+Z 撤销',
      discarded: '该输入不符合特征类型 — 更改已放弃'
    },
    parse: {
      notNumber: '不是数字',
      numRangeShape: '请使用“最小–最大”格式',
      numRangeNumbers: '请输入数字，如“10–20”',
      yesNo: '请输入 yes / no 或 1 / 0',
      notOption: '“{text}”不是可选项',
      dateShape: '请输入年份，或 YYYY-MM-DD',
      dateRangeShape: '请使用“起–止”格式',
      dateRangeDates: '请输入日期，如“1950–1960”',
      notEditable: '此特征类型暂不支持在此编辑'
    },
    picker: {
      findGroup: '查找或新建分组…',
      findOption: '查找或添加选项…',
      newGroup: '新建分组',
      addOption: '添加选项',
      empty: '暂无可选项',
      clear: '清除',
      hintMulti: '移动 · Enter 切换 · Esc 关闭',
      hintSingle: '移动 · Enter 选择 · Esc 关闭'
    }
  },
  personForm: {
    input: {
      notSetHint: '未设置——点击设置',
      notSet: '未设置',
      yes: '是',
      no: '否',
      clear: '清除',
      from: '从',
      to: '至',
      year: '年份',
      reserved: '将随自定义历法推出'
    },
    types: {
      text: '文本',
      boolean: '是 / 否',
      number: '数字',
      number_range: '数字范围',
      select: '选项',
      slider: '滑块',
      date: '日期',
      date_range: '日期范围'
    },
    typeHints: {
      text: '自由文本',
      boolean: '是/否开关',
      number: '单个数字，可带单位',
      number_range: '不确定的区间（a–b）',
      select: '从选项中选一个',
      slider: '两端之间的数值',
      date: '某个时间点',
      date_range: '不确定的时间段'
    },
    slots: {
      name: '姓名',
      gender: '性别',
      birth: '出生',
      death: '去世',
      highlight: '高亮'
    },
    slotHints: {
      name: '文本特征 · 顺序即词序',
      gender: '映射到颜色渐变',
      birth: '日期、年份或范围',
      death: '日期、年份或范围',
      highlight: '有任何值即为节点加环'
    },
    addTrait: '添加特征',
    close: '关闭',
    changeType: '更改类型',
    nameTraitPh: '为这个{type}特征命名…',
    lock: '锁定',
    lockHint: '锁定的特征会出现在每个成员的表单上',
    create: '创建',
    optionN: '选项 {n}',
    row: {
      dragHint: '拖动以排序——放到槽位上即可指定',
      templateHint: '模板特征——出现在每张表单上',
      shownInGraph: '显示在关系图标签中',
      timeframeHint: '此特征适用的时间',
      label: '名称',
      unit: '单位',
      multiline: '多行',
      min: '最小',
      max: '最大',
      step: '步长',
      leftLabel: '左侧标签',
      rightLabel: '右侧标签',
      icon: '图标',
      traitIcon: '特征图标',
      optionColor: '选项颜色',
      optionPh: '选项…',
      removeOption: '移除选项',
      addOption: '添加选项',
      apply: '应用',
      options: '特征选项',
      editTrait: '编辑特征',
      editTraitHint: '名称 · 图标 · 选项',
      unlock: '解锁',
      thisPersonOnly: '仅限此{noun}',
      onEveryForm: '出现在每张表单上',
      showInGraph: '在关系图中显示',
      applyAllHint: '对所有成员的此特征生效',
      applyAll: '应用到全部',
      removeTimeframe: '移除时间范围',
      setTimeframe: '设置时间范围',
      moveToSlot: '移到槽位',
      slotRejects: '{type}特征不能放在这里',
      duplicate: '复制',
      removeFromThis: '从此{noun}移除',
      deleteTrait: '删除特征',
      copyName: '{name}副本'
    },
    unnamed: '未命名',
    bornAbbr: '生于{year}',
    picker: {
      placeholder: '输入姓名…',
      noMatches: '没有匹配的人',
      creating: '正在创建…',
      createAs: '将“{name}”创建为新{noun}'
    },
    dock: {
      leftColor: '渐变左端颜色',
      rightColor: '渐变右端颜色',
      earlier: '在姓名中前移',
      later: '在姓名中后移',
      ringColor: '光环颜色',
      ejectHint: '移出槽位（回到特征列表）',
      eject: '移出槽位',
      dropHere: '放到这里',
      dragHere: '将特征拖到这里'
    },
    livePreview: '实时预览',
    identitySlots: '身份槽位',
    traits: '特征',
    traitsHint: '拖动行的手柄排序 · 放到槽位上即可指定',
    removeRel: '移除关系',
    status: '状态',
    married: '已婚',
    since: '始于',
    ended: '结束',
    siblings: '兄弟姐妹',
    siblingHint: '由共同的父母推算——无需单独的关系',
    viaSharedParents: '经由共同父母',
    new: '新',
    discardLink: '放弃此关联',
    images: '图片',
    imagesLater: '创建后才能添加图片——请先保存。',
    removeImage: '移除图片',
    useAs: '用作{slot}',
    deleteImage: '删除图片',
    addExtraImage: '添加额外图片',
    extra: '额外',
    tags: '标签',
    tagsLater: '创建后才能添加标签——请先保存。',
    saving: '正在保存…',
    saveChanges: '保存更改',
    intentHintDirected: '谁是这位{noun}的{role}？',
    intentHintSym: '{type}：选择另一位{noun}',
    bands: {
      family: '家庭',
      social: '社交',
      power: '权力',
      custom: '自定义'
    },
    roleOf: '{role}',
    imageSlots: {
      portrait: '头像',
      fullbody: '全身',
      background: '背景'
    },
    imageSlotHints: {
      portrait: '头肩像——用作头像',
      fullbody: '站立全身像',
      background: '场景或背景'
    },
    sections: {
      identity: '身份',
      traits: '特征',
      relations: '关系',
      images: '图片',
      tags: '标签'
    },
    editTitle: '编辑：{name}',
    addTitle: '添加{noun}',
    present: '至今',
    onlyTextInName: '只有文本特征才能出现在关系图的姓名中',
    slotRejectsType: '该特征类型不能放入“{slot}”槽位',
    couldNotSave: '无法保存',
    couldNotCreate: '无法创建'
  },
  tagChips: {
    color: '标签颜色',
    typeTitle: '标签类型：{type}',
    remove: '移除标签',
    empty: '还没有标签。',
    addExisting: '添加已有标签…',
    assign: '分配',
    newLabelPh: '新标签名称…',
    typePh: '类型（可选）',
    typeHint: '同类型的标签可在分组视图中比较（例如“family”）',
    add: '添加'
  },
  personModal: {
    inMemoriam: '谨此纪念',
    present: '至今',
    ageYrs: '{n}岁',
    noDates: '未记录日期',
    stats: {
      bonds: '关系',
      circle: '圈子',
      traits: '特征',
      photos: '照片'
    },
    constellation: '星座图',
    withinTwo: '两层关系内共{n}人',
    twoHops: '隔2层',
    kinship: '亲属',
    kinshipSub: '家人称谓',
    story: '故事',
    traits: '特征',
    chronicle: '编年史',
    addEventHint: '添加其参与的故事事件',
    addEvent: '添加事件',
    livedThrough: '经历的时代',
    bonds: '关系',
    endedYear: '结束于{year}',
    gallery: '相册',
    primaryPhoto: '主照片',
    blankTitle: '一段等待书写的故事',
    blankText: '还没有特征、关系或照片——打开编辑器，让{name}鲜活起来。',
    them: '此人',
    startEditing: '开始编辑',
    profileStyle: '档案样式',
    styles: {
      cinematic: '电影',
      scroll: '卷轴'
    },
    styleTitles: {
      cinematic: '电影式档案',
      scroll: '手卷——水墨画风格的档案'
    },
    editNoun: '编辑{noun}',
    edit: '编辑',
    deleteNoun: '删除{noun}',
    closeProfile: '关闭档案',
    prevPhoto: '上一张照片',
    nextPhoto: '下一张照片',
    kin: {
      husband: '丈夫',
      wife: '妻子',
      spouse: '配偶',
      son: '儿子',
      daughter: '女儿',
      child: '子女',
      father: '父亲',
      mother: '母亲',
      parent: '父母',
      adoptedChild: '养子女',
      adoptiveParent: '养父母',
      brother: '兄弟',
      sister: '姐妹',
      sibling: '兄弟姐妹'
    },
    bands: {
      family: '家庭',
      social: '社交',
      power: '权力',
      custom: '其他'
    },
    ev: {
      born: '出生',
      married: '与{name}结婚',
      childBorn: '{name}出生',
      bond: '{role}——{name}',
      bondEnded: '{role}关系结束——{name}',
      with: '与{names}',
      eraBegins: '{name}开始',
      aged: '时年{n}岁',
      died: '去世',
      atAge: '享年{n}岁'
    },
    listSep: '、',
    back: '返回',
    view: '视图',
    backTo: '返回{view}'
  },
  relsView: {
    searchPh: '按姓名搜索…',
    issuesHint: '需要留意的关系',
    issues: '问题',
    filters: '筛选',
    manageTypes: '管理关系类型',
    types: '类型',
    addRel: '添加关系',
    dates: '日期',
    any: '不限',
    dated: '有日期',
    undated: '无日期',
    marriage: '婚姻',
    together: '在一起',
    groupLens: '分组透镜',
    endpointsHint: '哪一端必须在该分组中',
    either: '任一方',
    both: '双方',
    clearFilters: {
      one: '清除{n}个筛选',
      other: '清除{n}个筛选'
    },
    newRel: '新关系',
    personA: '成员 A',
    personB: '成员 B',
    relationship: '关系',
    swapAB: '交换 A 和 B',
    marriedYear: '结婚（年份）',
    sinceYear: '始于（年份）',
    endedYear: '结束（年份）',
    save: '保存',
    colFrom: '从',
    colRelation: '关系',
    colTo: '至',
    viewPerson: '查看{name}',
    unknown: '未知',
    toggleMarried: '点击切换已婚 / 离婚',
    formedHint: '关系建立的年份',
    swapDirection: '反转方向',
    editRel: '编辑关系',
    deleteRel: '删除关系',
    empty: {
      noIssues: '未发现问题',
      noMatches: '没有匹配项',
      noRels: '还没有关系',
      noIssuesText: '所有关系看起来都一致。干得好！',
      noMatchesText: '试试其他搜索词或筛选条件。',
      noRelsText: '连接两位家庭成员即可开始。'
    },
    selectPerson: '选择成员…',
    nameBorn: '{name}（{born}）',
    parentOf: '父母',
    partner: '伴侣',
    all: '全部',
    issue: {
      self: '将一个人与其自身关联',
      missing: '引用了已不存在的成员',
      duplicate: '重复——这两人已有此关系',
      parentYounger: '父母（生于{a}）出生晚于或同年于子女（生于{b}）',
      tooManyParents: '{name}有超过两位亲生父母',
      thisChild: '此子女',
      redundantSibling: '多余——这两人已因共同父母而是兄弟姐妹'
    },
    preview: {
      divorced: '{a}与{b}曾结婚，现已离婚',
      married: '{a}与{b}已婚',
      adopted: '{a}收养了{b}',
      parent: '{a}是{b}的父母',
      generic: '{a}——{b}',
      directed: '{a}是{b}的{role}',
      symmetric: '{a}与{b}是{type}关系'
    },
    err: {
      chooseBoth: '请选择两位成员。',
      self: '成员不能与自己关联。',
      exists: '此关系已存在。',
      couldNotSave: '无法保存。'
    },
    kind: {
      marriage: '婚姻',
      adoption: '收养',
      parentChild: '亲子'
    }
  },
  app: {
    homepage: '主页',
    exportFailed: '导出失败',
    langName: {
      en: '英语',
      'zh-Hans': '简体中文',
      'zh-Hant': '繁体中文',
      nb: '挪威语'
    }
  },
  scenes: {
    label: '场景',
    add: '新建场景',
    duplicate: '复制当前场景',
    remove: '删除场景'
  },
  commands: {
    searchPh: '跳转到成员…',
    unnamed: '未命名',
    born: '生于{year}',
    noMatches: '无匹配结果'
  },
  starChart: {
    section: '星图海报',
    toggle: '以星图装裱',
    frame: {
      circle: '星盘',
      rect: '星图图版'
    },
    hint: '印在夜空上，配有时角刻度环和图例。',
    autoSubtitle: '{count} 颗星的星图',
    legend: '亮度 = 后代数量',
    hour: '{h}时'
  },
  exportModal: {
    title: '导出图片',
    sub: '为项目合成一张图片并保存到任意位置',
    closeEsc: '关闭（Esc）',
    dragReframe: '拖动以调整取景',
    dragFrame: '拖动框选想要的部分',
    empty: '{view}视图中暂无可导出的内容。',
    cropped: '已裁剪',
    reset: '重置',
    view: '视图',
    size: '尺寸',
    preset: {
      fhd: '全高清',
      qhd: 'QHD',
      '4k': '4K 超高清',
      square: '正方形',
      portrait: '竖版',
      a4: '打印 A4 · 300dpi'
    },
    custom: '自定义…',
    format: '格式',
    quality: '质量',
    colours: '配色',
    noAlpha: 'JPEG 不支持透明——请选择 PNG 或 WebP',
    scheme: {
      app: '跟随应用',
      none: '无'
    },
    tint: '环境色晕染',
    margin: '边距',
    text: '文字',
    titlePh: '标题（显示在图片中）',
    subtitlePh: '副标题（可选）',
    stamp: '角落印记——{stamp}',
    crop: '裁剪',
    done: '完成',
    saved: '已保存',
    rendering: '渲染中…',
    download: '下载',
    defaultStamp: '家谱'
  },
  auth: {
    termsPrivacy: '条款与隐私',
    home: '首页',
    back: '返回',
    loginSubtitle: '欢迎回来——登录以继续',
    registerSubtitle: '创建账户，开始你的家谱',
    signIn: '登录',
    createAccount: '创建账户',
    username: '用户名',
    password: '密码',
    hidePassword: '隐藏密码',
    showPassword: '显示密码',
    confirmPassword: '确认密码',
    agreePre: '我同意',
    terms: '服务条款',
    agreeAnd: '和',
    privacyPolicy: '隐私政策',
    agreePost: '',
    or: '或',
    guest: '以访客身份继续',
    guestNote: '使用示例数据体验——高级模式保持锁定。',
    footPre: '你的数据保存在本设备上——详见',
    footPost: '',
    strength: {
      tooShort: '太短',
      okay: '一般',
      good: '良好',
      strong: '很强'
    },
    err: {
      mismatch: '两次输入的密码不一致',
      acceptTerms: '请接受服务条款和隐私政策',
      generic: '出了点问题',
      guest: '无法开始访客会话',
      usernameMin: '用户名至少需要{n}个字符',
      usernameMax: '用户名最多{n}个字符',
      usernameChars: '用户名只能包含字母、数字、点、短横线和下划线',
      passwordMin: '密码至少需要{n}个字符',
      passwordMax: '密码最多{n}个字符',
      taken: '该用户名已被使用',
      invalid: '用户名或密码错误',
      locked: '失败次数过多——请几分钟后再试'
    },
    email: '电子邮箱',
    emailPh: 'you@example.com',
    sb: {
      createTitle: '创建你的账户',
      welcomeTitle: '欢迎回来',
      createSub: '注册后即可开始构建家谱。',
      welcomeSub: '登录以访问你的家谱。',
      wait: '请稍候…',
      signUp: '注册',
      haveAccount: '已有账户？',
      noAccount: '还没有账户？',
      genericError: '出了点问题，请重试。',
      confirmSent: '我们已向{email}发送确认链接。确认后即可登录。'
    }
  },
  ui: {
    search: '搜索…',
    clearSearch: '清除搜索',
    icon: '图标',
    noIcon: '无图标',
    searchIcons: '搜索全部图标…',
    noIconMatch: '没有与“{query}”匹配的图标。'
  },
  storeMsg: {
    welcome: '欢迎',
    welcomeName: '欢迎，{name}',
    welcomeGuest: '欢迎，访客',
    growingTree: '正在培育你的家谱…',
    notProjectFile: '不是项目文件',
    opening: '正在打开{name}',
    switchingProject: '正在切换项目…',
    loadingData: '正在加载成员与关系…',
    yourProfile: '你的个人资料',
    gatheringAccount: '正在获取你的账户…',
    signingOut: '正在退出登录…',
    seeYouSoon: '再见'
  },
  home: {
    born: '{year}年生',
    nav: {
      features: '功能',
      views: '视图',
      explore: '探索',
      about: '关于',
      openEditor: '打开编辑器',
      signIn: '登录',
      getStarted: '立即开始'
    },
    hero: {
      eyebrow: '每个家族都是一个宇宙',
      titleWords: ['把你的', '家族', '化作', '一幅', '*鲜活的', '*星图。'],
      titleLabel: '把你的家族化作一幅鲜活的星图。',
      sub: '描绘真实的祖先，或虚构的王朝。在电影般的时间线上看一生徐徐展开，把亲人聚成发光的家族，在 3D 中漫游你的家族树——即使数千人也丝滑流畅。',
      ctaOpen: '打开你的家族树',
      ctaStart: '免费开始你的家族树',
      ctaDemo: '试玩在线演示',
      demoError: '无法启动演示，请重试',
      trust: '永久免费 · 默认私密 · 桌面与网页',
      scroll: '向下滚动',
      hint: '嘘——点一下夜空'
    },
    features: {
      kicker: '为何与众不同',
      titleLead: '家谱，',
      titleEm: '活起来了',
      titleTail: '。',
      sub: '大多数家谱软件用起来像报税软件。而这一个，像一片任你布置的夜空。',
      items: {
        breathes: {
          title: '会呼吸的家族树',
          text: '物理驱动的关系图：拖动一位祖父母，整个家族随之摇曳。五种布局，从严谨的世代排列到自由漂浮的太空。'
        },
        time: {
          title: '时光旅行',
          text: '拖动时间滑块，看人们出生、成婚、老去。生命线、婚姻缎带与诞生火花——全部带动画。'
        },
        houses: {
          title: '家族与氏族',
          text: '用标签把任何人编入分组——农庄、王朝、船员——看他们聚成可随意重排的发光星团。'
        },
        faces: {
          title: '面孔与故事',
          text: '每个人都有肖像、照片、日期与笔记。打造家族的完整群像，而不只是一张名字表。'
        },
        smooth: {
          title: '流畅得离谱',
          text: '一切基于 WebGL。一万位亲人以 60fps 流畅滑动，环境动画闲置时 CPU 占用为 0%，视图切换如同电影转场。'
        },
        yours: {
          title: '完全属于你',
          text: '默认私密，离线可用。数据留在你身边，可导出为普通文件。没有广告，不挖掘数据，无需信用卡。'
        }
      }
    },
    views: {
      kicker: '五种视角',
      titleLead: '一个家族，',
      titleEm: '五种观看方式。',
      sub: '看同样的十二个人自行重新排列——这是实时演示，尽管点吧。'
    },
    stats: {
      people: '人同在一棵树上——依然丝滑',
      lenses: '种视角看每个家族',
      languages: '种语言，三种主题',
      fps: '环境动画，闲置 CPU 占用 0%'
    },
    marquee: {
      title: '容得下每一种家庭'
    },
    explore: {
      kicker: '社区 · 即将推出',
      titleLead: '探索家族',
      titleEm: '宇宙',
      titleTail: '。',
      sub: '先睹为快，看看大家正在培育怎样的家族树。浏览、点赞、评论和关注将随在线版一同上线——下方每张封面都是程序生成的艺术图，并非截图。'
    },
    about: {
      kicker: '关于作者',
      title: '由一个人亲手打造——他相信家族历史值得更好的软件。',
      body: '你好，我是 Tommy。我做 {app}，是因为我自己的家族怎么也塞不进一张电子表格，而我试过的每个工具都像在填表。背后没有公司，没有追踪，没有风险投资——只是一份从挪威寄出的、漫长的热爱。如果它让你为所爱之人（或某个凌晨两点编出来的王朝）画出一张图，那它就尽到了本分。',
      hello: '打个招呼',
      idea: '建议新功能'
    },
    final: {
      titleAuthed: '你的家族在等你。',
      titleGuest: '开启你的家族故事。',
      subAuthed: '回到编辑器，让星图继续生长。',
      subGuest: '两分钟后，你的前三代人就能出现在画布上。',
      ctaAuthed: '回到你的家族树',
      ctaGuest: '开始你的家族树——免费',
      note: '无需下载 · 无需信用卡 · 只需你的亲人'
    },
    footer: {
      tag: '每个家族都是一幅星图。',
      product: '产品',
      maker: '作者',
      legal: '法律',
      contact: '联系',
      terms: '使用条款',
      privacy: '隐私政策',
      madeWith: '用',
      madeAfter: '与零风投打造',
      love: '爱'
    },
    showcase: {
      live: '实时',
      sep: '：',
      spaceName: '3D 空间',
      groups: {
        farm: '农庄',
        seafarers: '航海人',
        musicians: '音乐家'
      },
      views: {
        tree: {
          title: '鲜活的关系图',
          caption: '由物理驱动、连结每个人的网络——拖动一人，整个家族随之摇曳。'
        },
        timeline: {
          title: '生命线',
          caption: '每个人化作一段寿命——看谁曾同时在世，谁从未相遇。'
        },
        groups: {
          title: '家族与氏族',
          caption: '给人们打上标签编入分组，看他们聚成发光的星座。'
        },
        grid: {
          title: '名录',
          caption: '全体成员的可搜索卡片索引——数千张也能顺畅滚动。'
        },
        space: {
          title: '太空模式',
          caption: '实验性视角——你的王朝在三维空间中漂浮。'
        }
      }
    },
    gallery: {
      filters: {
        all: '全部',
        trending: '热门',
        fictional: '虚构',
        historical: '历史',
        personal: '个人'
      },
      badges: {
        trending: '热门',
        staffPick: '编辑精选',
        new: '新作'
      },
      coverMeta: '{people}人 · {generations}代',
      peoplePill: '{people}人',
      liked: '已点赞！（社区同步即将推出）',
      like: '点赞',
      comments: '评论',
      favorites: '收藏',
      followers: '关注者',
      close: '关闭',
      peekTitle: '社区浏览即将上线',
      peekBody:
        '很快，你就能走进这样的家族树——逐个视图探索，关注作者，留下评论，收藏你喜爱的家族。',
      follow: '关注',
      comment: '评论',
      favorite: '收藏',
      cta: '不如开始你自己的家族树',
      ago: {
        m: '{n}分钟前',
        h: '{n}小时前',
        d: '{n}天前'
      }
    },
    projects: {
      atreides: {
        title: '厄崔迪家族',
        blurb: '从雷托公爵到雷托二世——厄拉科斯上的每条血脉，尽收图中。'
      },
      medici: {
        title: '美第奇王朝',
        blurb: '银行家、教皇与艺术赞助人——文艺复兴时期的佛罗伦萨，尽在一张图中。'
      },
      vestlandet: {
        title: 'Slekta mi — Vestlandet',
        blurb: '四座农庄，七代人，还有一位非常倔强的姑婆。'
      },
      westeros: {
        title: '维斯特洛：各大家族',
        blurb: '史塔克、坦格利安、兰尼斯特——联盟、背叛，一应俱全。'
      },
      bronte: {
        title: '勃朗特一家',
        blurb: '霍沃思牧师住宅，以及每一位曾踏进它的人。'
      },
      kattegat: {
        title: '卡特加特血脉',
        blurb: '拉格纳的儿子们与他们之间的传奇，一次劫掠接一次劫掠。'
      },
      village: {
        title: '外婆的村庄',
        blurb: '克里特岛一面山坡上的每户人家，一直追溯到1840年。'
      },
      bridgerton: {
        title: '布里奇顿家族',
        blurb: '八个兄弟姐妹、一位女王，还有整个上流社会——亲爱的读者。'
      },
      romanov: {
        title: '罗曼诺夫：末代沙皇',
        blurb: '三个世纪的皇室血脉，终结于叶卡捷琳堡。'
      },
      corleone: {
        title: '柯里昂家族',
        blurb: '只谈生意，无关私人——从西西里到太浩湖。'
      },
      curie: {
        title: '居里家族的传承',
        blurb: '一棵家族树，五座诺贝尔奖。孩子们，别有压力。'
      },
      durin: {
        title: '中土世界：都林一脉',
        blurb: '矮人的七位先祖，以及其间的每一把胡子。'
      }
    }
  },
  characterX: {
    parts: {
      afro: '爆炸头',
      angry: '怒眉',
      arched: '弯眉',
      armor: '盔甲',
      backpack: '背包',
      bags: '眼袋',
      balloon: '气球',
      bandage: '绷带',
      bandaid: '创可贴',
      bandaids: '多片创可贴',
      batwings: '蝙蝠翅膀',
      beanie: '毛线帽',
      bell: '喇叭裤',
      beret: '贝雷帽',
      blazer: '西装外套',
      blep: '吐舌',
      blush: '腮红',
      bob: '波波头',
      boots: '靴子',
      bow: '蝴蝶结',
      bowl: '锅盖头',
      bowtie: '领结',
      braid: '辫子',
      buns: '丸子头',
      button: '纽扣鼻',
      cap: '鸭舌帽',
      cape: '斗篷',
      cat: '猫咪嘴',
      catears: '猫耳',
      chin: '下巴胡',
      choker: '颈链',
      chubby: '圆润',
      circlet: '头环',
      closed: '闭眼',
      coat: '大衣',
      cowboy: '牛仔帽',
      crown: '王冠',
      cuffed: '卷边裤',
      curly: '卷曲',
      diamond: '菱形',
      dot: '圆点',
      dots: '点点',
      dress: '连衣裙',
      earrings: '耳环',
      egg: '蛋形',
      elf: '精灵',
      eyepatch: '眼罩',
      facemask: '口罩',
      fang: '小虎牙',
      fedora: '软呢帽',
      flattop: '平头',
      flower: '花饰',
      foxmask: '狐狸面具',
      foxtail: '狐狸尾巴',
      freckles: '雀斑',
      frown: '撇嘴',
      full: '饱满',
      gakuran: '学兰服',
      geta: '木屐',
      glasses: '眼镜',
      goatee: '山羊胡',
      gown: '礼服',
      grin: '咧嘴笑',
      hairclip: '发夹',
      hakama: '袴',
      halo: '光环',
      happy: '开心',
      headband: '发带',
      headphones: '耳机',
      heart: '心形',
      hearts: '爱心',
      heels: '高跟鞋',
      hime: '姬发式',
      hooded: '内双',
      hoodie: '连帽衫',
      idol: '偶像装',
      jacket: '夹克',
      jeans: '牛仔裤',
      jetpack: '喷气背包',
      kimono: '和服',
      kneesocks: '及膝袜',
      lash: '睫毛',
      lashes: '浓睫毛',
      leggings: '打底裤',
      loafers: '乐福鞋',
      long: '长',
      longbangs: '长刘海',
      longskirt: '长裙',
      maryjanes: '玛丽珍鞋',
      messy: '凌乱',
      mohawk: '莫西干头',
      mole: '痣',
      monocle: '单片眼镜',
      monolid: '单眼皮',
      mustache: '八字胡',
      necklace: '项链',
      neutral: '平静',
      none: '无',
      o: 'O形',
      open: '张嘴',
      oval: '椭圆',
      overalls: '背带裤',
      oxfords: '牛津鞋',
      paint: '彩绘',
      pants: '长裤',
      party: '派对帽',
      pearls: '珍珠',
      pirate: '海盗帽',
      plaid: '格纹',
      pleated: '百褶裙',
      pointy: '尖鼻',
      ponytail: '马尾',
      pout: '嘟嘴',
      puffy: '灯笼裤',
      quiver: '箭袋',
      rainboots: '雨靴',
      raised: '挑眉',
      ribbon: '缎带',
      robe: '长袍',
      roman: '罗马鼻',
      round: '圆形',
      sad: '难过',
      sailor: '水手服',
      sandals: '凉鞋',
      scar: '伤疤',
      scarf: '围巾',
      shades: '墨镜',
      sharp: '锐利',
      short: '短发',
      shorts: '短裤',
      sidepart: '侧分',
      skirt: '短裙',
      sleepy: '困倦',
      slickback: '背头',
      slim: '瘦长',
      slippers: '拖鞋',
      small: '小巧',
      smile: '微笑',
      smirk: '坏笑',
      sneakers: '运动鞋',
      soft: '柔和',
      spark: '闪亮',
      spiky: '刺猬头',
      square: '方形',
      star: '星星',
      stars: '群星',
      straight: '平眉',
      stripes: '条纹',
      stubble: '胡茬',
      suit: '西装',
      sweater: '毛衣',
      sword: '剑',
      tail: '尾巴',
      tank: '背心',
      tareme: '垂眼',
      tee: 'T恤',
      teeth: '露齿',
      thick: '浓眉',
      thighhigh: '过膝袜',
      tights: '连裤袜',
      tiny: '小眼',
      tongue: '舌头',
      toothy: '露齿笑',
      top: '礼帽',
      triangle: '三角',
      tsurime: '吊眼',
      tunic: '束腰外衣',
      twintails: '双马尾',
      undercut: '削边头',
      unibrow: '一字眉',
      uniform: '制服',
      wavy: '波浪',
      wide: '宽',
      wings: '翅膀',
      wink: '眨眼',
      witch: '女巫帽',
      wizard: '巫师长须'
    },
    partIds: {
      'beard-full': '络腮胡'
    }
  },
  human3dX: {
    reset: '重置'
  },
  pagesX: {
    couldNotRename: '无法重命名',
    couldNotSave: '无法保存',
    couldNotDuplicate: '无法复制',
    couldNotChangePassword: '无法修改密码',
    sandbox: '沙盒',
    quotaDetail: {
      people: '{n}名成员',
      projects: '{n}个项目',
      photos: '{n}张照片'
    }
  },
  // 名字生成器（WILD_IDEAS C2）—— 名字槽旁的骰子
  nameGen: {
    dice: '推荐名字',
    title: '名字生成器',
    close: '关闭',
    source: '取名风格',
    ownTags: '推荐标签',
    otherTags: '其他标签',
    cultures: '文化',
    tagOption: '{label}（{n}）',
    blendNote: '从 {n} 个名字中学习，并融合{culture}风格。',
    useName: '使用“{name}”',
    empty: '没有生成名字，换个来源试试。',
    reroll: '重新生成',
    surnameFrom: {
      patronym: '姓氏取自父亲的名字',
      parent: '姓氏随父母',
      tag: '该标签最常见的姓氏',
      generated: '自动生成的姓氏'
    },
    corpus: {
      english: '英格兰与盎格鲁-撒克逊',
      norse: '北欧',
      roman: '古罗马',
      slavic: '斯拉夫',
      celtic: '凯尔特',
      elvish: '奇幻（精灵）',
      dwarven: '矮人与兽人',
      japanese: '日本',
      chinese: '中文（拼音）'
    }
  }
}
