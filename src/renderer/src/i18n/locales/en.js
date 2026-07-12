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
    character: 'Character',
    addPerson: 'Add person',
    style: 'Style'
  },
  character: {
    experimental: 'Experimental',
    person: 'Person',
    style: 'Style',
    labelPh: 'Name this look…',
    lookName: 'Look {n}',
    addLook: 'New look',
    deleteLook: 'Delete this look',
    confirmDelete: 'Delete "{name}"? This look will be gone for good.',
    create: 'Create a character',
    emptyTitle: 'Give {name} a face',
    emptyHint:
      'Build a portrait from swappable parts — pick pieces, recolor and resize them, then set it as their picture everywhere in the app.',
    noPersons: 'Add a person first — then come back and give them a face.',
    randomize: 'Randomize',
    mirror: 'Mirror',
    undo: 'Undo',
    redo: 'Redo',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    setPortrait: 'Set as portrait',
    portraitBadge: 'This look is the portrait',
    none: 'None',
    size: 'Size',
    colors: 'Colors',
    body: 'Body',
    height: 'Height',
    build: 'Build',
    headSize: 'Head',
    ages: 'Ages',
    ageHint: 'Optionally bind this look to an age range, e.g. a young and an old portrait.',
    ageFrom: 'From',
    ageTo: 'To',
    slots: {
      head: 'Face',
      hair: 'Hair',
      eyes: 'Eyes',
      brows: 'Brows',
      mouth: 'Mouth',
      torso: 'Top',
      legs: 'Bottom',
      feet: 'Shoes',
      headwear: 'Headwear',
      accessory: 'Accessory'
    },
    palette: {
      skin: 'Skin',
      hair: 'Hair',
      eyes: 'Eyes',
      outfitA: 'Top',
      outfitB: 'Bottom',
      accent: 'Accent'
    }
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
  account: {
    myProfile: 'My profile',
    back: 'Back to the app',
    memberSince: 'Member since {date}',
    planFree: 'Free plan',
    profile: {
      title: 'Profile',
      desc: 'How you appear in the app — and, once sharing arrives, to the people you share with.',
      displayName: 'Display name',
      displayNamePh: 'How should we address you?',
      bio: 'About you',
      bioPh: 'A short line about you or your family research…',
      avatar: 'Avatar colour',
      auto: 'Automatic — derived from your username',
      save: 'Save profile',
      saved: 'Saved'
    },
    security: {
      title: 'Security',
      desc: 'Your sign-in details. Changing the password signs out your other devices.',
      username: 'Username',
      usernameNote: 'Usernames can’t be changed.',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Repeat new password',
      change: 'Change password',
      changed: 'Password changed — your other devices were signed out.',
      mismatch: 'The new passwords don’t match',
      signOut: 'Sign out'
    },
    usage: {
      title: 'Plan & usage',
      desc: 'What your current plan includes and how much of it you’re using.',
      people: 'People',
      projects: 'Projects',
      photos: 'Photos'
    },
    projects: {
      title: 'Your projects',
      desc: 'Everything you’ve created, in one place. Click a project to open it.',
      open: 'Open',
      current: 'Open now',
      updated: 'Updated {date}',
      new: 'New project'
    },
    sharing: {
      title: 'Sharing',
      soon: 'Coming soon',
      desc: 'Share a read-only link to a project, or publish snapshot images of your tree. Once it lands, this is where you’ll manage everything you’ve shared.',
      kindProject: 'Project link',
      kindImage: 'Image snapshot',
      visibility: {
        private: 'Private',
        link: 'Anyone with the link',
        public: 'Public'
      },
      copyLink: 'Copy link',
      mockNote:
        'This is a preview of the planned feature — nothing is shared yet, and all of your data stays on this device.'
    }
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
