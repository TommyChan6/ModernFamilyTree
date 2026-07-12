// English — the source locale and fallback for every other language.
export default {
  topbar: {
    search: 'Jump to a person',
    export: 'Export',
    exportImage: 'Export an image of your tree',
    mode: 'Mode',
    modeHint: 'Program mode — how much of the app is shown',
    labs: 'Labs',
    labsOn: 'Labs is on — experimental features are available',
    labsOff: 'Labs — switch on experimental features',
    settings: 'Settings',
    settingsHint: 'Settings, language, help & feedback',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    newProject: 'New project',
    closeProject: 'Close project'
  },
  mode: {
    simple: 'Simple',
    standard: 'Standard',
    advanced: 'Advanced'
  },
  rail: {
    graph: 'Graph',
    directory: 'Directory',
    relationships: 'Relationships',
    timeline: 'Timeline',
    groups: 'Groups',
    addPerson: 'Add person',
    style: 'Style'
  },
  settings: {
    title: 'Settings',
    tabs: {
      general: 'General',
      help: 'Help & Docs',
      feedback: 'Feedback',
      about: 'About'
    },
    language: {
      title: 'Language',
      desc: 'Choose the display language for the app. This applies everywhere and is saved for next time.'
    },
    appearance: {
      title: 'Appearance'
    },
    theme: {
      title: 'Theme',
      desc: 'Switch between a dark and light interface.',
      light: 'Light',
      dark: 'Dark'
    },
    programMode: {
      title: 'Program mode',
      desc: 'Controls how many features are shown. Simple keeps things focused; Advanced unlocks every tool.'
    },
    close: 'Close'
  },
  help: {
    title: 'Help & Documentation',
    intro:
      'Family Tree helps you map people, their relationships, and how those change over time. Here is how to get around.',
    gettingStarted: {
      title: 'Getting started',
      steps: [
        'Add a person with the ＋ button on the left rail, or press the Add person button.',
        'Open a person to fill in dates, photos, and notes.',
        'Draw a relationship by connecting two people in the Graph view.',
        'Switch views from the left rail to see your family as a graph, directory, timeline, or groups.',
        'Press Ctrl+S to save a checkpoint you can revert to later — everything else autosaves.'
      ]
    },
    views: {
      title: 'The five views',
      items: [
        {
          name: 'Graph',
          desc: 'The interactive web of people and relationships. Drag to rearrange.'
        },
        { name: 'Directory', desc: 'A searchable card list of everyone in the project.' },
        { name: 'Relationships', desc: 'Every connection in one scannable list.' },
        { name: 'Timeline', desc: 'Lifelines laid out by year — births, marriages, and more.' },
        { name: 'Groups', desc: 'Cluster people by the tags they share.' }
      ]
    },
    shortcuts: {
      title: 'Keyboard shortcuts',
      items: [
        { keys: 'Ctrl / ⌘ + K', desc: 'Jump to a person' },
        { keys: 'Ctrl / ⌘ + S', desc: 'Save a checkpoint' },
        { keys: 'Esc', desc: 'Close a dialog' }
      ]
    }
  },
  feedback: {
    title: 'Send feedback',
    intro: 'Found a bug or have an idea? The creator of this program would love to hear from you.',
    typeLabel: 'Type',
    type: {
      bug: 'Bug report',
      idea: 'Feature idea',
      praise: 'Something I like',
      other: 'Other'
    },
    messageLabel: 'Your message',
    placeholder: 'Describe what you liked, what broke, or what you wish the app could do…',
    send: 'Send via email',
    note: 'This opens your email app with the message pre-filled — nothing is sent automatically.',
    empty: 'Write a short message first, then send.'
  },
  about: {
    title: 'About Family Tree',
    tagline: 'A local-first family & relationship mapper.',
    versionLabel: 'Version',
    creatorLabel: 'Created by',
    contactLabel: 'Contact',
    tech: 'Built with Vue 3, Three.js, and Electron.',
    privacy: 'Your data stays on your device — no accounts are required for local use.'
  }
}
