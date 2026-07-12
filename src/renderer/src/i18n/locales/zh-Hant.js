// 繁體中文 (Traditional Chinese)
export default {
  topbar: {
    search: '跳到某個人',
    export: '匯出',
    exportImage: '匯出家譜圖片',
    mode: '模式',
    modeHint: '程式模式 — 決定顯示多少功能',
    labs: '實驗室',
    labsOn: '實驗室已開啟 — 可使用實驗性功能',
    labsOff: '實驗室 — 開啟實驗性功能',
    settings: '設定',
    settingsHint: '設定、語言、說明與意見回饋',
    lightMode: '淺色模式',
    darkMode: '深色模式',
    newProject: '新增專案',
    closeProject: '關閉專案'
  },
  mode: {
    simple: '簡易',
    standard: '標準',
    advanced: '進階'
  },
  rail: {
    graph: '關係圖',
    directory: '名錄',
    relationships: '關係',
    timeline: '時間軸',
    groups: '群組',
    addPerson: '新增成員',
    style: '樣式'
  },
  settings: {
    title: '設定',
    tabs: {
      general: '一般',
      help: '說明與文件',
      feedback: '意見回饋',
      about: '關於'
    },
    language: {
      title: '語言',
      desc: '選擇應用程式的顯示語言。此設定會套用至整個程式並儲存供下次使用。'
    },
    appearance: {
      title: '外觀'
    },
    theme: {
      title: '主題',
      desc: '在深色與淺色介面之間切換。',
      light: '淺色',
      dark: '深色'
    },
    programMode: {
      title: '程式模式',
      desc: '控制顯示多少功能。簡易模式保持介面精簡；進階模式解鎖所有工具。'
    },
    close: '關閉'
  },
  help: {
    title: '說明與文件',
    intro: '家譜協助你梳理人物、彼此之間的關係，以及這些關係隨時間的變化。以下是使用指南。',
    gettingStarted: {
      title: '快速上手',
      steps: [
        '使用左側列的 ＋ 按鈕新增成員，或點選「新增成員」按鈕。',
        '開啟某位成員以填寫日期、相片與備註。',
        '在關係圖檢視中連接兩個人以建立關係。',
        '從左側列切換檢視，以關係圖、名錄、時間軸或群組方式檢視你的家庭。',
        '按 Ctrl+S 儲存一個可隨時還原的存檔 — 其餘變更皆會自動儲存。'
      ]
    },
    views: {
      title: '五種檢視',
      items: [
        { name: '關係圖', desc: '人物與關係的互動式網路。可拖曳重新排列。' },
        { name: '名錄', desc: '可搜尋的成員卡片清單。' },
        { name: '關係', desc: '在單一清晰清單中檢視所有關係。' },
        { name: '時間軸', desc: '依年份排列的生命線 — 出生、婚姻等。' },
        { name: '群組', desc: '依共用的標籤將人物分群。' }
      ]
    },
    shortcuts: {
      title: '鍵盤快速鍵',
      items: [
        { keys: 'Ctrl / ⌘ + K', desc: '跳到某個人' },
        { keys: 'Ctrl / ⌘ + S', desc: '儲存存檔' },
        { keys: 'Esc', desc: '關閉對話方塊' }
      ]
    }
  },
  feedback: {
    title: '傳送意見回饋',
    intro: '發現問題或有好點子？本程式的作者很樂意聽取你的意見。',
    typeLabel: '類型',
    type: {
      bug: '問題回報',
      idea: '功能建議',
      praise: '我喜歡的地方',
      other: '其他'
    },
    messageLabel: '你的留言',
    placeholder: '描述你喜歡什麼、哪裡出了問題，或希望應用程式能做到什麼……',
    send: '透過電子郵件傳送',
    note: '這會開啟你的電子郵件應用程式並預先填入留言 — 不會自動傳送任何內容。',
    empty: '請先寫一段簡短的留言，再傳送。'
  },
  about: {
    title: '關於家譜',
    tagline: '一款以本機為優先的家庭與關係圖譜工具。',
    versionLabel: '版本',
    creatorLabel: '作者',
    contactLabel: '聯絡方式',
    tech: '使用 Vue 3、Three.js 與 Electron 建置。',
    privacy: '你的資料保存在本機裝置上 — 本機使用無需帳戶。'
  }
}
