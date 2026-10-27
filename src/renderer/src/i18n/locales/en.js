// English — the source locale and fallback for every other language.
export default {
  // Relationship dynamics — the sentiment layer + the graph's Dynamics lens
  sentiment: {
    lens: 'Dynamics',
    lensHint: 'Recolour every bond warm ↔ cold by its feeling; width shows how strongly it is felt',
    legendTitle: 'Dynamics',
    close: 'Turn off the Dynamics lens',
    cold: 'Cold',
    neutral: 'Neutral',
    warm: 'Warm',
    faint: 'Faint',
    strong: 'Strong',
    widthNote: 'Line width = intensity',
    ringNote: 'Rings = each person’s overall temperature',
    counts: '{warm} warm · {neutral} neutral · {cold} cold',
    feeling: 'Feeling',
    intensity: 'Intensity',
    feelingAria: 'Feeling, from cold to warm',
    intensityAria: 'Intensity, from faint to strong',
    fromType: 'From type',
    fromTypeTitle: 'Use this type’s default feeling',
    defaultIntensity: 'Default',
    defaultIntensityTitle: 'Use the default intensity',
    typeFeelingHint:
      'How this kind of bond feels by default — the Dynamics lens colours it on the cold ↔ warm ramp. Single bonds can override it.',
    levels: {
      hostile: 'Hostile',
      cool: 'Cool',
      neutral: 'Neutral',
      warm: 'Warm',
      loving: 'Loving'
    },
    style: {
      title: 'Dynamics lens',
      warm: 'Warm feeling',
      cold: 'Cold feeling'
    }
  },
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
    inkOn: 'Ink painting theme (水墨)',
    inkOff: 'Leave the ink painting theme',
    medievalOn: 'Medieval codex theme',
    medievalOff: 'Leave the medieval theme',
    newProject: 'New project',
    closeProject: 'Close project',
    undo: 'Undo the last data edit',
    redo: 'Redo the undone edit',
    projects: 'Projects',
    projectsHint: 'Browse and manage all your projects'
  },
  billing: {
    title: 'Grow your forest',
    eyebrow: 'Plans',
    subtitle:
      'Everything you love stays free. Upgrade for more room, no ads, and the pro tools as they land — and help keep the forest growing.',
    close: 'Close',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'Save {pct}%',
    popular: 'Most popular',
    perMonth: '/ month',
    forever: 'forever',
    noCard: 'No card, no catch',
    billedYearly: 'Billed {amount} once a year',
    billedMonthly: 'Billed monthly · cancel anytime',
    freeIncludes: 'Every view, every layout, Labs',
    soon: 'Soon',
    compare: 'Compare every feature',
    faqTitle: 'Questions',
    faq: {
      cancel: {
        q: 'Can I cancel anytime?',
        a: 'Yes. Cancelling stops the renewal; you keep your plan until the end of the period you paid for, then drop back to Free.'
      },
      downgrade: {
        q: 'What happens to my trees if I go back to Free?',
        a: 'Nothing is deleted. You keep every project, person and photo — you just can’t add more while you’re over the Free limits.'
      },
      secure: {
        q: 'Is paying secure?',
        a: 'Payments are handled by our payment partner on their own secure page. Your card details never touch our app or servers.'
      },
      discounts: {
        q: 'Do you have discounts?',
        a: 'Yearly billing saves about a quarter, and promo codes (for launches, schools and communities) apply at checkout.'
      }
    },
    fine: 'Prices in USD. Taxes may apply where required.',
    sandboxChip: 'Sandbox — no real payments',
    notLiveChip: 'Payments open soon',
    reason: {
      quota: 'You’ve reached a Free plan limit',
      ads: 'Enjoy the forest without ads.',
      feature: 'That feature needs a higher plan.'
    },
    plans: {
      free: { name: 'Free', tagline: 'Everything you need to start growing.' },
      plus: { name: 'Plus', tagline: '10× bigger trees, zero ads, a supporter badge.' },
      pro: { name: 'Pro', tagline: 'For dynasties, researchers and worldbuilders.' },
      guest: { name: 'Guest', tagline: '' }
    },
    limits: { maxProjects: 'projects', maxPersons: 'people', maxImages: 'photos' },
    perks: {
      adFree: 'No ads, anywhere',
      moreProjects: 'More projects',
      morePeople: 'Bigger trees',
      morePhotos: 'More photos',
      supporterBadge: 'Supporter badge',
      earlyLabs: 'Early access to Labs',
      coEdit: 'Co-edit Open Groves',
      hiresExport: 'High-res & print export',
      gedcom: 'GEDCOM import & export',
      aiCredits: 'AI tree-builder credits',
      prioritySupport: 'Priority support'
    },
    cta: {
      guest: 'Create an account first',
      current: 'Your plan',
      included: 'Included',
      switchInterval: 'Switch billing period',
      upgrade: 'Upgrade to {plan}',
      switch: 'Switch to {plan}'
    },
    backToPlans: 'All plans',
    reviewTitle: 'Review your order',
    couponPh: 'Promo code',
    apply: 'Apply',
    couponOk: '{code} applied',
    couponErr: {
      unknown: 'That code doesn’t exist.',
      interval: 'That code only works with yearly billing.'
    },
    annualSavings: 'You save vs monthly',
    dueToday: 'Due today',
    renews: 'Renews {date} at {amount}. Cancel anytime.',
    agree:
      'I agree to the Terms of Service and understand the plan renews automatically until I cancel.',
    continue: 'Continue to secure checkout',
    notifyMe: 'Notify me when payments open',
    waitlisted: 'You’re on the list',
    notLiveBody:
      'Paid plans aren’t on sale yet. Your interest is saved on this device, and the plan will be waiting here when checkout opens.',
    waitlistToast: 'Saved — you’ll find it here when payments open.',
    secureNote: 'Checkout happens on our payment partner’s secure page. We never see your card.',
    sandboxRibbon: 'test mode — no money moves',
    contacting: 'Contacting the payment partner…',
    sandboxBrand: 'Payment partner (sandbox)',
    sandboxBody:
      'This stands in for the real hosted checkout while payments are being built. Pick an outcome to test the flow.',
    simSuccess: 'Simulate successful payment',
    simFail: 'Simulate declined card',
    simCancel: 'Cancel and go back',
    welcome: 'Welcome to {plan}!',
    welcomeBody: 'Thank you for helping the forest grow. Here’s what just unlocked:',
    startExploring: 'Back to my trees',
    declined: 'Payment declined',
    declinedBody:
      'Nothing was charged and your plan hasn’t changed. You can try again whenever you like.',
    tryAgain: 'Try again',
    yearWord: 'year',
    monthWord: 'month',
    upgradeShort: 'Go Plus',
    upgradeHint: 'See plans — more room, no ads',
    limitToast: 'That’s over your Free plan’s limit.',
    seePlans: 'See plans',
    menu: {
      title: 'Go Plus',
      body: '10× bigger trees · no ads',
      billing: 'Plan & billing'
    },
    panel: {
      title: 'Plan & billing',
      desc: 'Your plan, renewal and payment history.',
      renewsOn: 'renews {date}',
      endsOn: 'ends {date} — won’t renew',
      free: 'The free plan — no card on file.',
      guest: 'Create an account to choose a plan.',
      change: 'Change plan',
      upgrade: 'Upgrade',
      cancel: 'Cancel plan',
      resume: 'Keep my plan',
      sandboxNote: 'Sandbox billing: payments are simulated in this build.',
      history: 'Billing history',
      date: 'Date',
      number: 'Invoice',
      item: 'Plan',
      amount: 'Amount',
      status: 'Status',
      inv: { paid: 'Paid', failed: 'Failed' },
      noInvoices: 'No payments yet.',
      cancelTitle: 'Cancel your plan?',
      cancelBody:
        'You keep everything until {date}; after that your account returns to Free. Nothing is deleted.',
      cancelConfirm: 'Cancel plan',
      keep: 'Keep it',
      canceledToast: 'Your plan won’t renew. Thanks for supporting the forest',
      resumedToast: 'Welcome back — your plan will renew as usual.'
    }
  },
  ads: {
    label: 'Ad',
    houseSponsor: 'from FamilyTree',
    remove: 'Remove ads',
    dismiss: 'Hide this ad',
    house: {
      goPlus: {
        title: 'Go ad-free with Plus',
        body: 'No ads, 10× bigger trees and a supporter badge — from $3 a month.',
        cta: 'See Plus'
      },
      room: {
        title: 'Room for 25,000 people',
        body: 'Big dynasties need big trees. Plus gives every project space to grow.',
        cta: 'Get more room'
      },
      pro: {
        title: 'Pro: built for dynasties',
        body: 'The biggest limits, early Labs access, and pro exports and GEDCOM as they land.',
        cta: 'Meet Pro'
      },
      browse: {
        title: 'Wander the forest',
        body: 'Explore anime clans, royal houses and Chinese dynasties — and graft one into your projects.',
        cta: 'Browse trees'
      }
    }
  },
  browse: {
    button: 'Browse',
    buttonHint: 'Browse family trees shared by the community',
    back: 'Back',
    brand: 'Browse',
    eyebrow: 'Community forest',
    title: 'Wander the forest',
    subtitle:
      'Family trees shared by other creators — anime clans, royal houses, Chinese dynasties and sitcom households. Look around, take a copy home, or grow one together.',
    searchPh: 'Search trees, people, tags or @creators',
    try: 'Try',
    surprise: 'Surprise me',
    mockNote:
      'Preview — these creators and trees are samples until the hosted community launches. Downloads and grafts are real.',
    ladderTitle: 'What can I do with someone’s tree?',
    ladderHint:
      'Each creator chooses how much visitors may take, and every mode includes everything before it. Click a mode to filter.',
    modes: {
      glasshouse: {
        name: 'Glasshouse',
        short: 'View only',
        desc: 'Look through the glass: explore every branch, but nothing leaves the greenhouse.'
      },
      seedbank: {
        name: 'Seed Bank',
        short: 'View & download',
        desc: 'Take the seeds home: download the project file to keep, study or open offline.'
      },
      graft: {
        name: 'Graftable',
        short: 'Fork to your projects',
        desc: 'Graft it onto your own tree: copy it into your projects and make it yours.'
      },
      grove: {
        name: 'Open Grove',
        short: 'Edit together',
        desc: 'A shared grove: join as a gardener and help the creator grow it.'
      }
    },
    caps: { view: 'Explore', export: 'Download', fork: 'Graft', edit: 'Co-edit' },
    capsYes: {
      view: 'Browse the tree, people and bonds',
      export: 'Save the project file',
      fork: 'Copy it into your projects',
      edit: 'Join as a gardener'
    },
    capsNo: {
      view: '',
      export: 'Kept in the glasshouse',
      fork: 'The creator keeps the only copy',
      edit: 'Only the creator edits'
    },
    genres: {
      all: 'Everything',
      anime: 'Anime',
      tv: 'TV & film',
      history: 'Royal houses',
      dynasty: 'Chinese dynasties',
      sitcom: 'Sitcoms & dramas',
      myth: 'Mythology'
    },
    sizeLabel: 'Tree size',
    sizes: { any: 'Any size', cozy: 'Cozy', clan: 'Clan', dynasty: 'Dynasty' },
    sizesHint: {
      any: 'Any number of people',
      cozy: 'Up to 15 people',
      clan: '16–21 people',
      dynasty: '22 people or more'
    },
    langs: {
      any: 'Any language',
      en: 'English',
      'zh-Hans': '简体中文',
      'zh-Hant': '繁體中文',
      ja: '日本語'
    },
    sortLabel: 'Sort',
    sort: {
      forYou: 'For you',
      relevance: 'Best match',
      trending: 'Trending',
      loved: 'Most loved',
      fresh: 'Recently updated',
      largest: 'Most people',
      deepest: 'Most generations',
      ancient: 'Oldest roots'
    },
    shelves: {
      forYou: 'Picked for you',
      forYouHint: 'Learns from what you like, save, follow and open',
      collections: 'Collections',
      collectionsHint: 'Hand-picked by the staff gardeners',
      creators: 'Creators to follow',
      creatorsHint: 'The people growing these forests',
      yours: 'Your trees in the forest',
      yoursHint: 'How visitors see your public projects',
      all: 'All trees'
    },
    reasons: {
      because: 'Because you enjoyed {title}',
      creator: 'From {name}, who you follow',
      yours: 'Matches your “{word}” project',
      lang: 'In your language',
      trending: 'Trending right now'
    },
    results: '{n} trees',
    resultsFor: '{n} trees for “{q}”',
    clear: 'Clear filters',
    emptyTitle: 'Nothing growing here… yet',
    emptyBody: 'Try another search, or loosen a filter.',
    yoursEmpty: 'Share one of your trees',
    yoursManage: 'Manage sharing',
    yoursPrivate: '{n} private — make one Public on the Projects page',
    badges: { staff: 'Staff pick', trending: 'Trending', new: 'New' },
    stats: {
      people: 'people',
      gens: 'generations',
      likes: 'likes',
      forks: 'grafts',
      views: 'views'
    },
    card: {
      like: 'Like',
      unlike: 'Unlike',
      save: 'Save for later',
      unsave: 'Remove from saved',
      found: 'Found'
    },
    activity: {
      grafted: 'grafted',
      liked: 'liked',
      joined: 'joined the grove of',
      downloaded: 'downloaded',
      commented: 'commented on'
    },
    detail: {
      close: 'Close',
      updated: 'Updated {ago}',
      saved: 'Saved',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fit: 'Fit',
      zoomHint: 'Scroll to zoom · drag to pan · click a person',
      legend: { parent: 'Parent', spouse: 'Partner', rival: 'Rival', other: 'Other bond' },
      bonds: 'Bonds',
      noBonds: 'No recorded bonds.',
      cast: 'Cast',
      castPh: 'Find a person…',
      access: 'What you can do here',
      download: 'Download project file',
      downloaded: 'Saved {file} — open it any time from the Project menu → Import.',
      graft: 'Graft to my projects',
      grafting: 'Grafting…',
      grafted: '“{name}” was grafted into your projects',
      graftFailed: 'Couldn’t graft: {error}',
      openCopy: 'Open my copy',
      join: 'Join as gardener',
      pending: 'Request sent — waiting for the creator…',
      member: 'You’re a gardener',
      memberNote:
        'Live co-editing arrives with the hosted community. Until then, graft a copy and share ideas in the comments.',
      glassNote:
        'This creator keeps the tree in the glasshouse — leave a comment if you’d love a copy.',
      facts: 'Fun facts',
      comments: 'Comments',
      commentPh: 'Say something kind…',
      post: 'Post',
      you: 'You',
      similar: 'You might also like'
    },
    facts: {
      longest: '{name} lived the longest — {n} years',
      children: '{name} has the most children ({n})',
      married: '{name} married {n} times',
      connected: '{name} is the most connected — {n} bonds',
      rivals: '{n} rivalries on record',
      span: 'Spans {n} years of history',
      gens: '{n} generations deep'
    },
    bonds: {
      parent_child: { fwd: 'Parent of', back: 'Child of' },
      adopted: { fwd: 'Adoptive parent of', back: 'Adopted by' },
      spouse: { fwd: 'Married to', back: 'Married to' },
      partner: { fwd: 'Partner of', back: 'Partner of' },
      sibling: { fwd: 'Sibling of', back: 'Sibling of' },
      friends: { fwd: 'Friends with', back: 'Friends with' },
      likes: { fwd: 'Has a crush on', back: 'Admired by' },
      rival: { fwd: 'Rival of', back: 'Rival of' },
      mentor: { fwd: 'Mentor of', back: 'Student of' },
      subordinate: { fwd: 'Superior of', back: 'Serves' }
    },
    profile: {
      follow: 'Follow',
      following: 'Following',
      followers: 'followers',
      followingN: 'following',
      trees: 'trees',
      likes: 'likes',
      theirTrees: 'Their trees',
      joined: 'Joined {date}',
      badges: {
        staff: 'Staff',
        historian: 'Historian',
        otaku: 'Otaku',
        critic: 'Critic',
        pioneer: 'Pioneer'
      }
    }
  },
  projectsPage: {
    title: 'Your Universes',
    subtitle: 'Every world you are building, gathered in one place.',
    back: 'Back',
    new: 'New project',
    quota: '{used} of {max} projects',
    stats: {
      projects: 'Projects',
      people: 'People',
      bonds: 'Bonds',
      photos: 'Photos'
    },
    searchPh: 'Search projects…',
    filters: {
      all: 'All',
      favorites: 'Favorites',
      public: 'Public',
      private: 'Private'
    },
    sort: {
      updated: 'Recently updated',
      nameAsc: 'Name A–Z',
      nameDesc: 'Name Z–A',
      people: 'Most people',
      newest: 'Newest first',
      oldest: 'Oldest first'
    },
    view: {
      grid: 'Grid view',
      list: 'List view'
    },
    live: 'Live',
    open: 'Open',
    favorite: 'Favorite',
    actions: 'Project actions',
    noDesc: 'No description yet — add one from ⋯ → Edit details.',
    updated: 'Updated {date}',
    visibility: {
      private: 'Private',
      public: 'Public'
    },
    visibilityHint: 'Toggle public / private',
    publicNote:
      'Public sharing goes live with the hosted version — your choice is saved until then.',
    menu: {
      open: 'Open',
      rename: 'Rename',
      edit: 'Edit details',
      duplicate: 'Duplicate',
      delete: 'Delete'
    },
    deleteTitle: 'Delete "{name}"?',
    deleteBody:
      'This permanently deletes its {persons} people, {relationships} relationships and {images} photos.',
    deleteCancel: 'Keep it',
    deleteConfirm: 'Delete forever',
    editTitle: 'Project details',
    editName: 'Name',
    editDesc: 'Description',
    editDescPh: 'What is this world about?',
    editColor: 'Card colour',
    editVisibility: 'Visibility',
    editAccess: 'Visitors can',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Project details saved',
    created: 'Project created — it is waiting in the grid',
    duplicated: 'Project duplicated (photos stay with the original)',
    deleted: 'Project deleted',
    emptyTitle: 'No projects match',
    emptySub: 'Try a different search or filter.'
  },
  history: {
    undid: 'Undid {what}',
    redid: 'Redid {what}',
    kind: {
      persons: 'a person edit',
      relationships: 'a relationship edit',
      fields: 'a trait edit',
      relTypes: 'a relationship-type edit',
      tags: 'a tag edit',
      entity_tags: 'a tag change',
      scene_tags: 'a group change',
      images: 'a photo change',
      characters: 'a character edit',
      generic: 'a change',
      layout_move: 'a move',
      layout_curve: 'a line reshape',
      layout_style: 'a node style',
      layout_layout: 'a layout refresh'
    }
  },
  dialog: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    ok: 'OK',
    delete: 'Delete',
    dismiss: 'Dismiss',
    notice: 'Notice',
    areYouSure: 'Are you sure?',
    undo: 'Undo',
    undoHint: 'You can undo this with Ctrl+Z.'
  },
  confirm: {
    deletePerson: 'Delete {name}?',
    deletePersonBody: 'Their relationships, traits and tags go with them.',
    deletePeople: 'Delete {count} people?',
    deletePeopleBody: 'All of their relationships go with them.',
    deleteSelection: 'Delete {people} people and {bonds} bonds?',
    deleteBonds: 'Delete {count} bonds?',
    deleteBond: 'Delete this {kind} bond?',
    deleteBondBetween: 'The bond between {a} and {b} is removed; both people stay.',
    deleteScene: 'Delete the scene “{name}”?',
    deleteSceneBody: 'Only this arrangement is removed — people and groups stay.',
    deleteSceneGroups: 'Its {count} group placements go with it — people and groups stay.',
    deleteGroup: 'Delete the group “{name}”?',
    deleteGroupBody: 'Its {count} members stay in your project.',
    deleteTrait: 'Delete the trait “{name}”?',
    deleteTraitBody: 'Its values on {count} people are removed too.',
    deleteRelType: 'Delete the relationship type “{name}”?',
    deleteRelTypeBody: 'Its {count} relationships are deleted too.',
    revert: 'Revert to the last checkpoint?',
    revertBody: 'Changes since your last save are discarded.',
    revertConfirm: 'Revert',
    deleteLook: 'Delete this look',
    deleteMap: 'Delete this map'
  },
  toasts: {
    deletedPerson: '{name} deleted',
    deletedPeople: '{count} people deleted',
    deletedBond: 'Bond deleted',
    deletedSelection: 'Selection deleted',
    deleted: 'Deleted',
    saved: 'Checkpoint saved',
    reverted: 'Reverted to the last checkpoint',
    exported: 'Project exported — {file}',
    imported: 'Imported “{name}” as a new project',
    importFailed: 'Import failed: {error}',
    importPhotos: 'Photos are not included in project files.',
    accent: 'Accent colour updated'
  },
  fingerprint: {
    title: 'Family fingerprint',
    menu: 'Family fingerprint',
    open: 'View the family fingerprint',
    ariaOf: 'Family fingerprint of {name}',
    close: 'Close',
    subtitle:
      'A crest drawn from the shape of this tree. It is unique to this project and redraws itself as the family grows.',
    partial: 'Drawn from counts only — the full structure is not available here.',
    downloadPng: 'Download PNG',
    downloadSvg: 'Download SVG',
    saved: 'Saved {name}',
    failed: 'Could not create the image',
    living: 'Same tree, same crest: add a person and it shifts gently.',
    legend: {
      rings: {
        label: 'Rings',
        text: 'One per generation, with a bead for each person ({n} generations, {m} people)'
      },
      petals: {
        label: 'Petals',
        text: 'One per family, repeated at each star point and rising from the parents’ ring ({n} families)'
      },
      shape: {
        label: 'Petal shape',
        text: 'Longer = more children per family (average {n}); sharper = more uneven family sizes'
      },
      symmetry: {
        label: 'Star',
        text: 'One point per founding line, at least three ({m} founding lines)'
      },
      rosette: {
        label: 'Rosette',
        text: 'Interlaced circles for couples, diamonds for remarriages ({n} couples, {m} remarried)'
      },
      core: {
        label: 'Core',
        text: 'Split by gender balance ({n}% / {m}%)'
      },
      threads: {
        label: 'Threads',
        text: 'Friendships, rivalries and other social bonds ({n})'
      },
      halo: {
        label: 'Halo',
        text: 'One bead per decade spanned, large beads on centuries ({n} decades)'
      },
      satellites: {
        label: 'Satellites',
        text: 'Groups not joined to the main tree; sparks for people with no bonds ({n} groups, {m} alone)'
      },
      tints: {
        label: 'Colours',
        text: 'Petals take the most-used tag colours ({n} of {m} tags)'
      }
    }
  },
  projectMenu: {
    button: 'Project',
    unsavedDot: 'Unsaved changes',
    save: 'Save',
    saveHint: 'Commit a checkpoint you can revert to (Ctrl+S)',
    unsaved: 'unsaved',
    revert: 'Revert to saved',
    revertHint: 'Restore the arrangement saved by the last checkpoint',
    exportJson: 'Export project file',
    exportHint: 'Download this whole project (people, traits, bonds, groups, scenes, maps) as JSON',
    importJson: 'Import project file',
    importHint: 'Open a project file exported from this app as a new project',
    present: 'Present',
    presentPh: 'Enter year…',
    presentReset: 'Reset to latest year in data',
    presentAuto: 'Auto · latest year in data',
    stats: 'Statistics',
    members: 'Members',
    relationships: 'Relationships',
    couples: 'Couples',
    generations: 'Generations',
    generationsHint: 'The longest parent → child line in this project'
  },
  mode: {
    simple: 'Simple',
    standard: 'Standard',
    advanced: 'Advanced'
  },
  rail: {
    views: 'Views',
    graph: 'Graph',
    directory: 'Directory',
    relationships: 'Relationships',
    timeline: 'Timeline',
    groups: 'Groups',
    character: 'Character',
    map: 'Map',
    addPerson: 'Add person',
    style: 'Style studio'
  },
  map: {
    time: {
      play: 'Play through time (P)',
      pause: 'Pause (P)',
      prevEvent: 'Previous moment',
      nextEvent: 'Next moment',
      stepBack: 'One year back ([)',
      stepFwd: 'One year forward (])',
      typeYear: 'Type a year to jump to it',
      year: 'YEAR',
      speed: 'Playback speed'
    },
    groups: {
      select: 'Select',
      terrain: 'Terrain',
      realm: 'Realms',
      lines: 'Routes & lines',
      places: 'Places',
      events: 'Events',
      text: 'Text'
    },
    tools: {
      select: 'Select & move',
      pan: 'Pan',
      measure: 'Measure distance',
      erase: 'Eraser',
      land: 'Land',
      water: 'Water / lake',
      forest: 'Forest',
      mountains: 'Mountains',
      hills: 'Hills',
      grass: 'Grassland',
      desert: 'Desert',
      swamp: 'Swamp',
      snow: 'Snow & ice',
      territory: 'Kingdom / faction',
      river: 'River',
      road: 'Road',
      rail: 'Railway',
      searoute: 'Sea route',
      wall: 'Wall',
      border: 'Border',
      place_capital: 'Capital',
      place_city: 'City',
      place_town: 'Town',
      place_village: 'Village',
      place_castle: 'Castle',
      place_port: 'Port',
      place_temple: 'Temple',
      place_tower: 'Tower',
      place_ruin: 'Ruin',
      place_cave: 'Cave',
      place_camp: 'Camp',
      place_mine: 'Mine',
      place_station: 'Station',
      place_landmark: 'Landmark',
      event_battle: 'Battle',
      event_fire: 'Disaster',
      event_crown: 'Coronation',
      event_heart: 'Meeting',
      event_skull: 'Death',
      event_star: 'Discovery',
      event_flag: 'Founding',
      arrow: 'Campaign arrow',
      zone: 'Event zone',
      label: 'Label'
    },
    kinds: {
      land: 'Land',
      water: 'Water',
      forest: 'Forest',
      mountains: 'Mountains',
      hills: 'Hills',
      desert: 'Desert',
      grass: 'Grassland',
      swamp: 'Swamp',
      snow: 'Snow & ice',
      territory: 'Kingdom / faction',
      zone: 'Event zone',
      river: 'River',
      road: 'Road',
      rail: 'Railway',
      wall: 'Wall',
      border: 'Border',
      searoute: 'Sea route',
      arrow: 'Campaign arrow',
      place: 'Place',
      label: 'Label',
      event: 'Event'
    },
    people: {
      toggle: 'People — place them on the map (G)',
      title: 'Place a {noun}',
      search: 'Search…',
      hint: 'Drag someone onto the map, or tap to drop them in the middle.',
      autoPlace: 'Place {n} by their Location',
      flyTo: 'On the map — click to fly there',
      dragOrTap: 'Drag onto the map, or click to place',
      none: 'Nobody matches.',
      unnamed: 'Unnamed'
    },
    inspector: {
      namePh: 'Give it a name…',
      length: 'Length {d}',
      area: 'Area {a} · edge {d}',
      close: 'Close',
      type: 'Type',
      icon: 'Icon',
      group: 'Group',
      noGroup: '— not linked —',
      groupHint: 'Link a Group and the realm takes its color — and its name if it has none.',
      color: 'Color',
      styleColor: 'Style default',
      custom: 'Custom color',
      size: 'Size',
      rotate: 'Rotation',
      when: 'When it exists',
      from: 'From',
      to: 'Until',
      always: 'always',
      fromNow: 'from {y}',
      untilNow: 'until {y}',
      whenHint:
        'Leave blank to show it at every point in time. It fades in and out as the timeline plays.',
      notes: 'Notes',
      notesPh: 'Lore, history, who lives here…',
      duplicate: 'Duplicate (Ctrl+D)',
      front: 'Bring to front',
      back: 'Send to back',
      newEra: 'New era from {y}',
      newEraHint:
        'Ends this the year before and starts an editable copy — for borders that shift or roads that get rebuilt.',
      delete: 'Delete (Del)',
      onMap: 'On the map',
      journey: 'Journey',
      stopNotePh: 'What happened here?',
      goTo: 'Go to this stop',
      removeStop: 'Remove this stop',
      journeyHint:
        'Move the timeline to another year, then drag their portrait — each drag records a stop. Alt-drag shifts the whole journey.',
      follow: 'Follow',
      following: 'Following',
      profile: 'Profile',
      removeFromMap: 'Remove from this map'
    },
    new: {
      kickerFirst: 'Map view',
      kicker: 'New map',
      titleFirst: 'Draw the world your people live in',
      title: 'Start a new map',
      sub: 'Paint lands, realms, rivers and roads, then place your people and watch them travel through time.',
      start: 'Start from',
      starts: {
        generate: 'Generate a world',
        ocean: 'Open ocean',
        land: 'Open land'
      },
      startsBlurb: {
        generate: 'A continent with kingdoms, cities, roads and a railway — all editable.',
        ocean: 'An empty sea. Paint your own coastlines.',
        land: 'Solid ground. Paint lakes, seas and everything else.'
      },
      shapes: {
        landscape: 'Landscape',
        wide: 'Wide',
        square: 'Square',
        portrait: 'Portrait'
      },
      reroll: 'Reroll',
      style: 'Pick a style — you can switch any time',
      namePh: 'Name your map (e.g. “The Known World”)',
      create: 'Create map',
      defaultName: 'The Known World'
    },
    styles: {
      parchment: 'Parchment',
      fantasy: 'Fantasy',
      ink: 'Ink wash',
      shanshui: 'Shanshui 山水',
      qinglu: 'Qinglü 青绿',
      hightech: 'High-tech',
      atlas: 'Atlas'
    },
    stylesBlurb: {
      parchment: 'An explorer’s chart in sepia ink.',
      fantasy: 'A storybook atlas with drifting clouds.',
      ink: '水墨 — Chinese ink on rice paper.',
      shanshui: 'Song-dynasty ink mountains on a mounted scroll.',
      qinglu: 'Wang Ximeng’s mineral blue-green peaks on silk.',
      hightech: 'A holographic tactical display.',
      atlas: 'A clean, modern political map.'
    },
    menu: {
      yourMaps: 'Your maps',
      rename: 'Rename',
      new: 'New map…',
      duplicate: 'Duplicate map',
      delete: 'Delete map',
      style: 'Style',
      ground: 'Unpainted ground is…',
      groundSea: 'Sea',
      groundLand: 'Land',
      export: 'Export as PNG',
      copyName: '{name} (copy)',
      confirmDelete: 'Delete the map “{name}”? This can’t be undone.'
    },
    toast: {
      created: '{name} is ready',
      undo: 'Undone',
      minPoints: 'Can’t remove that one — a shape keeps at least 3 corners, a line 2',
      copied: 'Copied {name} — Ctrl+V pastes it, on any map',
      nothingToPaste: 'Nothing copied yet — select something and press Ctrl+C',
      layerShown: '{layer} layer shown again',
      exportFailed: 'Couldn’t create the image — try the current view instead',
      redo: 'Redone',
      nothingToUndo: 'Nothing to undo',
      nothingToRedo: 'Nothing to redo',
      deleted: 'Deleted — Ctrl+Z brings it back',
      forkTooEarly: 'Move the timeline past this one’s start year first',
      forked: 'New era from {y} — reshape it freely',
      autoPlaced: 'Placed {n} by their Location',
      noLater: 'Nothing later on this map',
      noEarlier: 'Nothing earlier on this map',
      firstJourney: 'Journey started — press Play to watch it',
      tooSmall: 'Too small — drag a bigger shape',
      exported: 'Map saved as PNG'
    },
    zoom: {
      in: 'Zoom in (+)',
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+X)',
      out: 'Zoom out (−)',
      fit: 'Fit the whole map (0)'
    },
    hover: {
      stops: '{n} stops on their journey',
      dragHint: 'Drag to move · double-click for their profile'
    },
    defaults: {
      label: 'Label'
    },
    find: {
      title: 'Find on this map (Ctrl+F)',
      placeholder: 'Find a place, realm or person…',
      none: 'Nothing by that name on this map.',
      empty: 'Nothing named yet — name your places and realms and they show up here.',
      foot: '↑ ↓ to choose · Enter flies there',
      person: 'On the map'
    },
    layers: {
      title: 'Layers',
      terrain: 'Terrain',
      realms: 'Realms',
      routes: 'Routes & lines',
      places: 'Places',
      events: 'Events',
      text: 'Labels',
      people: 'People',
      journeys: 'Journeys',
      names: 'Names',
      snap: 'Snap to places & corners',
      snapHint:
        'Lines and shapes you draw stick to nearby places and corners. Hold Alt to draw freely.',
      showAll: 'Show everything'
    },
    export: {
      sheet: 'Whole map',
      sheetHint: 'The full sheet as it looks in {y}',
      view: 'Current view',
      viewHint: 'Exactly what’s on screen, twice as sharp'
    },
    keys: {
      title: 'Keyboard shortcuts',
      tools: 'Tools',
      edit: 'Editing',
      view: 'View & time',
      undo: 'Undo',
      redo: 'Redo',
      copy: 'Copy',
      paste: 'Paste at the pointer',
      duplicate: 'Duplicate',
      delete: 'Delete the selection',
      nudge: 'Nudge (Shift = 10×)',
      finish: 'Finish a line or ruler',
      cancel: 'Cancel / deselect',
      removePoint: 'Remove a corner',
      noSnap: 'Draw without snapping (hold)',
      pan: 'Pan',
      zoom: 'Zoom in / out',
      fit: 'Fit the whole map',
      find: 'Find',
      people: 'People drawer',
      play: 'Play / pause time',
      step: 'One year back / forward',
      sheet: 'This cheat sheet'
    },
    units: {
      league: '{n} leagues',
      league2: '{n} sq leagues',
      li: '{n} li',
      li2: '{n} sq li',
      km: '{n} km',
      km2: '{n} km²'
    },
    ctx: {
      deletePoint: 'Remove this corner',
      rename: 'Rename',
      duplicate: 'Duplicate',
      copy: 'Copy',
      delete: 'Delete',
      pasteHere: 'Paste here',
      labelHere: 'Add a label here',
      measureFrom: 'Measure from here'
    },
    hint: {
      select:
        'Click to select · drag to move · drag empty space to pan · scroll to zoom · double-click land or sea to edit it',
      pan: 'Drag to pan · scroll to zoom',
      measure:
        'Click to start measuring · keep clicking for a route · double-click or Enter to finish',
      measuring: '{d} so far · click to add a stop · double-click or Enter to finish · Esc clears',
      measured: 'Total {d} · click to measure again · Esc clears',
      shape:
        'Drag a square to move a corner · drag a dot on an edge to add one · Alt-click a corner to remove it',
      erase: 'Click or drag across things to erase them',
      area: '{name}: drag to paint a shape — or click points and press Enter',
      line: '{name}: drag to draw — or click points and double-click to finish',
      point: 'Click to place a {name}',
      clickMode:
        'Click to add points · Enter or double-click to finish · Backspace removes a point · Esc cancels',
      token: 'Drag {name} to record where they are in {y} · Alt-drag moves the whole journey'
    }
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
    newLookTitle: 'A new look',
    chooseStyle: 'Choose an art style — you can switch any time.',
    startRandom: 'Start from a random look',
    startInherit: 'Inherit from parents',
    emptyHint:
      'Build a portrait from swappable parts — pick pieces, recolor and resize them, then set it as their picture everywhere in the app.',
    noPersons: 'Add a person first — then come back and give them a face.',
    randomize: 'Shuffle',
    mirror: 'Mirror',
    undo: 'Undo',
    redo: 'Redo',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    setPortrait: 'Set as portrait',
    portraitSet: 'Portrait updated everywhere',
    portraitBadge: 'This look is the portrait',
    none: 'None',
    size: 'Size',
    colors: 'Colors',
    body: 'Body',
    height: 'Height',
    build: 'Build',
    headSize: 'Head',
    age: 'Age',
    ageStages: {
      child: 'Child',
      teen: 'Teen',
      adult: 'Adult',
      middle: 'Middle-aged',
      elder: 'Elder'
    },
    resetHint: 'Double-click a slider to reset it.',
    ages: 'Age range',
    ageHint: 'Optionally bind this look to an age range, e.g. a young and an old portrait.',
    ageFrom: 'From',
    ageTo: 'To',
    flipPart: 'Flip this part',
    lockHint: 'Lock — keep it when shuffling',
    customColor: 'Custom color',
    presets: 'Palettes',
    applyPreset: 'Apply this palette',
    harmony: 'Outfit harmony',
    harmonyHint: 'Rebuild the outfit colors around the top color.',
    harmonies: {
      complementary: 'Complementary',
      analogous: 'Analogous',
      triad: 'Triad',
      mono: 'Mono'
    },
    groupColors: 'Wear group colors',
    groupColorsHint: "Dress them in one of their groups' colors.",
    fxToggle: 'Ambient motion & particles',
    tabs: {
      parts: 'Parts',
      colors: 'Colors',
      body: 'Body',
      genes: 'Genes'
    },
    groups: {
      face: 'Face',
      hair: 'Hair',
      outfit: 'Outfit',
      extras: 'Extras'
    },
    cams: {
      auto: 'Auto',
      full: 'Full',
      portrait: 'Bust',
      face: 'Face'
    },
    backdrops: {
      studio: 'Studio',
      sunset: 'Sunset',
      night: 'Starry night',
      sakura: 'Sakura',
      forest: 'Firefly forest',
      arcade: 'Arcade',
      paper: 'Paper',
      none: 'Plain'
    },
    expr: {
      neutral: 'Neutral',
      happy: 'Happy',
      laugh: 'Laughing',
      surprised: 'Surprised',
      angry: 'Angry',
      sad: 'Sad',
      smug: 'Smug',
      shy: 'Shy'
    },
    styleNames: {
      anime: 'Anime',
      realistic: 'Realistic',
      simple: 'Simplistic',
      cartoon: 'Cartoon',
      human3d: 'Realistic 3D'
    },
    styleBlurbs: {
      anime: 'Cel-shaded, big sparkling eyes, gacha-hero flair.',
      realistic: 'Painterly light and natural proportions.',
      simple: 'Flat, geometric and friendly — pure shapes.',
      cartoon: 'Bold outlines and a big, cheerful head.',
      human3d:
        'A fully sculptable 3D human — hundreds of face and body sliders, strand hair, outfits, poses and studio lighting.'
    },
    new3d: 'New · Realistic 3D creator',
    inherit: 'Inherit from parents',
    resemblance: 'Resemblance',
    rollChild: 'Roll a family face',
    inherited: 'A face with a family resemblance',
    noParents: 'No parents are linked to this person yet.',
    parentsNoLooks: 'Give their parents a look first — then their features can be passed down.',
    genePool: 'Gene pool',
    genePoolHint: 'Blend two random looks from this project so new faces belong to this world.',
    rollGenePool: 'Roll from the gene pool',
    dna: 'Character code',
    dnaHint: 'Copy this look as a code, or paste one to load it here.',
    copyDna: 'Copy code',
    pasteDna: 'Paste a code…',
    apply: 'Apply',
    dnaCopied: 'Code copied',
    dnaShown: 'Code placed in the box — copy it from there',
    dnaApplied: 'Look loaded',
    dnaBad: "That isn't a valid character code",
    export: 'Export',
    photo: {
      open: 'Photo mode',
      portrait: 'Bust',
      full: 'Full body',
      download: 'Download card',
      setFramed: 'Use as framed portrait',
      close: 'Close'
    },
    slots: {
      back: 'Back',
      head: 'Face',
      hair: 'Hair',
      eyes: 'Eyes',
      brows: 'Brows',
      nose: 'Nose',
      mouth: 'Mouth',
      facialHair: 'Beard',
      marks: 'Marks',
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
      desc: 'Switch between dark, light, the 水墨 ink-painting and the illuminated medieval interface.',
      light: 'Light',
      dark: 'Dark',
      ink: 'Ink',
      medieval: 'Medieval'
    },
    accent: {
      title: 'Accent colour',
      desc: 'Tints buttons, highlights and selections across the whole app.',
      inkNote: 'The ink theme always stamps in cinnabar seal red.',
      medievalNote: 'The medieval theme is always illuminated in lapis and gold.',
      custom: 'Custom colour',
      reset: 'Reset to default',
      presets: {
        periwinkle: 'Periwinkle',
        violet: 'Violet',
        rose: 'Rose',
        coral: 'Coral',
        amber: 'Amber',
        emerald: 'Emerald',
        teal: 'Teal',
        sky: 'Sky'
      }
    },
    programMode: {
      title: 'Program mode',
      desc: 'Controls how many features are shown. Simple keeps things focused; Advanced unlocks every tool.'
    },
    noun: {
      title: 'What do you call them?',
      desc: 'The word this project uses for its entries — Person, Character, Ship, House… Applies to this project only.',
      placeholder: 'Person'
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
        { keys: 'Ctrl / ⌘ + Z', desc: 'Undo the last data edit' },
        { keys: 'Ctrl / ⌘ + X · Ctrl + Y · Ctrl + Shift + Z', desc: 'Redo' },
        { keys: 'Alt + 1 … 7', desc: 'Switch view (Graph, Directory, Relationships…)' },
        { keys: 'Alt + N', desc: 'Add a person' },
        { keys: 'Hold Tab', desc: 'Graph action wheel' },
        { keys: 'Shift + click two people', desc: 'Trace the connection between them' },
        { keys: '?', desc: 'Show this help' },
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
    privacy: 'Your data stays on your device — no accounts are required for local use.',
    copyright: '{holder} — all rights reserved.'
  },
  // The 3D character creator (Character view, 3D style)
  human3d: {
    categories: 'Categories',
    loading: 'Sculpting your character…',
    loadFailed: 'The 3D model could not be loaded.',
    camera: 'Camera',
    lighting: 'Lighting',
    dragToSculpt: 'drag to sculpt · click to edit',
    handleDepthHint: 'turn to the side to pull in depth',
    handle: {
      crown: 'Top of head',
      headSide: 'Side of head',
      forehead: 'Forehead',
      temple: 'Temple',
      brow: 'Brow',
      browTail: 'Brow tail',
      eyeInner: 'Inner eye corner',
      eyeOuter: 'Outer eye corner',
      lid: 'Upper lid',
      noseBridge: 'Nose bridge',
      noseTip: 'Nose tip',
      noseWing: 'Side of nose',
      cheekbone: 'Cheekbone',
      cheek: 'Cheek',
      upperLip: 'Upper lip',
      lowerLip: 'Lower lip',
      mouthCorner: 'Mouth corner',
      chin: 'Chin',
      chinSide: 'Side of chin',
      jawCorner: 'Jaw corner',
      ear: 'Ear',
      neck: 'Neck',
      shoulder: 'Shoulder',
      bust: 'Chest',
      waist: 'Waist',
      belly: 'Belly',
      hip: 'Hip',
      glutes: 'Glutes',
      upperArm: 'Upper arm',
      thigh: 'Thigh',
      calf: 'Calf'
    },
    clickToEdit: 'click to edit',
    expression: 'Expression',
    undo: 'Undo',
    redo: 'Redo',
    randomizeAll: 'Randomize everything',
    sculptMode: 'Sculpt mode: drag features on the face',
    turntable: 'Turntable',
    gaze: 'Eye contact',
    photo: 'Save a photo',
    setPortrait: 'Set as portrait',
    searchSliders: 'Search sliders…',
    asymmetry: 'Edit left and right separately',
    resetGroup: 'Reset this group',
    randomizeGroup: 'Randomize this group',
    archetypes: 'Archetypes',
    family: 'Family resemblance',
    familyHint: 'Blend this face from the parents’ 3D looks.',
    resemblance: 'Resemblance',
    end: {
      'Wild card': 'Wild card',
      'Spitting image': 'Spitting image',
      Narrow: 'Narrow',
      Wide: 'Wide',
      Smaller: 'Smaller',
      Bigger: 'Bigger',
      Less: 'Less',
      More: 'More',
      Younger: 'Younger',
      Older: 'Older',
      In: 'In',
      Out: 'Out',
      Down: 'Down',
      Up: 'Up',
      Back: 'Back',
      Forward: 'Forward',
      Low: 'Low',
      High: 'High',
      Hollow: 'Hollow',
      Full: 'Full',
      Close: 'Close',
      Apart: 'Apart',
      Open: 'Open',
      Short: 'Short',
      Long: 'Long',
      Flat: 'Flat',
      Prominent: 'Prominent',
      Concave: 'Concave',
      Convex: 'Convex',
      Pinched: 'Pinched',
      Relaxed: 'Relaxed',
      Thin: 'Thin',
      Soft: 'Soft',
      Receding: 'Receding',
      Strong: 'Strong',
      Pointed: 'Pointed',
      Triangle: 'Triangle',
      Square: 'Square',
      Round: 'Round',
      Thick: 'Thick',
      Slim: 'Slim',
      Slender: 'Slender',
      Spread: 'Spread',
      Bowed: 'Bowed',
      Knock: 'Knock',
      Female: 'Female',
      Male: 'Male',
      Tall: 'Tall',
      Heavy: 'Heavy',
      Athletic: 'Athletic',
      Uncommon: 'Uncommon',
      Ideal: 'Ideal',
      Small: 'Small',
      Firm: 'Firm',
      Straight: 'Straight',
      Coily: 'Coily',
      Left: 'Left',
      Right: 'Right',
      Petite: 'Petite'
    },
    rollChild: 'Roll a family face',
    noParents3d: 'Give this person’s parents a 3D look to inherit features from them.',
    randomize: 'Randomize',
    randomizeHint: 'Locked sections keep their look when you roll the dice.',
    reset: 'Start over',
    resetFace: 'Neutral face',
    resetAll: 'Default human',
    heritage: 'Heritage blend',
    heritageHint: 'Shapes the face and body; the three always add up to 100%.',
    left: 'Left',
    right: 'Right',
    noMatches: 'No sliders match.',
    skinTone: 'Skin tone',
    style: 'Style',
    fringeTitle: 'Fringe',
    hairColor: 'Colour',
    ombre: 'Ombré tips',
    highlights: 'Highlights',
    brows: {
      thickness: 'Thickness',
      density: 'Density',
      arch: 'Arch'
    },
    beard: {
      length: 'Length',
      density: 'Density',
      stubble: 'Stubble',
      none: 'Clean shaven',
      'short-beard': 'Short beard',
      'full-beard': 'Full beard',
      goatee: 'Goatee',
      'van-dyke': 'Van Dyke',
      mustache: 'Mustache',
      chevron: 'Chevron',
      handlebar: 'Handlebar',
      'chin-strap': 'Chin strap',
      mutton: 'Mutton chops'
    },
    iris: 'Iris',
    irisRing: 'Outer ring',
    hetero: 'Different right eye (heterochromia)',
    mainColor: 'Main colour',
    secondColor: 'Second colour',
    patternTitle: 'Pattern',
    metal: 'Metal & trim',
    poseTitle: 'Pose',
    qualityTitle: 'Render quality',
    qualityHint: 'High adds ambient occlusion, 4× anti-aliasing and full hair density.',
    photoPortrait: 'Portrait',
    photoFull: 'Full body',
    photoView: 'This view',
    transparent: 'Transparent background',
    credits: 'About this model',
    creditsText:
      'Human base mesh, morph targets and rig from MakeHuman (CC0). Hair, skin, eyes and clothing are generated procedurally.',
    group: {
      shape: 'Proportions',
      head: 'Head shape',
      forehead: 'Forehead',
      eyes: 'Eyes',
      nose: 'Nose',
      mouth: 'Mouth & lips',
      cheeks: 'Cheeks',
      jaw: 'Jaw & chin',
      ears: 'Ears',
      neck: 'Neck',
      torso: 'Torso',
      hips: 'Hips',
      arms: 'Arms & hands',
      legs: 'Legs & feet'
    },
    sub: {
      hair: 'Hair',
      brows: 'Brows',
      beard: 'Beard',
      top: 'Top',
      bottom: 'Bottom',
      shoes: 'Shoes',
      acc: 'Accessories'
    },
    years: 'y',
    slider: {
      'head-oval': 'Oval',
      'head-round': 'Round',
      'head-rectangular': 'Rectangular',
      'head-square': 'Square',
      'head-triangular': 'Triangular',
      'head-invertedtriangular': 'Inverted triangle',
      'head-diamond': 'Diamond',
      'head-scale-horiz-decr-incr': 'Width',
      'head-scale-vert-decr-incr': 'Height',
      'head-scale-depth-decr-incr': 'Depth',
      'head-back-scale-depth-decr-incr': 'Back of head',
      'head-fat-decr-incr': 'Fullness',
      'head-age-decr-incr': 'Face age',
      'head-angle-in-out': 'Tilt',
      'head-trans-down-up': 'Head height',
      'head-trans-backward-forward': 'Head forward',
      'head-trans-in-out': 'Head sideways',
      'forehead-scale-vert-decr-incr': 'Height',
      'forehead-trans-backward-forward': 'Slope',
      'forehead-nubian-decr-incr': 'Brow bulge',
      'forehead-temple-decr-incr': 'Temples',
      'eyebrows-trans-down-up': 'Brow height',
      'eyebrows-trans-backward-forward': 'Brow ridge',
      'eyebrows-angle-down-up': 'Brow angle',
      'eye-scale-decr-incr': 'Size',
      'eye-trans-in-out': 'Spacing',
      'eye-trans-down-up': 'Height',
      'eye-height1-decr-incr': 'Inner opening',
      'eye-height2-decr-incr': 'Middle opening',
      'eye-height3-decr-incr': 'Outer opening',
      'eye-corner1-down-up': 'Outer corner (tilt)',
      'eye-corner2-down-up': 'Inner corner',
      'eye-push1-in-out': 'Inner depth',
      'eye-push2-in-out': 'Outer depth',
      'eye-epicanthus-in-out': 'Epicanthic fold',
      'eye-eyefold-down-up': 'Lid fold',
      'eye-eyefold-concave-convex': 'Lid fullness',
      'eye-eyefold-angle-down-up': 'Lid angle',
      'eye-bag-decr-incr': 'Under-eye bags',
      'eye-bag-height-decr-incr': 'Bag height',
      'eye-bag-in-out': 'Bag depth',
      'nose-scale-vert-decr-incr': 'Length',
      'nose-scale-horiz-decr-incr': 'Width',
      'nose-scale-depth-decr-incr': 'Projection',
      'nose-trans-down-up': 'Height',
      'nose-trans-backward-forward': 'Depth',
      'nose-trans-in-out': 'Sideways',
      'nose-width1-decr-incr': 'Bridge width',
      'nose-width2-decr-incr': 'Middle width',
      'nose-width3-decr-incr': 'Base width',
      'nose-hump-decr-incr': 'Bridge hump',
      'nose-curve-concave-convex': 'Profile curve',
      'nose-greek-decr-incr': 'Greek line',
      'nose-point-width-decr-incr': 'Tip width',
      'nose-point-down-up': 'Tip angle',
      'nose-volume-decr-incr': 'Volume',
      'nose-nostrils-width-decr-incr': 'Nostril width',
      'nose-nostrils-angle-down-up': 'Nostril angle',
      'nose-flaring-decr-incr': 'Nostril flare',
      'nose-base-down-up': 'Base',
      'nose-septumangle-decr-incr': 'Septum angle',
      'nose-compression-compress-uncompress': 'Compression',
      'mouth-scale-horiz-decr-incr': 'Width',
      'mouth-scale-vert-decr-incr': 'Height',
      'mouth-scale-depth-decr-incr': 'Depth',
      'mouth-trans-down-up': 'Position',
      'mouth-trans-backward-forward': 'Protrusion',
      'mouth-trans-in-out': 'Sideways',
      'mouth-upperlip-volume-decr-incr': 'Upper lip fullness',
      'mouth-lowerlip-volume-decr-incr': 'Lower lip fullness',
      'mouth-upperlip-height-decr-incr': 'Upper lip height',
      'mouth-lowerlip-height-decr-incr': 'Lower lip height',
      'mouth-upperlip-width-decr-incr': 'Upper lip width',
      'mouth-lowerlip-width-decr-incr': 'Lower lip width',
      'mouth-upperlip-middle-down-up': 'Upper lip centre',
      'mouth-lowerlip-middle-down-up': 'Lower lip centre',
      'mouth-upperlip-ext-down-up': 'Upper lip ends',
      'mouth-lowerlip-ext-down-up': 'Lower lip ends',
      'mouth-cupidsbow-decr-incr': "Cupid's bow",
      'mouth-cupidsbow-width-decr-incr': "Cupid's bow width",
      'mouth-angles-down-up': 'Corners',
      'mouth-philtrum-volume-decr-incr': 'Philtrum',
      'mouth-dimples-in-out': 'Dimples',
      'mouth-laugh-lines-in-out': 'Laugh lines',
      'cheek-bones-decr-incr': 'Cheekbones',
      'cheek-volume-decr-incr': 'Fullness',
      'cheek-inner-decr-incr': 'Inner cheek',
      'cheek-trans-down-up': 'Height',
      'chin-width-decr-incr': 'Chin width',
      'chin-height-decr-incr': 'Chin height',
      'chin-prominent-decr-incr': 'Chin projection',
      'chin-cleft-decr-incr': 'Cleft',
      'chin-jaw-drop-decr-incr': 'Jaw depth',
      'chin-bones-decr-incr': 'Jaw width',
      'chin-prognathism-decr-incr': 'Underbite',
      'ear-scale-decr-incr': 'Size',
      'ear-scale-vert-decr-incr': 'Height',
      'ear-scale-depth-decr-incr': 'Depth',
      'ear-trans-down-up': 'Position',
      'ear-trans-backward-forward': 'Forward',
      'ear-rot-backward-forward': 'Rotation',
      'ear-lobe-decr-incr': 'Lobe',
      'ear-shape-pointed-triangle': 'Pointed ↔ triangle',
      'ear-shape-square-round': 'Square ↔ round',
      'ear-wing-decr-incr': 'Stick-out',
      'ear-flap-decr-incr': 'Flap',
      'neck-scale-horiz-decr-incr': 'Width',
      'neck-scale-depth-decr-incr': 'Depth',
      'neck-scale-vert-decr-incr': 'Length',
      'neck-double-decr-incr': 'Double chin',
      'neck-back-scale-depth-decr-incr': 'Nape',
      'neck-trans-backward-forward': 'Forward',
      'neck-trans-down-up': 'Height',
      'measure-neck-circ-decr-incr': 'Thickness',
      'measure-shoulder-dist-decr-incr': 'Shoulder width',
      'torso-vshape-decr-incr': 'V-shape',
      'torso-scale-horiz-decr-incr': 'Torso width',
      'torso-scale-depth-decr-incr': 'Torso depth',
      'torso-scale-vert-decr-incr': 'Torso length',
      'measure-napetowaist-dist-decr-incr': 'Back length',
      'torso-muscle-pectoral-decr-incr': 'Pectorals',
      'torso-muscle-dorsi-decr-incr': 'Lats',
      'measure-bust-circ-decr-incr': 'Chest',
      'measure-underbust-circ-decr-incr': 'Ribcage',
      'measure-frontchest-dist-decr-incr': 'Chest spread',
      'breast-dist-decr-incr': 'Breast spacing',
      'breast-point-decr-incr': 'Breast shape',
      'breast-trans-down-up': 'Breast height',
      'breast-volume-vert-down-up': 'Breast lift',
      'measure-waist-circ-decr-incr': 'Waist',
      'stomach-pregnant-decr-incr': 'Belly',
      'stomach-tone-decr-incr': 'Abdominal tone',
      'stomach-navel-down-up': 'Navel height',
      'measure-hips-circ-decr-incr': 'Hips',
      'hip-scale-horiz-decr-incr': 'Hip width',
      'hip-scale-depth-decr-incr': 'Hip depth',
      'hip-scale-vert-decr-incr': 'Hip height',
      'hip-waist-down-up': 'Waistline',
      'measure-waisttohip-dist-decr-incr': 'Waist to hip',
      'buttocks-volume-decr-incr': 'Glutes',
      'hip-trans-backward-forward': 'Pelvis tilt',
      'measure-upperarm-length-decr-incr': 'Upper arm length',
      'measure-lowerarm-length-decr-incr': 'Forearm length',
      'measure-upperarm-circ-decr-incr': 'Upper arm size',
      'upperarm-muscle-decr-incr': 'Biceps',
      'upperarm-shoulder-muscle-decr-incr': 'Deltoids',
      'upperarm-fat-decr-incr': 'Upper arm softness',
      'lowerarm-muscle-decr-incr': 'Forearm muscle',
      'lowerarm-fat-decr-incr': 'Forearm softness',
      'measure-wrist-circ-decr-incr': 'Wrist',
      'hand-scale-decr-incr': 'Hand size',
      'hand-fingers-length-decr-incr': 'Finger length',
      'hand-fingers-diameter-decr-incr': 'Finger thickness',
      'hand-fingers-distance-decr-incr': 'Finger spread',
      'upperlegs-height-decr-incr': 'Thigh length',
      'lowerlegs-height-decr-incr': 'Shin length',
      'measure-thigh-circ-decr-incr': 'Thighs',
      'upperleg-muscle-decr-incr': 'Quads',
      'upperleg-fat-decr-incr': 'Thigh softness',
      'measure-knee-circ-decr-incr': 'Knees',
      'measure-calf-circ-decr-incr': 'Calves',
      'lowerleg-muscle-decr-incr': 'Calf muscle',
      'measure-ankle-circ-decr-incr': 'Ankles',
      'leg-valgus-decr-incr': 'Knee angle',
      'foot-scale-decr-incr': 'Foot size'
    },
    macro: {
      gender: 'Sex',
      age: 'Age',
      height: 'Height',
      weight: 'Weight',
      muscle: 'Muscle',
      proportions: 'Proportions',
      breastSize: 'Bust',
      breastFirmness: 'Bust firmness',
      ideal: 'Idealize'
    },
    anc: {
      african: 'African',
      asian: 'East Asian',
      caucasian: 'European'
    },
    cat: {
      presets: 'Presets',
      body: 'Body',
      face: 'Face',
      skin: 'Skin',
      makeup: 'Makeup',
      hair: 'Hair',
      eyes: 'Eyes',
      outfit: 'Outfit',
      pose: 'Pose',
      studio: 'Studio'
    },
    cam: {
      full: 'Full body',
      torso: 'Upper body',
      portrait: 'Portrait',
      eyes: 'Close-up'
    },
    quality: {
      high: 'High',
      balanced: 'Balanced',
      fast: 'Fast'
    },
    skin: {
      flush: 'Rosiness',
      freckles: 'Freckles',
      moles: 'Moles & beauty marks',
      circles: 'Under-eye shadows',
      wrinkles: 'Lines & wrinkles',
      sheen: 'Dewiness',
      detail: 'Pores & texture',
      sss: 'Translucency'
    },
    makeup: {
      lips: 'Lipstick',
      eyes: 'Eyes',
      cheeks: 'Cheeks',
      gloss: 'Gloss',
      shadow: 'Eyeshadow',
      liner: 'Eyeliner',
      mascara: 'Mascara',
      blush: 'Blush'
    },
    hair: {
      length: 'Length',
      volume: 'Volume',
      curl: 'Wave & curl',
      frizz: 'Frizz',
      part: 'Parting',
      density: 'Density',
      gloss: 'Shine',
      grey: 'Grey hair'
    },
    eyes: {
      pupil: 'Pupil size',
      pattern: 'Iris detail',
      scleraRed: 'Redness',
      lashLength: 'Lash length',
      lashDensity: 'Lash density'
    },
    pattern: {
      solid: 'Solid',
      stripes: 'Stripes',
      pinstripe: 'Pinstripe',
      plaid: 'Plaid',
      dots: 'Polka dots',
      gradient: 'Gradient',
      camo: 'Camo'
    },
    lock: {
      body: 'Body',
      face: 'Face',
      skin: 'Skin',
      hair: 'Hair',
      eyes: 'Eyes',
      makeup: 'Makeup',
      outfit: 'Outfit'
    },
    hairStyle: {
      bald: 'Bald',
      buzz: 'Buzz cut',
      crew: 'Crew cut',
      'side-part': 'Side part',
      'slick-back': 'Slicked back',
      pompadour: 'Pompadour',
      undercut: 'Undercut',
      messy: 'Messy',
      'curly-short': 'Short curls',
      mohawk: 'Mohawk',
      pixie: 'Pixie',
      bob: 'Bob',
      shoulder: 'Shoulder length',
      long: 'Long straight',
      'long-wavy': 'Long waves',
      'curly-long': 'Long curls',
      hime: 'Hime cut',
      afro: 'Afro',
      ponytail: 'High ponytail',
      'low-ponytail': 'Low ponytail',
      'twin-tails': 'Twin tails',
      bun: 'Top bun',
      'man-bun': 'Man bun',
      braid: 'Braid'
    },
    fringe: {
      none: 'None',
      blunt: 'Blunt bangs',
      side: 'Side-swept',
      curtain: 'Curtain',
      wispy: 'Wispy'
    },
    brow: {
      natural: 'Natural',
      straight: 'Straight',
      arched: 'Arched',
      thick: 'Thick',
      thin: 'Thin',
      bushy: 'Bushy',
      none: 'None'
    },
    pose: {
      apose: 'A-pose',
      relaxed: 'Relaxed',
      contrapposto: 'Contrapposto',
      wave: 'Wave',
      thinking: 'Thinking',
      heroic: 'Heroic',
      shy: 'Shy',
      clasped: 'Hands clasped'
    },
    expr: {
      neutral: 'Neutral',
      smile: 'Smile',
      grin: 'Big grin',
      laugh: 'Laugh',
      sad: 'Sad',
      angry: 'Angry',
      surprised: 'Surprised',
      fear: 'Afraid',
      disgust: 'Disgust',
      smirk: 'Smirk',
      pout: 'Pout',
      determined: 'Determined',
      sleepy: 'Sleepy',
      wink: 'Wink'
    },
    light: {
      studio: 'Studio',
      atelier: 'Atelier',
      cinematic: 'Cinematic',
      daylight: 'Daylight',
      golden: 'Golden hour',
      moonlight: 'Moonlight',
      neon: 'Neon',
      noir: 'Noir',
      candle: 'Candlelight'
    },
    preset: {
      'young-woman': 'Young woman',
      'young-man': 'Young man',
      elder: 'Grandparent',
      child: 'Child',
      athlete: 'Athlete',
      scholar: 'Scholar',
      royal: 'Royalty',
      knight: 'Knight'
    },
    region: {
      portrait: 'Portrait',
      head: 'Head',
      forehead: 'Forehead & brows',
      eyes: 'Eyes',
      nose: 'Nose',
      mouth: 'Mouth',
      cheeks: 'Cheeks',
      jaw: 'Jaw & chin',
      ears: 'Ears',
      neck: 'Neck',
      torso: 'Torso',
      hips: 'Hips',
      arms: 'Arms',
      legs: 'Legs',
      hair: 'Hair'
    },
    top: {
      none: 'None',
      tank: 'Tank top',
      tee: 'T-shirt',
      longsleeve: 'Long sleeve',
      shirt: 'Button shirt',
      sweater: 'Sweater',
      turtleneck: 'Turtleneck',
      vneck: 'V-neck',
      crop: 'Crop top',
      dress: 'Dress',
      gown: 'Gown',
      robe: 'Robe',
      armor: 'Plate armour'
    },
    bottom: {
      none: 'Underwear',
      trousers: 'Trousers',
      jeans: 'Jeans',
      shorts: 'Shorts',
      leggings: 'Leggings',
      skirt: 'Skirt',
      'midi-skirt': 'Midi skirt',
      'long-skirt': 'Long skirt'
    },
    shoes: {
      none: 'Barefoot',
      sneakers: 'Sneakers',
      boots: 'Boots',
      loafers: 'Loafers',
      socks: 'Socks'
    },
    acc: {
      glasses: 'Glasses',
      sunglasses: 'Sunglasses',
      earrings: 'Earrings',
      necklace: 'Necklace',
      beanie: 'Beanie',
      cap: 'Cap',
      crown: 'Crown',
      headband: 'Headband',
      watch: 'Watch'
    }
  },
  data: {
    relTypes: {
      parent_child: 'Parent / Child',
      adopted: 'Adopted',
      spouse: 'Spouse',
      sibling: 'Sibling',
      partner: 'Partner',
      friends: 'Friend',
      likes: 'Likes',
      rival: 'Rival',
      mentor: 'Mentor / Student',
      subordinate: 'Subordinate'
    },
    relRoles: {
      parent_child: {
        a: 'Parent',
        b: 'Child'
      },
      adopted: {
        a: 'Adoptive parent',
        b: 'Adopted child'
      },
      likes: {
        a: 'Admirer',
        b: 'Crush'
      },
      mentor: {
        a: 'Mentor',
        b: 'Student'
      },
      subordinate: {
        a: 'Superior',
        b: 'Subordinate'
      }
    },
    relStatus: {
      active: 'Active',
      engaged: 'Engaged',
      divorced: 'Divorced',
      widowed: 'Widowed',
      ended: 'Ended',
      estranged: 'Estranged',
      resolved: 'Resolved'
    },
    fields: {
      name: 'Full name',
      gender: 'Gender',
      birth: 'Birth',
      death: 'Death',
      occupation: 'Occupation',
      location: 'Location',
      bio: 'Bio'
    },
    gender: {
      male: 'Male',
      female: 'Female'
    },
    noun: {
      person: 'Person'
    },
    defaults: {
      untitledEvent: 'Untitled event',
      untitledEra: 'Untitled era',
      untitledMap: 'Untitled map',
      newTag: 'New Tag',
      unnamedProject: 'Unnamed Project',
      newScene: 'New Scene',
      scene1: 'Scene 1',
      guest: 'Guest',
      timeline: 'Timeline'
    }
  },
  graph: {
    searchPh: 'Search family members…',
    nameThis: 'Name this {noun}…',
    newNoun: 'New {noun}',
    unnamed: 'Unnamed',
    spot: {
      on: 'Spotlight on',
      choose: 'Choose who takes the spotlight',
      put: 'Put {name} in the spotlight',
      titles: 'Titles — what everyone is to the main character',
      titlesAria: 'Show titles',
      pickerPh: 'Who takes the spotlight?',
      takes: '{name} takes the spotlight'
    },
    ctrl: {
      tiltOffTitle: 'Back to the flat view (T)',
      tiltOnTitle:
        'Tilt into 3D — lay the board down and stand everyone up (T · Q/E to turn · Alt-drag to adjust)',
      tilt: '3D tilt',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      stretchWideTitle: 'Horizontal zoom in — stretch the layout wider (or hold X and scroll)',
      stretchWide: 'Stretch wider',
      squeezeNarrowTitle: 'Horizontal zoom out — squeeze the layout narrower',
      squeezeNarrow: 'Squeeze narrower',
      stretchTallTitle: 'Vertical zoom in — stretch the layout taller (or hold Z and scroll)',
      stretchTall: 'Stretch taller',
      squeezeShortTitle: 'Vertical zoom out — squeeze the layout shorter',
      squeezeShort: 'Squeeze shorter',
      fitAll: 'Fit all',
      resetView: 'Reset view',
      refreshTitle: 'Refresh layout — re-run the family tree algorithm',
      refresh: 'Refresh layout',
      lockNodes: 'Lock node clicks',
      unlockNodes: 'Unlock node clicks',
      lockLines: 'Lock line clicks',
      unlockLines: 'Unlock line clicks',
      autoRotateTitle: 'Auto-rotate (R)',
      autoRotate: 'Auto-rotate',
      layersTitle: 'Generation layers (G)',
      layers: 'Generation layers',
      help3dTitle: 'How to navigate in 3D (?)',
      help3d: 'How to navigate in 3D'
    },
    modes: {
      free: {
        label: 'Free',
        title: 'Free — nodes stay where you put them'
      },
      organic: {
        label: 'Organic',
        title: 'Organic — force-directed layout'
      },
      birth: {
        label: 'Birth',
        title: 'Birth — vertical position by birth date'
      },
      generations: {
        label: 'Generations',
        title: 'Generations — top-down hierarchy'
      },
      spotlight: {
        label: 'Spotlight',
        title: 'Spotlight — a main character at centre stage, everyone else in rings by closeness'
      },
      space: {
        label: 'Space',
        title: 'Space — experimental 3D layout (Labs)'
      }
    },
    scenes: {
      label: 'Scenes',
      add: 'New scene',
      duplicate: 'Duplicate current scene',
      delete: 'Delete scene',
      nameN: 'Scene {n}'
    },
    hud: {
      customize: 'Customize the wheel',
      exit: 'Exit edit mode (Esc)',
      exitAria: 'Exit edit mode',
      linkNext: 'Now click who {name} bonds with',
      deleteConfirm: 'Click it again to confirm',
      pinOrganic: 'Pinning matters in the Organic layout'
    },
    path: {
      armedHint: 'Ctrl-click another person to trace the connection',
      cancel: 'Cancel (Esc)',
      dismiss: 'Dismiss (Esc)',
      clear: 'Clear (Esc)',
      clearAria: 'Clear',
      noConnPre: 'No connection between ',
      noConnMid: ' and ',
      noConnPost: '',
      title: 'Connection',
      hopOne: '{n} hop',
      hopOther: '{n} hops',
      view: 'View {name}',
      roleOf: '{role} of'
    },
    focus: {
      title: 'Focus',
      lineage: 'Lineage',
      marriage: 'Marriage',
      deceased: 'Deceased',
      orbit: 'Orbit',
      default: 'Default',
      paternal: 'Paternal',
      maternal: 'Maternal',
      married: 'Married',
      single: 'Single',
      living: 'Living',
      needDate: 'Set current date first to use this filter',
      needSel: 'Select a person first',
      off: 'Off',
      orbitOne: '{n} hop around the selection',
      orbitOther: '{n} hops around the selection'
    },
    rel: {
      rowTitle: '{count} in use — click to isolate on the canvas',
      weight: 'Weight — structural to the right, repel to the left',
      romance: 'Romance',
      pinesFor: 'pines for',
      vieFor: 'vie for',
      gravityTitle: 'Boosts social-edge springs in the Organic layout',
      gravity: 'Social gravity',
      hintSolo: 'Isolating one type — click it again to reset',
      hint: 'Click a type to isolate · Ctrl-click two people to trace their connection'
    },
    legend: {
      title: 'Legend',
      nodes: 'Nodes',
      lines: 'Lines'
    },
    flash: {
      curveReset: 'Curve reset',
      unavailable: 'Not available right now',
      emptySpot: 'Click an empty spot',
      bondNotNode: 'Click a bond, not a node',
      typeGone: 'That bond type no longer exists',
      alreadyLinked: 'Already linked',
      linked: 'Linked — {type}',
      node: 'Node',
      released: '{name} released',
      pinned: '{name} pinned',
      tagAdded: 'Added “{tag}”',
      tagRemoved: 'Removed “{tag}”',
      alreadyEnded: 'Already ended',
      needYear: 'Set a current year first',
      ended: 'Ended {year}',
      noDirection: 'That bond has no direction',
      flipped: 'Direction flipped',
      restored: 'Restored the {type} arrangement',
      curveHint: 'Drag the line or its handles · double-click to reset',
      timeDrag: 'Drag people up or down to change their birth year'
    },
    canvas: {
      gen: 'Gen {n}',
      newGen: 'New Gen',
      now: 'Now · {year}'
    },
    rings: {
      main: 'Main character',
      inner: 'Inner circle',
      close: 'Close family',
      extended: 'Extended family',
      distant: 'Distant kin',
      far: 'Far reaches',
      edge: 'Edge of the story',
      outside: 'Not connected'
    },
    timeDrag: {
      badge: 'b. {year} ({delta})',
      badgeMany: '{n} lives · {delta} yr',
      movedManyLater: '{count} lives moved later by {n} yr',
      movedManyEarlier: '{count} lives moved earlier by {n} yr',
      badgeBirths: '{n} births · {delta} yr',
      birthsLater: '{count} births moved {n} yr later',
      birthsEarlier: '{count} births moved {n} yr earlier'
    },
    toggles: {
      aria: 'Canvas overlays',
      select: 'Select',
      edit: 'Edit',
      modeTitle: '{label} — {hint}',
      gear: 'Customize edit modes (or hold Tab for the wheel)',
      gearAria: 'Customize edit modes',
      focus: 'Focus — highlight & emphasise people',
      legend: 'Legend',
      relTypes: 'Relationships — types, weights & lenses',
      chronicle: 'Chronicle — eras & story events',
      style: 'Style — lifeline looks, canvas & atmosphere',
      kinship: 'Kinship — name every relative, see through their eyes',
      clean: 'Clean view — hide canvas overlays',
      box: 'Box select — hold Shift and drag on the canvas',
      lasso: 'Lasso select — hold Shift and drag a freeform loop',
      timeDrag:
        'Time drag — drag people up or down to change their birth year (lifespans move with them)'
    }
  },
  graphWheel: {
    addMode: 'Add a mode…',
    hubIdle: 'Edit',
    tipRelease: 'Release to select',
    tipCustomize: 'customize',
    tipCancel: 'cancel',
    empty: {
      label: 'Empty',
      hint: 'Nothing here'
    },
    kinds: {
      add: {
        label: 'Add {noun}',
        hint: 'Click an empty spot to add a {noun}'
      },
      delete: {
        label: 'Delete',
        hint: 'Click a node or bond — click again to confirm'
      },
      pin: {
        label: 'Pin',
        hint: 'Click people to pin / release them'
      },
      end: {
        label: 'End bond',
        hint: 'Click a bond to mark it ended'
      },
      swap: {
        label: 'Flip bond',
        hint: 'Click a directed bond to reverse it'
      },
      retime: {
        label: 'Retime',
        hint: 'Drag a person up or down to change their birth year'
      },
      paint: {
        label: 'Paint',
        hint: 'Click people to paint them — same color again clears',
        disabled: 'Node styling needs Standard mode'
      },
      tag: {
        hint: 'Click people to toggle “{tag}”',
        disabled: 'Tags need Standard mode'
      },
      link: {
        hint: 'Click two people in a row to link them as {type}',
        disabled: 'This bond type needs Standard mode'
      }
    },
    config: {
      aria: 'Customize the action wheel',
      title: 'Action wheel',
      subPre: 'Hold',
      subPost:
        'on the canvas, flick toward a mode, release. Pick a direction below and give it a job.',
      close: 'Close (Esc)',
      closeAria: 'Close',
      emptySlot: 'Empty slot',
      mode: 'Mode',
      forge: 'Forge a bond',
      forgeNote: "Click two people in a row and they're linked.",
      paint: 'Paint nodes',
      paintTitle: 'Paint people {color}',
      tag: 'Toggle a tag',
      reset: 'Reset to defaults',
      done: 'Done'
    },
    dirs: {
      N: 'N',
      NE: 'NE',
      E: 'E',
      SE: 'SE',
      S: 'S',
      SW: 'SW',
      W: 'W',
      NW: 'NW'
    }
  },
  graph3d: {
    badge: 'Experimental · Space',
    help: {
      close: 'Close',
      title: 'Navigating Space',
      sub: 'Your tree in three dimensions — the same people and lines, one more axis. Controls follow the usual 3D conventions:',
      mouse: 'Mouse',
      keys: 'Keys',
      leftDrag: {
        key: 'Left-drag',
        desc: 'Orbit around the family'
      },
      rightDrag: {
        key: 'Right-drag',
        desc: 'Pan sideways'
      },
      scroll: {
        key: 'Scroll',
        desc: 'Zoom in / out'
      },
      dragPerson: {
        key: 'Drag person',
        desc: 'Move them in space'
      },
      click: {
        key: 'Click',
        desc: 'Select a person or line'
      },
      dblClick: {
        key: 'Dbl-click',
        desc: 'Fly to a person'
      },
      frame: 'Frame everything',
      rotate: 'Auto-rotate on / off',
      layers: 'Generation layers',
      hints: 'Show these hints',
      tipLabel: 'Tip:',
      tipMid: '(the layers button in the toolbar, or',
      tipEnd: ') stacks each generation on its own floor — oldest on top.',
      gotIt: 'Got it'
    }
  },
  minimap: {
    title: 'Overview — drag to move the view'
  },
  styleStudio: {
    title: 'Style studio',
    close: 'Close the style studio',
    search: 'Find a style setting…',
    noResults: 'No style setting matches “{q}”',
    reach: 'Views this layer paints',
    tuned: '{n} tuned · reset',
    resetChapterHint: 'Put this chapter back to its defaults',
    layers: {
      app: 'Whole app',
      appTag: 'Everywhere',
      appDesc: 'The foundation every view paints on',
      viewTag: 'This view',
      viewDesc: 'Only changes the {view} view',
      viewNone: 'Has no style of its own — follows the app',
      bringForward: 'Bring this layer to the front'
    },
    chapters: {
      theme: 'Theme',
      palette: 'Palette',
      profiles: 'Profiles',
      looks: 'Looks',
      nodes: 'Nodes',
      lines: 'Lines',
      effects: 'Effects',
      air: 'Atmosphere',
      camera: 'Camera',
      physics: 'Physics',
      lifelines: 'Lifelines',
      time: 'Time',
      canvas: 'Canvas',
      cards: 'Cards',
      mapStyle: 'Map style',
      shapes: 'Shapes',
      auras: 'Special effects'
    },
    saved: {
      deviceAll: 'Saved on this device · every project, every view',
      projectAll: 'Saved with this project · every view',
      projectView: 'Saved with this project · {view} only',
      mapView: 'Saved with this map · each map keeps its own'
    },
    results: {
      app: 'Whole app',
      view: 'This view · {view}',
      other: 'Other views'
    },
    inherit: {
      title: '{view} paints with the app style',
      body: 'This view has no style of its own yet. It uses the app layer: the theme, the accent and the shared palette.',
      cta: 'Style the whole app'
    },
    palette: {
      intro: 'Every view draws people and their bonds in these colours.',
      specimen: 'A small family drawn in the shared palette',
      people: 'People',
      bonds: 'Bonds',
      lookNote: 'Picking a graph look repaints this palette too.'
    },
    profile: {
      title: 'Profile presentation',
      intro: 'How a person’s profile opens, from any view.'
    },
    looks: {
      paletteNote: 'Each look also repaints the shared palette.',
      openPalette: 'Open the palette'
    },
    lines: {
      colorsNote: 'Line colours are shared by every view.'
    },
    air: {
      quality: 'Render quality'
    },
    map: {
      none: 'Open a map to style it.'
    },
    directory: {
      cardModesOnly: 'Card faces show in the Grid and card-stage modes.'
    },
    groups: {
      shape: 'Group shape',
      shapeSub: 'How a group is drawn, and how it shows the people it shares with other groups.',
      ringsBlurb: 'Fixed circles. Shared people sit between their groups, tethered to each.',
      vennBlurb:
        'Living membranes. Each group stretches to wrap its people, so shared members sit where the groups overlap.',
      preview: 'Preview of the {style} style',
      softness: 'Softness',
      softTaut: 'Taut',
      softFluid: 'Fluid',
      lens: 'Lens glow',
      lensHint: 'Shade the overlaps as lit lenses',
      arrangeTip:
        'Arrange in the toolbar slides groups that share people into overlap and keeps the rest apart.',
      ringsTip: 'Switch to Venn to see shared members as overlaps instead of tethers.'
    }
  },
  auras: {
    intro:
      'Give a tag or a trait a special effect. Everyone who carries it wears it in the Graph and the Timeline.',
    active: 'Active effects',
    add: 'Add effect',
    addTitle: 'Give an effect to…',
    cancel: 'Cancel',
    kinds: { tag: 'Tag', trait: 'Trait' },
    searchTags: 'Find a tag…',
    searchTraits: 'Find a trait…',
    noTags: 'No tags yet. Tag a {noun} on their profile, then give the tag an effect here.',
    noTraits: 'No traits yet.',
    noMatch: 'Nothing matches “{q}”',
    hasEffect: 'Has an effect',
    ruleCount: 'Effects: {n}',
    empty: {
      title: 'No special effects yet',
      body: 'Crown your royals, set your mages alight, frost the northerners. Pick a tag or a trait to begin.',
      cta: 'Add the first effect'
    },
    bearersNone: 'No one yet',
    bearersOne: '{n} {noun}',
    bearersOther: '{n} {noun}s',
    draft: 'Not saved',
    draftHint: 'A suggested look. Change anything, or keep it as it is.',
    keep: 'Keep',
    edit: 'Edit this effect',
    collapse: 'Collapse',
    remove: 'Remove this effect',
    discard: 'Discard',
    removed: 'Effect removed from “{name}”',
    saveFailed: 'Couldn’t save the effect',
    tagMembers: 'Everyone with this tag',
    preview: {
      label: 'Live preview',
      replay: 'Replay the ignition',
      sample: 'A sample {noun} wearing this effect'
    },
    presets: {
      title: 'Presets',
      royal: 'Royal',
      saint: 'Saint',
      inferno: 'Inferno',
      frostborn: 'Frostborn',
      arcane: 'Arcane',
      cursed: 'Cursed',
      stormcaller: 'Stormcaller',
      blossom: 'Blossom',
      bloodline: 'Bloodline'
    },
    ornament: 'Ornament',
    ornaments: {
      none: { label: 'None', hint: 'No ornament — just the line and the tint' },
      halo: { label: 'Halo', hint: 'A saint’s nimbus glowing behind the head' },
      flame: { label: 'Flame', hint: 'Flames licking up around the node' },
      frost: { label: 'Frost', hint: 'Ice crystals creeping over the rim' },
      sparkle: { label: 'Sparkle', hint: 'Twinkling stars drifting around' },
      crown: { label: 'Crown', hint: 'A crown resting on top' },
      shadow: { label: 'Shadow', hint: 'Dark smoke curling out from behind' },
      storm: { label: 'Storm', hint: 'Lightning crackling around the rim' },
      bloom: { label: 'Bloom', hint: 'Petals drifting in a slow circle' },
      aura: { label: 'Aura', hint: 'A paired golden ring shimmering around the rim' },
      runes: { label: 'Runes', hint: 'A slowly turning ring of runes' },
      orbit: { label: 'Orbit', hint: 'A spark circling the node' },
      burst: { label: 'Burst', hint: 'A spiked starburst behind the node' },
      pulse: { label: 'Pulse', hint: 'Echo rings beating outward' }
    },
    color: 'Colour',
    tint: 'Tint',
    tintHint: 'Ring the node and colour the lifeline in this colour',
    line: 'Line effect',
    lineHint: 'Runs down their lifeline, and along bonds between two bearers.',
    noLine: 'Plain',
    when: {
      title: 'Who wears it',
      any: 'Any value',
      is: 'Is one of',
      contains: 'Contains',
      range: 'In range',
      checkedNote: 'Everyone with this box checked wears the effect.',
      pickOptions: 'Pick at least one option.',
      noOptions: 'This trait has no options yet.',
      containsPh: 'Type a word, press Enter',
      addWord: 'Add',
      removeWord: 'Remove “{v}”',
      needWord: 'Add at least one word.',
      needBound: 'Set a lower or an upper bound.',
      min: 'From',
      max: 'To',
      minYear: 'From year',
      maxYear: 'To year',
      scale: 'Scale with value',
      scaleHint: 'Higher values wear a stronger ornament',
      sumAny: 'Has any value',
      sumChecked: 'When checked',
      sumIs: 'Is {v}',
      sumContains: 'Contains “{v}”',
      sumBetween: '{min} to {max}',
      sumAtLeast: '{min} or more',
      sumAtMost: 'Up to {max}',
      sumYearBetween: 'Years {min}–{max}',
      sumYearFrom: 'From {min}',
      sumYearUntil: 'Until {max}',
      sumScaled: 'scales with value'
    },
    entry: {
      trait: 'Special effect…',
      traitHint: 'Make everyone with it glow',
      tag: 'Special effect'
    }
  },
  graphStyle: {
    tiltHint:
      'Lays the arrangement down like a board seen from above, with every person standing on it. T toggles; Q / E turn the board; hold Alt and drag up/down to tilt, left/right to turn.',
    title: 'Style',
    close: 'Close style panel',
    quality: 'Quality',
    qualityHint: 'Full resolution, ornaments, atmosphere and ambient motion',
    performance: 'Performance',
    performanceHint: 'Trimmed resolution, still ornaments, no atmosphere — for low-end machines',
    groups: {
      perspective: 'Perspective',
      themes: 'Theme',
      nodes: 'Node appearance',
      colors: 'Node colors',
      lines: 'Relationship lines',
      fx: 'Line effects',
      atmosphere: 'Atmosphere',
      physics: 'Physics / layout'
    },
    chips: {
      custom: 'custom',
      live: 'live',
      off: 'off'
    },
    atmosphereOffHint: 'Atmosphere is off in Performance mode',
    inkNote:
      '水墨 — in the Ink theme every look is painted in brush and wash on rice paper; shapes, routes and atmosphere still follow the theme you pick.',
    labels: {
      tiltYaw: 'Turn',
      tiltAngle: 'Angle',
      tilt: '3D tilt',
      shape: 'Shape',
      ornament: 'Ornament',
      ornamentColor: 'Ornament color',
      nodeSize: 'Node size',
      nodeOpacity: 'Node opacity',
      labelSize: 'Label size',
      showLabels: 'Show labels',
      showAge: 'Show age',
      glowOnHover: 'Glow on hover',
      starTwinkle: 'Departed stars twinkle',
      unknown: 'Unknown',
      lineStyle: 'Line style',
      lineOpacity: 'Line opacity',
      lineCurvature: 'Line curvature',
      color: 'Color',
      width: 'Width',
      appliesTo: 'Applies to',
      palette: 'Palette',
      effectColors: 'Effect colors',
      relColors: 'Relationship colors',
      speed: 'Speed',
      glow: 'Glow',
      effect: 'Effect',
      colors: 'Colors',
      density: 'Density',
      linkDistance: 'Link distance',
      repulsion: 'Repulsion'
    },
    brushOwns: 'Brush strokes own the lines right now — effects resume on any other line style.',
    starHint: 'Brighter, bigger stars have more descendants. Photos show on hover.',
    useOrganic: 'Use Organic',
    reset: 'Reset all',
    shapes: {
      gravestone: 'Gravestone',
      plate: 'Plate',
      flatplate: 'Flat plate',
      star: 'Star',
      circle: 'Circle',
      square: 'Square',
      diamond: 'Diamond',
      hexagon: 'Hexagon',
      shield: 'Shield',
      oval: 'Oval',
      octagon: 'Octagon',
      heart: 'Heart'
    },
    decors: {
      none: 'None',
      aura: 'Aura',
      runes: 'Runes',
      orbit: 'Orbit',
      burst: 'Burst',
      pulse: 'Pulse',
      enso: 'Ensō'
    },
    routes: {
      organic: {
        label: 'Organic',
        hint: 'Soft curves with a natural per-line bend'
      },
      straight: {
        label: 'Straight',
        hint: 'Dead-straight lines'
      },
      arc: {
        label: 'Arc',
        hint: 'Sweeping half-moon curves'
      },
      elbow: {
        label: 'Elbow',
        hint: 'Right-angle runs, like a flowchart'
      },
      trident: {
        label: 'Trident',
        hint: 'Classic genealogy: couple bar → stem → sibling rail → children'
      },
      circuit: {
        label: 'Circuit',
        hint: 'Axis-then-45° traces, like a circuit board'
      },
      wave: {
        label: 'Wave',
        hint: 'A sinuous ripple between people'
      },
      bezier: {
        label: 'Bezier',
        hint: 'Smooth curves you shape yourself — select a line, then drag it or its handles (double-click resets)'
      },
      brush: {
        label: 'Brush',
        hint: '水墨 — calligraphic brush strokes with dry-brush flying white'
      }
    },
    ambients: {
      none: 'None',
      fireflies: 'Fireflies',
      stars: 'Stars',
      petals: 'Petals',
      snow: 'Snow',
      embers: 'Embers',
      rain: 'Rain',
      motes: 'Motes',
      mist: 'Mist',
      plum: 'Plum',
      nightsky: 'Night sky'
    },
    fxScopes: {
      lineage: {
        label: 'Lineage',
        hint: 'Parent → child lines (every vertical relationship type)'
      },
      family: {
        label: 'Family',
        hint: 'Lineage plus couples'
      },
      all: {
        label: 'All',
        hint: 'Every bond, social ones too'
      }
    },
    fx: {
      none: {
        label: 'Classic',
        hint: 'Plain lines'
      },
      blood: {
        label: 'Bloodstream',
        hint: 'A living vessel — red cells drift down the generations on a heartbeat'
      },
      river: {
        label: 'River',
        hint: 'Flowing water — caustic light, current streaks, foam at the banks'
      },
      neon: {
        label: 'Neon',
        hint: 'Cyber conduit — white-hot core, data packets racing, circuit ticks'
      },
      helix: {
        label: 'Helix',
        hint: 'A DNA double helix twisting along the line, base pairs glowing'
      },
      ember: {
        label: 'Ember',
        hint: 'A line of fire — licking flames and sparks thrown into the dark'
      },
      aurora: {
        label: 'Aurora',
        hint: 'Northern lights — shifting curtains of green and violet'
      },
      storm: {
        label: 'Storm',
        hint: 'Crackling lightning that re-strikes as you watch'
      },
      stars: {
        label: 'Starlight',
        hint: 'A constellation — twinkling stars strung on a silver thread'
      },
      gilded: {
        label: 'Gilded',
        hint: 'A royal gold rope with a shine that travels its length'
      },
      starline: {
        label: 'Star chart',
        hint: 'Constellation lines — fine silver strokes that stop short of each star'
      }
    },
    themes: {
      constellation: {
        name: 'Constellation',
        tagline: 'A night sky — brighter stars have more descendants'
      },
      graveyard: {
        name: 'Graveyard',
        tagline: 'Headstones on their birth-year ground — best in the Birth layout'
      },
      heraldry: {
        name: 'Heraldry',
        tagline: 'Coats of arms — shields on gilded lines, embers on the wind'
      },
      illuminated: {
        name: 'Illuminated',
        tagline: 'A manuscript leaf — lapis and gold leaf, dust in the candlelight'
      },
      classic: {
        name: 'Classic',
        tagline: 'The signature look — clean discs, organic lines'
      },
      lineage: {
        name: 'Lineage',
        tagline: 'Formal genealogy — sibling rails and couple bars'
      },
      storybook: {
        name: 'Storybook',
        tagline: 'Fantasy — gilded shields and fireflies in the dark'
      },
      neon: {
        name: 'Neon Circuit',
        tagline: 'Sci-fi — hex cells on glowing traces under starlight'
      },
      noir: {
        name: 'Noir',
        tagline: 'Crime drama — hard edges, monochrome, endless rain'
      },
      dynasty: {
        name: 'Dynasty',
        tagline: '朝代 — vermillion, jade and gold; petals on the wind'
      },
      wuxia: {
        name: 'Ink & Blade',
        tagline: '武侠 — brush-stroke calm, ink motes drifting in water'
      },
      shuimo: {
        name: 'Shuimo',
        tagline: '水墨 — brush strokes, ink washes, mist over far mountains'
      },
      qinglu: {
        name: 'Qinglü',
        tagline: '青绿 — azurite and malachite washes, mist-veiled peaks'
      },
      meihua: {
        name: 'Ink Plum',
        tagline: '墨梅 — dry-brush branches, plum blossoms on the wind'
      },
      celestial: {
        name: 'Celestial',
        tagline: '仙侠 — jade crystals in arcs, spirit wisps ascending'
      },
      rosewater: {
        name: 'Rosewater',
        tagline: 'Romance — hearts, blush arcs and falling petals'
      },
      winter: {
        name: 'Winterhold',
        tagline: 'Northern saga — burst crowns and quiet snowfall'
      },
      minimal: {
        name: 'Minimal',
        tagline: 'Modern and quiet — clean lines, no ornament'
      },
      heirloom: {
        name: 'Heirloom',
        tagline: 'Family archive — sepia cameos and drifting dust'
      },
      blueprint: {
        name: 'Blueprint',
        tagline: 'Drafting table — crisp octagons on right-angle runs'
      },
      wildwood: {
        name: 'Wildwood',
        tagline: 'Enchanted forest — rune rings on winding vines'
      },
      harvest: {
        name: 'Harvest',
        tagline: 'Autumn — amber crests glowing by the hearth'
      },
      sakura: {
        name: 'Sakura',
        tagline: '桜 — blossoms in orbit on a spring breeze'
      },
      pharaoh: {
        name: 'Sands of Time',
        tagline: 'Ancient empire — lapis and gold on drifting sand'
      },
      ember: {
        name: 'Ember Throne',
        tagline: 'Dark fantasy war — burning crests and rising sparks'
      },
      nocturne: {
        name: 'Nocturne',
        tagline: 'Gothic — crimson crests beneath moonlit rain'
      },
      grimoire: {
        name: 'Grimoire',
        tagline: 'Arcane — sigil-bound crystals and wandering wisps'
      },
      abyss: {
        name: 'Abyss',
        tagline: 'Deep sea — bioluminescent pulses among plankton'
      },
      nebula: {
        name: 'Nebula',
        tagline: 'Space opera — orbiting worlds in a violet starfield'
      }
    }
  },
  graphActions: {
    dismissHint: 'Dismiss (Esc)',
    clearSelHint: 'Clear selection (Esc)',
    clearSel: 'Clear selection',
    status: 'Status',
    pick: 'Pick',
    size: 'Size',
    color: 'Color',
    link: 'Link',
    swap: 'Swap',
    swapHint: 'Reverse who is who in this bond',
    isolate: 'Isolate',
    isolateHint: 'Isolate this relationship type on the canvas',
    allBonds: 'All bonds',
    allBondsHint: 'Open the Relationships view',
    deleteBond: 'Delete bond',
    filters: {
      both: {
        label: 'Both',
        title: 'Select nodes and bonds'
      },
      nodes: {
        label: 'Nodes',
        title: 'Select only people'
      },
      bonds: {
        label: 'Bonds',
        title: 'Select only relationships'
      }
    },
    setAllStatus: 'Set all {count} bonds to {status}',
    sizes: {
      s: {
        label: 'S',
        title: 'Small'
      },
      m: {
        label: 'M',
        title: 'Default'
      },
      l: {
        label: 'L',
        title: 'Large'
      },
      xl: {
        label: 'XL',
        title: 'Huge'
      }
    },
    autoColor: 'Auto — the gender gradient',
    delete: 'Delete',
    deleteN: 'Delete {n}',
    clear: 'Clear',
    clearKeepAll: 'Keep everything, drop the selection',
    clearKeepPeople: 'Keep everyone, drop the selection',
    details: 'Details',
    detailsHint: 'Open the profile card',
    edit: 'Edit',
    editHint: 'Edit this {noun}',
    focus: 'Focus',
    focusHint: 'Glide the camera to this node',
    trace: 'Trace',
    traceHint: 'Trace a connection — then click another person',
    kin: 'Kin',
    kinHint: 'Kinship lens — label everyone by what they are to this person',
    spotlight: 'Spotlight',
    spotlightHint: 'Spotlight — make this the main character, everyone else in rings around them',
    pin: 'Pin',
    unpin: 'Unpin',
    pinHint: 'Pin the node in place',
    unpinHint: 'Release the node back to the simulation',
    pairKinHint: "Show how they're related",
    swapDirHint: 'Swap direction (matters for parent → child, admirer → crush…)',
    linked: 'Linked — {label}',
    traceConnection: 'Trace connection',
    traceConnectionHint: 'Light up the shortest chain between them',
    selected: '{n} selected',
    nounCountOne: '{n} {noun}',
    nounCountOther: '{n} {noun}s',
    bondCountOne: '{n} bond',
    bondCountOther: '{n} bonds',
    nothingInRange: 'Nothing in range',
    pairTitle: '{a} & {b}',
    born: 'b. {year}',
    died: 'd. {year}',
    pairSub: 'Forge a bond, or style them together',
    multiSub: 'Styling applies to everyone selected',
    unnamed: 'Unnamed',
    alreadyLinked: 'Already linked',
    becomes: '{a} becomes {role} of {b}',
    linkAs: 'Link {a} and {b} as {type}',
    married: 'Married',
    marriedYear: 'Married {year}',
    sinceYear: 'Since {year}',
    range: '{from} — {to}',
    endedYear: 'Ended {year}'
  },
  relTypesPanel: {
    title: 'Relationship types',
    close: 'Close',
    hint: "Every relationship points at a type. Tune a type's look here",
    hintAffinityPre: '— and its',
    hintAffinityBold: 'structural ↔ affinity',
    hintAffinityPost:
      'weight: structural types pull hard on the layout (family skeleton), affinity types are decorative overlays, negative weights push people apart (rivals).',
    symmetric: 'symmetric',
    typeColor: 'Type color',
    styleColor: 'Colored by the Style panel',
    deleteType: 'Delete this type (removes its relationships)',
    deleteTypeAria: 'Delete type',
    builtinHint: 'Built-in — tunable, not deletable',
    builtin: 'Built-in',
    generations: 'Generations',
    generationsHint: "How the generations layout treats this type's edges",
    repel: 'Repel',
    structural: 'Structural',
    newTitle: 'New custom type',
    labelPh: 'Label (e.g. Sworn enemies)',
    hideIcons: 'Hide icons',
    chooseIcon: 'Choose an icon',
    directed: 'Directed',
    roleAPh: 'Role A (e.g. Master)',
    roleBPh: 'Role B (e.g. Servant)',
    addType: 'Add type',
    typeIcon: 'Type icon',
    roles: {
      vertical: {
        label: 'Generational',
        hint: 'Parent → child — the child sits one generation below.'
      },
      horizontal: {
        label: 'Same generation',
        hint: 'A couple — both partners share a row, side by side.'
      },
      none: {
        label: 'Non-generational',
        hint: 'Ignored by the generations layout (still drawn and pulls in force layouts).'
      }
    }
  },
  timeline: {
    undated: '{n} undated',
    undatedHint:
      'People without a birth year cannot be placed on the timeline. Add a birth year in their profile to include them.',
    hint: 'Drag a life to move it · Drag empty space to pan · Scroll to zoom · 1–6: edit tools',
    empty: {
      noDatable: 'No datable people',
      noPeople: 'No people yet',
      noDatableText:
        'Add birth years to your family members to see their lives unfold on the timeline.',
      noPeopleText: 'Add family members from the graph view to see them here.'
    },
    searchPh: 'Search people…',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitAll: 'Fit all',
    refresh: 'Refresh layout — re-run the family tree algorithm',
    refreshAria: 'Refresh layout',
    warpToggle: 'Stretch busy years — widen the axis where births cluster',
    tiltToggle: 'Tilt the timeline into 3D (T)',
    modes: {
      lanes: {
        label: 'Lanes',
        title:
          'Every life keeps its own lane — family stems and bridged branches show who descends from whom'
      },
      sprout: {
        label: 'Sprout',
        title:
          'Lives sprout out of their parents’ family stem and reuse lanes once their last owner is gone — compact and flowing'
      },
      rivers: {
        label: 'Rivers',
        title:
          'Household rivers — each household is a channel: children are born inside their parents’ channel, and a life only crosses over when it marries or leaves home'
      }
    },
    river: {
      household: 'Household of {names}',
      own: '{name}’s own household',
      joined: 'Joined: {names}'
    },
    bond: {
      born: 'Born {year}',
      childOf: 'Child of {names}',
      adoptedBy: 'Adopted by {names}',
      ageAt: '{name} was {age}',
      oneChild: '1 child',
      children: '{n} children'
    },
    zoomAxes: 'Time axis {v} · lanes {h}',
    focus: {
      title: 'Focus',
      gender: 'Gender',
      life: 'Life',
      all: 'All',
      unknown: 'Unknown',
      living: 'Living',
      remembered: 'Remembered',
      needYear: 'Set the current year first'
    },
    legend: {
      title: 'Legend',
      people: 'People',
      lines: 'Lines',
      marriage: 'Marriage',
      divorced: 'Divorced',
      birth: 'Birth',
      adopted: 'Adopted'
    },
    tip: {
      dragToMove: 'Drag to move',
      clickToEdit: 'Click to edit',
      undated: 'undated',
      now: 'now'
    },
    marriage: {
      year: 'Year',
      married: 'Married',
      divorced: 'Divorced',
      save: 'Save'
    },
    traceArmed: 'ctrl-click another life to trace the connection',
    hud: {
      exit: 'Exit the tool (Esc)',
      exitAria: 'Exit the tool',
      linkPick: 'Pick what binds them — swap flips the direction',
      linkNext: 'Now click the life {name} is bound to — at the year it began'
    },
    tools: {
      add: {
        label: 'Add',
        hint: 'Click anywhere — a new life begins at that year'
      },
      child: {
        label: 'Child',
        hint: 'Click a lifeline at the year the child is born'
      },
      link: {
        label: 'Link',
        hint: 'Click one life, then another — pick what binds them'
      },
      event: {
        label: 'Event',
        hint: 'Click for a moment · drag up/down for a span'
      },
      retime: {
        label: 'Retime',
        hint: 'Drag a birth, death, marriage or event — or a whole life'
      },
      delete: {
        label: 'Delete',
        hint: 'Click a life, marriage or event to remove it'
      }
    },
    bubble: {
      namePh: 'Name this {noun}…',
      with: 'with',
      create: 'Create',
      createHint: 'Create (Enter)',
      newLife: 'A new life · born {year}',
      childOf: "{name}'s child · born {year}"
    },
    link: {
      swap: 'Swap direction (parent → child…)',
      swapAria: 'Swap direction',
      directed: '{a} is {role} of {b}',
      failed: 'Could not link them'
    },
    scenes: {
      label: 'Scenes',
      add: 'New scene',
      duplicate: 'Duplicate current scene',
      delete: 'Delete scene'
    },
    ghost: {
      born: 'born {year}',
      died: 'died {year}',
      stillLiving: 'still living',
      dragToDate: 'drag to date it',
      dragToEnd: 'drag up to end this life',
      shiftLife: 'shift the whole life',
      between: 'between {a} & {b}',
      after: 'after {name}',
      before: 'before {name}',
      firstLane: 'first lane',
      lives: '{n} lives {where}'
    },
    confirm: {
      deleteMarriage: 'Remove the marriage of {names}?',
      deleteMarriageBody: 'Both lives stay — only the bond goes.',
      deleteEvent: 'Delete “{name}”?'
    },
    toasts: {
      marriageRemoved: 'Marriage removed',
      bornIn: '{name} is now born in {year}',
      diesIn: '{name} now dies in {year}',
      movedLater: "{name}'s life moved later by {n} yr",
      movedEarlier: "{name}'s life moved earlier by {n} yr",
      marriedIn: 'Married in {year}',
      eventMoved: '“{name}” moved to {year}',
      calendarUnsupported: 'That date uses a calendar the timeline can’t move yet'
    },
    canvas: {
      unnamed: 'Unnamed',
      yearsDead: '{b}–{d} · {age} yr',
      yearsLiving: 'b. {b} · {age} yr',
      addYear: 'add year',
      now: 'now'
    },
    style: {
      title: 'Style',
      reset: 'Reset',
      resetHint: 'Back to the defaults',
      tabs: {
        lines: 'Lifelines',
        canvas: 'Canvas',
        air: 'Atmosphere'
      },
      inkLines: 'In the Ink theme lifelines are brushed — looks apply in every other theme.',
      inkAir: 'The Ink theme brings its own mist — atmospheres apply in every other theme.',
      thickness: 'Thickness',
      portraits: 'Portraits',
      shadows: 'Drop shadows',
      shadowsHint: 'Shadows fall under the solid, lit looks',
      flowSpeed: 'Flow speed',
      glow: 'Glow',
      palette: 'Palette',
      paletteEffect: 'Effect',
      palettePerson: 'Person',
      ageTicks: 'Age ticks',
      ageTicksHint: 'A notch every decade of each life',
      eraWash: 'Era wash',
      leaveHome: 'Leaving home',
      leaveHomeHint:
        'Household rivers: unmarried adults move to a channel of their own at this age',
      ageYears: 'age {n}',
      timeWarp: 'Stretch busy years',
      timeWarpHint: 'Siblings born a year apart separate; empty decades fold away',
      warpStrength: 'Stretch',
      warpNote:
        'The grid stays on real years — its rules simply crowd where time is stretched. The stripe down the year gutter shows it: accent = stretched, grey = squeezed.',
      tilt: 'Tilt into 3D',
      tiltAngle: 'Tilt angle',
      tiltYaw: 'Turn',
      arcLift: 'Arc height',
      tiltHint:
        'T tilts, Q / E turn, Alt-drag sets the angle and turn. Family arcs rise off the board — turn it to pull overlapping arcs apart.',
      density: 'Density',
      colours: 'Colours',
      segs: {
        connectors: 'Bonds',
        grid: 'Year grid',
        labels: 'Names',
        eventMarkers: 'Events'
      },
      opts: {
        curve: 'Curved',
        straight: 'Straight',
        hidden: 'Hidden',
        bands: 'Bands',
        lines: 'Lines',
        none: 'None',
        full: 'Full',
        fullHint: 'Name + years',
        compact: 'Compact',
        compactHint: 'Short names only',
        pills: 'Pills',
        dots: 'Icons'
      },
      ambients: {
        none: 'None',
        fireflies: 'Fireflies',
        stars: 'Stars',
        petals: 'Petals',
        snow: 'Snow',
        embers: 'Embers',
        rain: 'Rain',
        motes: 'Motes',
        mist: 'Mist',
        plum: 'Plum'
      },
      looks: {
        clean: {
          label: 'Clean',
          hint: 'Flat lines, no atmosphere'
        },
        bloodline: {
          label: 'Bloodline',
          hint: 'Blood pulsing down every life, embers drifting'
        },
        tides: {
          label: 'Tides',
          hint: 'Rivers of time under a drifting mist'
        },
        cosmos: {
          label: 'Cosmos',
          hint: 'Starlit lives in a twinkling night'
        },
        neon: {
          label: 'Neon city',
          hint: 'Data streams, rain and hard lines'
        },
        gilded: {
          label: 'Gilded',
          hint: 'Gold-leaf dynasties, motes of light'
        },
        glasshouse: {
          label: 'Glasshouse',
          hint: 'Glass rods catching the light, soft snow'
        },
        sakura: {
          label: 'Sakura',
          hint: 'Lit tubes under falling petals'
        }
      },
      lifelines: {
        classic: {
          label: 'Classic',
          hint: 'Flat, clean lines'
        },
        tube: {
          label: 'Tube',
          hint: 'Lit 3D cylinders with shadows'
        },
        glass: {
          label: 'Glass',
          hint: 'Glass rods — a sheen flows down each life'
        },
        glow: {
          label: 'Glow',
          hint: 'White-hot cores in a coloured glow'
        }
      }
    }
  },
  timeSlider: {
    activeHint: 'Time travel active',
    presentHint: 'Showing the present',
    capYear: 'YEAR',
    capNow: 'NOW',
    from: 'from {year}',
    trackHint: 'Drag either handle to frame a span of time',
    pause: 'Pause',
    playBack: 'Play backwards',
    play: 'Play through time',
    stop: 'Stop — back to the present',
    stopAria: 'Stop',
    prevEvent: 'Previous event',
    nextEvent: 'Next event',
    backYear: 'Back one year',
    fwdYear: 'Forward one year',
    speed: 'Playback speed — {speed}',
    reverse: 'Reverse playback direction',
    loop: 'Loop playback'
  },
  census: {
    toggle: 'Census: live demographics for this year',
    title: 'Census',
    close: 'Close the census',
    emptyTitle: 'No one to count yet',
    emptyBody:
      'Give people a birth year and the census will tally who was alive in every year you travel to.',
    alive: 'Alive',
    couples: 'Couples',
    meanAge: 'Mean age',
    medianAge: 'Median age',
    nobody: 'No one is alive in {year}',
    trend: '{delta} compared with ten years earlier',
    genderSplit: 'Male: {male} · Female: {female} · Other or unknown: {other}',
    decade: '{decade}s',
    decadeSpan: '{from}–{to}',
    bornIn: 'Born in the {decade}',
    diedIn: 'Died in the {decade}',
    generations: 'Generations alive',
    oldest: 'Oldest living',
    ageShort: 'age {age}',
    selectPerson: 'Select {name}',
    population: 'Population',
    populationAria: 'Population over time. Click to travel to a year.',
    mortality: 'Deaths per decade',
    noDeaths: 'No deaths recorded',
    mortalityAria: 'Recorded deaths per decade. Click to travel to a year.',
    hoverValue: '{year}: {value}',
    hoverDeaths: '{decade}: {value}'
  },
  chronicle: {
    now: 'now',
    undated: 'undated',
    deleted: 'Deleted “{name}”',
    pane: {
      title: 'Chronicle',
      era: 'Era',
      event: 'Event',
      eras: 'Eras',
      events: 'Events',
      quickStart: 'Quick start',
      erasEmpty:
        "Name the stretches of your story — a war, a reign, a golden age — and they'll band the Timeline and the Birth graph.",
      searchPh: 'Search events…',
      noMatch: 'Nothing matches.',
      eventsEmpty:
        'Battles, coronations, migrations, first meetings — add the moments that shaped your people.',
      nothingNew: 'Nothing new from “{pack}” for {min}–{max}',
      addedOne: 'Added {n} era',
      addedMany: 'Added {n} eras',
      addFailed: 'Could not add the eras'
    },
    editor: {
      newEra: 'New era',
      editEra: 'Edit era',
      newEvent: 'New event',
      editEvent: 'Edit event',
      close: 'Close (Esc)',
      closeAria: 'Close',
      eraNamePh: 'Name this era — “The Regency”, “Age of Dragons”…',
      from: 'From',
      until: 'Until',
      beginning: 'the beginning of time',
      open: 'open',
      ongoing: 'ongoing',
      colour: 'Colour',
      anyColour: 'Any colour',
      icon: 'Icon',
      eraIcon: 'Era icon',
      eventTitlePh: 'What happened? — “The Long Winter”, “Grandma arrives in New York”…',
      when: 'When',
      lasts: 'lasts a while',
      weight: 'Weight',
      importance: {
        minor: 'Minor',
        minorHint: 'Shown when zoomed in',
        notable: 'Notable',
        notableHint: 'Shown at most zoom levels',
        major: 'Major',
        majorHint: 'Always shown, bold'
      },
      who: 'Who',
      remove: 'Remove',
      removeName: 'Remove {name}',
      addNoun: 'Add {noun}',
      whoPh: 'Who took part?',
      where: 'Where',
      placePh: 'Optional place',
      eraDescPh: 'What defined this era?',
      eventDescPh: 'The story of what happened…',
      add: 'Add to the chronicle',
      save: 'Save',
      saveEraFailed: 'Could not save the era',
      saveEventFailed: 'Could not save the event',
      added: '{name} added',
      saved: '{name} saved',
      deleteEra: 'Delete era “{name}”?',
      deleteEvent: 'Delete event “{name}”?',
      deleteEraBody: 'The band leaves every view. People are not affected.',
      deleteEventBody: 'It leaves the timeline and every profile.'
    },
    date: {
      year: 'Year',
      month: 'month',
      day: 'day',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    },
    kinds: {
      milestone: 'Milestone',
      battle: 'Battle',
      war: 'War',
      coronation: 'Coronation',
      founding: 'Founding',
      migration: 'Migration',
      journey: 'Journey',
      meeting: 'First meeting',
      wedding: 'Wedding',
      treaty: 'Treaty',
      discovery: 'Discovery',
      disaster: 'Disaster',
      betrayal: 'Betrayal',
      prophecy: 'Prophecy',
      celebration: 'Celebration',
      loss: 'Loss',
      custom: 'Other'
    },
    packs: {
      world: {
        label: 'World history',
        hint: 'Wars, reigns and revolutions, 1700 → today'
      },
      generations: {
        label: 'Generations',
        hint: 'Lost Generation → Gen Alpha'
      },
      centuries: {
        label: 'Centuries',
        hint: 'One band per century across your project'
      },
      fantasy: {
        label: 'Fantasy ages',
        hint: 'Myth → Kings → Iron → Twilight, fitted to your years'
      }
    },
    presets: {
      century: '{ord} century',
      eras: {
        ageOfEnlightenment: {
          name: 'Age of Enlightenment',
          description: 'Reason, science and the rights of man.'
        },
        industrialRevolution: {
          name: 'Industrial Revolution',
          description: 'Steam, mills and the move to the cities.'
        },
        napoleonicWars: {
          name: 'Napoleonic Wars',
          description: 'Europe at war with — and for — Napoleon.'
        },
        victorianEra: {
          name: 'Victorian Era',
          description: 'The reign of Queen Victoria.'
        },
        theGildedAge: {
          name: 'The Gilded Age',
          description: 'Railroads, fortunes and rapid change.'
        },
        worldWarI: {
          name: 'World War I',
          description: 'The Great War.'
        },
        theRoaringTwenties: {
          name: 'The Roaring Twenties',
          description: 'Jazz, prosperity and new freedoms.'
        },
        theGreatDepression: {
          name: 'The Great Depression',
          description: 'Hard times across the world.'
        },
        worldWarII: {
          name: 'World War II',
          description: 'The Second World War.'
        },
        coldWar: {
          name: 'Cold War',
          description: 'East against West, under the shadow of the bomb.'
        },
        spaceAge: {
          name: 'Space Age',
          description: 'Sputnik to the Moon landings.'
        },
        digitalAge: {
          name: 'Digital Age',
          description: 'The internet changes everything.'
        },
        lostGeneration: {
          name: 'Lost Generation',
          description: 'Came of age in World War I.'
        },
        greatestGeneration: {
          name: 'Greatest Generation',
          description: 'Grew up in the Depression, fought World War II.'
        },
        silentGeneration: {
          name: 'Silent Generation',
          description: 'Children of the Depression and the war.'
        },
        babyBoomers: {
          name: 'Baby Boomers',
          description: 'The post-war baby boom.'
        },
        generationX: {
          name: 'Generation X',
          description: 'Latchkey kids of the late Cold War.'
        },
        millennials: {
          name: 'Millennials',
          description: 'Came of age with the internet.'
        },
        generationZ: {
          name: 'Generation Z',
          description: 'The first truly digital natives.'
        },
        generationAlpha: {
          name: 'Generation Alpha',
          description: 'Born into smartphones and AI.'
        },
        ageOfMyth: {
          name: 'Age of Myth',
          description: 'When legends walked the land.'
        },
        ageOfKings: {
          name: 'Age of Kings',
          description: 'Crowns rise; houses are founded.'
        },
        ageOfIron: {
          name: 'Age of Iron',
          description: 'War, conquest and steel.'
        },
        ageOfTwilight: {
          name: 'Age of Twilight',
          description: 'The old powers fade.'
        }
      }
    }
  },
  groups: {
    title: 'Groups',
    hint: 'Drag people into rings · Drag rings to arrange · Click a person to manage',
    arrangeTitle: 'Arrange groups in a ring',
    arrangeVennTitle: 'Pull groups that share people into overlap, keep the rest apart',
    style: {
      label: 'Group style',
      rings: 'Rings',
      venn: 'Venn',
      ringsHint: 'Fixed circles, with shared people tethered between them',
      vennHint: 'Circles stretch to wrap shared people and overlap like a Venn diagram'
    },
    arrange: 'Arrange',
    newGroup: 'New group',
    emptySceneTitle: 'No groups in this scene',
    emptyTitle: 'No groups yet',
    emptyText:
      'Group your people into families, companies, schools, guilds — any camps you like. People in several groups settle in the middle ground between them.',
    createGroup: 'Create a group',
    createFirstGroup: 'Create your first group',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitAll: 'Fit all',
    focus: 'Focus',
    gender: 'Gender',
    life: 'Life',
    all: 'All',
    unknown: 'Unknown',
    living: 'Living',
    remembered: 'Remembered',
    showGroup: 'Show group',
    hideGroup: 'Hide group',
    editGroup: 'Edit group',
    sharedCount: '{n} in multiple groups',
    unassigned: 'Unassigned',
    trayHint: 'drag onto a ring',
    trayMoreTitle: 'Filter the member list on the right and drag people in from there',
    trayMore: '+{n} more',
    groupName: 'Group name',
    groupIcon: 'Group icon',
    save: 'Save',
    unnamed: 'Unnamed',
    removeFromGroup: 'Remove from group',
    addToGroup: 'Add to group…',
    openProfile: 'Open profile',
    close: 'Close',
    scenes: 'Scenes',
    scenesHint: 'Each scene keeps its own group placements — membership is shared',
    addScene: 'New empty scene',
    duplicateScene: 'Duplicate current scene',
    deleteScene: 'Delete scene',
    defaultGroupName: 'Group {n}',
    unnamedGroup: 'Unnamed Group',
    sceneGroupsOne: '{n} group',
    sceneGroupsOther: '{n} groups',
    sceneTooltip: '{groups} · {n} people in scene',
    defaultSceneName: 'Scene {n}'
  },
  kinship: {
    title: 'Kinship',
    unnamed: 'Unnamed',
    tabs: {
      lens: 'Lens',
      walk: 'Walk',
      insights: 'Insights'
    },
    pane: {
      quizTitle: 'Kinship quiz — how well do you know this family?',
      quiz: 'Quiz',
      throughEyes: 'Through the eyes of',
      startingFrom: 'Starting from',
      selectToBegin: 'Select someone on the graph to begin',
      useName: 'Use {name}',
      lensOn: 'Lens on',
      lensOff: 'See the family through their eyes',
      lensOnSub: 'Every node now says what it is to {name}',
      lensOffSub: 'Labels every person with their relation',
      closestKin: 'Closest kin'
    },
    filters: {
      all: {
        label: 'All',
        title: 'Everyone, labelled'
      },
      blood: {
        label: 'Blood',
        title: 'Blood relatives only'
      },
      marriage: {
        label: 'Marriage',
        title: 'Spouses, in-laws and step-family'
      },
      ancestors: {
        label: 'Ancestors',
        title: 'The direct line upward'
      },
      descendants: {
        label: 'Descendants',
        title: 'Everyone descended from them'
      }
    },
    classes: {
      blood: 'Blood',
      spouse: 'Spouse',
      marriage: 'By marriage',
      step: 'Step-family',
      social: 'Social',
      distant: 'Further out'
    },
    walk: {
      up: 'Up',
      across: 'Across',
      down: 'Down',
      married: 'Married',
      removeStep: 'Remove this step',
      tapSteps: 'Tap steps to build a chain…',
      clear: 'Clear the chain',
      found: '{n} found',
      nobody: 'Nobody on record'
    },
    insights: {
      family: 'family',
      islands: 'islands',
      linchpinsStat: 'linchpins',
      tangledStat: 'tangled',
      linchpinsTitle: 'Remove one of these people and the family splits apart',
      linchpins: 'Linchpins',
      cutOffOne: 'Without {name}, {n} person is cut off',
      cutOffOther: 'Without {name}, {n} people are cut off',
      holds: 'holds {n}',
      founders: 'Dynasty founders',
      founderStat: '{d} desc. · {g} gen',
      tangledTitle: 'Couples who are also blood relatives',
      tangled: 'Tangled roots',
      islandsTitle: 'Groups with no connection to each other',
      islandsHead: 'Islands',
      islandOne: '{n} person — {name}…',
      islandOther: '{n} people — {name}…',
      empty: 'Add a few parents and children to see the structure.'
    },
    quiz: {
      title: 'Kinship quiz',
      score: 'Score',
      streak: 'Streak',
      closeEsc: 'Close (Esc)',
      close: 'Close',
      emptyTitle: 'Grow the tree a little first',
      emptyText: 'The quiz needs a few parents, children and spouses to ask about.',
      correct: 'correct',
      bestStreak: 'Best streak:',
      playAgain: 'Play again',
      kinds: {
        name: 'Name the bond',
        who: 'Find the relative',
        hops: 'Six degrees'
      },
      questions: {
        name: 'What is {b} to {a}?',
        who: 'Who is {a}’s {rel}?',
        hops: 'How many links from {a} to {b}?'
      },
      notQuite: 'Not quite —',
      hopsNoteOne: "It's {n} link — trace them on the graph to see the chain.",
      hopsNoteOther: "It's {n} links — trace them on the graph to see the chain.",
      seeResults: 'See results',
      next: 'Next',
      cheers: ['Spot on!', 'Nailed it!', 'Family historian!', 'Exactly right!', 'Yes!'],
      grades: {
        keeper: {
          title: 'Keeper of the Family Tree',
          sub: 'Nobody knows this family better.'
        },
        historian: {
          title: 'Family Historian',
          sub: 'You could run the reunion.'
        },
        cousin: {
          title: 'Cousin Counter',
          sub: 'Solid — the "removed" ones are tricky.'
        },
        distant: {
          title: 'Distant Relative',
          sub: 'You know the faces, not the bonds.'
        },
        stranger: {
          title: 'Long-lost Stranger',
          sub: 'Time to study the Kinship lens!'
        }
      }
    },
    card: {
      flip: 'Flip the question',
      notFamily: "{b} and {a} aren't family — {n} links apart",
      noConnection: '{b} and {a} share no connection at all',
      degree: 'Degree',
      degreeValue: '{ord}-degree relative',
      sharedDna: 'Shared DNA',
      dnaNoneStep: 'none — family by a stepfamily',
      dnaNoneMarriage: 'none — family by marriage',
      also: 'Also',
      bloodline: 'Bloodline',
      commonAncestors: 'Common ancestors',
      commonAncestor: 'Common ancestor',
      through: 'Through',
      explicitSibling: 'an explicit sibling bond',
      directLine: 'a direct line'
    },
    section: {
      groups: {
        ancestors: 'Ancestors',
        siblings: 'Siblings',
        descendants: 'Descendants',
        collateral: 'Aunts, uncles, nieces & nephews',
        cousins: 'Cousins',
        marriage: 'Spouse & in-laws',
        step: 'Step-family'
      },
      less: 'Less',
      empty: 'No family on record yet.',
      pedigreeKnown: 'Pedigree known',
      generationsBack: 'Generations back',
      collapseTitle: 'Share of ancestor slots filled by someone who already appears elsewhere',
      collapse: 'Pedigree collapse',
      inbreeding: 'Own inbreeding (F)'
    },
    trace: {
      armedHint: 'shift-click another person to trace the connection',
      cancelEsc: 'Cancel (Esc)',
      dismissEsc: 'Dismiss (Esc)',
      clearEsc: 'Clear (Esc)',
      clear: 'Clear',
      noConnection: 'No connection between {a} and {b}',
      connection: 'Connection',
      hopsOne: '{n} hop',
      hopsOther: '{n} hops',
      view: 'View {name}',
      roleOf: '{role} of'
    },
    blood: {
      none: {
        label: 'No shared blood',
        note: 'Their child would carry no inbreeding.'
      },
      echo: {
        label: 'Distant echoes',
        note: 'Around third cousins — common in any old village.'
      },
      distant: {
        label: 'Distant cousins',
        note: 'About second cousins (1.56%).'
      },
      cousins: {
        label: 'Cousin marriage',
        note: 'First cousins sit at 6.25%.'
      },
      close: {
        label: 'Close kin',
        note: 'Uncle–niece or double-cousin territory (12.5%).'
      },
      royal: {
        label: 'Royal-house territory',
        note: 'Only generations of in-marriage get this high.'
      },
      habsburg: {
        label: 'Habsburg jaw',
        note: 'Charles II of Spain: 25.4%.'
      }
    },
    fan: {
      aria: 'Ancestor fan chart',
      dup: '{name} — appears more than once',
      unknown: 'Unknown'
    },
    lang: {
      aria: 'Kinship naming language',
      nameIn: 'Name relatives in {lang}'
    }
  },
  profile: {
    viewPortrait: 'View portrait',
    present: 'present',
    ageYears: '{n} years',
    ageYrs: '{n} yrs',
    datesUnrecorded: 'dates unrecorded',
    inscription: 'Inscription',
    scrollToUnroll: 'scroll to unroll',
    unroll: 'unroll',
    leaves: {
      story: 'Story',
      family: 'Family',
      bonds: 'Bonds',
      kin: 'Kinship',
      traits: 'Traits',
      chron: 'Chronicle',
      gallery: 'Gallery'
    },
    withinTwoBonds: '{n} within two bonds',
    endedYear: 'ended {year}',
    familyNamed: 'family, named',
    yes: 'Yes',
    no: 'No',
    primary: 'primary',
    blankTitle: 'A scroll waiting for ink',
    blankText: 'No traits, bonds or photos yet — open the editor to paint {name} in.',
    blankTextAnon: 'No traits, bonds or photos yet — open the editor to paint them in.',
    startEditing: 'Start editing',
    unnamed: 'Unnamed',
    stats: {
      bonds: 'Bonds',
      circle: 'Circle',
      traits: 'Traits',
      photos: 'Photos'
    },
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dateDay: '{d} {m} {y}',
    dateMonth: '{m} {y}'
  },
  directory: {
    toolbar: {
      search: 'Search people…',
      filters: 'Filters'
    },
    sort: {
      name: 'A–Z',
      year: 'Year',
      age: 'Age'
    },
    filters: {
      life: 'Life',
      all: 'All',
      living: 'Living',
      remembered: 'Remembered',
      gender: 'Gender',
      unknown: 'Unknown',
      ties: 'Ties',
      everyone: 'Everyone',
      connected: 'Connected',
      unlinked: 'Unlinked',
      clearOne: 'Clear {n} filter',
      clearOther: 'Clear {n} filters'
    },
    empty: {
      noMatches: 'No matches',
      noPeople: 'No people yet',
      noMatchesHint: 'Try a different search term.',
      noPeopleHint: 'Add family members from the graph view to see them here.'
    },
    modes: {
      switchLabel: 'Directory view mode',
      showcaseViews: 'Showcase views',
      showcase: 'Showcase',
      showcaseSub: 'Other ways to meet everyone',
      showcaseTitle: 'Showcase — more ways to see everyone',
      grid: {
        label: 'Grid',
        blurb: 'the classic scrolling wall of cards'
      },
      wheel: {
        label: 'Carousel',
        blurb: 'a 3D ring of cards — drag to spin it'
      },
      flow: {
        label: 'Flow',
        blurb: 'coverflow with floor reflections'
      },
      fan: {
        label: 'Hand',
        blurb: 'a fanned hand of cards'
      },
      deck: {
        label: 'Deck',
        blurb: 'swipe through the deck one card at a time'
      },
      hive: {
        label: 'Hive',
        blurb: 'a honeycomb — every person a hexagon'
      },
      reel: {
        label: 'Reel',
        blurb: 'a spinning drum of film strips'
      },
      sheet: {
        label: 'Sheet',
        blurb: 'a spreadsheet — type, paste and sort every trait'
      },
      roster: {
        label: 'Roster',
        blurb: 'a fighting-game select screen'
      },
      codex: {
        label: 'Codex',
        blurb: 'an illustrated bestiary, page by page'
      },
      board: {
        label: 'Evidence',
        blurb: 'polaroids and red yarn on a corkboard'
      },
      elements: {
        label: 'Elements',
        blurb: 'a periodic table of the family'
      },
      ranks: {
        label: 'Ranks',
        blurb: 'a podium and a leaderboard race'
      },
      bubbles: {
        label: 'Bubbles',
        blurb: 'packed bubbles that regroup'
      },
      handscroll: {
        label: 'Handscroll',
        blurb: '长卷 — the family as one painted scroll, read right to left'
      }
    },
    common: {
      unnamed: 'Unnamed',
      born: 'b. {year}',
      died: 'd. {year}',
      deceased: 'Deceased'
    },
    stage: {
      emptyTitle: 'Nothing to deal',
      emptyText: 'No people match — clear the search or add someone.',
      prev: 'Previous',
      prevHint: 'Previous (Left arrow)',
      next: 'Next',
      nextHint: 'Next (Right arrow)'
    },
    cardStyle: {
      current: 'Card style: {style}',
      title: 'Card style',
      sub: 'how the directory deals its deck',
      styles: {
        classic: {
          label: 'Classic',
          blurb: 'The original — banner, avatar, and stats.'
        },
        poster: {
          label: 'Full Art',
          blurb: 'The photo fills the card; info floats in front.'
        },
        holo: {
          label: 'Holo',
          blurb: 'Gold-foil trading card with HP, attacks, and rarity.'
        },
        neon: {
          label: 'Neon',
          blurb: 'Cyberpunk dossier — scanlines, glitches, barcodes.'
        },
        arcana: {
          label: 'Arcana',
          blurb: 'Tarot of the family — gilded frames and starlight.'
        },
        scroll: {
          label: 'Scroll',
          blurb: '立轴 — hanging ink scrolls with calligraphy and seals.'
        },
        moonfan: {
          label: 'Moon Fan',
          blurb: '团扇 — round silk fans painted with plum, bamboo and moon.'
        }
      }
    },
    hive: {
      emptyTitle: 'The hive is empty'
    },
    reel: {
      emptyTitle: 'The reel is blank',
      relations: 'Relations',
      prevHint: 'Previous (Up arrow)',
      nextHint: 'Next (Down arrow)'
    },
    board: {
      emptyTitle: 'No leads yet',
      emptyText: 'No people match — clear the search or add someone.',
      evidence: 'EVIDENCE',
      subjects: {
        one: '{n} subject',
        other: '{n} subjects'
      },
      strings: {
        one: '{n} string',
        other: '{n} strings'
      },
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fit: 'Fit',
      fitTitle: 'Fit everyone on screen',
      tidy: 'Tidy up',
      tidyTitle: 'Put every photo back in its family spot',
      hint: 'Drag the board to pan · scroll to zoom · drag photos to rearrange',
      deceasedStamp: 'DECEASED',
      unnamed: 'Unnamed',
      born: 'b. {year}',
      died: 'd. {year}',
      diedAt: '† at {age}',
      age: 'Age {age}',
      kin: '{n} kin',
      children: {
        one: '{n} child',
        other: '{n} children'
      }
    },
    bubbles: {
      emptyTitle: 'No bubbles to blow',
      emptyText: 'No people match — clear the search or add someone.',
      unnamed: 'Unnamed',
      size: 'Size',
      group: 'Group',
      sizeModes: {
        kin: 'Connections',
        children: 'Children',
        age: 'Age',
        equal: 'Equal'
      },
      groupModes: {
        gender: 'Gender',
        decade: 'Decade',
        tag: 'Group',
        life: 'Life',
        family: 'Family',
        none: 'None'
      },
      everyone: 'Everyone',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitTitle: 'Fit everyone (Esc)',
      fitAria: 'Fit everyone',
      foot: {
        people: {
          one: 'person',
          other: 'people'
        },
        groups: {
          one: 'group',
          other: 'groups'
        }
      },
      footHint: 'Scroll to zoom · drag to pan · click a circle to dive in',
      deceased: 'Deceased',
      born: 'b. {year}',
      died: 'd. {year}',
      datesUnknown: 'Dates unknown',
      metric: {
        ageUnknown: 'Age unknown',
        age: 'Age {n}',
        children: {
          one: '{n} child',
          other: '{n} children'
        },
        connections: {
          one: '{n} connection',
          other: '{n} connections'
        }
      },
      groups: {
        other: 'Other / unknown',
        deceased: 'Deceased',
        living: 'Living',
        unknownBirth: 'Unknown birth',
        decade: '{n}s',
        ungrouped: 'Ungrouped',
        unconnected: 'Unconnected',
        surnameFamily: '{name} family',
        familyN: 'Family {n}'
      }
    },
    card: {
      unnamed: 'Unnamed',
      datesUnknown: 'Dates unknown',
      born: 'b. {year}',
      died: 'd. {year}',
      yr: 'yr',
      yrDeceased: 'yr†',
      ageYr: '{age} yr',
      relations: 'Relations',
      children: 'Children',
      deceased: 'Deceased',
      ties: {
        one: 'tie',
        other: 'ties'
      },
      heirs: {
        one: 'heir',
        other: 'heirs'
      },
      tiesCount: {
        one: '{n} tie',
        other: '{n} ties'
      },
      childrenCount: {
        one: '{n} child',
        other: '{n} children'
      },
      holo: {
        legend: 'LEGEND',
        basic: 'BASIC',
        kinship: 'Kinship',
        kinshipText: 'Draws strength from every bond.',
        legacy: 'Legacy',
        legacyText: 'Passes the story to the next age.',
        rarity: 'Rarity {n} of 5'
      },
      neon: {
        archived: 'ARCHIVED',
        online: 'ONLINE',
        unnamed: 'UNNAMED',
        age: 'AGE',
        links: 'LINKS',
        heirs: 'HEIRS',
        origin: 'ORIGIN',
        unknown: 'UNKNOWN'
      }
    },
    handscroll: {
      emptyTitle: 'The scroll is blank',
      emptyText: 'No people match — clear the search or add someone.',
      decade: '{year}s',
      undated: 'undated',
      people: {
        one: '{n} person',
        other: '{n} people'
      },
      scenes: {
        one: '{n} scene',
        other: '{n} scenes'
      },
      hint: 'drag · wheel · arrow keys'
    },
    codex: {
      title: 'Codex',
      emptyTitle: 'The codex is unwritten',
      emptyText: 'No entries match — clear the search or add someone.',
      entries: {
        one: '{n} entry',
        other: '{n} entries'
      },
      chronicledCount: '{n} chronicled',
      jumpTo: 'Jump to {ch}',
      jumpNo: 'No.',
      jumpToNumber: 'Jump to entry number',
      entryNo: 'No. {n}',
      unnamed: 'Unnamed',
      deceased: 'Deceased',
      living: 'Living',
      openProfile: 'Open full profile',
      born: 'Born',
      died: 'Died',
      age: 'Age',
      unrecorded: 'Unrecorded',
      lifespan: 'Lifespan',
      spanUnrecorded: 'span unrecorded',
      ageUnknown: 'Unknown',
      ageYears: '{n} years',
      ageLiving: '{n} · living',
      captionUnrecorded: 'unrecorded',
      caption: '{from} – {to} · {age} of {max} yrs',
      now: 'now',
      kinship: 'Kinship',
      kinCap: 'KIN',
      groups: {
        parents: 'Parents',
        partners: 'Partners',
        children: 'Children',
        siblings: 'Siblings'
      },
      bond: 'Bond',
      turnTo: 'Turn to {name}',
      notInFilter: 'Not in the current filter',
      more: '+{n} more',
      noBonds: 'A solitary soul — no bonds recorded.',
      chronicle: 'Chronicle',
      noBio: 'No records survive of this one’s deeds. The page waits for a chronicler.',
      prev: 'Previous entry',
      prevTitle: 'Previous entry (Up or Left arrow)',
      next: 'Next entry',
      nextTitle: 'Next entry (Down or Right arrow)',
      folio: '— {i} of {n} —',
      seal: {
        undated: 'UNDATED',
        discovered: 'DISCOVERED',
        discoveredBce: 'DISCOVERED · BCE'
      },
      date: {
        months: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec'
        ],
        year: '{y}',
        month: '{m} {y}',
        day: '{d} {m} {y}',
        bce: '{y} BCE'
      }
    },
    roster: {
      emptyTitle: 'No challengers',
      emptyText: 'No people match — clear the search or add someone.',
      no: 'No.{n}',
      departed: 'Departed',
      unnamed: 'Unnamed',
      selected: 'Selected!',
      lockIn: 'Lock in',
      selectTitle: 'Select your character',
      keys: {
        left: 'Left',
        up: 'Up',
        down: 'Down',
        right: 'Right'
      },
      hintMove: 'move',
      hintLock: 'lock in',
      fighters: {
        one: '{n} fighter',
        other: '{n} fighters'
      },
      life: {
        span: '{b} – {d}',
        born: 'b. {y}',
        died: 'd. {y}'
      },
      diedAged: 'died aged {n}',
      ageN: 'age {n}',
      stats: {
        age: 'Age',
        kin: 'Kin',
        children: 'Children'
      }
    },
    ranks: {
      metricAria: 'Ranking metric',
      metrics: {
        age: {
          label: 'Age',
          blurb: 'Age at the reference year — full lifespan for the departed',
          unit: {
            one: 'yr',
            other: 'yrs'
          }
        },
        connections: {
          label: 'Connections',
          blurb: 'Every relationship a person takes part in',
          unit: {
            one: 'link',
            other: 'links'
          }
        },
        children: {
          label: 'Children',
          blurb: 'Direct children on record',
          unit: {
            one: 'child',
            other: 'children'
          }
        },
        descendants: {
          label: 'Descendants',
          blurb: 'Children, grandchildren and every generation below',
          unit: {
            one: 'descendant',
            other: 'descendants'
          }
        },
        depth: {
          label: 'Lineage',
          blurb: 'Generations of recorded ancestors above them',
          unit: {
            one: 'gen',
            other: 'gens'
          }
        },
        siblings: {
          label: 'Siblings',
          blurb: 'People who share at least one parent',
          unit: {
            one: 'sibling',
            other: 'siblings'
          }
        }
      },
      ranked: 'ranked',
      unranked: 'unranked',
      avg: 'avg',
      emptyTitle: 'No contenders',
      emptyText: 'No people match — clear the search or add someone.',
      topThree: 'Top three',
      unnamed: 'Unnamed',
      deceased: 'Deceased',
      podiumNote: 'Nobody scores on {metric} yet',
      colName: 'Name',
      unrankedDivider: 'Unranked · {n} — no {metric} on record',
      tied: 'Tied',
      deltaNew: 'NEW',
      bornShort: 'b. {year}',
      diedShort: 'd. {year}'
    },
    elements: {
      emptyTitle: 'No elements discovered',
      emptyText: 'No people match — clear the search or add someone.',
      deceased: 'Deceased',
      unnamed: 'Unnamed',
      stats: {
        born: 'Born',
        died: 'Died',
        age: 'Age',
        kin: 'Kin',
        children: 'Children',
        group: 'Group'
      },
      groupByAria: 'Group columns by',
      groupsLabel: 'Groups',
      colourByAria: 'Colour tiles by',
      colourLabel: 'Colour',
      groupings: {
        decade: 'Birth decade',
        generation: 'Generation',
        tag: 'Group tag'
      },
      colorings: {
        gender: 'Gender',
        life: 'Life status',
        group: 'Group'
      },
      cats: {
        other: 'Other / unknown',
        living: 'Living',
        deceased: 'Deceased',
        undated: 'Undated',
        untagged: 'Untagged'
      },
      tagFallback: 'Tag',
      hint: '{elements} elements · {groups} groups · {periods} periods — hover to inspect, click to open',
      gen: 'Gen {n}',
      decade: '{d}s',
      massYears: '{age} yr',
      ageAtDeath: '{age} (at death)',
      periodShort: 'P{n}',
      monthsShort: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ],
      dateDay: '{d} {m} {y}',
      dateMonth: '{m} {y}'
    }
  },
  dock: {
    expand: 'Expand panel',
    collapse: 'Collapse panel',
    inspector: 'Inspector',
    noDates: 'No dates recorded',
    tags: 'Tags',
    openProfile: 'Open profile',
    edit: 'Edit',
    emptyHint:
      'Select a person on the canvas — or pick one from the Directory tab — to inspect and edit them here.',
    noPeopleFound: 'No people found',
    addNoun: 'Add {noun}'
  },
  sheet: {
    aria: 'Spreadsheet',
    bar: {
      addRowTitle: 'Add a row (Enter on an empty sheet)',
      addTraitTitle: 'Add a trait column',
      trait: 'Trait',
      columnsTitle: 'Show or hide columns',
      columns: 'Columns',
      hidden: '{n} hidden',
      fillDownTitle: 'Fill down (Ctrl+D)',
      confirmDelete: 'Click again to delete'
    },
    deleteRows: 'Delete {n} {nouns}',
    head: {
      selectAll: 'Select all (Ctrl+A)',
      options: 'Column options',
      resize: 'Drag to resize · double-click to fit',
      titleAge: 'Age in {year} (calculated) — click to sort',
      titleTies: 'Number of relationships (calculated) — click to sort',
      titleGroups: 'Group memberships — click to sort',
      titleField: '{label} ({type}) — click to sort',
      titleFieldSlot: '{label} ({type} · {slot} slot) — click to sort'
    },
    typeNames: {
      text: 'text',
      boolean: 'boolean',
      number: 'number',
      number_range: 'number range',
      select: 'select',
      slider: 'slider',
      date: 'date',
      date_range: 'date range',
      custom_date: 'custom date',
      custom_date_range: 'custom date range'
    },
    slots: {
      name: 'name',
      gender: 'gender',
      birth: 'birth',
      death: 'death',
      highlight: 'highlight'
    },
    types: {
      text: 'Text',
      number: 'Number',
      date: 'Date',
      select: 'Choice',
      boolean: 'Yes / no',
      slider: 'Slider',
      number_range: 'Num range',
      date_range: 'Date range'
    },
    cols: {
      age: 'Age',
      ties: 'Ties',
      groups: 'Groups',
      showAll: 'Show all columns'
    },
    people: {
      one: 'person',
      other: 'people'
    },
    customNoun: {
      one: '{noun}',
      other: '{noun}s'
    },
    addNoun: 'Add {noun}',
    addRowHint: 'or paste rows below the last one',
    unnamed: 'Unnamed',
    empty: {
      noMatches: 'No matches',
      emptyTitle: 'An empty sheet',
      noMatchesText: 'Nobody fits the current search or filters.',
      emptyText: 'Add the first row — or paste a list of names from any spreadsheet.'
    },
    status: {
      rows: '{n} {nouns}',
      cols: {
        one: '{n} column',
        other: '{n} columns'
      },
      resort: 'Re-sort',
      resortTitle: 'Values changed since the rows were ordered',
      hint: 'Enter edit · Tab next · Ctrl+C / Ctrl+V · Del clear · Ctrl+D fill down · right-click for more',
      saving: 'Saving…',
      notSaved: 'Not saved',
      saved: 'All changes saved'
    },
    addCol: {
      title: 'New trait column',
      placeholder: 'Trait name, e.g. Nickname',
      add: 'Add column'
    },
    menu: {
      confirm: 'Click again to confirm',
      sortAsc: 'Sort ascending',
      sortDesc: 'Sort descending',
      clearSort: 'Clear sort',
      fit: 'Fit width to content',
      selectColumn: 'Select column',
      rename: 'Rename trait',
      hide: 'Hide column',
      deleteTrait: 'Delete trait for everyone',
      deleteTraitArmed: 'Click again — removes every value',
      copy: 'Copy',
      paste: 'Paste',
      clear: 'Clear contents',
      fillDown: 'Fill down',
      openProfile: 'Open profile',
      editForm: 'Edit in full form',
      deleteRowsArmed: 'Click again to delete {n}'
    },
    summary: {
      cells: '{n} cells',
      count: 'Count {n}',
      sum: 'Sum {n}',
      avg: 'Avg {n}',
      min: 'Min {n}',
      max: 'Max {n}'
    },
    fx: {
      selectCell: 'Select a cell',
      pickGroups: 'Double-click the cell to pick groups',
      calculated: 'Calculated',
      pick: 'Double-click to pick',
      empty: 'Empty — type to fill'
    },
    ref: {
      cells: 'cells',
      row: '{name} · row {n}'
    },
    notice: {
      genericError: 'Something went wrong',
      saveFailed: "Couldn't save — {error}",
      projectChanged: 'The project changed before this edit saved',
      calculated: "{label} is calculated — it can't be typed into",
      cleared: 'Cleared {n} cells',
      cantClear: 'Calculated and group cells can’t be cleared here',
      filled: {
        one: 'Filled {n} cell down',
        other: 'Filled {n} cells down'
      },
      copied: {
        one: 'Copied {n} cell',
        other: 'Copied {n} cells'
      },
      pressCopy: 'Press Ctrl+C to copy',
      pressPaste: 'Press Ctrl+V to paste',
      pasted: {
        one: 'Pasted {n} cell',
        other: 'Pasted {n} cells'
      },
      pastedAdded: 'added {n} {nouns}',
      pastedBad: "{n} didn't fit their trait type",
      pastedSkipped: '{n} landed on calculated columns',
      nothing: 'Nothing to change',
      deletedRows: 'Deleted {n} {nouns} — Ctrl+Z to undo',
      colAdded: 'Added “{label}” — every {noun} has it now',
      traitDeleted: 'Deleted “{label}” — Ctrl+Z to undo',
      discarded: 'That entry didn’t fit its trait type — change discarded'
    },
    parse: {
      notNumber: 'Not a number',
      numRangeShape: 'Use “low–high”',
      numRangeNumbers: 'Use numbers, like “10–20”',
      yesNo: 'Use yes / no',
      notOption: "“{text}” isn't an option",
      dateShape: 'Use a year, or YYYY-MM-DD',
      dateRangeShape: 'Use “from–to”',
      dateRangeDates: 'Use dates, like “1950–1960”',
      notEditable: 'This trait type can’t be edited here yet'
    },
    picker: {
      findGroup: 'Find or create a group…',
      findOption: 'Find or add an option…',
      newGroup: 'New group',
      addOption: 'Add option',
      empty: 'Nothing to pick yet',
      clear: 'Clear',
      hintMulti: 'move · Enter toggle · Esc close',
      hintSingle: 'move · Enter pick · Esc close'
    }
  },
  personForm: {
    input: {
      notSetHint: 'Not set — click to set',
      notSet: 'Not set',
      yes: 'Yes',
      no: 'No',
      clear: 'Clear',
      from: 'From',
      to: 'To',
      year: 'Year',
      reserved: 'Coming with custom calendars'
    },
    types: {
      text: 'Text',
      boolean: 'Yes / No',
      number: 'Number',
      number_range: 'Number range',
      select: 'Selection',
      slider: 'Slider',
      date: 'Date',
      date_range: 'Date range'
    },
    typeHints: {
      text: 'Free text',
      boolean: 'A true/false switch',
      number: 'One number, optional unit',
      number_range: 'Uncertain span (a–b)',
      select: 'Pick one option',
      slider: 'A value between two ends',
      date: 'A point in time',
      date_range: 'Uncertain time span'
    },
    slots: {
      name: 'Name',
      gender: 'Gender',
      birth: 'Birth',
      death: 'Death',
      highlight: 'Highlight'
    },
    slotHints: {
      name: 'Text traits · order = word order',
      gender: 'Maps onto the color gradient',
      birth: 'Dates, years or ranges',
      death: 'Dates, years or ranges',
      highlight: 'Any value rings the node'
    },
    addTrait: 'Add trait',
    close: 'Close',
    changeType: 'Change type',
    nameTraitPh: 'Name this {type} trait…',
    lock: 'Lock',
    lockHint: "Locked traits appear on every person's form",
    create: 'Create',
    optionN: 'Option {n}',
    row: {
      dragHint: 'Drag to reorder — drop on a slot to assign',
      templateHint: 'Template trait — on every form',
      shownInGraph: 'Shown in the graph label',
      timeframeHint: 'When this trait applied',
      label: 'Label',
      unit: 'Unit',
      multiline: 'Multiline',
      min: 'Min',
      max: 'Max',
      step: 'Step',
      leftLabel: 'Left label',
      rightLabel: 'Right label',
      icon: 'Icon',
      traitIcon: 'Trait icon',
      optionColor: 'Option color',
      optionPh: 'Option…',
      removeOption: 'Remove option',
      addOption: 'Add option',
      apply: 'Apply',
      options: 'Trait options',
      editTrait: 'Edit trait',
      editTraitHint: 'Label · icon · options',
      unlock: 'Unlock',
      thisPersonOnly: 'This {noun} only',
      onEveryForm: 'On every form',
      showInGraph: 'Show in graph',
      applyAllHint: 'Apply to this trait on every person',
      applyAll: 'Apply to all',
      removeTimeframe: 'Remove timeframe',
      setTimeframe: 'Set timeframe',
      moveToSlot: 'Move to slot',
      slotRejects: "{type} traits can't go here",
      duplicate: 'Duplicate',
      removeFromThis: 'Remove from this {noun}',
      deleteTrait: 'Delete trait',
      copyName: '{name} copy'
    },
    unnamed: 'Unnamed',
    bornAbbr: 'b. {year}',
    picker: {
      placeholder: 'Type a name…',
      noMatches: 'No one matches',
      creating: 'Creating…',
      createAs: 'Create “{name}” as a new {noun}'
    },
    dock: {
      leftColor: 'Left gradient color',
      rightColor: 'Right gradient color',
      earlier: 'Earlier in the name',
      later: 'Later in the name',
      ringColor: 'Ring color',
      ejectHint: 'Remove from slot (back to the trait list)',
      eject: 'Remove from slot',
      dropHere: 'Drop it here',
      dragHere: 'Drag a trait here'
    },
    livePreview: 'Live preview',
    identitySlots: 'Identity slots',
    traits: 'Traits',
    traitsHint: "Drag a row's handle to reorder · drop it on a slot to assign",
    removeRel: 'Remove relationship',
    status: 'Status',
    married: 'Married',
    since: 'Since',
    ended: 'Ended',
    siblings: 'Siblings',
    siblingHint: 'Derived from a shared parent — no separate relationship needed',
    viaSharedParents: 'via shared parents',
    new: 'New',
    discardLink: 'Discard this link',
    images: 'Images',
    imagesLater: 'Images can be added after creating — save first.',
    removeImage: 'Remove image',
    useAs: 'Use as {slot}',
    deleteImage: 'Delete image',
    addExtraImage: 'Add an extra image',
    extra: 'Extra',
    tags: 'Tags',
    tagsLater: 'Tags can be added after creating — save first.',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    intentHintDirected: "Who is this {noun}'s {role}?",
    intentHintSym: '{type}: pick the other {noun}',
    bands: {
      family: 'Family',
      social: 'Social',
      power: 'Power',
      custom: 'Custom'
    },
    roleOf: '{role} of',
    imageSlots: {
      portrait: 'Portrait',
      fullbody: 'Full body',
      background: 'Background'
    },
    imageSlotHints: {
      portrait: 'Head & shoulders — the avatar',
      fullbody: 'Standing figure',
      background: 'A scene or backdrop'
    },
    sections: {
      identity: 'Identity',
      traits: 'Traits',
      relations: 'Relations',
      images: 'Images',
      tags: 'Tags'
    },
    editTitle: 'Edit: {name}',
    addTitle: 'Add {noun}',
    present: 'present',
    onlyTextInName: 'Only text traits can appear in the graph name',
    slotRejectsType: "That trait type can't go in the {slot} slot",
    couldNotSave: 'Could not save',
    couldNotCreate: 'Could not create'
  },
  tagChips: {
    color: 'Tag color',
    typeTitle: 'Tag type: {type}',
    remove: 'Remove tag',
    empty: 'No tags yet.',
    addExisting: 'Add existing tag…',
    assign: 'Assign',
    newLabelPh: 'New tag label…',
    typePh: 'Type (optional)',
    typeHint: "Tags with the same type can be compared in the Groups view (e.g. 'family')",
    add: 'Add'
  },
  personModal: {
    inMemoriam: 'In memoriam',
    present: 'Present',
    ageYrs: '{n} yrs',
    noDates: 'No dates recorded',
    stats: {
      bonds: 'Bonds',
      circle: 'Circle',
      traits: 'Traits',
      photos: 'Photos'
    },
    constellation: 'Constellation',
    withinTwo: '{n} within two bonds',
    twoHops: '2 hops',
    kinship: 'Kinship',
    kinshipSub: 'family, named',
    story: 'Story',
    traits: 'Traits',
    chronicle: 'Chronicle',
    addEventHint: 'Add a story event they took part in',
    addEvent: 'Add event',
    livedThrough: 'Lived through',
    bonds: 'Bonds',
    endedYear: 'Ended {year}',
    gallery: 'Gallery',
    primaryPhoto: 'Primary photo',
    blankTitle: 'A story waiting to be written',
    blankText: 'No traits, bonds, or photos yet — open the editor to bring {name} to life.',
    them: 'them',
    startEditing: 'Start editing',
    profileStyle: 'Profile style',
    styles: {
      cinematic: 'Cinematic',
      scroll: 'Scroll'
    },
    styleTitles: {
      cinematic: 'Cinematic profile',
      scroll: 'Handscroll — an ink-painting profile'
    },
    editNoun: 'Edit {noun}',
    edit: 'Edit',
    deleteNoun: 'Delete {noun}',
    closeProfile: 'Close profile',
    prevPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    kin: {
      husband: 'Husband',
      wife: 'Wife',
      spouse: 'Spouse',
      son: 'Son',
      daughter: 'Daughter',
      child: 'Child',
      father: 'Father',
      mother: 'Mother',
      parent: 'Parent',
      adoptedChild: 'Adopted child',
      adoptiveParent: 'Adoptive parent',
      brother: 'Brother',
      sister: 'Sister',
      sibling: 'Sibling'
    },
    bands: {
      family: 'Family',
      social: 'Social',
      power: 'Power',
      custom: 'Other'
    },
    ev: {
      born: 'Born',
      married: 'Married {name}',
      childBorn: '{name} born',
      bond: '{role} — {name}',
      bondEnded: '{role} ended — {name}',
      with: 'with {names}',
      eraBegins: '{name} begins',
      aged: 'aged {n}',
      died: 'Died',
      atAge: 'at {n}'
    },
    listSep: ', ',
    back: 'Back',
    view: 'view',
    backTo: 'Back to {view}'
  },
  relsView: {
    searchPh: 'Search by name…',
    issuesHint: 'Relationships that need attention',
    issues: 'Issues',
    filters: 'Filters',
    manageTypes: 'Manage relationship types',
    types: 'Types',
    addRel: 'Add relationship',
    dates: 'Dates',
    any: 'Any',
    dated: 'Dated',
    undated: 'Undated',
    marriage: 'Marriage',
    together: 'Together',
    groupLens: 'Group lens',
    endpointsHint: 'Which endpoints must be in the group',
    either: 'Either',
    both: 'Both',
    clearFilters: {
      one: 'Clear {n} filter',
      other: 'Clear {n} filters'
    },
    newRel: 'New relationship',
    personA: 'Person A',
    personB: 'Person B',
    relationship: 'Relationship',
    swapAB: 'Swap A and B',
    marriedYear: 'Married (year)',
    sinceYear: 'Since (year)',
    endedYear: 'Ended (year)',
    save: 'Save',
    colFrom: 'From',
    colRelation: 'Relation',
    colTo: 'To',
    viewPerson: 'View {name}',
    unknown: 'Unknown',
    toggleMarried: 'Click to toggle married / divorced',
    formedHint: 'Year the relationship formed',
    swapDirection: 'Swap direction',
    editRel: 'Edit relationship',
    deleteRel: 'Delete relationship',
    empty: {
      noIssues: 'No issues found',
      noMatches: 'No matches',
      noRels: 'No relationships yet',
      noIssuesText: 'Every relationship looks consistent. Nice work!',
      noMatchesText: 'Try a different search term or filter.',
      noRelsText: 'Connect two family members to get started.'
    },
    selectPerson: 'Select person…',
    nameBorn: '{name} ({born})',
    parentOf: 'Parent of',
    partner: 'Partner',
    all: 'All',
    issue: {
      self: 'Links a person to themselves',
      missing: 'References a person that no longer exists',
      duplicate: 'Duplicate — this pair already has this relationship',
      parentYounger: 'Parent (b. {a}) born after or same year as child (b. {b})',
      tooManyParents: '{name} has more than two biological parents',
      thisChild: 'This child',
      redundantSibling: 'Redundant — these two are already siblings via a shared parent'
    },
    preview: {
      divorced: '{a} and {b} were married, now divorced',
      married: '{a} and {b} are married',
      adopted: '{a} adopted {b}',
      parent: '{a} is a parent of {b}',
      generic: '{a} — {b}',
      directed: "{a} is {b}'s {role}",
      symmetric: '{a} and {b} are {type}s'
    },
    err: {
      chooseBoth: 'Choose both people.',
      self: 'A person cannot be linked to themselves.',
      exists: 'This relationship already exists.',
      couldNotSave: 'Could not save.'
    },
    kind: {
      marriage: 'marriage',
      adoption: 'adoption',
      parentChild: 'parent–child'
    }
  },
  app: {
    homepage: 'Homepage',
    exportFailed: 'Export failed',
    langName: {
      en: 'English',
      'zh-Hans': 'Simplified Chinese',
      'zh-Hant': 'Traditional Chinese',
      nb: 'Norwegian'
    }
  },
  scenes: {
    label: 'Scenes',
    add: 'New scene',
    duplicate: 'Duplicate current scene',
    remove: 'Delete scene'
  },
  commands: {
    searchPh: 'Jump to a person…',
    unnamed: 'Unnamed',
    born: 'b. {year}',
    noMatches: 'No matches'
  },
  starChart: {
    section: 'Star chart poster',
    toggle: 'Frame as a star chart',
    frame: {
      circle: 'Planisphere',
      rect: 'Atlas plate'
    },
    hint: 'Printed on a night sky, with an hour ring and a legend.',
    autoSubtitle: 'A chart of {count} stars',
    legend: 'Brightness = descendants',
    hour: '{h}h'
  },
  exportModal: {
    title: 'Export image',
    sub: 'Compose a picture of your project and save it anywhere',
    closeEsc: 'Close (Esc)',
    dragReframe: 'Drag to reframe',
    dragFrame: 'Drag to frame the part you want',
    empty: 'Nothing to picture in the {view} view yet.',
    cropped: 'Cropped',
    reset: 'Reset',
    view: 'View',
    size: 'Size',
    preset: {
      fhd: 'Full HD',
      qhd: 'QHD',
      '4k': '4K UHD',
      square: 'Square',
      portrait: 'Portrait',
      a4: 'Print A4 · 300dpi'
    },
    custom: 'Custom…',
    format: 'Format',
    quality: 'Quality',
    colours: 'Colours',
    noAlpha: 'JPEG has no transparency — pick PNG or WebP',
    scheme: {
      app: 'Match app',
      none: 'None'
    },
    tint: 'Ambient colour wash',
    margin: 'Margin',
    text: 'Text',
    titlePh: 'Title (shown in the image)',
    subtitlePh: 'Subtitle (optional)',
    stamp: 'Corner stamp — {stamp}',
    crop: 'Crop',
    done: 'Done',
    saved: 'Saved',
    rendering: 'Rendering…',
    download: 'Download',
    defaultStamp: 'Family tree'
  },
  auth: {
    termsPrivacy: 'Terms & Privacy',
    home: 'Home',
    back: 'Back',
    loginSubtitle: 'Welcome back — sign in to continue',
    registerSubtitle: 'Create an account to start your tree',
    signIn: 'Sign in',
    createAccount: 'Create account',
    username: 'Username',
    password: 'Password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    confirmPassword: 'Confirm password',
    agreePre: 'I agree to the',
    terms: 'Terms',
    agreeAnd: 'and',
    privacyPolicy: 'Privacy Policy',
    agreePost: '',
    or: 'or',
    guest: 'Continue as guest',
    guestNote: 'Explore with sample data — Advanced mode stays locked.',
    footPre: 'Your data stays on this device — see the',
    footPost: '',
    strength: {
      tooShort: 'Too short',
      okay: 'Okay',
      good: 'Good',
      strong: 'Strong'
    },
    err: {
      mismatch: 'Passwords do not match',
      acceptTerms: 'Please accept the Terms & Privacy Policy',
      generic: 'Something went wrong',
      guest: 'Could not start a guest session',
      usernameMin: 'Username must be at least {n} characters',
      usernameMax: 'Username must be at most {n} characters',
      usernameChars: 'Username may only contain letters, numbers, dots, dashes and underscores',
      passwordMin: 'Password must be at least {n} characters',
      passwordMax: 'Password must be at most {n} characters',
      taken: 'That username is already taken',
      invalid: 'Invalid username or password',
      locked: 'Too many failed attempts — try again in a few minutes'
    },
    email: 'Email',
    emailPh: 'you@example.com',
    sb: {
      createTitle: 'Create your account',
      welcomeTitle: 'Welcome back',
      createSub: 'Sign up to start building your trees.',
      welcomeSub: 'Sign in to your trees.',
      wait: 'Please wait…',
      signUp: 'Sign up',
      haveAccount: 'Already have an account?',
      noAccount: 'No account yet?',
      genericError: 'Something went wrong. Please try again.',
      confirmSent: 'We sent a confirmation link to {email}. Confirm it, then sign in.'
    }
  },
  ui: {
    search: 'Search…',
    clearSearch: 'Clear search',
    icon: 'Icon',
    noIcon: 'No icon',
    searchIcons: 'Search all icons…',
    noIconMatch: 'No icon matches “{query}”.'
  },
  storeMsg: {
    welcome: 'Welcome',
    welcomeName: 'Welcome, {name}',
    welcomeGuest: 'Welcome, guest',
    growingTree: 'Growing your family tree…',
    notProjectFile: 'Not a project file',
    opening: 'Opening {name}',
    switchingProject: 'Switching project…',
    loadingData: 'Loading people & relationships…',
    yourProfile: 'Your profile',
    gatheringAccount: 'Gathering your account…',
    signingOut: 'Signing out…',
    seeYouSoon: 'See you soon'
  },
  home: {
    born: 'b. {year}',
    nav: {
      features: 'Features',
      views: 'Views',
      explore: 'Explore',
      about: 'About',
      openEditor: 'Open editor',
      signIn: 'Sign in',
      getStarted: 'Get started'
    },
    hero: {
      eyebrow: 'Every family is a universe',
      titleWords: ['Turn', 'your', 'family', 'into', 'a', '*living', '*constellation.'],
      titleLabel: 'Turn your family into a living constellation.',
      sub: 'Map real ancestors or invented dynasties. Watch lifetimes unfold on a cinematic timeline, gather kin into glowing houses, and drift through your tree in 3D — silky smooth at thousands of people.',
      ctaOpen: 'Open your tree',
      ctaStart: 'Start your tree — free',
      ctaDemo: 'Try the live demo',
      demoError: 'Could not start the demo — try again',
      trust: 'Free forever · Private by default · Desktop & web',
      scroll: 'Scroll',
      hint: 'Psst — click the sky'
    },
    features: {
      kicker: 'Why it feels different',
      titleLead: 'Ancestry, but ',
      titleEm: 'alive',
      titleTail: '.',
      sub: 'Most family tree tools feel like tax software. This one feels like a night sky you get to arrange.',
      items: {
        breathes: {
          title: 'A tree that breathes',
          text: 'Physics-driven graphs: drag a grandparent and the whole family sways. Five layouts, from strict generations to free-floating space.'
        },
        time: {
          title: 'Time travel',
          text: 'Scrub the time slider and watch people appear, marry and grow old. Lifelines, marriage ribbons and birth sparks — all animated.'
        },
        houses: {
          title: 'Houses & clans',
          text: 'Tag anyone into groups — farms, dynasties, ship crews — and watch them gather into glowing clusters you can rearrange.'
        },
        faces: {
          title: 'Faces & stories',
          text: 'Portraits, photos, dates and notes on every person. Build the full cast of your family, not just a chart of names.'
        },
        smooth: {
          title: 'Absurdly smooth',
          text: 'Everything is WebGL. Ten thousand relatives glide at 60fps, ambient animations idle at 0% CPU, and views switch like scenes in a film.'
        },
        yours: {
          title: 'Yours, full stop',
          text: 'Private by default and works offline. Your data lives with you and exports to a plain file. No ads, no mining, no credit card.'
        }
      }
    },
    views: {
      kicker: 'Five lenses',
      titleLead: 'One family. ',
      titleEm: 'Five ways to see it.',
      sub: 'Watch the same twelve people rearrange themselves — this is live, go ahead and click.'
    },
    stats: {
      people: 'people in one tree — still silky',
      lenses: 'lenses on every family',
      languages: 'languages, three themes',
      fps: 'with ambient animation at 0% idle CPU'
    },
    marquee: {
      title: 'Room for every kind of family'
    },
    explore: {
      kicker: 'Community · coming soon',
      titleLead: 'Explore family ',
      titleEm: 'universes',
      titleTail: '.',
      sub: 'A peek at the kinds of trees people are growing. Browsing, likes, comments and follows launch with our hosted home — every cover below is generated art, not a screenshot.'
    },
    about: {
      kicker: 'About the maker',
      title: 'Handmade by one person who thinks family history deserves better software.',
      body: "Hi — I'm Tommy. I built {app} because my own family refused to fit in a spreadsheet, and every tool I tried felt like filling out forms. No company behind this, no tracking, no venture capital — just a long labour of love, shipped from Norway. If it makes you map somebody you love (or a dynasty you invented at 2 a.m.), it's doing its job.",
      hello: 'Say hello',
      idea: 'Suggest a feature'
    },
    final: {
      titleAuthed: 'Your family is waiting.',
      titleGuest: "Begin your family's story.",
      subAuthed: 'Jump back into the editor and keep the constellation growing.',
      subGuest: 'Two minutes from now, your first three generations could be on the canvas.',
      ctaAuthed: 'Back to your tree',
      ctaGuest: "Start your tree — it's free",
      note: 'No downloads required · No credit card · Just your people'
    },
    footer: {
      tag: 'Every family is a constellation.',
      product: 'Product',
      maker: 'Maker',
      legal: 'Legal',
      contact: 'Contact',
      terms: 'Terms of Use',
      privacy: 'Privacy Policy',
      madeWith: 'Made with',
      madeAfter: 'and zero venture capital',
      love: 'love'
    },
    showcase: {
      live: 'Live',
      sep: ' — ',
      spaceName: '3D Space',
      groups: {
        farm: 'The farm',
        seafarers: 'Seafarers',
        musicians: 'Musicians'
      },
      views: {
        tree: {
          title: 'The living graph',
          caption: 'a physics-driven web of everyone — drag someone and the whole family sways.'
        },
        timeline: {
          title: 'Lifelines',
          caption: 'every person becomes a lifespan — see who overlapped, who never met.'
        },
        groups: {
          title: 'Houses & clans',
          caption: 'tag people into groups and watch them gather into glowing constellations.'
        },
        grid: {
          title: 'The directory',
          caption: 'a searchable card index of your whole cast — built to scroll thousands.'
        },
        space: {
          title: 'Space mode',
          caption: 'the experimental lens — your dynasty floating in three dimensions.'
        }
      }
    },
    gallery: {
      filters: {
        all: 'All',
        trending: 'Trending',
        fictional: 'Fictional',
        historical: 'Historical',
        personal: 'Personal'
      },
      badges: {
        trending: 'Trending',
        staffPick: 'Staff pick',
        new: 'New'
      },
      coverMeta: '{people} people · {generations} generations',
      peoplePill: '{people} people',
      liked: 'Liked! (community sync coming soon)',
      like: 'Like',
      comments: 'Comments',
      favorites: 'Favorites',
      followers: 'Followers',
      close: 'Close',
      peekTitle: 'Community browsing is almost here',
      peekBody:
        "Soon you'll be able to step inside trees like this one — explore them view by view, follow the makers, leave comments, and favorite the families you love.",
      follow: 'Follow',
      comment: 'Comment',
      favorite: 'Favorite',
      cta: 'Start your own tree instead',
      ago: {
        m: '{n}m ago',
        h: '{n}h ago',
        d: '{n}d ago'
      }
    },
    projects: {
      atreides: {
        title: 'House Atreides',
        blurb: 'From Duke Leto to Leto II — every bloodline on Arrakis, mapped.'
      },
      medici: {
        title: 'The Medici Dynasty',
        blurb: 'Bankers, popes and patrons — Renaissance Florence in one graph.'
      },
      vestlandet: {
        title: 'Slekta mi — Vestlandet',
        blurb: 'Four farms, seven generations, and one very stubborn great-aunt.'
      },
      westeros: {
        title: 'Westeros: The Great Houses',
        blurb: 'Stark, Targaryen, Lannister — alliances, betrayals and all.'
      },
      bronte: {
        title: 'The Brontë Circle',
        blurb: 'Haworth parsonage and everyone who ever walked through it.'
      },
      kattegat: {
        title: 'Kattegat Bloodlines',
        blurb: 'Ragnar’s sons and the sagas between them, raid by raid.'
      },
      village: {
        title: "My Grandmother's Village",
        blurb: 'Every family on one Cretan hillside, back to 1840.'
      },
      bridgerton: {
        title: 'The Bridgerton Set',
        blurb: 'Eight siblings, one queen, and the entire ton — dearest reader.'
      },
      romanov: {
        title: 'Romanovs: The Last Tsars',
        blurb: 'Three centuries of the imperial line, ending in Ekaterinburg.'
      },
      corleone: {
        title: 'La Famiglia Corleone',
        blurb: 'Business, never personal — from Sicily to Lake Tahoe.'
      },
      curie: {
        title: 'The Curie Legacy',
        blurb: 'Five Nobel prizes in one family tree. No pressure, kids.'
      },
      durin: {
        title: 'Middle-earth: Line of Durin',
        blurb: 'Seven fathers of the dwarves and every beard in between.'
      }
    }
  },
  characterX: {
    parts: {
      afro: 'Afro',
      angry: 'Angry',
      arched: 'Arched',
      armor: 'Armor',
      backpack: 'Backpack',
      bags: 'Bags',
      balloon: 'Balloon',
      bandage: 'Bandage',
      bandaid: 'Bandaid',
      bandaids: 'Bandaids',
      batwings: 'Batwings',
      beanie: 'Beanie',
      bell: 'Bell',
      beret: 'Beret',
      blazer: 'Blazer',
      blep: 'Blep',
      blush: 'Blush',
      bob: 'Bob',
      boots: 'Boots',
      bow: 'Bow',
      bowl: 'Bowl',
      bowtie: 'Bowtie',
      braid: 'Braid',
      buns: 'Buns',
      button: 'Button',
      cap: 'Cap',
      cape: 'Cape',
      cat: 'Cat',
      catears: 'Catears',
      chin: 'Chin',
      choker: 'Choker',
      chubby: 'Chubby',
      circlet: 'Circlet',
      closed: 'Closed',
      coat: 'Coat',
      cowboy: 'Cowboy',
      crown: 'Crown',
      cuffed: 'Cuffed',
      curly: 'Curly',
      diamond: 'Diamond',
      dot: 'Dot',
      dots: 'Dots',
      dress: 'Dress',
      earrings: 'Earrings',
      egg: 'Egg',
      elf: 'Elf',
      eyepatch: 'Eyepatch',
      facemask: 'Facemask',
      fang: 'Fang',
      fedora: 'Fedora',
      flattop: 'Flattop',
      flower: 'Flower',
      foxmask: 'Foxmask',
      foxtail: 'Foxtail',
      freckles: 'Freckles',
      frown: 'Frown',
      full: 'Full',
      gakuran: 'Gakuran',
      geta: 'Geta',
      glasses: 'Glasses',
      goatee: 'Goatee',
      gown: 'Gown',
      grin: 'Grin',
      hairclip: 'Hairclip',
      hakama: 'Hakama',
      halo: 'Halo',
      happy: 'Happy',
      headband: 'Headband',
      headphones: 'Headphones',
      heart: 'Heart',
      hearts: 'Hearts',
      heels: 'Heels',
      hime: 'Hime',
      hooded: 'Hooded',
      hoodie: 'Hoodie',
      idol: 'Idol',
      jacket: 'Jacket',
      jeans: 'Jeans',
      jetpack: 'Jetpack',
      kimono: 'Kimono',
      kneesocks: 'Kneesocks',
      lash: 'Lash',
      lashes: 'Lashes',
      leggings: 'Leggings',
      loafers: 'Loafers',
      long: 'Long',
      longbangs: 'Longbangs',
      longskirt: 'Longskirt',
      maryjanes: 'Maryjanes',
      messy: 'Messy',
      mohawk: 'Mohawk',
      mole: 'Mole',
      monocle: 'Monocle',
      monolid: 'Monolid',
      mustache: 'Mustache',
      necklace: 'Necklace',
      neutral: 'Neutral',
      none: 'None',
      o: 'O',
      open: 'Open',
      oval: 'Oval',
      overalls: 'Overalls',
      oxfords: 'Oxfords',
      paint: 'Paint',
      pants: 'Pants',
      party: 'Party',
      pearls: 'Pearls',
      pirate: 'Pirate',
      plaid: 'Plaid',
      pleated: 'Pleated',
      pointy: 'Pointy',
      ponytail: 'Ponytail',
      pout: 'Pout',
      puffy: 'Puffy',
      quiver: 'Quiver',
      rainboots: 'Rainboots',
      raised: 'Raised',
      ribbon: 'Ribbon',
      robe: 'Robe',
      roman: 'Roman',
      round: 'Round',
      sad: 'Sad',
      sailor: 'Sailor',
      sandals: 'Sandals',
      scar: 'Scar',
      scarf: 'Scarf',
      shades: 'Shades',
      sharp: 'Sharp',
      short: 'Short',
      shorts: 'Shorts',
      sidepart: 'Sidepart',
      skirt: 'Skirt',
      sleepy: 'Sleepy',
      slickback: 'Slickback',
      slim: 'Slim',
      slippers: 'Slippers',
      small: 'Small',
      smile: 'Smile',
      smirk: 'Smirk',
      sneakers: 'Sneakers',
      soft: 'Soft',
      spark: 'Spark',
      spiky: 'Spiky',
      square: 'Square',
      star: 'Star',
      stars: 'Stars',
      straight: 'Straight',
      stripes: 'Stripes',
      stubble: 'Stubble',
      suit: 'Suit',
      sweater: 'Sweater',
      sword: 'Sword',
      tail: 'Tail',
      tank: 'Tank',
      tareme: 'Tareme',
      tee: 'Tee',
      teeth: 'Teeth',
      thick: 'Thick',
      thighhigh: 'Thighhigh',
      tights: 'Tights',
      tiny: 'Tiny',
      tongue: 'Tongue',
      toothy: 'Toothy',
      top: 'Top',
      triangle: 'Triangle',
      tsurime: 'Tsurime',
      tunic: 'Tunic',
      twintails: 'Twintails',
      undercut: 'Undercut',
      unibrow: 'Unibrow',
      uniform: 'Uniform',
      wavy: 'Wavy',
      wide: 'Wide',
      wings: 'Wings',
      wink: 'Wink',
      witch: 'Witch',
      wizard: 'Wizard'
    },
    partIds: {
      'beard-full': 'Full'
    }
  },
  human3dX: {
    reset: 'Reset'
  },
  pagesX: {
    couldNotRename: 'Could not rename',
    couldNotSave: 'Could not save',
    couldNotDuplicate: 'Could not duplicate',
    couldNotChangePassword: 'Could not change the password',
    sandbox: 'SANDBOX',
    quotaDetail: {
      people: '{n} people',
      projects: '{n} projects',
      photos: '{n} photos'
    }
  },
  // Name generator (WILD_IDEAS C2) — the dice beside the name slot
  nameGen: {
    dice: 'Suggest a name',
    title: 'Name generator',
    close: 'Close',
    source: 'Sounds like',
    ownTags: 'Suggested tags',
    otherTags: 'Other tags',
    cultures: 'Cultures',
    tagOption: '{label} ({n})',
    blendNote: 'Learned from {n} names, blended with {culture}.',
    useName: 'Use “{name}”',
    empty: 'No names came out. Try another source.',
    reroll: 'Reroll',
    surnameFrom: {
      patronym: "Surname from the father's name",
      parent: 'Surname from the parents',
      tag: "The tag's most common surname",
      generated: 'Generated surname'
    },
    corpus: {
      english: 'English & Anglo-Saxon',
      norse: 'Norse',
      roman: 'Roman',
      slavic: 'Slavic',
      celtic: 'Celtic',
      elvish: 'High fantasy (elvish)',
      dwarven: 'Dwarven & orcish',
      japanese: 'Japanese',
      chinese: 'Chinese (pinyin)'
    }
  }
}
