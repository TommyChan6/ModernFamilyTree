// Norsk bokmål — translated from en.js (the source locale). Missing keys fall
// back to English, so new strings can land in en.js first.
export default {
  topbar: {
    search: 'Gå til en person',
    export: 'Eksporter',
    exportImage: 'Eksporter et bilde av treet ditt',
    mode: 'Modus',
    modeHint: 'Programmodus — hvor mye av appen som vises',
    labs: 'Labs',
    labsOn: 'Labs er på — eksperimentelle funksjoner er tilgjengelige',
    labsOff: 'Labs — slå på eksperimentelle funksjoner',
    settings: 'Innstillinger',
    settingsHint: 'Innstillinger, språk, hjelp og tilbakemelding',
    lightMode: 'Lyst tema',
    darkMode: 'Mørkt tema',
    inkOn: 'Tusjmaleri-tema (水墨)',
    inkOff: 'Forlat tusjmaleri-temaet',
    newProject: 'Nytt prosjekt',
    closeProject: 'Lukk prosjekt',
    undo: 'Angre siste dataendring',
    redo: 'Gjør om den angrede endringen',
    projects: 'Prosjekter',
    projectsHint: 'Utforsk og administrer alle prosjektene dine'
  },
  billing: {
    title: 'La skogen vokse',
    eyebrow: 'Abonnementer',
    subtitle:
      'Alt du liker forblir gratis. Oppgrader for mer plass, ingen annonser og proverktøyene etter hvert som de kommer — og hjelp skogen å vokse.',
    close: 'Lukk',
    monthly: 'Månedlig',
    yearly: 'Årlig',
    save: 'Spar {pct} %',
    popular: 'Mest populær',
    perMonth: '/ mnd',
    forever: 'for alltid',
    noCard: 'Uten kort, uten skjulte vilkår',
    billedYearly: 'Faktureres {amount} én gang i året',
    billedMonthly: 'Faktureres månedlig · avslutt når som helst',
    freeIncludes: 'Alle visninger, alle oppsett, Labs',
    soon: 'Snart',
    compare: 'Sammenlign alle funksjoner',
    faqTitle: 'Spørsmål',
    faq: {
      cancel: {
        q: 'Kan jeg avslutte når som helst?',
        a: 'Ja. Når du avslutter, stopper fornyelsen. Du beholder abonnementet ut perioden du har betalt for, og går deretter tilbake til Free.'
      },
      downgrade: {
        q: 'Hva skjer med trærne mine hvis jeg går tilbake til Free?',
        a: 'Ingenting slettes. Du beholder alle prosjekter, personer og bilder — du kan bare ikke legge til flere mens du er over Free-grensene.'
      },
      secure: {
        q: 'Er det trygt å betale?',
        a: 'Betalinger håndteres av vår betalingspartner på deres egen sikre side. Kortopplysningene dine berører aldri appen eller serverne våre.'
      },
      discounts: {
        q: 'Har dere rabatter?',
        a: 'Årlig fakturering sparer deg for omtrent en firedel, og kampanjekoder (for lanseringer, skoler og fellesskap) brukes i kassen.'
      }
    },
    fine: 'Priser i USD. Avgifter kan komme i tillegg der det kreves.',
    sandboxChip: 'Sandkasse — ingen ekte betalinger',
    notLiveChip: 'Betaling åpner snart',
    reason: {
      quota: 'Du har nådd en grense i Free-abonnementet',
      ads: 'Nyt skogen uten annonser.',
      feature: 'Den funksjonen krever et høyere abonnement.'
    },
    plans: {
      free: { name: 'Free', tagline: 'Alt du trenger for å begynne å vokse.' },
      plus: { name: 'Plus', tagline: '10× større trær, null annonser, et supportermerke.' },
      pro: { name: 'Pro', tagline: 'For dynastier, forskere og verdensbyggere.' },
      guest: { name: 'Gjest', tagline: '' }
    },
    limits: { maxProjects: 'prosjekter', maxPersons: 'personer', maxImages: 'bilder' },
    perks: {
      adFree: 'Ingen annonser, noe sted',
      moreProjects: 'Flere prosjekter',
      morePeople: 'Større trær',
      morePhotos: 'Flere bilder',
      supporterBadge: 'Supportermerke',
      earlyLabs: 'Tidlig tilgang til Labs',
      coEdit: 'Rediger Åpne lunder sammen',
      hiresExport: 'Høyoppløst eksport og utskrift',
      gedcom: 'GEDCOM-import og -eksport',
      aiCredits: 'Kreditter til AI-trebygger',
      prioritySupport: 'Prioritert support'
    },
    cta: {
      guest: 'Opprett en konto først',
      current: 'Ditt abonnement',
      included: 'Inkludert',
      switchInterval: 'Bytt faktureringsperiode',
      upgrade: 'Oppgrader til {plan}',
      switch: 'Bytt til {plan}'
    },
    backToPlans: 'Alle abonnementer',
    reviewTitle: 'Se over bestillingen',
    couponPh: 'Kampanjekode',
    apply: 'Bruk',
    couponOk: '{code} er brukt',
    couponErr: {
      unknown: 'Den koden finnes ikke.',
      interval: 'Den koden gjelder bare årlig fakturering.'
    },
    annualSavings: 'Du sparer mot månedlig',
    dueToday: 'Å betale i dag',
    renews: 'Fornyes {date} for {amount}. Avslutt når som helst.',
    agree:
      'Jeg godtar vilkårene for bruk og forstår at abonnementet fornyes automatisk til jeg avslutter det.',
    continue: 'Gå videre til sikker betaling',
    notifyMe: 'Varsle meg når betaling åpner',
    waitlisted: 'Du står på listen',
    notLiveBody:
      'Betalte abonnementer er ikke i salg ennå. Interessen din er lagret på denne enheten, og abonnementet venter på deg her når kassen åpner.',
    waitlistToast: 'Lagret — du finner det her når betaling åpner.',
    secureNote: 'Betalingen skjer på betalingspartnerens sikre side. Vi ser aldri kortet ditt.',
    sandboxRibbon: 'testmodus — ingen penger flyttes',
    contacting: 'Kontakter betalingspartneren…',
    sandboxBrand: 'Betalingspartner (sandkasse)',
    sandboxBody:
      'Dette erstatter den ekte betalingssiden mens betaling bygges. Velg et utfall for å teste flyten.',
    simSuccess: 'Simuler vellykket betaling',
    simFail: 'Simuler avvist kort',
    simCancel: 'Avbryt og gå tilbake',
    welcome: 'Velkommen til {plan}!',
    welcomeBody: 'Takk for at du hjelper skogen å vokse. Dette er nå låst opp:',
    startExploring: 'Tilbake til trærne mine',
    declined: 'Betalingen ble avvist',
    declinedBody:
      'Ingenting ble belastet, og abonnementet ditt er uendret. Du kan prøve igjen når du vil.',
    tryAgain: 'Prøv igjen',
    yearWord: 'år',
    monthWord: 'måned',
    upgradeShort: 'Få Plus',
    upgradeHint: 'Se abonnementer — mer plass, ingen annonser',
    limitToast: 'Det er over grensen i Free-abonnementet.',
    seePlans: 'Se abonnementer',
    menu: {
      title: 'Få Plus',
      body: '10× større trær · ingen annonser',
      billing: 'Abonnement og fakturering'
    },
    panel: {
      title: 'Abonnement og fakturering',
      desc: 'Abonnementet ditt, fornyelse og betalingshistorikk.',
      renewsOn: 'fornyes {date}',
      endsOn: 'avsluttes {date} — fornyes ikke',
      free: 'Gratisabonnementet — ingen kort registrert.',
      guest: 'Opprett en konto for å velge abonnement.',
      change: 'Bytt abonnement',
      upgrade: 'Oppgrader',
      cancel: 'Avslutt abonnement',
      resume: 'Behold abonnementet',
      sandboxNote: 'Sandkassefakturering: betalinger simuleres i denne versjonen.',
      history: 'Faktureringshistorikk',
      date: 'Dato',
      number: 'Faktura',
      item: 'Abonnement',
      amount: 'Beløp',
      status: 'Status',
      inv: { paid: 'Betalt', failed: 'Mislyktes' },
      noInvoices: 'Ingen betalinger ennå.',
      cancelTitle: 'Avslutte abonnementet?',
      cancelBody:
        'Du beholder alt til {date}; deretter går kontoen tilbake til Free. Ingenting slettes.',
      cancelConfirm: 'Avslutt abonnement',
      keep: 'Behold det',
      canceledToast: 'Abonnementet ditt fornyes ikke. Takk for at du støtter skogen',
      resumedToast: 'Velkommen tilbake — abonnementet fornyes som vanlig.'
    }
  },
  ads: {
    label: 'Annonse',
    houseSponsor: 'fra FamilyTree',
    remove: 'Fjern annonser',
    dismiss: 'Skjul denne annonsen',
    house: {
      goPlus: {
        title: 'Bli annonsefri med Plus',
        body: 'Ingen annonser, 10× større trær og et supportermerke — fra $3 i måneden.',
        cta: 'Se Plus'
      },
      room: {
        title: 'Plass til 25 000 personer',
        body: 'Store dynastier trenger store trær. Plus gir hvert prosjekt rom til å vokse.',
        cta: 'Få mer plass'
      },
      pro: {
        title: 'Pro: laget for dynastier',
        body: 'De største grensene, tidlig Labs-tilgang, og proeksport og GEDCOM etter hvert som de kommer.',
        cta: 'Møt Pro'
      },
      browse: {
        title: 'Vandre i skogen',
        body: 'Utforsk anime-klaner, kongehus og kinesiske dynastier — og pod ett inn i prosjektene dine.',
        cta: 'Utforsk trær'
      }
    }
  },
  browse: {
    button: 'Utforsk',
    buttonHint: 'Utforsk slektstrær delt av fellesskapet',
    back: 'Tilbake',
    brand: 'Utforsk',
    eyebrow: 'Fellesskapets skog',
    title: 'Vandre i skogen',
    subtitle:
      'Slektstrær delt av andre skapere — anime-klaner, kongehus, kinesiske dynastier og sitcom-familier. Se deg rundt, ta med en kopi hjem, eller dyrk et tre sammen.',
    searchPh: 'Søk etter trær, personer, tagger eller @skapere',
    try: 'Prøv',
    surprise: 'Overrask meg',
    mockNote:
      'Forhåndsvisning — disse skaperne og trærne er eksempler til fellesskapet lanseres. Nedlastinger og poding er ekte.',
    ladderTitle: 'Hva kan jeg gjøre med andres tre?',
    ladderHint:
      'Hver skaper velger hvor mye besøkende får ta med seg, og hver modus inkluderer alt før den. Klikk på en modus for å filtrere.',
    modes: {
      glasshouse: {
        name: 'Glasshus',
        short: 'Bare visning',
        desc: 'Se gjennom glasset: utforsk hver gren, men ingenting forlater drivhuset.'
      },
      seedbank: {
        name: 'Frøbank',
        short: 'Vis og last ned',
        desc: 'Ta frøene med hjem: last ned prosjektfilen for å beholde, studere eller åpne offline.'
      },
      graft: {
        name: 'Podbar',
        short: 'Kopier til prosjektene dine',
        desc: 'Pod det inn i ditt eget tre: kopier det til prosjektene dine og gjør det til ditt.'
      },
      grove: {
        name: 'Åpen lund',
        short: 'Rediger sammen',
        desc: 'En felles lund: bli med som gartner og hjelp skaperen å dyrke den.'
      }
    },
    caps: { view: 'Utforsk', export: 'Last ned', fork: 'Pod', edit: 'Rediger sammen' },
    capsYes: {
      view: 'Utforsk treet, personene og båndene',
      export: 'Lagre prosjektfilen',
      fork: 'Kopier det til prosjektene dine',
      edit: 'Bli med som gartner'
    },
    capsNo: {
      view: '',
      export: 'Holdes i glasshuset',
      fork: 'Skaperen har den eneste kopien',
      edit: 'Bare skaperen redigerer'
    },
    genres: {
      all: 'Alt',
      anime: 'Anime',
      tv: 'TV og film',
      history: 'Kongehus',
      dynasty: 'Kinesiske dynastier',
      sitcom: 'Sitcoms og drama',
      myth: 'Mytologi'
    },
    sizeLabel: 'Trestørrelse',
    sizes: { any: 'Alle størrelser', cozy: 'Koselig', clan: 'Klan', dynasty: 'Dynasti' },
    sizesHint: {
      any: 'Hvor mange personer som helst',
      cozy: 'Opptil 15 personer',
      clan: '16–21 personer',
      dynasty: '22 personer eller flere'
    },
    langs: {
      any: 'Alle språk',
      en: 'Engelsk',
      'zh-Hans': '简体中文',
      'zh-Hant': '繁體中文',
      ja: '日本語'
    },
    sortLabel: 'Sorter',
    sort: {
      forYou: 'For deg',
      relevance: 'Beste treff',
      trending: 'Populært nå',
      loved: 'Mest likt',
      fresh: 'Nylig oppdatert',
      largest: 'Flest personer',
      deepest: 'Flest generasjoner',
      ancient: 'Eldste røtter'
    },
    shelves: {
      forYou: 'Valgt for deg',
      forYouHint: 'Lærer av det du liker, lagrer, følger og åpner',
      collections: 'Samlinger',
      collectionsHint: 'Håndplukket av gartnerne i teamet',
      creators: 'Skapere å følge',
      creatorsHint: 'Menneskene som dyrker disse skogene',
      yours: 'Dine trær i skogen',
      yoursHint: 'Slik ser besøkende de offentlige prosjektene dine',
      all: 'Alle trær'
    },
    reasons: {
      because: 'Fordi du likte {title}',
      creator: 'Fra {name}, som du følger',
      yours: 'Passer til prosjektet ditt «{word}»',
      lang: 'På ditt språk',
      trending: 'Populært akkurat nå'
    },
    results: '{n} trær',
    resultsFor: '{n} trær for «{q}»',
    clear: 'Nullstill filtre',
    emptyTitle: 'Ingenting vokser her… ennå',
    emptyBody: 'Prøv et annet søk, eller løsne på et filter.',
    yoursEmpty: 'Del et av trærne dine',
    yoursManage: 'Administrer deling',
    yoursPrivate: '{n} private — gjør ett offentlig på Prosjekter-siden',
    badges: { staff: 'Teamets valg', trending: 'Populært', new: 'Nytt' },
    stats: {
      people: 'personer',
      gens: 'generasjoner',
      likes: 'liker',
      forks: 'podinger',
      views: 'visninger'
    },
    card: {
      like: 'Lik',
      unlike: 'Fjern lik',
      save: 'Lagre til senere',
      unsave: 'Fjern fra lagret',
      found: 'Funnet'
    },
    activity: {
      grafted: 'podet',
      liked: 'likte',
      joined: 'ble med i lunden til',
      downloaded: 'lastet ned',
      commented: 'kommenterte'
    },
    detail: {
      close: 'Lukk',
      updated: 'Oppdatert {ago}',
      saved: 'Lagret',
      zoomIn: 'Zoom inn',
      zoomOut: 'Zoom ut',
      fit: 'Tilpass',
      zoomHint: 'Rull for å zoome · dra for å panorere · klikk på en person',
      legend: { parent: 'Forelder', spouse: 'Partner', rival: 'Rival', other: 'Annet bånd' },
      bonds: 'Bånd',
      noBonds: 'Ingen registrerte bånd.',
      cast: 'Persongalleri',
      castPh: 'Finn en person…',
      access: 'Dette kan du gjøre her',
      download: 'Last ned prosjektfil',
      downloaded: 'Lagret {file} — åpne den når som helst fra Prosjekt-menyen → Importer.',
      graft: 'Pod inn i prosjektene mine',
      grafting: 'Poder…',
      grafted: '«{name}» ble podet inn i prosjektene dine',
      graftFailed: 'Kunne ikke pode: {error}',
      openCopy: 'Åpne kopien min',
      join: 'Bli med som gartner',
      pending: 'Forespørsel sendt — venter på skaperen…',
      member: 'Du er gartner',
      memberNote:
        'Sanntidsredigering sammen kommer med det hostede fellesskapet. Inntil da kan du pode en kopi og dele ideer i kommentarene.',
      glassNote:
        'Denne skaperen holder treet i glasshuset — legg igjen en kommentar hvis du gjerne vil ha en kopi.',
      facts: 'Morsomme fakta',
      comments: 'Kommentarer',
      commentPh: 'Si noe hyggelig…',
      post: 'Publiser',
      you: 'Du',
      similar: 'Du vil kanskje også like'
    },
    facts: {
      longest: '{name} levde lengst — {n} år',
      children: '{name} har flest barn ({n})',
      married: '{name} giftet seg {n} ganger',
      connected: '{name} er mest tilknyttet — {n} bånd',
      rivals: '{n} registrerte rivaliseringer',
      span: 'Spenner over {n} år med historie',
      gens: '{n} generasjoner dypt'
    },
    bonds: {
      parent_child: { fwd: 'Forelder til', back: 'Barn av' },
      adopted: { fwd: 'Adoptivforelder til', back: 'Adoptert av' },
      spouse: { fwd: 'Gift med', back: 'Gift med' },
      partner: { fwd: 'Partner med', back: 'Partner med' },
      sibling: { fwd: 'Søsken av', back: 'Søsken av' },
      friends: { fwd: 'Venn med', back: 'Venn med' },
      likes: { fwd: 'Forelsket i', back: 'Beundret av' },
      rival: { fwd: 'Rival av', back: 'Rival av' },
      mentor: { fwd: 'Mentor for', back: 'Elev av' },
      subordinate: { fwd: 'Overordnet', back: 'Tjener' }
    },
    profile: {
      follow: 'Følg',
      following: 'Følger',
      followers: 'følgere',
      followingN: 'følger',
      trees: 'trær',
      likes: 'liker',
      theirTrees: 'Trærne deres',
      joined: 'Ble med {date}',
      badges: {
        staff: 'Team',
        historian: 'Historiker',
        otaku: 'Otaku',
        critic: 'Kritiker',
        pioneer: 'Pioner'
      }
    }
  },
  projectsPage: {
    title: 'Dine universer',
    subtitle: 'Alle verdenene du bygger, samlet på ett sted.',
    back: 'Tilbake',
    new: 'Nytt prosjekt',
    quota: '{used} av {max} prosjekter',
    stats: {
      projects: 'Prosjekter',
      people: 'Personer',
      bonds: 'Bånd',
      photos: 'Bilder'
    },
    searchPh: 'Søk i prosjekter…',
    filters: {
      all: 'Alle',
      favorites: 'Favoritter',
      public: 'Offentlige',
      private: 'Privat'
    },
    sort: {
      updated: 'Sist oppdatert',
      nameAsc: 'Navn A–Å',
      nameDesc: 'Navn Å–A',
      people: 'Flest personer',
      newest: 'Nyeste først',
      oldest: 'Eldste først'
    },
    view: {
      grid: 'Rutenett',
      list: 'Liste'
    },
    live: 'Aktiv',
    open: 'Åpne',
    favorite: 'Favoritt',
    actions: 'Prosjekthandlinger',
    noDesc: 'Ingen beskrivelse ennå — legg til en via ⋯ → Rediger detaljer.',
    updated: 'Oppdatert {date}',
    visibility: {
      private: 'Privat',
      public: 'Offentlig'
    },
    visibilityHint: 'Bytt mellom offentlig og privat',
    publicNote:
      'Offentlig deling blir tilgjengelig med den nettbaserte versjonen — valget ditt lagres til da.',
    menu: {
      open: 'Åpne',
      rename: 'Gi nytt navn',
      edit: 'Rediger detaljer',
      duplicate: 'Dupliser',
      delete: 'Slett'
    },
    deleteTitle: 'Slette «{name}»?',
    deleteBody:
      'Dette sletter permanent {persons} personer, {relationships} relasjoner og {images} bilder.',
    deleteCancel: 'Behold',
    deleteConfirm: 'Slett for godt',
    editTitle: 'Prosjektdetaljer',
    editName: 'Navn',
    editDesc: 'Beskrivelse',
    editDescPh: 'Hva handler denne verdenen om?',
    editColor: 'Kortfarge',
    editVisibility: 'Synlighet',
    editAccess: 'Besøkende kan',
    save: 'Lagre',
    cancel: 'Avbryt',
    saved: 'Prosjektdetaljer lagret',
    created: 'Prosjektet er opprettet — det venter i rutenettet',
    duplicated: 'Prosjektet er duplisert (bildene blir værende i originalen)',
    deleted: 'Prosjektet er slettet',
    emptyTitle: 'Ingen prosjekter passer',
    emptySub: 'Prøv et annet søk eller filter.'
  },
  history: {
    undid: 'Angret {what}',
    redid: 'Gjorde om {what}',
    kind: {
      persons: 'en personendring',
      relationships: 'en relasjonsendring',
      fields: 'en egenskapsendring',
      relTypes: 'en endring av relasjonstype',
      tags: 'en taggendring',
      entity_tags: 'en taggendring',
      scene_tags: 'en gruppeendring',
      images: 'en bildeendring',
      characters: 'en figurendring',
      generic: 'en endring',
      layout_move: 'en flytting',
      layout_curve: 'en linjeform',
      layout_style: 'en nodestil',
      layout_layout: 'en oppsettoppdatering'
    }
  },
  dialog: {
    confirm: 'Bekreft',
    cancel: 'Avbryt',
    ok: 'OK',
    delete: 'Slett',
    dismiss: 'Lukk',
    notice: 'Merknad',
    areYouSure: 'Er du sikker?',
    undo: 'Angre',
    undoHint: 'Du kan angre dette med Ctrl+Z.'
  },
  confirm: {
    deletePerson: 'Slette {name}?',
    deletePersonBody: 'Relasjonene, egenskapene og taggene deres slettes også.',
    deletePeople: 'Slette {count} personer?',
    deletePeopleBody: 'Alle relasjonene deres slettes også.',
    deleteSelection: 'Slette {people} personer og {bonds} bånd?',
    deleteBonds: 'Slette {count} bånd?',
    deleteBond: 'Slette dette båndet ({kind})?',
    deleteBondBetween: 'Båndet mellom {a} og {b} fjernes; begge personene beholdes.',
    deleteScene: 'Slette scenen «{name}»?',
    deleteSceneBody: 'Bare dette oppsettet fjernes — personer og grupper beholdes.',
    deleteSceneGroups:
      'De {count} gruppeplasseringene fjernes også — personer og grupper beholdes.',
    deleteGroup: 'Slette gruppen «{name}»?',
    deleteGroupBody: 'De {count} medlemmene blir værende i prosjektet.',
    deleteTrait: 'Slette egenskapen «{name}»?',
    deleteTraitBody: 'Verdiene for {count} personer fjernes også.',
    deleteRelType: 'Slette relasjonstypen «{name}»?',
    deleteRelTypeBody: 'De {count} relasjonene slettes også.',
    revert: 'Gå tilbake til siste lagringspunkt?',
    revertBody: 'Endringer siden forrige lagring forkastes.',
    revertConfirm: 'Tilbakestill',
    deleteLook: 'Slett dette utseendet',
    deleteMap: 'Slett dette kartet'
  },
  toasts: {
    deletedPerson: '{name} er slettet',
    deletedPeople: '{count} personer slettet',
    deletedBond: 'Båndet er slettet',
    deletedSelection: 'Utvalget er slettet',
    deleted: 'Slettet',
    saved: 'Lagringspunkt lagret',
    reverted: 'Tilbakestilt til siste lagringspunkt',
    exported: 'Prosjektet er eksportert — {file}',
    imported: 'Importerte «{name}» som et nytt prosjekt',
    importFailed: 'Importen mislyktes: {error}',
    importPhotos: 'Bilder er ikke med i prosjektfiler.',
    accent: 'Aksentfargen er oppdatert'
  },
  projectMenu: {
    button: 'Prosjekt',
    unsavedDot: 'Ulagrede endringer',
    save: 'Lagre',
    saveHint: 'Lag et lagringspunkt du kan gå tilbake til (Ctrl+S)',
    unsaved: 'ulagret',
    revert: 'Tilbakestill til lagret',
    revertHint: 'Gjenopprett oppsettet fra siste lagringspunkt',
    exportJson: 'Eksporter prosjektfil',
    exportHint:
      'Last ned hele prosjektet (personer, egenskaper, bånd, grupper, scener, kart) som JSON',
    importJson: 'Importer prosjektfil',
    importHint: 'Åpne en prosjektfil eksportert fra denne appen som et nytt prosjekt',
    present: 'Nåtid',
    presentPh: 'Skriv inn år…',
    presentReset: 'Tilbakestill til siste år i dataene',
    presentAuto: 'Auto · siste år i dataene',
    stats: 'Statistikk',
    members: 'Medlemmer',
    relationships: 'Relasjoner',
    couples: 'Par',
    generations: 'Generasjoner',
    generationsHint: 'Den lengste forelder → barn-linjen i dette prosjektet'
  },
  mode: {
    simple: 'Enkel',
    standard: 'Standard',
    advanced: 'Avansert'
  },
  rail: {
    views: 'Visninger',
    graph: 'Graf',
    directory: 'Katalog',
    relationships: 'Relasjoner',
    timeline: 'Tidslinje',
    groups: 'Grupper',
    character: 'Figur',
    map: 'Kart',
    addPerson: 'Legg til person',
    style: 'Stil'
  },
  map: {
    time: {
      play: 'Spill av gjennom tiden (P)',
      pause: 'Pause (P)',
      prevEvent: 'Forrige øyeblikk',
      nextEvent: 'Neste øyeblikk',
      stepBack: 'Ett år tilbake ([)',
      stepFwd: 'Ett år frem (])',
      typeYear: 'Skriv et år for å hoppe dit',
      year: 'ÅR',
      speed: 'Avspillingshastighet'
    },
    groups: {
      select: 'Velg',
      terrain: 'Terreng',
      realm: 'Riker',
      lines: 'Ruter og linjer',
      places: 'Steder',
      events: 'Hendelser',
      text: 'Tekst'
    },
    tools: {
      select: 'Velg og flytt',
      pan: 'Panorer',
      measure: 'Mål avstand',
      erase: 'Viskelær',
      land: 'Land',
      water: 'Vann / innsjø',
      forest: 'Skog',
      mountains: 'Fjell',
      hills: 'Åser',
      grass: 'Gressletter',
      desert: 'Ørken',
      swamp: 'Myr',
      snow: 'Snø og is',
      territory: 'Kongerike / fraksjon',
      river: 'Elv',
      road: 'Vei',
      rail: 'Jernbane',
      searoute: 'Sjørute',
      wall: 'Mur',
      border: 'Grense',
      place_capital: 'Hovedstad',
      place_city: 'By',
      place_town: 'Småby',
      place_village: 'Landsby',
      place_castle: 'Borg',
      place_port: 'Havn',
      place_temple: 'Tempel',
      place_tower: 'Tårn',
      place_ruin: 'Ruin',
      place_cave: 'Grotte',
      place_camp: 'Leir',
      place_mine: 'Gruve',
      place_station: 'Stasjon',
      place_landmark: 'Landemerke',
      event_battle: 'Slag',
      event_fire: 'Katastrofe',
      event_crown: 'Kroning',
      event_heart: 'Møte',
      event_skull: 'Død',
      event_star: 'Oppdagelse',
      event_flag: 'Grunnleggelse',
      arrow: 'Felttogspil',
      zone: 'Hendelsessone',
      label: 'Etikett'
    },
    kinds: {
      land: 'Land',
      water: 'Vann',
      forest: 'Skog',
      mountains: 'Fjell',
      hills: 'Åser',
      desert: 'Ørken',
      grass: 'Gressletter',
      swamp: 'Myr',
      snow: 'Snø og is',
      territory: 'Kongerike / fraksjon',
      zone: 'Hendelsessone',
      river: 'Elv',
      road: 'Vei',
      rail: 'Jernbane',
      wall: 'Mur',
      border: 'Grense',
      searoute: 'Sjørute',
      arrow: 'Felttogspil',
      place: 'Sted',
      label: 'Etikett',
      event: 'Hendelse'
    },
    people: {
      toggle: 'Personer — plasser dem på kartet (G)',
      title: 'Plasser en {noun}',
      search: 'Søk…',
      hint: 'Dra noen inn på kartet, eller trykk for å slippe dem midt på.',
      autoPlace: 'Plasser {n} etter bosted',
      flyTo: 'På kartet — klikk for å fly dit',
      dragOrTap: 'Dra inn på kartet, eller klikk for å plassere',
      none: 'Ingen treff.',
      unnamed: 'Uten navn'
    },
    inspector: {
      namePh: 'Gi det et navn…',
      length: 'Lengde {d}',
      area: 'Areal {a} · omkrets {d}',
      close: 'Lukk',
      type: 'Type',
      icon: 'Ikon',
      group: 'Gruppe',
      noGroup: '— ikke koblet —',
      groupHint: 'Koble til en gruppe, så får riket gruppens farge — og navnet, om det mangler.',
      color: 'Farge',
      styleColor: 'Stilens standard',
      custom: 'Egendefinert farge',
      size: 'Størrelse',
      rotate: 'Rotasjon',
      when: 'Når det finnes',
      from: 'Fra',
      to: 'Til',
      always: 'alltid',
      fromNow: 'fra {y}',
      untilNow: 'til {y}',
      whenHint:
        'La stå tomt for å vise det på alle tidspunkter. Det tones inn og ut når tidslinjen spilles av.',
      notes: 'Notater',
      notesPh: 'Historie, sagn, hvem som bor her…',
      duplicate: 'Dupliser (Ctrl+D)',
      front: 'Flytt fremst',
      back: 'Flytt bakerst',
      newEra: 'Ny epoke fra {y}',
      newEraHint:
        'Avslutter dette året før og starter en redigerbar kopi — for grenser som flytter seg eller veier som bygges om.',
      delete: 'Slett (Del)',
      onMap: 'På kartet',
      journey: 'Reise',
      stopNotePh: 'Hva skjedde her?',
      goTo: 'Gå til dette stoppet',
      removeStop: 'Fjern dette stoppet',
      journeyHint:
        'Flytt tidslinjen til et annet år, og dra portrettet — hvert drag registrerer et stopp. Alt-drag flytter hele reisen.',
      follow: 'Følg',
      following: 'Følger',
      profile: 'Profil',
      removeFromMap: 'Fjern fra dette kartet'
    },
    new: {
      kickerFirst: 'Kartvisning',
      kicker: 'Nytt kart',
      titleFirst: 'Tegn verdenen personene dine lever i',
      title: 'Start et nytt kart',
      sub: 'Mal land, riker, elver og veier, og plasser så personene dine og se dem reise gjennom tiden.',
      start: 'Start fra',
      starts: {
        generate: 'Generer en verden',
        ocean: 'Åpent hav',
        land: 'Åpent land'
      },
      startsBlurb: {
        generate: 'Et kontinent med kongeriker, byer, veier og en jernbane — alt kan redigeres.',
        ocean: 'Et tomt hav. Mal dine egne kystlinjer.',
        land: 'Fast grunn. Mal innsjøer, hav og alt annet.'
      },
      shapes: {
        landscape: 'Liggende',
        wide: 'Bred',
        square: 'Kvadratisk',
        portrait: 'Stående'
      },
      reroll: 'Generer på nytt',
      style: 'Velg en stil — du kan bytte når som helst',
      namePh: 'Gi kartet et navn (f.eks. «Den kjente verden»)',
      create: 'Opprett kart',
      defaultName: 'Den kjente verden'
    },
    styles: {
      parchment: 'Pergament',
      fantasy: 'Fantasy',
      ink: 'Tusjmaling',
      shanshui: 'Shanshui 山水',
      qinglu: 'Qinglü 青绿',
      hightech: 'Høyteknologi',
      atlas: 'Atlas'
    },
    stylesBlurb: {
      parchment: 'En oppdagelsesreisendes kart i sepiablekk.',
      fantasy: 'Et eventyratlas med drivende skyer.',
      ink: '水墨 — kinesisk tusj på rispapir.',
      shanshui: 'Tusjfjell fra Song-dynastiet på en montert rull.',
      qinglu: 'Wang Ximengs blågrønne mineraltopper på silke.',
      hightech: 'En holografisk taktisk skjerm.',
      atlas: 'Et rent, moderne politisk kart.'
    },
    menu: {
      yourMaps: 'Dine kart',
      rename: 'Gi nytt navn',
      new: 'Nytt kart…',
      duplicate: 'Dupliser kart',
      delete: 'Slett kart',
      style: 'Stil',
      ground: 'Umalt grunn er…',
      groundSea: 'Hav',
      groundLand: 'Land',
      export: 'Eksporter som PNG',
      copyName: '{name} (kopi)',
      confirmDelete: 'Slette kartet «{name}»? Dette kan ikke angres.'
    },
    toast: {
      created: '{name} er klart',
      undo: 'Angret',
      minPoints: 'Kan ikke fjernes — en form beholder minst 3 hjørner, en linje 2',
      copied: 'Kopierte {name} — Ctrl+V limer inn, på hvilket som helst kart',
      nothingToPaste: 'Ingenting kopiert ennå — velg noe og trykk Ctrl+C',
      layerShown: 'Laget {layer} vises igjen',
      exportFailed: 'Kunne ikke lage bildet — prøv gjeldende visning i stedet',
      redo: 'Gjort om',
      nothingToUndo: 'Ingenting å angre',
      nothingToRedo: 'Ingenting å gjøre om',
      deleted: 'Slettet — Ctrl+Z henter det tilbake',
      forkTooEarly: 'Flytt tidslinjen forbi startåret først',
      forked: 'Ny epoke fra {y} — form den fritt',
      autoPlaced: 'Plasserte {n} etter bosted',
      noLater: 'Ingenting senere på dette kartet',
      noEarlier: 'Ingenting tidligere på dette kartet',
      firstJourney: 'Reisen har startet — trykk Spill av for å se den',
      tooSmall: 'For lite — dra en større form',
      exported: 'Kartet er lagret som PNG'
    },
    zoom: {
      in: 'Zoom inn (+)',
      undo: 'Angre (Ctrl+Z)',
      redo: 'Gjør om (Ctrl+X)',
      out: 'Zoom ut (−)',
      fit: 'Vis hele kartet (0)'
    },
    hover: {
      stops: '{n} stopp på reisen',
      dragHint: 'Dra for å flytte · dobbeltklikk for profilen'
    },
    defaults: {
      label: 'Etikett'
    },
    find: {
      title: 'Finn på dette kartet (Ctrl+F)',
      placeholder: 'Finn et sted, et rike eller en person…',
      none: 'Ingenting med det navnet på dette kartet.',
      empty: 'Ingenting har navn ennå — gi steder og riker navn, så dukker de opp her.',
      foot: '↑ ↓ for å velge · Enter flyr dit',
      person: 'På kartet'
    },
    layers: {
      title: 'Lag',
      terrain: 'Terreng',
      realms: 'Riker',
      routes: 'Ruter og linjer',
      places: 'Steder',
      events: 'Hendelser',
      text: 'Etiketter',
      people: 'Personer',
      journeys: 'Reiser',
      names: 'Navn',
      snap: 'Fest til steder og hjørner',
      snapHint:
        'Linjer og former du tegner, fester seg til steder og hjørner i nærheten. Hold Alt for å tegne fritt.',
      showAll: 'Vis alt'
    },
    export: {
      sheet: 'Hele kartet',
      sheetHint: 'Hele arket slik det ser ut i {y}',
      view: 'Gjeldende visning',
      viewHint: 'Nøyaktig det som er på skjermen, dobbelt så skarpt'
    },
    keys: {
      title: 'Hurtigtaster',
      tools: 'Verktøy',
      edit: 'Redigering',
      view: 'Visning og tid',
      undo: 'Angre',
      redo: 'Gjør om',
      copy: 'Kopier',
      paste: 'Lim inn ved pekeren',
      duplicate: 'Dupliser',
      delete: 'Slett utvalget',
      nudge: 'Flytt litt (Shift = 10×)',
      finish: 'Fullfør en linje eller måling',
      cancel: 'Avbryt / fjern valg',
      removePoint: 'Fjern et hjørne',
      noSnap: 'Tegn uten å feste (hold)',
      pan: 'Panorer',
      zoom: 'Zoom inn / ut',
      fit: 'Vis hele kartet',
      find: 'Finn',
      people: 'Personskuff',
      play: 'Spill av / pause tiden',
      step: 'Ett år tilbake / fram',
      sheet: 'Denne oversikten'
    },
    units: {
      league: '{n} ligaer',
      league2: '{n} kv.-ligaer',
      li: '{n} li',
      li2: '{n} kv.-li',
      km: '{n} km',
      km2: '{n} km²'
    },
    ctx: {
      deletePoint: 'Fjern dette hjørnet',
      rename: 'Gi nytt navn',
      duplicate: 'Dupliser',
      copy: 'Kopier',
      delete: 'Slett',
      pasteHere: 'Lim inn her',
      labelHere: 'Legg til en etikett her',
      measureFrom: 'Mål herfra'
    },
    hint: {
      select:
        'Klikk for å velge · dra for å flytte · dra i tomt område for å panorere · rull for å zoome · dobbeltklikk på land eller hav for å redigere',
      pan: 'Dra for å panorere · rull for å zoome',
      measure:
        'Klikk for å begynne å måle · fortsett å klikke for en rute · dobbeltklikk eller Enter for å avslutte',
      measuring:
        '{d} så langt · klikk for å legge til et stopp · dobbeltklikk eller Enter for å avslutte · Esc tømmer',
      measured: 'Totalt {d} · klikk for å måle på nytt · Esc tømmer',
      shape:
        'Dra en firkant for å flytte et hjørne · dra en prikk på en kant for å legge til et · Alt-klikk et hjørne for å fjerne det',
      erase: 'Klikk eller dra over ting for å viske dem ut',
      area: '{name}: dra for å male en form — eller klikk punkter og trykk Enter',
      line: '{name}: dra for å tegne — eller klikk punkter og dobbeltklikk for å fullføre',
      point: 'Klikk for å plassere: {name}',
      clickMode:
        'Klikk for å legge til punkter · Enter eller dobbeltklikk for å fullføre · Backspace fjerner et punkt · Esc avbryter',
      token: 'Dra {name} for å registrere hvor de er i {y} · Alt-drag flytter hele reisen'
    }
  },
  character: {
    experimental: 'Eksperimentell',
    person: 'Person',
    style: 'Stil',
    labelPh: 'Gi utseendet et navn…',
    lookName: 'Utseende {n}',
    addLook: 'Nytt utseende',
    deleteLook: 'Slett dette utseendet',
    confirmDelete: 'Slette «{name}»? Utseendet blir borte for godt.',
    create: 'Lag en figur',
    emptyTitle: 'Gi {name} et ansikt',
    newLookTitle: 'Et nytt utseende',
    chooseStyle: 'Velg en tegnestil — du kan bytte når som helst.',
    startRandom: 'Start med et tilfeldig utseende',
    startInherit: 'Arv fra foreldrene',
    emptyHint:
      'Bygg et portrett av utskiftbare deler — velg deler, endre farge og størrelse, og bruk det som bilde overalt i appen.',
    noPersons: 'Legg til en person først — kom så tilbake og gi dem et ansikt.',
    randomize: 'Tilfeldig',
    mirror: 'Speilvend',
    undo: 'Angre',
    redo: 'Gjør om',
    zoomIn: 'Zoom inn',
    zoomOut: 'Zoom ut',
    setPortrait: 'Bruk som portrett',
    portraitSet: 'Portrettet er oppdatert overalt',
    portraitBadge: 'Dette utseendet er portrettet',
    none: 'Ingen',
    size: 'Størrelse',
    colors: 'Farger',
    body: 'Kropp',
    height: 'Høyde',
    build: 'Kroppsbygning',
    headSize: 'Hode',
    age: 'Alder',
    ageStages: {
      child: 'Barn',
      teen: 'Tenåring',
      adult: 'Voksen',
      middle: 'Middelaldrende',
      elder: 'Eldre'
    },
    resetHint: 'Dobbeltklikk på en glidebryter for å tilbakestille den.',
    ages: 'Aldersspenn',
    ageHint: 'Knytt eventuelt utseendet til et aldersspenn, f.eks. et ungt og et gammelt portrett.',
    ageFrom: 'Fra',
    ageTo: 'Til',
    flipPart: 'Speilvend denne delen',
    lockHint: 'Lås — behold ved tilfeldig valg',
    customColor: 'Egendefinert farge',
    presets: 'Paletter',
    applyPreset: 'Bruk denne paletten',
    harmony: 'Antrekksharmoni',
    harmonyHint: 'Bygg antrekksfargene på nytt rundt overdelens farge.',
    harmonies: {
      complementary: 'Komplementær',
      analogous: 'Analog',
      triad: 'Triade',
      mono: 'Mono'
    },
    groupColors: 'Bruk gruppefarger',
    groupColorsHint: 'Kle dem i fargene til en av gruppene deres.',
    fxToggle: 'Bevegelse og partikler',
    tabs: {
      parts: 'Deler',
      colors: 'Farger',
      body: 'Kropp',
      genes: 'Gener'
    },
    groups: {
      face: 'Ansikt',
      hair: 'Hår',
      outfit: 'Antrekk',
      extras: 'Ekstra'
    },
    cams: {
      auto: 'Auto',
      full: 'Hel',
      portrait: 'Byste',
      face: 'Ansikt'
    },
    backdrops: {
      studio: 'Studio',
      sunset: 'Solnedgang',
      night: 'Stjernenatt',
      sakura: 'Sakura',
      forest: 'Ildflueskog',
      arcade: 'Arkade',
      paper: 'Papir',
      none: 'Enkel'
    },
    expr: {
      neutral: 'Nøytral',
      happy: 'Glad',
      laugh: 'Ler',
      surprised: 'Overrasket',
      angry: 'Sint',
      sad: 'Trist',
      smug: 'Selvgod',
      shy: 'Sjenert'
    },
    styleNames: {
      anime: 'Anime',
      realistic: 'Realistisk',
      simple: 'Enkel',
      cartoon: 'Tegneserie',
      human3d: 'Realistisk 3D'
    },
    styleBlurbs: {
      anime: 'Celleskygget, store glitrende øyne og gacha-heltestil.',
      realistic: 'Malerisk lys og naturlige proporsjoner.',
      simple: 'Flat, geometrisk og vennlig — rene former.',
      cartoon: 'Kraftige konturer og et stort, blidt hode.',
      human3d:
        'Et fullt formbart 3D-menneske — hundrevis av glidebrytere for ansikt og kropp, hårstrå, antrekk, positurer og studiolys.'
    },
    new3d: 'Nytt · Realistisk 3D-figurskaper',
    inherit: 'Arv fra foreldrene',
    resemblance: 'Likhet',
    rollChild: 'Lag et familieansikt',
    inherited: 'Et ansikt med familielikhet',
    noParents: 'Ingen foreldre er koblet til denne personen ennå.',
    parentsNoLooks: 'Gi foreldrene et utseende først — så kan trekkene deres gå i arv.',
    genePool: 'Genbank',
    genePoolHint:
      'Bland to tilfeldige utseender fra prosjektet, så nye ansikter hører hjemme i denne verdenen.',
    rollGenePool: 'Trekk fra genbanken',
    dna: 'Figurkode',
    dnaHint: 'Kopier utseendet som en kode, eller lim inn en kode for å laste den her.',
    copyDna: 'Kopier kode',
    pasteDna: 'Lim inn en kode…',
    apply: 'Bruk',
    dnaCopied: 'Koden er kopiert',
    dnaShown: 'Koden står i feltet — kopier den derfra',
    dnaApplied: 'Utseendet er lastet',
    dnaBad: 'Det er ikke en gyldig figurkode',
    export: 'Eksporter',
    photo: {
      open: 'Fotomodus',
      portrait: 'Byste',
      full: 'Hel kropp',
      download: 'Last ned kort',
      setFramed: 'Bruk som innrammet portrett',
      close: 'Lukk'
    },
    slots: {
      back: 'Bak',
      head: 'Ansikt',
      hair: 'Hår',
      eyes: 'Øyne',
      brows: 'Bryn',
      nose: 'Nese',
      mouth: 'Munn',
      facialHair: 'Skjegg',
      marks: 'Merker',
      torso: 'Overdel',
      legs: 'Underdel',
      feet: 'Sko',
      headwear: 'Hodeplagg',
      accessory: 'Tilbehør'
    },
    palette: {
      skin: 'Hud',
      hair: 'Hår',
      eyes: 'Øyne',
      outfitA: 'Overdel',
      outfitB: 'Underdel',
      accent: 'Aksent'
    }
  },
  settings: {
    title: 'Innstillinger',
    tabs: {
      general: 'Generelt',
      help: 'Hjelp og dokumentasjon',
      feedback: 'Tilbakemelding',
      about: 'Om'
    },
    language: {
      title: 'Språk',
      desc: 'Velg visningsspråk for appen. Gjelder overalt og huskes til neste gang.'
    },
    appearance: {
      title: 'Utseende'
    },
    theme: {
      title: 'Tema',
      desc: 'Bytt mellom mørkt, lyst og 水墨-tusjmaleri-grensesnittet.',
      light: 'Lyst',
      dark: 'Mørkt',
      ink: 'Tusj'
    },
    accent: {
      title: 'Aksentfarge',
      desc: 'Farger knapper, markeringer og valg i hele appen.',
      inkNote: 'Tusjtemaet stempler alltid i cinnoberrødt.',
      custom: 'Egendefinert farge',
      reset: 'Tilbakestill til standard',
      presets: {
        periwinkle: 'Blåklokke',
        violet: 'Fiolett',
        rose: 'Rosa',
        coral: 'Korall',
        amber: 'Rav',
        emerald: 'Smaragd',
        teal: 'Blågrønn',
        sky: 'Himmelblå'
      }
    },
    programMode: {
      title: 'Programmodus',
      desc: 'Styrer hvor mange funksjoner som vises. Enkel holder fokus; Avansert låser opp alle verktøy.'
    },
    noun: {
      title: 'Hva kaller du dem?',
      desc: 'Ordet prosjektet bruker for oppføringene sine — Person, Figur, Skip, Hus … Gjelder bare dette prosjektet.',
      placeholder: 'Person'
    },
    close: 'Lukk'
  },
  help: {
    title: 'Hjelp og dokumentasjon',
    intro:
      'Family Tree hjelper deg å kartlegge personer, relasjonene deres og hvordan de endrer seg over tid. Slik finner du fram.',
    gettingStarted: {
      title: 'Kom i gang',
      steps: [
        'Legg til en person med ＋-knappen i venstre felt, eller trykk på Legg til person.',
        'Åpne en person for å fylle inn datoer, bilder og notater.',
        'Tegn en relasjon ved å koble sammen to personer i grafvisningen.',
        'Bytt visning i venstre felt for å se familien som graf, katalog, tidslinje eller grupper.',
        'Trykk Ctrl+S for å lagre et lagringspunkt du kan gå tilbake til senere — alt annet lagres automatisk.'
      ]
    },
    views: {
      title: 'De fem visningene',
      items: [
        {
          name: 'Graf',
          desc: 'Det interaktive nettet av personer og relasjoner. Dra for å flytte rundt.'
        },
        { name: 'Katalog', desc: 'En søkbar kortliste over alle i prosjektet.' },
        { name: 'Relasjoner', desc: 'Alle koblinger i én oversiktlig liste.' },
        { name: 'Tidslinje', desc: 'Livslinjer lagt ut etter år — fødsler, ekteskap og mer.' },
        { name: 'Grupper', desc: 'Grupper personer etter taggene de deler.' }
      ]
    },
    shortcuts: {
      title: 'Hurtigtaster',
      items: [
        { keys: 'Ctrl / ⌘ + K', desc: 'Hopp til en person' },
        { keys: 'Ctrl / ⌘ + S', desc: 'Lagre et lagringspunkt' },
        { keys: 'Ctrl / ⌘ + Z', desc: 'Angre siste dataendring' },
        { keys: 'Ctrl / ⌘ + X · Ctrl + Y · Ctrl + Shift + Z', desc: 'Gjør om' },
        { keys: 'Alt + 1 … 7', desc: 'Bytt visning (Graf, Katalog, Relasjoner …)' },
        { keys: 'Alt + N', desc: 'Legg til en person' },
        { keys: 'Hold Tab', desc: 'Handlingshjulet i grafen' },
        { keys: 'Shift + klikk på to personer', desc: 'Spor koblingen mellom dem' },
        { keys: '?', desc: 'Vis denne hjelpen' },
        { keys: 'Esc', desc: 'Lukk en dialog' }
      ]
    }
  },
  feedback: {
    title: 'Send tilbakemelding',
    intro: 'Funnet en feil eller fått en idé? Skaperen av programmet vil gjerne høre fra deg.',
    typeLabel: 'Type',
    type: {
      bug: 'Feilrapport',
      idea: 'Funksjonsidé',
      praise: 'Noe jeg liker',
      other: 'Annet'
    },
    messageLabel: 'Din melding',
    placeholder:
      'Beskriv hva du likte, hva som gikk galt, eller hva du skulle ønske appen kunne gjøre…',
    send: 'Send med e-post',
    note: 'Dette åpner e-postappen din med meldingen ferdig utfylt — ingenting sendes automatisk.',
    empty: 'Skriv en kort melding først, og send den så.'
  },
  account: {
    myProfile: 'Min profil',
    back: 'Tilbake til appen',
    memberSince: 'Medlem siden {date}',
    planFree: 'Gratisabonnement',
    profile: {
      title: 'Profil',
      desc: 'Slik du vises i appen — og, når deling kommer, for dem du deler med.',
      displayName: 'Visningsnavn',
      displayNamePh: 'Hva skal vi kalle deg?',
      bio: 'Om deg',
      bioPh: 'En kort linje om deg eller slektsforskningen din…',
      avatar: 'Avatarfarge',
      auto: 'Automatisk — utledet fra brukernavnet ditt',
      save: 'Lagre profil',
      saved: 'Lagret'
    },
    security: {
      title: 'Sikkerhet',
      desc: 'Påloggingsdetaljene dine. Endrer du passordet, logges de andre enhetene dine ut.',
      username: 'Brukernavn',
      usernameNote: 'Brukernavn kan ikke endres.',
      currentPassword: 'Nåværende passord',
      newPassword: 'Nytt passord',
      confirmPassword: 'Gjenta nytt passord',
      change: 'Endre passord',
      changed: 'Passordet er endret — de andre enhetene dine er logget ut.',
      mismatch: 'De nye passordene er ikke like',
      signOut: 'Logg ut'
    },
    usage: {
      title: 'Abonnement og bruk',
      desc: 'Hva abonnementet ditt inkluderer, og hvor mye du bruker.',
      people: 'Personer',
      projects: 'Prosjekter',
      photos: 'Bilder'
    },
    projects: {
      title: 'Dine prosjekter',
      desc: 'Alt du har laget, samlet på ett sted. Klikk på et prosjekt for å åpne det.',
      open: 'Åpne',
      current: 'Åpen nå',
      updated: 'Oppdatert {date}',
      new: 'Nytt prosjekt'
    },
    sharing: {
      title: 'Deling',
      soon: 'Kommer snart',
      desc: 'Del en skrivebeskyttet lenke til et prosjekt, eller publiser øyeblikksbilder av treet ditt. Når funksjonen kommer, administrerer du alt du har delt her.',
      kindProject: 'Prosjektlenke',
      kindImage: 'Øyeblikksbilde',
      visibility: {
        private: 'Privat',
        link: 'Alle med lenken',
        public: 'Offentlig'
      },
      copyLink: 'Kopier lenke',
      mockNote:
        'Dette er en forhåndsvisning av en planlagt funksjon — ingenting er delt ennå, og alle dataene dine blir på denne enheten.'
    }
  },
  about: {
    title: 'Om Family Tree',
    tagline: 'Et lokalt-først verktøy for å kartlegge familie og relasjoner.',
    versionLabel: 'Versjon',
    creatorLabel: 'Laget av',
    contactLabel: 'Kontakt',
    tech: 'Bygget med Vue 3, Three.js og Electron.',
    privacy: 'Dataene dine blir på enheten din — du trenger ingen konto for lokal bruk.',
    copyright: '{holder} — alle rettigheter forbeholdt.'
  },
  // 3D-figurskaperen (Figur-visningen, 3D-stil)
  human3d: {
    categories: 'Kategorier',
    loading: 'Former figuren din …',
    loadFailed: 'Kunne ikke laste 3D-modellen.',
    camera: 'Kamera',
    lighting: 'Lys',
    dragToSculpt: 'dra for å forme · klikk for å redigere',
    clickToEdit: 'klikk for å redigere',
    expression: 'Uttrykk',
    undo: 'Angre',
    redo: 'Gjør om',
    randomizeAll: 'Gjør alt tilfeldig',
    sculptMode: 'Formemodus: dra trekk i ansiktet',
    turntable: 'Dreieskive',
    gaze: 'Øyekontakt',
    photo: 'Lagre et bilde',
    setPortrait: 'Bruk som portrett',
    searchSliders: 'Søk i glidebrytere …',
    asymmetry: 'Rediger venstre og høyre hver for seg',
    resetGroup: 'Tilbakestill denne gruppen',
    randomizeGroup: 'Gjør denne gruppen tilfeldig',
    archetypes: 'Arketyper',
    family: 'Familielikhet',
    familyHint: 'Bland dette ansiktet fra foreldrenes 3D-utseende.',
    resemblance: 'Likhet',
    end: {
      'Wild card': 'Joker',
      'Spitting image': 'Prikk lik',
      Narrow: 'Smal',
      Wide: 'Bred',
      Smaller: 'Mindre',
      Bigger: 'Større',
      Less: 'Mindre',
      More: 'Mer',
      Younger: 'Yngre',
      Older: 'Eldre',
      In: 'Inn',
      Out: 'Ut',
      Down: 'Ned',
      Up: 'Opp',
      Back: 'Bak',
      Forward: 'Frem',
      Low: 'Lav',
      High: 'Høy',
      Hollow: 'Hul',
      Full: 'Fyldig',
      Close: 'Tett',
      Apart: 'Spredt',
      Open: 'Åpen',
      Short: 'Kort',
      Long: 'Lang',
      Flat: 'Flat',
      Prominent: 'Markert',
      Concave: 'Konkav',
      Convex: 'Konveks',
      Pinched: 'Klemt',
      Relaxed: 'Avslappet',
      Thin: 'Tynn',
      Soft: 'Myk',
      Receding: 'Vikende',
      Strong: 'Kraftig',
      Pointed: 'Spiss',
      Triangle: 'Trekant',
      Square: 'Firkantet',
      Round: 'Rund',
      Thick: 'Tykk',
      Slim: 'Slank',
      Slender: 'Spinkel',
      Spread: 'Spredt',
      Bowed: 'Hjulbent',
      Knock: 'Kalvbent',
      Female: 'Kvinne',
      Male: 'Mann',
      Tall: 'Høy',
      Heavy: 'Kraftig',
      Athletic: 'Atletisk',
      Uncommon: 'Uvanlig',
      Ideal: 'Ideell',
      Small: 'Liten',
      Firm: 'Fast',
      Straight: 'Rett',
      Coily: 'Krøllete',
      Left: 'Venstre',
      Right: 'Høyre',
      Petite: 'Petite'
    },
    rollChild: 'Lag et familieansikt',
    noParents3d: 'Gi denne personens foreldre et 3D-utseende for å arve trekk fra dem.',
    randomize: 'Tilfeldig',
    randomizeHint: 'Låste deler beholder utseendet når du kaster terningen.',
    reset: 'Start på nytt',
    resetFace: 'Nøytralt ansikt',
    resetAll: 'Standardmenneske',
    heritage: 'Opphavsblanding',
    heritageHint: 'Former ansikt og kropp; de tre blir alltid 100 % til sammen.',
    left: 'Venstre',
    right: 'Høyre',
    noMatches: 'Ingen glidebrytere passer.',
    skinTone: 'Hudtone',
    style: 'Stil',
    fringeTitle: 'Pannelugg',
    hairColor: 'Farge',
    ombre: 'Ombré-tupper',
    highlights: 'Striper',
    brows: {
      thickness: 'Tykkelse',
      density: 'Tetthet',
      arch: 'Bue'
    },
    beard: {
      length: 'Lengde',
      density: 'Tetthet',
      stubble: 'Skjeggstubb',
      none: 'Glattbarbert',
      'short-beard': 'Kort skjegg',
      'full-beard': 'Fullskjegg',
      goatee: 'Bukkeskjegg',
      'van-dyke': 'Van Dyke',
      mustache: 'Bart',
      chevron: 'Chevron-bart',
      handlebar: 'Sykkelstyrebart',
      'chin-strap': 'Hakestropp',
      mutton: 'Kinnskjegg'
    },
    iris: 'Iris',
    irisRing: 'Ytre ring',
    hetero: 'Ulikt høyre øye (heterokromi)',
    mainColor: 'Hovedfarge',
    secondColor: 'Sekundærfarge',
    patternTitle: 'Mønster',
    metal: 'Metall og detaljer',
    poseTitle: 'Positur',
    qualityTitle: 'Gjengivelseskvalitet',
    qualityHint: 'Høy legger til ambient occlusion, 4× kantutjevning og full hårtetthet.',
    photoPortrait: 'Portrett',
    photoFull: 'Hel kropp',
    photoView: 'Denne visningen',
    transparent: 'Gjennomsiktig bakgrunn',
    credits: 'Om denne modellen',
    creditsText:
      'Grunnmesh, morf-mål og rigg fra MakeHuman (CC0). Hår, hud, øyne og klær genereres prosedyrisk.',
    group: {
      shape: 'Proporsjoner',
      head: 'Hodeform',
      forehead: 'Panne',
      eyes: 'Øyne',
      nose: 'Nese',
      mouth: 'Munn og lepper',
      cheeks: 'Kinn',
      jaw: 'Kjeve og hake',
      ears: 'Ører',
      neck: 'Hals',
      torso: 'Overkropp',
      hips: 'Hofter',
      arms: 'Armer og hender',
      legs: 'Ben og føtter'
    },
    sub: {
      hair: 'Hår',
      brows: 'Bryn',
      beard: 'Skjegg',
      top: 'Overdel',
      bottom: 'Underdel',
      shoes: 'Sko',
      acc: 'Tilbehør'
    },
    years: 'år',
    slider: {
      'head-oval': 'Oval',
      'head-round': 'Rund',
      'head-rectangular': 'Rektangulær',
      'head-square': 'Firkantet',
      'head-triangular': 'Trekantet',
      'head-invertedtriangular': 'Omvendt trekant',
      'head-diamond': 'Diamant',
      'head-scale-horiz-decr-incr': 'Bredde',
      'head-scale-vert-decr-incr': 'Høyde',
      'head-scale-depth-decr-incr': 'Dybde',
      'head-back-scale-depth-decr-incr': 'Bakhode',
      'head-fat-decr-incr': 'Fylde',
      'head-age-decr-incr': 'Ansiktsalder',
      'head-angle-in-out': 'Helning',
      'head-trans-down-up': 'Hodehøyde',
      'head-trans-backward-forward': 'Hode fremover',
      'head-trans-in-out': 'Hode sideveis',
      'forehead-scale-vert-decr-incr': 'Høyde',
      'forehead-trans-backward-forward': 'Helning',
      'forehead-nubian-decr-incr': 'Pannebule',
      'forehead-temple-decr-incr': 'Tinninger',
      'eyebrows-trans-down-up': 'Brynhøyde',
      'eyebrows-trans-backward-forward': 'Brynbue',
      'eyebrows-angle-down-up': 'Brynvinkel',
      'eye-scale-decr-incr': 'Størrelse',
      'eye-trans-in-out': 'Avstand',
      'eye-trans-down-up': 'Høyde',
      'eye-height1-decr-incr': 'Indre åpning',
      'eye-height2-decr-incr': 'Midtre åpning',
      'eye-height3-decr-incr': 'Ytre åpning',
      'eye-corner1-down-up': 'Indre øyekrok',
      'eye-corner2-down-up': 'Ytre øyekrok (helning)',
      'eye-push1-in-out': 'Indre dybde',
      'eye-push2-in-out': 'Ytre dybde',
      'eye-epicanthus-in-out': 'Epikantusfold',
      'eye-eyefold-down-up': 'Øyelokksfold',
      'eye-eyefold-concave-convex': 'Øyelokksfylde',
      'eye-eyefold-angle-down-up': 'Øyelokksvinkel',
      'eye-bag-decr-incr': 'Poser under øynene',
      'eye-bag-height-decr-incr': 'Posehøyde',
      'eye-bag-in-out': 'Posedybde',
      'nose-scale-vert-decr-incr': 'Lengde',
      'nose-scale-horiz-decr-incr': 'Bredde',
      'nose-scale-depth-decr-incr': 'Fremspring',
      'nose-trans-down-up': 'Høyde',
      'nose-trans-backward-forward': 'Dybde',
      'nose-trans-in-out': 'Sideveis',
      'nose-width1-decr-incr': 'Neseryggbredde',
      'nose-width2-decr-incr': 'Midtbredde',
      'nose-width3-decr-incr': 'Basebredde',
      'nose-hump-decr-incr': 'Nesepukkel',
      'nose-curve-concave-convex': 'Profilkurve',
      'nose-greek-decr-incr': 'Gresk profil',
      'nose-point-width-decr-incr': 'Tuppbredde',
      'nose-point-down-up': 'Tuppvinkel',
      'nose-volume-decr-incr': 'Volum',
      'nose-nostrils-width-decr-incr': 'Neseborbredde',
      'nose-nostrils-angle-down-up': 'Neseborvinkel',
      'nose-flaring-decr-incr': 'Neseborvidde',
      'nose-base-down-up': 'Base',
      'nose-septumangle-decr-incr': 'Skillevegg-vinkel',
      'nose-compression-compress-uncompress': 'Kompresjon',
      'mouth-scale-horiz-decr-incr': 'Bredde',
      'mouth-scale-vert-decr-incr': 'Høyde',
      'mouth-scale-depth-decr-incr': 'Dybde',
      'mouth-trans-down-up': 'Plassering',
      'mouth-trans-backward-forward': 'Fremspring',
      'mouth-trans-in-out': 'Sideveis',
      'mouth-upperlip-volume-decr-incr': 'Overleppefylde',
      'mouth-lowerlip-volume-decr-incr': 'Underleppefylde',
      'mouth-upperlip-height-decr-incr': 'Overleppehøyde',
      'mouth-lowerlip-height-decr-incr': 'Underleppehøyde',
      'mouth-upperlip-width-decr-incr': 'Overleppebredde',
      'mouth-lowerlip-width-decr-incr': 'Underleppebredde',
      'mouth-upperlip-middle-down-up': 'Overleppe midt',
      'mouth-lowerlip-middle-down-up': 'Underleppe midt',
      'mouth-upperlip-ext-down-up': 'Overleppe ender',
      'mouth-lowerlip-ext-down-up': 'Underleppe ender',
      'mouth-cupidsbow-decr-incr': 'Amorbue',
      'mouth-cupidsbow-width-decr-incr': 'Amorbuebredde',
      'mouth-angles-down-up': 'Munnviker',
      'mouth-philtrum-volume-decr-incr': 'Philtrum',
      'mouth-dimples-in-out': 'Smilehull',
      'mouth-laugh-lines-in-out': 'Smilerynker',
      'cheek-bones-decr-incr': 'Kinnben',
      'cheek-volume-decr-incr': 'Fylde',
      'cheek-inner-decr-incr': 'Indre kinn',
      'cheek-trans-down-up': 'Høyde',
      'chin-width-decr-incr': 'Hakebredde',
      'chin-height-decr-incr': 'Hakehøyde',
      'chin-prominent-decr-incr': 'Hakefremspring',
      'chin-cleft-decr-incr': 'Kløft',
      'chin-jaw-drop-decr-incr': 'Kjevedybde',
      'chin-bones-decr-incr': 'Kjevebredde',
      'chin-prognathism-decr-incr': 'Underbitt',
      'ear-scale-decr-incr': 'Størrelse',
      'ear-scale-vert-decr-incr': 'Høyde',
      'ear-scale-depth-decr-incr': 'Dybde',
      'ear-trans-down-up': 'Plassering',
      'ear-trans-backward-forward': 'Fremover',
      'ear-rot-backward-forward': 'Rotasjon',
      'ear-lobe-decr-incr': 'Øreflipp',
      'ear-shape-pointed-triangle': 'Spiss ↔ trekant',
      'ear-shape-square-round': 'Firkantet ↔ rund',
      'ear-wing-decr-incr': 'Utstående',
      'ear-flap-decr-incr': 'Ørebrem',
      'neck-scale-horiz-decr-incr': 'Bredde',
      'neck-scale-depth-decr-incr': 'Dybde',
      'neck-scale-vert-decr-incr': 'Lengde',
      'neck-double-decr-incr': 'Dobbelthake',
      'neck-back-scale-depth-decr-incr': 'Nakke',
      'neck-trans-backward-forward': 'Fremover',
      'neck-trans-down-up': 'Høyde',
      'measure-neck-circ-decr-incr': 'Tykkelse',
      'measure-shoulder-dist-decr-incr': 'Skulderbredde',
      'torso-vshape-decr-incr': 'V-form',
      'torso-scale-horiz-decr-incr': 'Overkroppsbredde',
      'torso-scale-depth-decr-incr': 'Overkroppsdybde',
      'torso-scale-vert-decr-incr': 'Overkroppslengde',
      'measure-napetowaist-dist-decr-incr': 'Rygglengde',
      'torso-muscle-pectoral-decr-incr': 'Brystmuskler',
      'torso-muscle-dorsi-decr-incr': 'Ryggmuskler',
      'measure-bust-circ-decr-incr': 'Bryst',
      'measure-underbust-circ-decr-incr': 'Brystkasse',
      'measure-frontchest-dist-decr-incr': 'Brystbredde',
      'breast-dist-decr-incr': 'Brystavstand',
      'breast-point-decr-incr': 'Brystform',
      'breast-trans-down-up': 'Brysthøyde',
      'breast-volume-vert-down-up': 'Brystløft',
      'measure-waist-circ-decr-incr': 'Midje',
      'stomach-pregnant-decr-incr': 'Mage',
      'stomach-tone-decr-incr': 'Magemuskler',
      'stomach-navel-down-up': 'Navlehøyde',
      'measure-hips-circ-decr-incr': 'Hofter',
      'hip-scale-horiz-decr-incr': 'Hoftebredde',
      'hip-scale-depth-decr-incr': 'Hoftedybde',
      'hip-scale-vert-decr-incr': 'Hoftehøyde',
      'hip-waist-down-up': 'Midjelinje',
      'measure-waisttohip-dist-decr-incr': 'Midje til hofte',
      'buttocks-volume-decr-incr': 'Sete',
      'hip-trans-backward-forward': 'Bekkenvinkel',
      'measure-upperarm-length-decr-incr': 'Overarmslengde',
      'measure-lowerarm-length-decr-incr': 'Underarmslengde',
      'measure-upperarm-circ-decr-incr': 'Overarmsstørrelse',
      'upperarm-muscle-decr-incr': 'Biceps',
      'upperarm-shoulder-muscle-decr-incr': 'Skuldermuskler',
      'upperarm-fat-decr-incr': 'Overarmsmykhet',
      'lowerarm-muscle-decr-incr': 'Underarmsmuskler',
      'lowerarm-fat-decr-incr': 'Underarmsmykhet',
      'measure-wrist-circ-decr-incr': 'Håndledd',
      'hand-scale-decr-incr': 'Håndstørrelse',
      'hand-fingers-length-decr-incr': 'Fingerlengde',
      'hand-fingers-diameter-decr-incr': 'Fingertykkelse',
      'hand-fingers-distance-decr-incr': 'Fingerspredning',
      'upperlegs-height-decr-incr': 'Lårlengde',
      'lowerlegs-height-decr-incr': 'Leggelengde',
      'measure-thigh-circ-decr-incr': 'Lår',
      'upperleg-muscle-decr-incr': 'Lårmuskler',
      'upperleg-fat-decr-incr': 'Lårmykhet',
      'measure-knee-circ-decr-incr': 'Knær',
      'measure-calf-circ-decr-incr': 'Legger',
      'lowerleg-muscle-decr-incr': 'Leggmuskler',
      'measure-ankle-circ-decr-incr': 'Ankler',
      'leg-valgus-decr-incr': 'Knevinkel',
      'foot-scale-decr-incr': 'Fotstørrelse'
    },
    macro: {
      gender: 'Kjønn',
      age: 'Alder',
      height: 'Høyde',
      weight: 'Vekt',
      muscle: 'Muskler',
      proportions: 'Proporsjoner',
      breastSize: 'Byste',
      breastFirmness: 'Bystefasthet'
    },
    anc: {
      african: 'Afrikansk',
      asian: 'Østasiatisk',
      caucasian: 'Europeisk'
    },
    cat: {
      presets: 'Forhåndsvalg',
      body: 'Kropp',
      face: 'Ansikt',
      skin: 'Hud',
      makeup: 'Sminke',
      hair: 'Hår',
      eyes: 'Øyne',
      outfit: 'Klær',
      pose: 'Positur',
      studio: 'Studio'
    },
    cam: {
      full: 'Hel kropp',
      torso: 'Overkropp',
      portrait: 'Portrett',
      eyes: 'Nærbilde'
    },
    quality: {
      high: 'Høy',
      balanced: 'Balansert',
      fast: 'Rask'
    },
    skin: {
      flush: 'Rødme',
      freckles: 'Fregner',
      moles: 'Føflekker',
      circles: 'Mørke ringer',
      wrinkles: 'Linjer og rynker',
      sheen: 'Glød',
      detail: 'Porer og tekstur',
      sss: 'Gjennomskinnelighet'
    },
    makeup: {
      lips: 'Leppestift',
      eyes: 'Øyne',
      cheeks: 'Kinn',
      gloss: 'Glans',
      shadow: 'Øyenskygge',
      liner: 'Eyeliner',
      mascara: 'Maskara',
      blush: 'Rouge'
    },
    hair: {
      length: 'Lengde',
      volume: 'Volum',
      curl: 'Bølger og krøller',
      frizz: 'Krus',
      part: 'Skill',
      density: 'Tetthet',
      gloss: 'Glans',
      grey: 'Grått hår'
    },
    eyes: {
      pupil: 'Pupillstørrelse',
      pattern: 'Irisdetaljer',
      scleraRed: 'Rødhet',
      lashLength: 'Vippelengde',
      lashDensity: 'Vippetetthet'
    },
    pattern: {
      solid: 'Ensfarget',
      stripes: 'Striper',
      pinstripe: 'Nålestripe',
      plaid: 'Rutete',
      dots: 'Prikker',
      gradient: 'Gradient',
      camo: 'Kamuflasje'
    },
    lock: {
      body: 'Kropp',
      face: 'Ansikt',
      skin: 'Hud',
      hair: 'Hår',
      eyes: 'Øyne',
      makeup: 'Sminke',
      outfit: 'Klær'
    },
    hairStyle: {
      bald: 'Skallet',
      buzz: 'Snauklipp',
      crew: 'Kortklipp',
      'side-part': 'Sideskill',
      'slick-back': 'Bakoverstrøket',
      pompadour: 'Pompadour',
      undercut: 'Undercut',
      messy: 'Bustete',
      'curly-short': 'Korte krøller',
      mohawk: 'Hanekam',
      pixie: 'Pixie',
      bob: 'Page',
      shoulder: 'Skulderlangt',
      long: 'Langt og rett',
      'long-wavy': 'Lange bølger',
      'curly-long': 'Lange krøller',
      hime: 'Hime-klipp',
      afro: 'Afro',
      ponytail: 'Høy hestehale',
      'low-ponytail': 'Lav hestehale',
      'twin-tails': 'Doble hestehaler',
      bun: 'Topknute',
      'man-bun': 'Mannsknute',
      braid: 'Flette'
    },
    fringe: {
      none: 'Ingen',
      blunt: 'Rett pannelugg',
      side: 'Sidelugg',
      curtain: 'Gardinlugg',
      wispy: 'Lett lugg'
    },
    brow: {
      natural: 'Naturlig',
      straight: 'Rett',
      arched: 'Buet',
      thick: 'Tykk',
      thin: 'Tynn',
      bushy: 'Busket',
      none: 'Ingen'
    },
    pose: {
      apose: 'A-positur',
      relaxed: 'Avslappet',
      contrapposto: 'Contrapposto',
      wave: 'Vinker',
      thinking: 'Tenker',
      heroic: 'Heroisk',
      shy: 'Sjenert',
      clasped: 'Foldede hender'
    },
    expr: {
      neutral: 'Nøytral',
      smile: 'Smil',
      grin: 'Stort glis',
      laugh: 'Latter',
      sad: 'Trist',
      angry: 'Sint',
      surprised: 'Overrasket',
      fear: 'Redd',
      disgust: 'Avsky',
      smirk: 'Lurt smil',
      pout: 'Trutmunn',
      determined: 'Bestemt',
      sleepy: 'Søvnig',
      wink: 'Blunk'
    },
    light: {
      studio: 'Studio',
      daylight: 'Dagslys',
      golden: 'Gyllen time',
      moonlight: 'Månelys',
      neon: 'Neon',
      noir: 'Noir',
      candle: 'Levende lys'
    },
    preset: {
      'young-woman': 'Ung kvinne',
      'young-man': 'Ung mann',
      elder: 'Besteforelder',
      child: 'Barn',
      athlete: 'Idrettsutøver',
      scholar: 'Lærd',
      royal: 'Kongelig',
      knight: 'Ridder'
    },
    region: {
      portrait: 'Portrett',
      head: 'Hode',
      forehead: 'Panne og bryn',
      eyes: 'Øyne',
      nose: 'Nese',
      mouth: 'Munn',
      cheeks: 'Kinn',
      jaw: 'Kjeve og hake',
      ears: 'Ører',
      neck: 'Hals',
      torso: 'Overkropp',
      hips: 'Hofter',
      arms: 'Armer',
      legs: 'Ben',
      hair: 'Hår'
    },
    top: {
      none: 'Ingen',
      tank: 'Singlet',
      tee: 'T-skjorte',
      longsleeve: 'Langermet',
      shirt: 'Skjorte',
      sweater: 'Genser',
      turtleneck: 'Høyhalset',
      vneck: 'V-hals',
      crop: 'Magetopp',
      dress: 'Kjole',
      gown: 'Gallakjole',
      robe: 'Kappe',
      armor: 'Platerustning'
    },
    bottom: {
      none: 'Undertøy',
      trousers: 'Bukser',
      jeans: 'Jeans',
      shorts: 'Shorts',
      leggings: 'Leggings',
      skirt: 'Skjørt',
      'midi-skirt': 'Midiskjørt',
      'long-skirt': 'Langt skjørt'
    },
    shoes: {
      none: 'Barbeint',
      sneakers: 'Joggesko',
      boots: 'Støvler',
      loafers: 'Loafers',
      socks: 'Sokker'
    },
    acc: {
      glasses: 'Briller',
      sunglasses: 'Solbriller',
      earrings: 'Øredobber',
      necklace: 'Halskjede',
      beanie: 'Lue',
      cap: 'Caps',
      crown: 'Krone',
      headband: 'Hårbånd',
      watch: 'Klokke'
    }
  },
  data: {
    relTypes: {
      parent_child: 'Forelder / barn',
      adopted: 'Adoptert',
      spouse: 'Ektefelle',
      sibling: 'Søsken',
      partner: 'Partner',
      friends: 'Venn',
      likes: 'Liker',
      rival: 'Rival',
      mentor: 'Mentor / elev',
      subordinate: 'Underordnet'
    },
    relRoles: {
      parent_child: {
        a: 'Forelder',
        b: 'Barn'
      },
      adopted: {
        a: 'Adoptivforelder',
        b: 'Adoptivbarn'
      },
      likes: {
        a: 'Beundrer',
        b: 'Forelskelse'
      },
      mentor: {
        a: 'Mentor',
        b: 'Elev'
      },
      subordinate: {
        a: 'Overordnet',
        b: 'Underordnet'
      }
    },
    relStatus: {
      active: 'Aktiv',
      engaged: 'Forlovet',
      divorced: 'Skilt',
      widowed: 'Enke/enkemann',
      ended: 'Avsluttet',
      estranged: 'Fremmedgjort',
      resolved: 'Forsonet'
    },
    fields: {
      name: 'Fullt navn',
      gender: 'Kjønn',
      birth: 'Født',
      death: 'Død',
      occupation: 'Yrke',
      location: 'Bosted',
      bio: 'Biografi'
    },
    gender: {
      male: 'Mann',
      female: 'Kvinne'
    },
    noun: {
      person: 'Person'
    },
    defaults: {
      untitledEvent: 'Navnløs hendelse',
      untitledEra: 'Navnløs epoke',
      untitledMap: 'Navnløst kart',
      newTag: 'Ny tagg',
      unnamedProject: 'Navnløst prosjekt',
      newScene: 'Ny scene',
      scene1: 'Scene 1',
      guest: 'Gjest',
      timeline: 'Tidslinje'
    }
  },
  graph: {
    searchPh: 'Søk etter familiemedlemmer…',
    nameThis: 'Navn på ny {noun}…',
    newNoun: 'Ny {noun}',
    unnamed: 'Uten navn',
    spot: {
      on: 'Søkelys på',
      choose: 'Velg hvem som står i søkelyset',
      put: 'Sett {name} i søkelyset',
      titles: 'Titler — hva alle er for hovedpersonen',
      titlesAria: 'Vis titler',
      pickerPh: 'Hvem skal i søkelyset?',
      takes: '{name} står i søkelyset'
    },
    ctrl: {
      tiltOffTitle: 'Tilbake til flat visning (T)',
      tiltOnTitle:
        'Vipp til 3D — legg brettet ned og reis alle opp (T · Q/E for å snu · Alt-dra for å justere)',
      tilt: '3D-vipp',
      zoomIn: 'Zoom inn',
      zoomOut: 'Zoom ut',
      stretchWideTitle: 'Horisontal zoom inn — strekk oppsettet bredere (eller hold X og rull)',
      stretchWide: 'Strekk bredere',
      squeezeNarrowTitle: 'Horisontal zoom ut — klem oppsettet smalere',
      squeezeNarrow: 'Klem smalere',
      stretchTallTitle: 'Vertikal zoom inn — strekk oppsettet høyere (eller hold Z og rull)',
      stretchTall: 'Strekk høyere',
      squeezeShortTitle: 'Vertikal zoom ut — klem oppsettet lavere',
      squeezeShort: 'Klem lavere',
      fitAll: 'Tilpass alt',
      resetView: 'Tilbakestill visning',
      refreshTitle: 'Oppdater oppsett — kjør slektstrealgoritmen på nytt',
      refresh: 'Oppdater oppsett',
      lockNodes: 'Lås nodeklikk',
      unlockNodes: 'Lås opp nodeklikk',
      lockLines: 'Lås linjeklikk',
      unlockLines: 'Lås opp linjeklikk',
      autoRotateTitle: 'Autorotasjon (R)',
      autoRotate: 'Autorotasjon',
      layersTitle: 'Generasjonslag (G)',
      layers: 'Generasjonslag',
      help3dTitle: 'Slik navigerer du i 3D (?)',
      help3d: 'Slik navigerer du i 3D'
    },
    modes: {
      free: {
        label: 'Fri',
        title: 'Fri — nodene blir der du plasserer dem'
      },
      organic: {
        label: 'Organisk',
        title: 'Organisk — kraftstyrt oppsett'
      },
      birth: {
        label: 'Fødsel',
        title: 'Fødsel — loddrett plassering etter fødselsdato'
      },
      generations: {
        label: 'Generasjoner',
        title: 'Generasjoner — hierarki ovenfra og ned'
      },
      spotlight: {
        label: 'Søkelys',
        title: 'Søkelys — en hovedperson midt på scenen, alle andre i ringer etter nærhet'
      },
      space: {
        label: 'Rom',
        title: 'Rom — eksperimentelt 3D-oppsett (Labs)'
      }
    },
    scenes: {
      label: 'Scener',
      add: 'Ny scene',
      duplicate: 'Dupliser gjeldende scene',
      delete: 'Slett scene',
      nameN: 'Scene {n}'
    },
    hud: {
      customize: 'Tilpass hjulet',
      exit: 'Avslutt redigeringsmodus (Esc)',
      exitAria: 'Avslutt redigeringsmodus',
      linkNext: 'Klikk nå på den {name} skal knyttes til',
      deleteConfirm: 'Klikk igjen for å bekrefte',
      pinOrganic: 'Festing har betydning i det organiske oppsettet'
    },
    path: {
      armedHint: 'Ctrl-klikk en annen person for å spore forbindelsen',
      cancel: 'Avbryt (Esc)',
      dismiss: 'Lukk (Esc)',
      clear: 'Fjern (Esc)',
      clearAria: 'Fjern',
      noConnPre: 'Ingen forbindelse mellom ',
      noConnMid: ' og ',
      noConnPost: '',
      title: 'Forbindelse',
      hopOne: '{n} ledd',
      hopOther: '{n} ledd',
      view: 'Vis {name}',
      roleOf: '{role} til'
    },
    focus: {
      title: 'Fokus',
      lineage: 'Slektslinje',
      marriage: 'Ekteskap',
      deceased: 'Avdøde',
      orbit: 'Bane',
      default: 'Standard',
      paternal: 'Farside',
      maternal: 'Morside',
      married: 'Gift',
      single: 'Enslig',
      living: 'Levende',
      needDate: 'Angi gjeldende dato først for å bruke dette filteret',
      needSel: 'Velg en person først',
      off: 'Av',
      orbitOne: '{n} ledd rundt utvalget',
      orbitOther: '{n} ledd rundt utvalget'
    },
    rel: {
      rowTitle: '{count} i bruk — klikk for å isolere på lerretet',
      weight: 'Vekt — strukturell mot høyre, frastøtende mot venstre',
      romance: 'Romantikk',
      pinesFor: 'lengter etter',
      vieFor: 'kjemper om',
      gravityTitle: 'Forsterker sosiale fjærer i det organiske oppsettet',
      gravity: 'Sosial gravitasjon',
      hintSolo: 'Isolerer én type — klikk igjen for å tilbakestille',
      hint: 'Klikk en type for å isolere · Ctrl-klikk to personer for å spore forbindelsen'
    },
    legend: {
      title: 'Forklaring',
      nodes: 'Noder',
      lines: 'Linjer'
    },
    flash: {
      curveReset: 'Kurve tilbakestilt',
      unavailable: 'Ikke tilgjengelig nå',
      emptySpot: 'Klikk på et tomt sted',
      bondNotNode: 'Klikk en forbindelse, ikke en node',
      typeGone: 'Den forbindelsestypen finnes ikke lenger',
      alreadyLinked: 'Allerede koblet',
      linked: 'Koblet — {type}',
      node: 'Node',
      released: '{name} løsnet',
      pinned: '{name} festet',
      tagAdded: 'La til «{tag}»',
      tagRemoved: 'Fjernet «{tag}»',
      alreadyEnded: 'Allerede avsluttet',
      needYear: 'Angi et gjeldende år først',
      ended: 'Avsluttet {year}',
      noDirection: 'Den forbindelsen har ingen retning',
      flipped: 'Retning snudd',
      restored: 'Gjenopprettet {type}-oppsettet',
      curveHint: 'Dra linjen eller håndtakene · dobbeltklikk for å tilbakestille',
      timeDrag: 'Dra personer opp eller ned for å endre fødselsåret'
    },
    canvas: {
      gen: 'Gen. {n}',
      newGen: 'Ny gen.',
      now: 'Nå · {year}'
    },
    rings: {
      main: 'Hovedperson',
      inner: 'Indre krets',
      close: 'Nær familie',
      extended: 'Storfamilie',
      distant: 'Fjern slekt',
      far: 'Ytterkanten',
      edge: 'Historiens utkant',
      outside: 'Ikke forbundet'
    },
    timeDrag: {
      badge: 'f. {year} ({delta})',
      badgeMany: '{n} liv · {delta} år',
      movedManyLater: '{count} liv er flyttet {n} år senere',
      movedManyEarlier: '{count} liv er flyttet {n} år tidligere',
      badgeBirths: '{n} fødsler · {delta} år',
      birthsLater: '{count} fødsler flyttet {n} år senere',
      birthsEarlier: '{count} fødsler flyttet {n} år tidligere'
    },
    toggles: {
      aria: 'Lerretsoverlegg',
      select: 'Velg',
      edit: 'Rediger',
      modeTitle: '{label} — {hint}',
      gear: 'Tilpass redigeringsmoduser (eller hold Tab for hjulet)',
      gearAria: 'Tilpass redigeringsmoduser',
      focus: 'Fokus — fremhev personer',
      legend: 'Forklaring',
      relTypes: 'Relasjoner — typer, vekter og linser',
      chronicle: 'Krønike — epoker og hendelser',
      style: 'Stil — livslinjer, lerret og atmosfære',
      kinship: 'Slektskap — navngi hver slektning, se med deres øyne',
      clean: 'Ren visning — skjul lerretsoverlegg',
      box: 'Boksvalg — hold Shift og dra på lerretet',
      lasso: 'Lassovalg — hold Shift og dra en frihåndsløkke',
      timeDrag:
        'Tidsdrag — dra personer opp eller ned for å endre fødselsåret (levetiden følger med)'
    }
  },
  graphWheel: {
    addMode: 'Legg til modus…',
    hubIdle: 'Rediger',
    tipRelease: 'Slipp for å velge',
    tipCustomize: 'tilpass',
    tipCancel: 'avbryt',
    empty: {
      label: 'Tom',
      hint: 'Ingenting her'
    },
    kinds: {
      add: {
        label: 'Legg til {noun}',
        hint: 'Klikk på et tomt sted for å legge til en {noun}'
      },
      delete: {
        label: 'Slett',
        hint: 'Klikk en node eller forbindelse — klikk igjen for å bekrefte'
      },
      pin: {
        label: 'Fest',
        hint: 'Klikk personer for å feste / løsne dem'
      },
      end: {
        label: 'Avslutt forbindelse',
        hint: 'Klikk en forbindelse for å markere den som avsluttet'
      },
      swap: {
        label: 'Snu forbindelse',
        hint: 'Klikk en rettet forbindelse for å snu den'
      },
      retime: {
        label: 'Flytt i tid',
        hint: 'Dra en person opp eller ned for å endre fødselsåret'
      },
      paint: {
        label: 'Mal',
        hint: 'Klikk personer for å male dem — samme farge igjen fjerner',
        disabled: 'Nodestil krever Standard-modus'
      },
      tag: {
        hint: 'Klikk personer for å slå «{tag}» av/på',
        disabled: 'Tagger krever Standard-modus'
      },
      link: {
        hint: 'Klikk to personer etter hverandre for å koble dem som {type}',
        disabled: 'Denne forbindelsestypen krever Standard-modus'
      }
    },
    config: {
      aria: 'Tilpass handlingshjulet',
      title: 'Handlingshjul',
      subPre: 'Hold',
      subPost:
        'nede på lerretet, dra mot en modus og slipp. Velg en retning nedenfor og gi den en oppgave.',
      close: 'Lukk (Esc)',
      closeAria: 'Lukk',
      emptySlot: 'Tom plass',
      mode: 'Modus',
      forge: 'Knytt en forbindelse',
      forgeNote: 'Klikk to personer etter hverandre, så kobles de.',
      paint: 'Mal noder',
      paintTitle: 'Mal personer {color}',
      tag: 'Slå en tagg av/på',
      reset: 'Tilbakestill til standard',
      done: 'Ferdig'
    },
    dirs: {
      N: 'N',
      NE: 'NØ',
      E: 'Ø',
      SE: 'SØ',
      S: 'S',
      SW: 'SV',
      W: 'V',
      NW: 'NV'
    }
  },
  graph3d: {
    badge: 'Eksperimentell · Rom',
    help: {
      close: 'Lukk',
      title: 'Navigere i rommet',
      sub: 'Treet ditt i tre dimensjoner — de samme personene og linjene, én akse til. Kontrollene følger vanlige 3D-konvensjoner:',
      mouse: 'Mus',
      keys: 'Taster',
      leftDrag: {
        key: 'Venstre-dra',
        desc: 'Kretse rundt familien'
      },
      rightDrag: {
        key: 'Høyre-dra',
        desc: 'Panorer sidelengs'
      },
      scroll: {
        key: 'Rull',
        desc: 'Zoom inn / ut'
      },
      dragPerson: {
        key: 'Dra person',
        desc: 'Flytt dem i rommet'
      },
      click: {
        key: 'Klikk',
        desc: 'Velg en person eller linje'
      },
      dblClick: {
        key: 'Dobbeltklikk',
        desc: 'Fly til en person'
      },
      frame: 'Vis alt',
      rotate: 'Autorotasjon av / på',
      layers: 'Generasjonslag',
      hints: 'Vis disse tipsene',
      tipLabel: 'Tips:',
      tipMid: '(lagknappen i verktøylinjen, eller',
      tipEnd: ') stabler hver generasjon i sin egen etasje — eldste øverst.',
      gotIt: 'Skjønner'
    }
  },
  minimap: {
    title: 'Oversikt — dra for å flytte visningen'
  },
  styleStudio: {
    title: 'Stilstudio',
    close: 'Lukk stilstudioet',
    search: 'Finn en stilinnstilling…',
    noResults: 'Ingen stilinnstilling passer til «{q}»',
    reach: 'Visninger dette laget farger',
    tuned: '{n} justert · tilbakestill',
    resetChapterHint: 'Sett dette kapittelet tilbake til standard',
    layers: {
      app: 'Hele appen',
      appTag: 'Overalt',
      appDesc: 'Grunnlaget alle visninger maler på',
      viewTag: 'Denne visningen',
      viewDesc: 'Endrer bare visningen {view}',
      viewNone: 'Har ingen egen stil — følger appen',
      bringForward: 'Hent dette laget fram'
    },
    chapters: {
      theme: 'Tema',
      palette: 'Palett',
      profiles: 'Profiler',
      looks: 'Utseender',
      nodes: 'Noder',
      lines: 'Linjer',
      effects: 'Effekter',
      air: 'Atmosfære',
      camera: 'Kamera',
      physics: 'Fysikk',
      lifelines: 'Livslinjer',
      canvas: 'Lerret',
      cards: 'Kort',
      mapStyle: 'Kartstil'
    },
    saved: {
      deviceAll: 'Lagret på denne enheten · alle prosjekter, alle visninger',
      projectAll: 'Lagret med dette prosjektet · alle visninger',
      projectView: 'Lagret med dette prosjektet · bare {view}',
      mapView: 'Lagret med dette kartet · hvert kart har sin egen'
    },
    results: {
      app: 'Hele appen',
      view: 'Denne visningen · {view}',
      other: 'Andre visninger'
    },
    inherit: {
      title: '{view} maler med appens stil',
      body: 'Denne visningen har ingen egen stil ennå. Den bruker applaget: temaet, aksentfargen og den delte paletten.',
      cta: 'Style hele appen'
    },
    palette: {
      intro: 'Alle visninger tegner personer og båndene deres i disse fargene.',
      specimen: 'En liten familie tegnet i den delte paletten',
      people: 'Personer',
      bonds: 'Bånd',
      lookNote: 'Å velge et grafutseende maler også om denne paletten.'
    },
    profile: {
      title: 'Profilvisning',
      intro: 'Hvordan en persons profil åpnes, fra hvilken som helst visning.'
    },
    looks: {
      paletteNote: 'Hvert utseende maler også om den delte paletten.',
      openPalette: 'Åpne paletten'
    },
    lines: {
      colorsNote: 'Linjefargene deles av alle visninger.'
    },
    air: {
      quality: 'Gjengivelseskvalitet'
    },
    map: {
      none: 'Åpne et kart for å style det.'
    },
    directory: {
      cardModesOnly: 'Kortforsider vises i rutenett- og kortscenemodusene.'
    }
  },
  graphStyle: {
    tiltHint:
      'Legger oppsettet ned som et brett sett ovenfra, med alle personene stående på det. T slår av/på; Q / E snur brettet; hold Alt og dra opp/ned for å vippe, til siden for å snu.',
    title: 'Stil',
    close: 'Lukk stilpanelet',
    quality: 'Kvalitet',
    qualityHint: 'Full oppløsning, ornamenter, atmosfære og bakgrunnsbevegelse',
    performance: 'Ytelse',
    performanceHint: 'Redusert oppløsning, stille ornamenter, ingen atmosfære – for svake maskiner',
    groups: {
      perspective: 'Perspektiv',
      themes: 'Tema',
      nodes: 'Nodeutseende',
      colors: 'Nodefarger',
      lines: 'Relasjonslinjer',
      fx: 'Linjeeffekter',
      atmosphere: 'Atmosfære',
      physics: 'Fysikk / oppsett'
    },
    chips: {
      custom: 'egendefinert',
      live: 'aktiv',
      off: 'av'
    },
    atmosphereOffHint: 'Atmosfære er av i ytelsesmodus',
    inkNote:
      '水墨 – i blekktemaet males hvert utseende med pensel og lavering på rispapir; former, linjer og atmosfære følger fortsatt temaet du velger.',
    labels: {
      tiltYaw: 'Snu',
      tiltAngle: 'Vinkel',
      tilt: '3D-vipp',
      shape: 'Form',
      ornament: 'Ornament',
      ornamentColor: 'Ornamentfarge',
      nodeSize: 'Nodestørrelse',
      nodeOpacity: 'Nodeopasitet',
      labelSize: 'Etikettstørrelse',
      showLabels: 'Vis etiketter',
      showAge: 'Vis alder',
      glowOnHover: 'Glød ved peking',
      unknown: 'Ukjent',
      lineStyle: 'Linjestil',
      lineOpacity: 'Linjeopasitet',
      lineCurvature: 'Linjekrumming',
      color: 'Farge',
      width: 'Bredde',
      appliesTo: 'Gjelder',
      palette: 'Palett',
      effectColors: 'Effektfarger',
      relColors: 'Relasjonsfarger',
      speed: 'Fart',
      glow: 'Glød',
      effect: 'Effekt',
      colors: 'Farger',
      density: 'Tetthet',
      linkDistance: 'Linkavstand',
      repulsion: 'Frastøting'
    },
    brushOwns: 'Penselstrøk styrer linjene nå – effektene kommer tilbake med en annen linjestil.',
    useOrganic: 'Bruk Organisk',
    reset: 'Tilbakestill alt',
    shapes: {
      gravestone: 'Gravstein',
      circle: 'Sirkel',
      square: 'Kvadrat',
      diamond: 'Rute',
      hexagon: 'Sekskant',
      shield: 'Skjold',
      oval: 'Oval',
      octagon: 'Åttekant',
      heart: 'Hjerte'
    },
    decors: {
      none: 'Ingen',
      aura: 'Aura',
      runes: 'Runer',
      orbit: 'Bane',
      burst: 'Stjerne',
      pulse: 'Puls',
      enso: 'Ensō'
    },
    routes: {
      organic: {
        label: 'Organisk',
        hint: 'Myke kurver med en naturlig bøy per linje'
      },
      straight: {
        label: 'Rett',
        hint: 'Snorrette linjer'
      },
      arc: {
        label: 'Bue',
        hint: 'Feiende halvmånekurver'
      },
      elbow: {
        label: 'Vinkel',
        hint: 'Rettvinklede løp, som et flytskjema'
      },
      trident: {
        label: 'Trefork',
        hint: 'Klassisk slektstre: parstang → stamme → søskenskinne → barn'
      },
      circuit: {
        label: 'Krets',
        hint: 'Akse og så 45°-spor, som et kretskort'
      },
      wave: {
        label: 'Bølge',
        hint: 'En slyngende krusning mellom personer'
      },
      bezier: {
        label: 'Bézier',
        hint: 'Myke kurver du former selv – velg en linje og dra i den eller håndtakene (dobbeltklikk tilbakestiller)'
      },
      brush: {
        label: 'Pensel',
        hint: '水墨 – kalligrafiske penselstrøk med tørrpensel-«flygende hvitt»'
      }
    },
    ambients: {
      none: 'Ingen',
      fireflies: 'Ildfluer',
      stars: 'Stjerner',
      petals: 'Kronblad',
      snow: 'Snø',
      embers: 'Glør',
      rain: 'Regn',
      motes: 'Støv',
      mist: 'Tåke',
      plum: 'Plomme'
    },
    fxScopes: {
      lineage: {
        label: 'Slektslinje',
        hint: 'Forelder → barn-linjer (alle vertikale relasjonstyper)'
      },
      family: {
        label: 'Familie',
        hint: 'Slektslinje pluss par'
      },
      all: {
        label: 'Alle',
        hint: 'Alle bånd, også sosiale'
      }
    },
    fx: {
      none: {
        label: 'Klassisk',
        hint: 'Vanlige linjer'
      },
      blood: {
        label: 'Blodomløp',
        hint: 'Et levende blodkar – røde blodceller driver nedover generasjonene i hjerteslag'
      },
      river: {
        label: 'Elv',
        hint: 'Rennende vann – kaustisk lys, strømstriper, skum ved breddene'
      },
      neon: {
        label: 'Neon',
        hint: 'Cyberkanal – hvitglødende kjerne, datapakker i fart, kretsmerker'
      },
      helix: {
        label: 'Heliks',
        hint: 'En DNA-dobbeltheliks som vrir seg langs linjen, med glødende basepar'
      },
      ember: {
        label: 'Glo',
        hint: 'En ildlinje – slikkende flammer og gnister kastet ut i mørket'
      },
      aurora: {
        label: 'Nordlys',
        hint: 'Nordlys – skiftende forheng av grønt og fiolett'
      },
      storm: {
        label: 'Uvær',
        hint: 'Knitrende lyn som slår ned igjen mens du ser på'
      },
      stars: {
        label: 'Stjernelys',
        hint: 'Et stjernebilde – blinkende stjerner tredd på en sølvtråd'
      },
      gilded: {
        label: 'Forgylt',
        hint: 'Et kongelig gulltau med en glans som vandrer langs det'
      }
    },
    themes: {
      graveyard: {
        name: 'Kirkegård',
        tagline: 'Gravsteiner på sin fødselsårs-jord — best i Født-oppsettet'
      },
      classic: {
        name: 'Klassisk',
        tagline: 'Signaturutseendet – rene skiver, organiske linjer'
      },
      lineage: {
        name: 'Slektslinje',
        tagline: 'Formell genealogi – søskenskinner og parstenger'
      },
      storybook: {
        name: 'Eventyrbok',
        tagline: 'Fantasy – forgylte skjold og ildfluer i mørket'
      },
      neon: {
        name: 'Neonkrets',
        tagline: 'Sci-fi – sekskantceller på glødende spor under stjernelys'
      },
      noir: {
        name: 'Noir',
        tagline: 'Krimdrama – skarpe kanter, monokromt, endeløst regn'
      },
      dynasty: {
        name: 'Dynasti',
        tagline: '朝代 – vermilion, jade og gull; kronblad i vinden'
      },
      wuxia: {
        name: 'Blekk og klinge',
        tagline: '武侠 – penselstrøkets ro, blekkstøv som driver i vann'
      },
      shuimo: {
        name: 'Shuimo',
        tagline: '水墨 – penselstrøk, blekklaveringer, tåke over fjerne fjell'
      },
      qinglu: {
        name: 'Qinglü',
        tagline: '青绿 – azuritt- og malakittlaveringer, tåkeslørte tinder'
      },
      meihua: {
        name: 'Blekkplomme',
        tagline: '墨梅 – tørrpenselgreiner, plommeblomster i vinden'
      },
      celestial: {
        name: 'Himmelsk',
        tagline: '仙侠 – jadekrystaller i buer, åndeslør som stiger'
      },
      rosewater: {
        name: 'Rosevann',
        tagline: 'Romantikk – hjerter, rødmende buer og fallende kronblad'
      },
      winter: {
        name: 'Vinterborg',
        tagline: 'Nordisk saga – stjernekroner og stille snøfall'
      },
      minimal: {
        name: 'Minimal',
        tagline: 'Moderne og stille – rene linjer, ingen ornamenter'
      },
      heirloom: {
        name: 'Arvestykke',
        tagline: 'Familiearkiv – sepiakameer og drivende støv'
      },
      blueprint: {
        name: 'Blåkopi',
        tagline: 'Tegnebord – skarpe åttekanter på rettvinklede løp'
      },
      wildwood: {
        name: 'Villskog',
        tagline: 'Fortryllet skog – runeringer på slyngende ranker'
      },
      harvest: {
        name: 'Innhøsting',
        tagline: 'Høst – ravgule våpenskjold som gløder ved peisen'
      },
      sakura: {
        name: 'Sakura',
        tagline: '桜 – blomster i bane på en vårbris'
      },
      pharaoh: {
        name: 'Tidens sand',
        tagline: 'Eldgammelt rike – lapis og gull på drivende sand'
      },
      ember: {
        name: 'Glødetronen',
        tagline: 'Mørk fantasykrig – brennende våpenskjold og stigende gnister'
      },
      nocturne: {
        name: 'Nocturne',
        tagline: 'Gotisk – karmosinrøde våpenskjold under månelyst regn'
      },
      grimoire: {
        name: 'Grimoire',
        tagline: 'Arkan – seglbundne krystaller og vandrende lys'
      },
      abyss: {
        name: 'Avgrunn',
        tagline: 'Dyphav – selvlysende pulser blant plankton'
      },
      nebula: {
        name: 'Nebula',
        tagline: 'Romopera – kretsende verdener i et fiolett stjernefelt'
      }
    }
  },
  graphActions: {
    dismissHint: 'Lukk (Esc)',
    clearSelHint: 'Fjern utvalget (Esc)',
    clearSel: 'Fjern utvalget',
    status: 'Status',
    pick: 'Velg',
    size: 'Størrelse',
    color: 'Farge',
    link: 'Koble',
    swap: 'Bytt',
    swapHint: 'Snu hvem som er hvem i dette båndet',
    isolate: 'Isoler',
    isolateHint: 'Vis bare denne relasjonstypen på lerretet',
    allBonds: 'Alle bånd',
    allBondsHint: 'Åpne Relasjoner-visningen',
    deleteBond: 'Slett bånd',
    filters: {
      both: {
        label: 'Begge',
        title: 'Velg noder og bånd'
      },
      nodes: {
        label: 'Noder',
        title: 'Velg bare personer'
      },
      bonds: {
        label: 'Bånd',
        title: 'Velg bare relasjoner'
      }
    },
    setAllStatus: 'Sett alle {count} bånd til {status}',
    sizes: {
      s: {
        label: 'S',
        title: 'Liten'
      },
      m: {
        label: 'M',
        title: 'Standard'
      },
      l: {
        label: 'L',
        title: 'Stor'
      },
      xl: {
        label: 'XL',
        title: 'Enorm'
      }
    },
    autoColor: 'Auto – kjønnsgradienten',
    delete: 'Slett',
    deleteN: 'Slett {n}',
    clear: 'Fjern',
    clearKeepAll: 'Behold alt, fjern bare utvalget',
    clearKeepPeople: 'Behold alle, fjern bare utvalget',
    details: 'Detaljer',
    detailsHint: 'Åpne profilkortet',
    edit: 'Rediger',
    editHint: 'Rediger {noun}',
    focus: 'Fokus',
    focusHint: 'Flytt kameraet til denne noden',
    trace: 'Spor',
    traceHint: 'Spor en forbindelse – klikk så på en annen person',
    kin: 'Slekt',
    kinHint: 'Slektskapslinse – merk alle med hva de er for denne personen',
    spotlight: 'Rampelys',
    spotlightHint: 'Rampelys – gjør dette til hovedpersonen, med alle andre i ringer rundt',
    pin: 'Fest',
    unpin: 'Løsne',
    pinHint: 'Fest noden på plass',
    unpinHint: 'Slipp noden tilbake til simuleringen',
    pairKinHint: 'Vis hvordan de er i slekt',
    swapDirHint: 'Bytt retning (betyr noe for forelder → barn, beundrer → forelskelse …)',
    linked: 'Koblet – {label}',
    traceConnection: 'Spor forbindelse',
    traceConnectionHint: 'Lys opp den korteste kjeden mellom dem',
    selected: '{n} valgt',
    nounCountOne: '{noun}: {n}',
    nounCountOther: '{noun}: {n}',
    bondCountOne: '{n} bånd',
    bondCountOther: '{n} bånd',
    nothingInRange: 'Ingenting innenfor området',
    pairTitle: '{a} og {b}',
    born: 'f. {year}',
    died: 'd. {year}',
    pairSub: 'Knytt et bånd, eller gi dem stil sammen',
    multiSub: 'Stilen gjelder alle valgte',
    unnamed: 'Uten navn',
    alreadyLinked: 'Allerede koblet',
    becomes: '{a} blir {role} for {b}',
    linkAs: 'Koble {a} og {b} som {type}',
    married: 'Gift',
    marriedYear: 'Gift {year}',
    sinceYear: 'Siden {year}',
    range: '{from} – {to}',
    endedYear: 'Avsluttet {year}'
  },
  relTypesPanel: {
    title: 'Relasjonstyper',
    close: 'Lukk',
    hint: 'Hver relasjon peker på en type. Juster utseendet til en type her',
    hintAffinityPre: '– og dens',
    hintAffinityBold: 'struktur ↔ tilhørighet',
    hintAffinityPost:
      '-vekt: strukturelle typer trekker hardt i oppsettet (familieskjelettet), tilhørighetstyper er dekorative lag, negative vekter skyver personer fra hverandre (rivaler).',
    symmetric: 'symmetrisk',
    typeColor: 'Typefarge',
    styleColor: 'Farget av Stil-panelet',
    deleteType: 'Slett denne typen (fjerner relasjonene dens)',
    deleteTypeAria: 'Slett type',
    builtinHint: 'Innebygd – kan justeres, ikke slettes',
    builtin: 'Innebygd',
    generations: 'Generasjoner',
    generationsHint: 'Hvordan generasjonsoppsettet behandler denne typens linjer',
    repel: 'Frastøt',
    structural: 'Strukturell',
    newTitle: 'Ny egendefinert type',
    labelPh: 'Navn (f.eks. Svorne fiender)',
    hideIcons: 'Skjul ikoner',
    chooseIcon: 'Velg et ikon',
    directed: 'Rettet',
    roleAPh: 'Rolle A (f.eks. Herre)',
    roleBPh: 'Rolle B (f.eks. Tjener)',
    addType: 'Legg til type',
    typeIcon: 'Typeikon',
    roles: {
      vertical: {
        label: 'Generasjonell',
        hint: 'Forelder → barn – barnet står én generasjon lavere.'
      },
      horizontal: {
        label: 'Samme generasjon',
        hint: 'Et par – begge partnerne deler rad, side om side.'
      },
      none: {
        label: 'Ikke-generasjonell',
        hint: 'Ignoreres av generasjonsoppsettet (tegnes fortsatt og trekker i kraftoppsett).'
      }
    }
  },
  timeline: {
    undated: '{n} udatert',
    undatedHint:
      'Personer uten fødselsår kan ikke plasseres på tidslinjen. Legg til et fødselsår i profilen for å ta dem med.',
    hint: 'Dra et liv for å flytte det · Dra tomt område for å panorere · Rull for å zoome · 1–6: redigeringsverktøy',
    empty: {
      noDatable: 'Ingen daterbare personer',
      noPeople: 'Ingen personer ennå',
      noDatableText:
        'Legg til fødselsår for familiemedlemmene dine for å se livene deres utfolde seg på tidslinjen.',
      noPeopleText: 'Legg til familiemedlemmer fra grafvisningen for å se dem her.'
    },
    searchPh: 'Søk etter personer…',
    zoomIn: 'Zoom inn',
    zoomOut: 'Zoom ut',
    fitAll: 'Tilpass alt',
    refresh: 'Oppdater oppsettet — kjør slektstre-algoritmen på nytt',
    refreshAria: 'Oppdater oppsettet',
    zoomAxes: 'Tidsakse {v} · baner {h}',
    focus: {
      title: 'Fokus',
      gender: 'Kjønn',
      life: 'Liv',
      all: 'Alle',
      unknown: 'Ukjent',
      living: 'Levende',
      remembered: 'Til minne',
      needYear: 'Angi gjeldende år først'
    },
    legend: {
      title: 'Forklaring',
      people: 'Personer',
      lines: 'Linjer',
      marriage: 'Ekteskap',
      divorced: 'Skilt',
      birth: 'Fødsel',
      adopted: 'Adoptert'
    },
    tip: {
      dragToMove: 'Dra for å flytte',
      clickToEdit: 'Klikk for å redigere',
      undated: 'udatert',
      now: 'nå'
    },
    marriage: {
      year: 'År',
      married: 'Gift',
      divorced: 'Skilt',
      save: 'Lagre'
    },
    traceArmed: 'Ctrl-klikk et annet liv for å spore forbindelsen',
    hud: {
      exit: 'Avslutt verktøyet (Esc)',
      exitAria: 'Avslutt verktøyet',
      linkPick: 'Velg hva som binder dem — bytt snur retningen',
      linkNext: 'Klikk nå livet {name} er bundet til — i året det begynte'
    },
    tools: {
      add: {
        label: 'Legg til',
        hint: 'Klikk hvor som helst — et nytt liv begynner det året'
      },
      child: {
        label: 'Barn',
        hint: 'Klikk en livslinje i året barnet blir født'
      },
      link: {
        label: 'Koble',
        hint: 'Klikk ett liv, så et annet — velg hva som binder dem'
      },
      event: {
        label: 'Hendelse',
        hint: 'Klikk for et øyeblikk · dra opp/ned for et tidsrom'
      },
      retime: {
        label: 'Flytt i tid',
        hint: 'Dra en fødsel, et dødsfall, et ekteskap eller en hendelse — eller et helt liv'
      },
      delete: {
        label: 'Slett',
        hint: 'Klikk et liv, et ekteskap eller en hendelse for å fjerne det'
      }
    },
    bubble: {
      namePh: 'Gi denne {noun} et navn…',
      with: 'med',
      create: 'Opprett',
      createHint: 'Opprett (Enter)',
      newLife: 'Et nytt liv · født {year}',
      childOf: 'Barnet til {name} · født {year}'
    },
    link: {
      swap: 'Bytt retning (forelder → barn …)',
      swapAria: 'Bytt retning',
      directed: '{a} er {role} til {b}',
      failed: 'Kunne ikke koble dem'
    },
    scenes: {
      label: 'Scener',
      add: 'Ny scene',
      duplicate: 'Dupliser gjeldende scene',
      delete: 'Slett scene'
    },
    ghost: {
      born: 'født {year}',
      died: 'død {year}',
      stillLiving: 'lever fortsatt',
      dragToDate: 'dra for å datere',
      dragToEnd: 'dra opp for å avslutte livet',
      shiftLife: 'flytt hele livet',
      between: 'mellom {a} og {b}',
      after: 'etter {name}',
      before: 'før {name}',
      firstLane: 'første bane',
      lives: '{n} liv {where}'
    },
    confirm: {
      deleteMarriage: 'Fjerne ekteskapet mellom {names}?',
      deleteMarriageBody: 'Begge livene blir — bare båndet fjernes.',
      deleteEvent: 'Slette «{name}»?'
    },
    toasts: {
      marriageRemoved: 'Ekteskapet er fjernet',
      bornIn: '{name} er nå født i {year}',
      diesIn: '{name} dør nå i {year}',
      movedLater: 'Livet til {name} er flyttet {n} år senere',
      movedEarlier: 'Livet til {name} er flyttet {n} år tidligere',
      marriedIn: 'Gift i {year}',
      eventMoved: '«{name}» flyttet til {year}',
      calendarUnsupported: 'Den datoen bruker en kalender tidslinjen ikke kan flytte ennå'
    },
    canvas: {
      unnamed: 'Uten navn',
      yearsDead: '{b}–{d} · {age} år',
      yearsLiving: 'f. {b} · {age} år',
      addYear: 'legg til år',
      now: 'nå'
    },
    style: {
      title: 'Stil',
      reset: 'Tilbakestill',
      resetHint: 'Tilbake til standard',
      tabs: {
        lines: 'Livslinjer',
        canvas: 'Lerret',
        air: 'Atmosfære'
      },
      inkLines:
        'I blekk-temaet er livslinjene penselstrøk — utseendene gjelder i alle andre temaer.',
      inkAir: 'Blekk-temaet har sin egen tåke — atmosfærene gjelder i alle andre temaer.',
      thickness: 'Tykkelse',
      portraits: 'Portretter',
      shadows: 'Skygger',
      shadowsHint: 'Skygger vises under de solide, opplyste utseendene',
      flowSpeed: 'Flythastighet',
      glow: 'Glød',
      palette: 'Palett',
      paletteEffect: 'Effekt',
      palettePerson: 'Person',
      ageTicks: 'Aldersmerker',
      ageTicksHint: 'Et hakk for hvert tiår av hvert liv',
      eraWash: 'Epokefarge',
      density: 'Tetthet',
      colours: 'Farger',
      segs: {
        connectors: 'Bånd',
        grid: 'Årsrutenett',
        labels: 'Navn',
        eventMarkers: 'Hendelser'
      },
      opts: {
        curve: 'Buet',
        straight: 'Rett',
        hidden: 'Skjult',
        bands: 'Bånd',
        lines: 'Linjer',
        none: 'Ingen',
        full: 'Full',
        fullHint: 'Navn + år',
        compact: 'Kompakt',
        compactHint: 'Bare korte navn',
        pills: 'Merker',
        dots: 'Ikoner'
      },
      ambients: {
        none: 'Ingen',
        fireflies: 'Ildfluer',
        stars: 'Stjerner',
        petals: 'Kronblader',
        snow: 'Snø',
        embers: 'Glør',
        rain: 'Regn',
        motes: 'Støvkorn',
        mist: 'Tåke',
        plum: 'Plommeblomst'
      },
      looks: {
        clean: {
          label: 'Ren',
          hint: 'Flate linjer, ingen atmosfære'
        },
        bloodline: {
          label: 'Blodslinje',
          hint: 'Blod som pulserer nedover hvert liv, glør som driver'
        },
        tides: {
          label: 'Tidevann',
          hint: 'Tidens elver under drivende tåke'
        },
        cosmos: {
          label: 'Kosmos',
          hint: 'Stjerneopplyste liv i en glitrende natt'
        },
        neon: {
          label: 'Neonby',
          hint: 'Datastrømmer, regn og harde linjer'
        },
        gilded: {
          label: 'Forgylt',
          hint: 'Dynastier i bladgull, lysende støvkorn'
        },
        glasshouse: {
          label: 'Glasshus',
          hint: 'Glassstaver som fanger lyset, myk snø'
        },
        sakura: {
          label: 'Sakura',
          hint: 'Opplyste rør under fallende kronblader'
        }
      },
      lifelines: {
        classic: {
          label: 'Klassisk',
          hint: 'Flate, rene linjer'
        },
        tube: {
          label: 'Rør',
          hint: 'Opplyste 3D-sylindre med skygger'
        },
        glass: {
          label: 'Glass',
          hint: 'Glassstaver — en glans flyter nedover hvert liv'
        },
        glow: {
          label: 'Glød',
          hint: 'Hvitglødende kjerner i en farget glød'
        }
      }
    }
  },
  timeSlider: {
    activeHint: 'Tidsreise aktiv',
    presentHint: 'Viser nåtiden',
    capYear: 'ÅR',
    capNow: 'NÅ',
    from: 'fra {year}',
    trackHint: 'Dra et av håndtakene for å ramme inn et tidsrom',
    pause: 'Pause',
    playBack: 'Spill baklengs',
    play: 'Spill gjennom tiden',
    stop: 'Stopp — tilbake til nåtiden',
    stopAria: 'Stopp',
    prevEvent: 'Forrige hendelse',
    nextEvent: 'Neste hendelse',
    backYear: 'Ett år tilbake',
    fwdYear: 'Ett år fram',
    speed: 'Avspillingshastighet — {speed}',
    reverse: 'Snu avspillingsretningen',
    loop: 'Gjenta avspilling'
  },
  chronicle: {
    now: 'nå',
    undated: 'udatert',
    deleted: 'Slettet «{name}»',
    pane: {
      title: 'Krønike',
      era: 'Epoke',
      event: 'Hendelse',
      eras: 'Epoker',
      events: 'Hendelser',
      quickStart: 'Hurtigstart',
      erasEmpty:
        'Gi navn til periodene i historien din — en krig, en regjeringstid, en gullalder — så blir de bånd på tidslinjen og fødselsgrafen.',
      searchPh: 'Søk i hendelser…',
      noMatch: 'Ingen treff.',
      eventsEmpty:
        'Slag, kroninger, utvandringer, første møter — legg til øyeblikkene som formet folket ditt.',
      nothingNew: 'Ingenting nytt fra «{pack}» for {min}–{max}',
      addedOne: 'La til {n} epoke',
      addedMany: 'La til {n} epoker',
      addFailed: 'Kunne ikke legge til epokene'
    },
    editor: {
      newEra: 'Ny epoke',
      editEra: 'Rediger epoke',
      newEvent: 'Ny hendelse',
      editEvent: 'Rediger hendelse',
      close: 'Lukk (Esc)',
      closeAria: 'Lukk',
      eraNamePh: 'Gi epoken et navn — «Regentperioden», «Dragenes tid» …',
      from: 'Fra',
      until: 'Til',
      beginning: 'tidenes morgen',
      open: 'åpen',
      ongoing: 'pågår',
      colour: 'Farge',
      anyColour: 'Valgfri farge',
      icon: 'Ikon',
      eraIcon: 'Epokeikon',
      eventTitlePh: 'Hva skjedde? — «Den lange vinteren», «Bestemor ankommer New York» …',
      when: 'Når',
      lasts: 'varer en stund',
      weight: 'Vekt',
      importance: {
        minor: 'Mindre',
        minorHint: 'Vises når du zoomer inn',
        notable: 'Merkbar',
        notableHint: 'Vises på de fleste zoomnivåer',
        major: 'Stor',
        majorHint: 'Vises alltid, i fet skrift'
      },
      who: 'Hvem',
      remove: 'Fjern',
      removeName: 'Fjern {name}',
      addNoun: 'Legg til {noun}',
      whoPh: 'Hvem deltok?',
      where: 'Hvor',
      placePh: 'Sted (valgfritt)',
      eraDescPh: 'Hva kjennetegnet denne epoken?',
      eventDescPh: 'Historien om det som skjedde …',
      add: 'Legg til i krøniken',
      save: 'Lagre',
      saveEraFailed: 'Kunne ikke lagre epoken',
      saveEventFailed: 'Kunne ikke lagre hendelsen',
      added: '{name} lagt til',
      saved: '{name} lagret',
      deleteEra: 'Slette epoken «{name}»?',
      deleteEvent: 'Slette hendelsen «{name}»?',
      deleteEraBody: 'Båndet forsvinner fra alle visninger. Personer påvirkes ikke.',
      deleteEventBody: 'Den forsvinner fra tidslinjen og alle profiler.'
    },
    date: {
      year: 'År',
      month: 'måned',
      day: 'dag',
      months: [
        'jan.',
        'feb.',
        'mar.',
        'apr.',
        'mai',
        'jun.',
        'jul.',
        'aug.',
        'sep.',
        'okt.',
        'nov.',
        'des.'
      ]
    },
    kinds: {
      milestone: 'Milepæl',
      battle: 'Slag',
      war: 'Krig',
      coronation: 'Kroning',
      founding: 'Grunnleggelse',
      migration: 'Utvandring',
      journey: 'Reise',
      meeting: 'Første møte',
      wedding: 'Bryllup',
      treaty: 'Traktat',
      discovery: 'Oppdagelse',
      disaster: 'Katastrofe',
      betrayal: 'Svik',
      prophecy: 'Profeti',
      celebration: 'Feiring',
      loss: 'Tap',
      custom: 'Annet'
    },
    packs: {
      world: {
        label: 'Verdenshistorie',
        hint: 'Kriger, regjeringstider og revolusjoner, 1700 → i dag'
      },
      generations: {
        label: 'Generasjoner',
        hint: 'Den tapte generasjonen → generasjon alfa'
      },
      centuries: {
        label: 'Århundrer',
        hint: 'Ett bånd per århundre i hele prosjektet'
      },
      fantasy: {
        label: 'Fantasy-tidsaldre',
        hint: 'Myte → Konger → Jern → Skumring, tilpasset årene dine'
      }
    },
    presets: {
      century: '{n}. århundre',
      eras: {
        ageOfEnlightenment: {
          name: 'Opplysningstiden',
          description: 'Fornuft, vitenskap og menneskerettigheter.'
        },
        industrialRevolution: {
          name: 'Den industrielle revolusjon',
          description: 'Damp, fabrikker og flyttingen til byene.'
        },
        napoleonicWars: {
          name: 'Napoleonskrigene',
          description: 'Europa i krig mot — og for — Napoleon.'
        },
        victorianEra: {
          name: 'Viktoriatiden',
          description: 'Dronning Victorias regjeringstid.'
        },
        theGildedAge: {
          name: 'Den forgylte tidsalder',
          description: 'Jernbaner, formuer og raske endringer.'
        },
        worldWarI: {
          name: 'Første verdenskrig',
          description: 'Den store krigen.'
        },
        theRoaringTwenties: {
          name: 'De glade tjueåra',
          description: 'Jazz, velstand og nye friheter.'
        },
        theGreatDepression: {
          name: 'Den store depresjonen',
          description: 'Harde tider over hele verden.'
        },
        worldWarII: {
          name: 'Andre verdenskrig',
          description: 'Den andre verdenskrigen.'
        },
        coldWar: {
          name: 'Den kalde krigen',
          description: 'Øst mot vest, i skyggen av bomben.'
        },
        spaceAge: {
          name: 'Romalderen',
          description: 'Fra Sputnik til månelandingene.'
        },
        digitalAge: {
          name: 'Den digitale tidsalder',
          description: 'Internett forandrer alt.'
        },
        lostGeneration: {
          name: 'Den tapte generasjonen',
          description: 'Ble voksne under første verdenskrig.'
        },
        greatestGeneration: {
          name: 'Den største generasjonen',
          description: 'Vokste opp under depresjonen, kjempet i andre verdenskrig.'
        },
        silentGeneration: {
          name: 'Den tause generasjonen',
          description: 'Barn av depresjonen og krigen.'
        },
        babyBoomers: {
          name: 'Etterkrigsgenerasjonen',
          description: 'Babyboomen etter krigen.'
        },
        generationX: {
          name: 'Generasjon X',
          description: 'Nøkkelbarna fra den sene kalde krigen.'
        },
        millennials: {
          name: 'Millennials',
          description: 'Ble voksne med internett.'
        },
        generationZ: {
          name: 'Generasjon Z',
          description: 'De første ekte digitale innfødte.'
        },
        generationAlpha: {
          name: 'Generasjon alfa',
          description: 'Født inn i smarttelefoner og KI.'
        },
        ageOfMyth: {
          name: 'Mytenes tid',
          description: 'Da legender vandret på jorden.'
        },
        ageOfKings: {
          name: 'Kongenes tid',
          description: 'Kroner reiser seg; ætter grunnlegges.'
        },
        ageOfIron: {
          name: 'Jernets tid',
          description: 'Krig, erobring og stål.'
        },
        ageOfTwilight: {
          name: 'Skumringens tid',
          description: 'De gamle maktene blekner.'
        }
      }
    }
  },
  groups: {
    title: 'Grupper',
    hint: 'Dra personer inn i ringer · Dra ringer for å ordne · Klikk en person for å administrere',
    arrangeTitle: 'Ordne gruppene i en ring',
    arrange: 'Ordne',
    newGroup: 'Ny gruppe',
    emptySceneTitle: 'Ingen grupper i denne scenen',
    emptyTitle: 'Ingen grupper ennå',
    emptyText:
      'Del inn personene dine i familier, firmaer, skoler, laug — hvilke leirer du vil. Personer i flere grupper havner i mellomrommet mellom dem.',
    createGroup: 'Opprett en gruppe',
    createFirstGroup: 'Opprett din første gruppe',
    zoomIn: 'Zoom inn',
    zoomOut: 'Zoom ut',
    fitAll: 'Tilpass alt',
    focus: 'Fokus',
    gender: 'Kjønn',
    life: 'Liv',
    all: 'Alle',
    unknown: 'Ukjent',
    living: 'Levende',
    remembered: 'Avdøde',
    showGroup: 'Vis gruppe',
    hideGroup: 'Skjul gruppe',
    editGroup: 'Rediger gruppe',
    sharedCount: '{n} i flere grupper',
    unassigned: 'Uten gruppe',
    trayHint: 'dra inn på en ring',
    trayMoreTitle: 'Filtrer medlemslisten til høyre og dra personer inn derfra',
    trayMore: '+{n} til',
    groupName: 'Gruppenavn',
    groupIcon: 'Gruppeikon',
    save: 'Lagre',
    unnamed: 'Uten navn',
    removeFromGroup: 'Fjern fra gruppe',
    addToGroup: 'Legg til i gruppe…',
    openProfile: 'Åpne profil',
    close: 'Lukk',
    scenes: 'Scener',
    scenesHint: 'Hver scene har sine egne gruppeplasseringer — medlemskap er felles',
    addScene: 'Ny tom scene',
    duplicateScene: 'Dupliser gjeldende scene',
    deleteScene: 'Slett scene',
    defaultGroupName: 'Gruppe {n}',
    unnamedGroup: 'Gruppe uten navn',
    sceneGroupsOne: '{n} gruppe',
    sceneGroupsOther: '{n} grupper',
    sceneTooltip: '{groups} · {n} personer i scenen',
    defaultSceneName: 'Scene {n}'
  },
  kinship: {
    title: 'Slektskap',
    unnamed: 'Uten navn',
    tabs: {
      lens: 'Linse',
      walk: 'Vandring',
      insights: 'Innsikt'
    },
    pane: {
      quizTitle: 'Slektsquiz — hvor godt kjenner du denne familien?',
      quiz: 'Quiz',
      throughEyes: 'Sett med øynene til',
      startingFrom: 'Starter fra',
      selectToBegin: 'Velg noen i grafen for å begynne',
      useName: 'Bruk {name}',
      lensOn: 'Linse på',
      lensOff: 'Se familien med deres øyne',
      lensOnSub: 'Hver node viser nå hva den er for {name}',
      lensOffSub: 'Merker alle med sin relasjon',
      closestKin: 'Nærmeste slekt'
    },
    filters: {
      all: {
        label: 'Alle',
        title: 'Alle, merket'
      },
      blood: {
        label: 'Blod',
        title: 'Bare blodsslektninger'
      },
      marriage: {
        label: 'Ekteskap',
        title: 'Ektefeller, svigerfamilie og stefamilie'
      },
      ancestors: {
        label: 'Aner',
        title: 'Den direkte linjen oppover'
      },
      descendants: {
        label: 'Etterkommere',
        title: 'Alle som stammer fra dem'
      }
    },
    classes: {
      blood: 'Blod',
      spouse: 'Ektefelle',
      marriage: 'Inngiftet',
      step: 'Stefamilie',
      social: 'Sosial',
      distant: 'Lenger ut'
    },
    walk: {
      up: 'Opp',
      across: 'Til siden',
      down: 'Ned',
      married: 'Gift',
      removeStep: 'Fjern dette steget',
      tapSteps: 'Trykk på steg for å bygge en kjede…',
      clear: 'Tøm kjeden',
      found: '{n} funnet',
      nobody: 'Ingen registrert'
    },
    insights: {
      family: 'familie',
      islands: 'øyer',
      linchpinsStat: 'nøkkelpersoner',
      tangledStat: 'floker',
      linchpinsTitle: 'Fjern én av disse, og familien deler seg',
      linchpins: 'Nøkkelpersoner',
      cutOffOne: 'Uten {name} blir {n} person avskåret',
      cutOffOther: 'Uten {name} blir {n} personer avskåret',
      holds: 'holder {n}',
      founders: 'Dynastigrunnleggere',
      founderStat: '{d} etterk. · {g} gen.',
      tangledTitle: 'Par som også er blodsslektninger',
      tangled: 'Sammenfiltrede røtter',
      islandsTitle: 'Grupper uten forbindelse til hverandre',
      islandsHead: 'Øyer',
      islandOne: '{n} person — {name}…',
      islandOther: '{n} personer — {name}…',
      empty: 'Legg til noen foreldre og barn for å se strukturen.'
    },
    quiz: {
      title: 'Slektsquiz',
      score: 'Poeng',
      streak: 'Rekke',
      closeEsc: 'Lukk (Esc)',
      close: 'Lukk',
      emptyTitle: 'La treet vokse litt først',
      emptyText: 'Quizen trenger noen foreldre, barn og ektefeller å spørre om.',
      correct: 'riktige',
      bestStreak: 'Beste rekke:',
      playAgain: 'Spill igjen',
      kinds: {
        name: 'Navngi båndet',
        who: 'Finn slektningen',
        hops: 'Seks ledd'
      },
      questions: {
        name: 'Hva er {b} for {a}?',
        who: 'Hvem er {rel} til {a}?',
        hops: 'Hvor mange ledd er det fra {a} til {b}?'
      },
      notQuite: 'Ikke helt —',
      hopsNoteOne: 'Det er {n} ledd — spor dem i grafen for å se kjeden.',
      hopsNoteOther: 'Det er {n} ledd — spor dem i grafen for å se kjeden.',
      seeResults: 'Se resultat',
      next: 'Neste',
      cheers: ['Helt riktig!', 'Spikret!', 'Slektshistoriker!', 'Akkurat!', 'Ja!'],
      grades: {
        keeper: {
          title: 'Slektstreets vokter',
          sub: 'Ingen kjenner denne familien bedre.'
        },
        historian: {
          title: 'Slektshistoriker',
          sub: 'Du kunne ledet slektstreffet.'
        },
        cousin: {
          title: 'Søskenbarnteller',
          sub: 'Solid — de på tvers av generasjoner er vanskelige.'
        },
        distant: {
          title: 'Fjern slektning',
          sub: 'Du kjenner ansiktene, ikke båndene.'
        },
        stranger: {
          title: 'Bortkommen fremmed',
          sub: 'På tide å studere slektskapslinsen!'
        }
      }
    },
    card: {
      flip: 'Snu spørsmålet',
      notFamily: '{b} og {a} er ikke i slekt — {n} ledd fra hverandre',
      noConnection: '{b} og {a} har ingen forbindelse i det hele tatt',
      degree: 'Grad',
      degreeValue: '{n}. grads slektning',
      sharedDna: 'Delt DNA',
      dnaNoneStep: 'ingen — familie gjennom stefamilie',
      dnaNoneMarriage: 'ingen — familie gjennom ekteskap',
      also: 'Også',
      bloodline: 'Blodslinje',
      commonAncestors: 'Felles aner',
      commonAncestor: 'Felles ane',
      through: 'Gjennom',
      explicitSibling: 'et eksplisitt søskenbånd',
      directLine: 'en direkte linje'
    },
    section: {
      groups: {
        ancestors: 'Aner',
        siblings: 'Søsken',
        descendants: 'Etterkommere',
        collateral: 'Tanter, onkler, nieser og nevøer',
        cousins: 'Søskenbarn',
        marriage: 'Ektefelle og svigerfamilie',
        step: 'Stefamilie'
      },
      less: 'Færre',
      empty: 'Ingen familie registrert ennå.',
      pedigreeKnown: 'Kjent anetavle',
      generationsBack: 'Generasjoner bakover',
      collapseTitle: 'Andel aneplasser fylt av noen som allerede finnes et annet sted',
      collapse: 'Anetap',
      inbreeding: 'Egen innavl (F)'
    },
    trace: {
      armedHint: 'Shift-klikk en annen person for å spore forbindelsen',
      cancelEsc: 'Avbryt (Esc)',
      dismissEsc: 'Lukk (Esc)',
      clearEsc: 'Tøm (Esc)',
      clear: 'Tøm',
      noConnection: 'Ingen forbindelse mellom {a} og {b}',
      connection: 'Forbindelse',
      hopsOne: '{n} ledd',
      hopsOther: '{n} ledd',
      view: 'Vis {name}',
      roleOf: '{role} til'
    },
    blood: {
      none: {
        label: 'Ingen felles blod',
        note: 'Barnet deres ville ikke ha noen innavl.'
      },
      echo: {
        label: 'Fjerne ekko',
        note: 'Rundt firmenninger — vanlig i enhver gammel bygd.'
      },
      distant: {
        label: 'Fjerne søskenbarn',
        note: 'Omtrent tremenninger (1,56 %).'
      },
      cousins: {
        label: 'Søskenbarnekteskap',
        note: 'Søskenbarn ligger på 6,25 %.'
      },
      close: {
        label: 'Nær slekt',
        note: 'Onkel–niese eller dobbelt søskenbarn (12,5 %).'
      },
      royal: {
        label: 'Kongehus-nivå',
        note: 'Bare generasjoner med inngifte når så høyt.'
      },
      habsburg: {
        label: 'Habsburgerkjeven',
        note: 'Karl II av Spania: 25,4 %.'
      }
    },
    fan: {
      aria: 'Anevifte',
      dup: '{name} — forekommer mer enn én gang',
      unknown: 'Ukjent'
    },
    lang: {
      aria: 'Språk for slektsnavn',
      nameIn: 'Navngi slektninger på {lang}'
    }
  },
  profile: {
    viewPortrait: 'Vis portrett',
    present: 'nå',
    ageYears: '{n} år',
    ageYrs: '{n} år',
    datesUnrecorded: 'datoer ikke registrert',
    inscription: 'Inskripsjon',
    scrollToUnroll: 'rull for å åpne',
    unroll: 'rull ut',
    leaves: {
      story: 'Historie',
      family: 'Familie',
      bonds: 'Bånd',
      kin: 'Slektskap',
      traits: 'Egenskaper',
      chron: 'Krønike',
      gallery: 'Galleri'
    },
    withinTwoBonds: '{n} innen to bånd',
    endedYear: 'endte {year}',
    familyNamed: 'familien, navngitt',
    yes: 'Ja',
    no: 'Nei',
    primary: 'hovedbilde',
    blankTitle: 'En rull som venter på blekk',
    blankText:
      'Ingen egenskaper, bånd eller bilder ennå — åpne redigeringen for å male {name} inn.',
    blankTextAnon:
      'Ingen egenskaper, bånd eller bilder ennå — åpne redigeringen for å male dem inn.',
    startEditing: 'Begynn å redigere',
    unnamed: 'Uten navn',
    stats: {
      bonds: 'Bånd',
      circle: 'Krets',
      traits: 'Egenskaper',
      photos: 'Bilder'
    },
    months: [
      'jan.',
      'feb.',
      'mar.',
      'apr.',
      'mai',
      'jun.',
      'jul.',
      'aug.',
      'sep.',
      'okt.',
      'nov.',
      'des.'
    ],
    dateDay: '{d}. {m} {y}',
    dateMonth: '{m} {y}'
  },
  directory: {
    toolbar: {
      search: 'Søk etter personer…',
      filters: 'Filtre'
    },
    sort: {
      name: 'A–Å',
      year: 'År',
      age: 'Alder'
    },
    filters: {
      life: 'Liv',
      all: 'Alle',
      living: 'Levende',
      remembered: 'Minnes',
      gender: 'Kjønn',
      unknown: 'Ukjent',
      ties: 'Bånd',
      everyone: 'Alle',
      connected: 'Tilknyttet',
      unlinked: 'Uten bånd',
      clearOne: 'Fjern {n} filter',
      clearOther: 'Fjern {n} filtre'
    },
    empty: {
      noMatches: 'Ingen treff',
      noPeople: 'Ingen personer ennå',
      noMatchesHint: 'Prøv et annet søkeord.',
      noPeopleHint: 'Legg til familiemedlemmer fra grafvisningen for å se dem her.'
    },
    modes: {
      switchLabel: 'Visningsmodus for katalogen',
      showcaseViews: 'Utstillingsvisninger',
      showcase: 'Utstilling',
      showcaseSub: 'Andre måter å møte alle på',
      showcaseTitle: 'Utstilling — flere måter å se alle på',
      grid: {
        label: 'Rutenett',
        blurb: 'den klassiske rullende kortveggen'
      },
      wheel: {
        label: 'Karusell',
        blurb: 'en 3D-ring av kort — dra for å snurre den'
      },
      flow: {
        label: 'Flyt',
        blurb: 'coverflow med speiling i gulvet'
      },
      fan: {
        label: 'Hånd',
        blurb: 'en vifte av kort på hånden'
      },
      deck: {
        label: 'Kortstokk',
        blurb: 'sveip gjennom kortstokken ett kort om gangen'
      },
      hive: {
        label: 'Bikube',
        blurb: 'en bikake — hver person en sekskant'
      },
      reel: {
        label: 'Filmrull',
        blurb: 'en snurrende trommel av filmstriper'
      },
      sheet: {
        label: 'Regneark',
        blurb: 'et regneark — skriv, lim inn og sorter hver egenskap'
      },
      roster: {
        label: 'Mannskap',
        blurb: 'en velgerskjerm fra et kampspill'
      },
      codex: {
        label: 'Kodeks',
        blurb: 'et illustrert bestiarium, side for side'
      },
      board: {
        label: 'Bevis',
        blurb: 'polaroider og rød tråd på en korktavle'
      },
      elements: {
        label: 'Grunnstoffer',
        blurb: 'et periodesystem over familien'
      },
      ranks: {
        label: 'Rangering',
        blurb: 'en pallplass og et ledertavleløp'
      },
      bubbles: {
        label: 'Bobler',
        blurb: 'tettpakkede bobler som omgrupperer seg'
      },
      handscroll: {
        label: 'Håndrull',
        blurb: '长卷 — familien som én malt rull, lest fra høyre mot venstre'
      }
    },
    common: {
      unnamed: 'Uten navn',
      born: 'f. {year}',
      died: 'd. {year}',
      deceased: 'Avdød'
    },
    stage: {
      emptyTitle: 'Ingenting å dele ut',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      prev: 'Forrige',
      prevHint: 'Forrige (venstre piltast)',
      next: 'Neste',
      nextHint: 'Neste (høyre piltast)'
    },
    cardStyle: {
      current: 'Kortstil: {style}',
      title: 'Kortstil',
      sub: 'hvordan katalogen deler ut kortene',
      styles: {
        classic: {
          label: 'Klassisk',
          blurb: 'Originalen — banner, avatar og statistikk.'
        },
        poster: {
          label: 'Helbilde',
          blurb: 'Bildet fyller kortet; informasjonen svever foran.'
        },
        holo: {
          label: 'Holo',
          blurb: 'Gullfoliert samlekort med HP, angrep og sjeldenhet.'
        },
        neon: {
          label: 'Neon',
          blurb: 'Cyberpunk-mappe — skannelinjer, glitcher, strekkoder.'
        },
        arcana: {
          label: 'Arkana',
          blurb: 'Familiens tarot — forgylte rammer og stjernelys.'
        },
        scroll: {
          label: 'Rull',
          blurb: '立轴 — hengende tusjruller med kalligrafi og segl.'
        },
        moonfan: {
          label: 'Månevifte',
          blurb: '团扇 — runde silkevifter malt med plomme, bambus og måne.'
        }
      }
    },
    hive: {
      emptyTitle: 'Bikuben er tom'
    },
    reel: {
      emptyTitle: 'Filmrullen er tom',
      relations: 'Relasjoner',
      prevHint: 'Forrige (pil opp)',
      nextHint: 'Neste (pil ned)'
    },
    board: {
      emptyTitle: 'Ingen spor ennå',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      evidence: 'BEVIS',
      subjects: {
        one: '{n} person',
        other: '{n} personer'
      },
      strings: {
        one: '{n} tråd',
        other: '{n} tråder'
      },
      zoomIn: 'Zoom inn',
      zoomOut: 'Zoom ut',
      fit: 'Tilpass',
      fitTitle: 'Vis alle på skjermen',
      tidy: 'Rydd opp',
      tidyTitle: 'Sett hvert bilde tilbake på familieplassen sin',
      hint: 'Dra brettet for å panorere · rull for å zoome · dra bilder for å flytte dem',
      deceasedStamp: 'AVDØD',
      unnamed: 'Uten navn',
      born: 'f. {year}',
      died: 'd. {year}',
      diedAt: '† {age} år',
      age: '{age} år',
      kin: '{n} slektninger',
      children: {
        one: '{n} barn',
        other: '{n} barn'
      }
    },
    bubbles: {
      emptyTitle: 'Ingen bobler å blåse',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      unnamed: 'Uten navn',
      size: 'Størrelse',
      group: 'Gruppe',
      sizeModes: {
        kin: 'Forbindelser',
        children: 'Barn',
        age: 'Alder',
        equal: 'Lik'
      },
      groupModes: {
        gender: 'Kjønn',
        decade: 'Tiår',
        tag: 'Gruppe',
        life: 'Liv',
        family: 'Familie',
        none: 'Ingen'
      },
      everyone: 'Alle',
      zoomIn: 'Zoom inn',
      zoomOut: 'Zoom ut',
      fitTitle: 'Vis alle (Esc)',
      fitAria: 'Vis alle',
      foot: {
        people: {
          one: 'person',
          other: 'personer'
        },
        groups: {
          one: 'gruppe',
          other: 'grupper'
        }
      },
      footHint: 'Rull for å zoome · dra for å panorere · klikk en sirkel for å gå inn',
      deceased: 'Avdød',
      born: 'f. {year}',
      died: 'd. {year}',
      datesUnknown: 'Ukjente datoer',
      metric: {
        ageUnknown: 'Ukjent alder',
        age: '{n} år',
        children: {
          one: '{n} barn',
          other: '{n} barn'
        },
        connections: {
          one: '{n} forbindelse',
          other: '{n} forbindelser'
        }
      },
      groups: {
        other: 'Annet / ukjent',
        deceased: 'Avdøde',
        living: 'Levende',
        unknownBirth: 'Ukjent fødsel',
        decade: '{n}-tallet',
        ungrouped: 'Uten gruppe',
        unconnected: 'Uten forbindelser',
        surnameFamily: 'Familien {name}',
        familyN: 'Familie {n}'
      }
    },
    card: {
      unnamed: 'Uten navn',
      datesUnknown: 'Ukjente datoer',
      born: 'f. {year}',
      died: 'd. {year}',
      yr: 'år',
      yrDeceased: 'år†',
      ageYr: '{age} år',
      relations: 'Relasjoner',
      children: 'Barn',
      deceased: 'Avdød',
      ties: {
        one: 'bånd',
        other: 'bånd'
      },
      heirs: {
        one: 'arving',
        other: 'arvinger'
      },
      tiesCount: {
        one: '{n} bånd',
        other: '{n} bånd'
      },
      childrenCount: {
        one: '{n} barn',
        other: '{n} barn'
      },
      holo: {
        legend: 'LEGENDE',
        basic: 'BASIS',
        kinship: 'Slektskap',
        kinshipText: 'Henter styrke fra hvert bånd.',
        legacy: 'Arv',
        legacyText: 'Fører historien videre til neste tid.',
        rarity: 'Sjeldenhet {n} av 5'
      },
      neon: {
        archived: 'ARKIVERT',
        online: 'TILKOBLET',
        unnamed: 'UTEN NAVN',
        age: 'ALDER',
        links: 'BÅND',
        heirs: 'ARVINGER',
        origin: 'OPPHAV',
        unknown: 'UKJENT'
      }
    },
    handscroll: {
      emptyTitle: 'Rullen er blank',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      decade: '{year}-tallet',
      undated: 'udatert',
      people: {
        one: '{n} person',
        other: '{n} personer'
      },
      scenes: {
        one: '{n} scene',
        other: '{n} scener'
      },
      hint: 'dra · hjul · piltaster'
    },
    codex: {
      title: 'Kodeks',
      emptyTitle: 'Kodeksen er uskrevet',
      emptyText: 'Ingen oppføringer passer – tøm søket eller legg til noen.',
      entries: {
        one: '{n} oppføring',
        other: '{n} oppføringer'
      },
      chronicledCount: '{n} med krønike',
      jumpTo: 'Hopp til {ch}',
      jumpNo: 'Nr.',
      jumpToNumber: 'Hopp til oppføringsnummer',
      entryNo: 'Nr. {n}',
      unnamed: 'Uten navn',
      deceased: 'Avdød',
      living: 'Levende',
      openProfile: 'Åpne full profil',
      born: 'Født',
      died: 'Død',
      age: 'Alder',
      unrecorded: 'Ikke registrert',
      lifespan: 'Levetid',
      spanUnrecorded: 'levetid ikke registrert',
      ageUnknown: 'Ukjent',
      ageYears: '{n} år',
      ageLiving: '{n} · lever',
      captionUnrecorded: 'ikke registrert',
      caption: '{from} – {to} · {age} av {max} år',
      now: 'nå',
      kinship: 'Slektskap',
      kinCap: 'SLEKT',
      groups: {
        parents: 'Foreldre',
        partners: 'Partnere',
        children: 'Barn',
        siblings: 'Søsken'
      },
      bond: 'Bånd',
      turnTo: 'Bla til {name}',
      notInFilter: 'Ikke i gjeldende filter',
      more: '+{n} til',
      noBonds: 'En ensom sjel – ingen bånd registrert.',
      chronicle: 'Krønike',
      noBio:
        'Ingen kilder forteller om denne personens gjerninger. Siden venter på en krønikeskriver.',
      prev: 'Forrige oppføring',
      prevTitle: 'Forrige oppføring (pil opp eller venstre)',
      next: 'Neste oppføring',
      nextTitle: 'Neste oppføring (pil ned eller høyre)',
      folio: '— {i} av {n} —',
      seal: {
        undated: 'UDATERT',
        discovered: 'OPPDAGET',
        discoveredBce: 'OPPDAGET · F.KR.'
      },
      date: {
        months: [
          'jan.',
          'feb.',
          'mar.',
          'apr.',
          'mai',
          'jun.',
          'jul.',
          'aug.',
          'sep.',
          'okt.',
          'nov.',
          'des.'
        ],
        year: '{y}',
        month: '{m} {y}',
        day: '{d}. {m} {y}',
        bce: '{y} f.Kr.'
      }
    },
    roster: {
      emptyTitle: 'Ingen utfordrere',
      emptyText: 'Ingen personer passer – tøm søket eller legg til noen.',
      no: 'Nr.{n}',
      departed: 'Avdød',
      unnamed: 'Uten navn',
      selected: 'Valgt!',
      lockIn: 'Lås inn',
      selectTitle: 'Velg din figur',
      keys: {
        left: 'Venstre',
        up: 'Opp',
        down: 'Ned',
        right: 'Høyre'
      },
      hintMove: 'flytt',
      hintLock: 'lås inn',
      fighters: {
        one: '{n} kjemper',
        other: '{n} kjempere'
      },
      life: {
        span: '{b} – {d}',
        born: 'f. {y}',
        died: 'd. {y}'
      },
      diedAged: 'døde {n} år gammel',
      ageN: '{n} år',
      stats: {
        age: 'Alder',
        kin: 'Slekt',
        children: 'Barn'
      }
    },
    ranks: {
      metricAria: 'Rangeringsmål',
      metrics: {
        age: {
          label: 'Alder',
          blurb: 'Alder i referanseåret — hele levetiden for de avdøde',
          unit: {
            one: 'år',
            other: 'år'
          }
        },
        connections: {
          label: 'Forbindelser',
          blurb: 'Alle relasjoner en person inngår i',
          unit: {
            one: 'kobling',
            other: 'koblinger'
          }
        },
        children: {
          label: 'Barn',
          blurb: 'Registrerte barn',
          unit: {
            one: 'barn',
            other: 'barn'
          }
        },
        descendants: {
          label: 'Etterkommere',
          blurb: 'Barn, barnebarn og alle generasjoner under',
          unit: {
            one: 'etterkommer',
            other: 'etterkommere'
          }
        },
        depth: {
          label: 'Slektslinje',
          blurb: 'Generasjoner av registrerte forfedre over dem',
          unit: {
            one: 'gen.',
            other: 'gen.'
          }
        },
        siblings: {
          label: 'Søsken',
          blurb: 'Personer som deler minst én forelder',
          unit: {
            one: 'søsken',
            other: 'søsken'
          }
        }
      },
      ranked: 'rangert',
      unranked: 'urangert',
      avg: 'snitt',
      emptyTitle: 'Ingen deltakere',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      topThree: 'Topp tre',
      unnamed: 'Uten navn',
      deceased: 'Avdød',
      podiumNote: 'Ingen har poeng på {metric} ennå',
      colName: 'Navn',
      unrankedDivider: 'Urangert · {n} — ingen {metric} registrert',
      tied: 'Delt',
      deltaNew: 'NY',
      bornShort: 'f. {year}',
      diedShort: 'd. {year}'
    },
    elements: {
      emptyTitle: 'Ingen grunnstoffer oppdaget',
      emptyText: 'Ingen personer passer — tøm søket eller legg til noen.',
      deceased: 'Avdød',
      unnamed: 'Uten navn',
      stats: {
        born: 'Født',
        died: 'Død',
        age: 'Alder',
        kin: 'Slekt',
        children: 'Barn',
        group: 'Gruppe'
      },
      groupByAria: 'Grupper kolonner etter',
      groupsLabel: 'Grupper',
      colourByAria: 'Farg ruter etter',
      colourLabel: 'Farge',
      groupings: {
        decade: 'Fødselstiår',
        generation: 'Generasjon',
        tag: 'Gruppetagg'
      },
      colorings: {
        gender: 'Kjønn',
        life: 'Livsstatus',
        group: 'Gruppe'
      },
      cats: {
        other: 'Annet / ukjent',
        living: 'Levende',
        deceased: 'Avdød',
        undated: 'Udatert',
        untagged: 'Uten tagg'
      },
      tagFallback: 'Tagg',
      hint: '{elements} grunnstoffer · {groups} grupper · {periods} perioder — hold over for å se, klikk for å åpne',
      gen: 'Gen. {n}',
      decade: '{d}-tallet',
      massYears: '{age} år',
      ageAtDeath: '{age} (ved død)',
      periodShort: 'P{n}',
      monthsShort: [
        'jan.',
        'feb.',
        'mar.',
        'apr.',
        'mai',
        'jun.',
        'jul.',
        'aug.',
        'sep.',
        'okt.',
        'nov.',
        'des.'
      ],
      dateDay: '{d}. {m} {y}',
      dateMonth: '{m} {y}'
    }
  },
  dock: {
    expand: 'Vis panelet',
    collapse: 'Skjul panelet',
    inspector: 'Inspektør',
    noDates: 'Ingen datoer registrert',
    tags: 'Tagger',
    openProfile: 'Åpne profil',
    edit: 'Rediger',
    emptyHint:
      'Velg en person på lerretet – eller fra Katalog-fanen – for å se og redigere vedkommende her.',
    noPeopleFound: 'Fant ingen personer',
    addNoun: 'Legg til {noun}'
  },
  sheet: {
    aria: 'Regneark',
    bar: {
      addRowTitle: 'Legg til en rad (Enter i et tomt ark)',
      addTraitTitle: 'Legg til en egenskapskolonne',
      trait: 'Egenskap',
      columnsTitle: 'Vis eller skjul kolonner',
      columns: 'Kolonner',
      hidden: '{n} skjult',
      fillDownTitle: 'Fyll ned (Ctrl+D)',
      confirmDelete: 'Klikk igjen for å slette'
    },
    deleteRows: 'Slett {n} {nouns}',
    head: {
      selectAll: 'Merk alt (Ctrl+A)',
      options: 'Kolonnevalg',
      resize: 'Dra for å endre bredde · dobbeltklikk for å tilpasse',
      titleAge: 'Alder i {year} (beregnet) — klikk for å sortere',
      titleTies: 'Antall relasjoner (beregnet) — klikk for å sortere',
      titleGroups: 'Gruppemedlemskap — klikk for å sortere',
      titleField: '{label} ({type}) — klikk for å sortere',
      titleFieldSlot: '{label} ({type} · {slot}-plass) — klikk for å sortere'
    },
    typeNames: {
      text: 'tekst',
      boolean: 'ja/nei',
      number: 'tall',
      number_range: 'tallområde',
      select: 'valg',
      slider: 'glidebryter',
      date: 'dato',
      date_range: 'datoområde',
      custom_date: 'egendefinert dato',
      custom_date_range: 'egendefinert datoområde'
    },
    slots: {
      name: 'navn',
      gender: 'kjønn',
      birth: 'fødsel',
      death: 'død',
      highlight: 'utheving'
    },
    types: {
      text: 'Tekst',
      number: 'Tall',
      date: 'Dato',
      select: 'Valg',
      boolean: 'Ja / nei',
      slider: 'Glidebryter',
      number_range: 'Tallområde',
      date_range: 'Datoområde'
    },
    cols: {
      age: 'Alder',
      ties: 'Bånd',
      groups: 'Grupper',
      showAll: 'Vis alle kolonner'
    },
    people: {
      one: 'person',
      other: 'personer'
    },
    customNoun: {
      one: '{noun}',
      other: '{noun}'
    },
    addNoun: 'Legg til {noun}',
    addRowHint: 'eller lim inn rader under den siste',
    unnamed: 'Uten navn',
    empty: {
      noMatches: 'Ingen treff',
      emptyTitle: 'Et tomt ark',
      noMatchesText: 'Ingen passer med gjeldende søk eller filtre.',
      emptyText:
        'Legg til første rad — eller lim inn en navneliste fra et hvilket som helst regneark.'
    },
    status: {
      rows: '{n} {nouns}',
      cols: {
        one: '{n} kolonne',
        other: '{n} kolonner'
      },
      resort: 'Sorter på nytt',
      resortTitle: 'Verdier er endret siden radene ble sortert',
      hint: 'Enter rediger · Tab neste · Ctrl+C / Ctrl+V · Del tøm · Ctrl+D fyll ned · høyreklikk for mer',
      saving: 'Lagrer…',
      notSaved: 'Ikke lagret',
      saved: 'Alle endringer lagret'
    },
    addCol: {
      title: 'Ny egenskapskolonne',
      placeholder: 'Navn på egenskap, f.eks. Kallenavn',
      add: 'Legg til kolonne'
    },
    menu: {
      confirm: 'Klikk igjen for å bekrefte',
      sortAsc: 'Sorter stigende',
      sortDesc: 'Sorter synkende',
      clearSort: 'Fjern sortering',
      fit: 'Tilpass bredde til innhold',
      selectColumn: 'Merk kolonne',
      rename: 'Gi egenskapen nytt navn',
      hide: 'Skjul kolonne',
      deleteTrait: 'Slett egenskapen for alle',
      deleteTraitArmed: 'Klikk igjen — fjerner alle verdier',
      copy: 'Kopier',
      paste: 'Lim inn',
      clear: 'Tøm innhold',
      fillDown: 'Fyll ned',
      openProfile: 'Åpne profil',
      editForm: 'Rediger i fullt skjema',
      deleteRowsArmed: 'Klikk igjen for å slette {n}'
    },
    summary: {
      cells: '{n} celler',
      count: 'Antall {n}',
      sum: 'Sum {n}',
      avg: 'Snitt {n}',
      min: 'Min {n}',
      max: 'Maks {n}'
    },
    fx: {
      selectCell: 'Velg en celle',
      pickGroups: 'Dobbeltklikk cellen for å velge grupper',
      calculated: 'Beregnet',
      pick: 'Dobbeltklikk for å velge',
      empty: 'Tom — skriv for å fylle ut'
    },
    ref: {
      cells: 'celler',
      row: '{name} · rad {n}'
    },
    notice: {
      genericError: 'Noe gikk galt',
      saveFailed: 'Kunne ikke lagre — {error}',
      projectChanged: 'Prosjektet ble byttet før denne endringen ble lagret',
      calculated: '{label} beregnes — kan ikke skrives inn',
      cleared: 'Tømte {n} celler',
      cantClear: 'Beregnede celler og gruppeceller kan ikke tømmes her',
      filled: {
        one: 'Fylte {n} celle nedover',
        other: 'Fylte {n} celler nedover'
      },
      copied: {
        one: 'Kopierte {n} celle',
        other: 'Kopierte {n} celler'
      },
      pressCopy: 'Trykk Ctrl+C for å kopiere',
      pressPaste: 'Trykk Ctrl+V for å lime inn',
      pasted: {
        one: 'Limte inn {n} celle',
        other: 'Limte inn {n} celler'
      },
      pastedAdded: 'la til {n} {nouns}',
      pastedBad: '{n} passet ikke egenskapstypen',
      pastedSkipped: '{n} havnet i beregnede kolonner',
      nothing: 'Ingenting å endre',
      deletedRows: 'Slettet {n} {nouns} — Ctrl+Z for å angre',
      colAdded: 'La til «{label}» — hver {noun} har den nå',
      traitDeleted: 'Slettet «{label}» — Ctrl+Z for å angre',
      discarded: 'Verdien passet ikke egenskapstypen — endringen ble forkastet'
    },
    parse: {
      notNumber: 'Ikke et tall',
      numRangeShape: 'Bruk «lav–høy»',
      numRangeNumbers: 'Bruk tall, som «10–20»',
      yesNo: 'Bruk yes / no eller 1 / 0',
      notOption: '«{text}» er ikke et valg',
      dateShape: 'Bruk et årstall, eller ÅÅÅÅ-MM-DD',
      dateRangeShape: 'Bruk «fra–til»',
      dateRangeDates: 'Bruk datoer, som «1950–1960»',
      notEditable: 'Denne egenskapstypen kan ikke redigeres her ennå'
    },
    picker: {
      findGroup: 'Finn eller opprett en gruppe…',
      findOption: 'Finn eller legg til et valg…',
      newGroup: 'Ny gruppe',
      addOption: 'Legg til valg',
      empty: 'Ingenting å velge ennå',
      clear: 'Tøm',
      hintMulti: 'flytt · Enter veksle · Esc lukk',
      hintSingle: 'flytt · Enter velg · Esc lukk'
    }
  },
  personForm: {
    input: {
      notSetHint: 'Ikke satt – klikk for å angi',
      notSet: 'Ikke satt',
      yes: 'Ja',
      no: 'Nei',
      clear: 'Tøm',
      from: 'Fra',
      to: 'Til',
      year: 'År',
      reserved: 'Kommer med egendefinerte kalendere'
    },
    types: {
      text: 'Tekst',
      boolean: 'Ja / nei',
      number: 'Tall',
      number_range: 'Tallområde',
      select: 'Valg',
      slider: 'Glidebryter',
      date: 'Dato',
      date_range: 'Datoområde'
    },
    typeHints: {
      text: 'Fritekst',
      boolean: 'En sann/usann-bryter',
      number: 'Ett tall, valgfri enhet',
      number_range: 'Usikkert spenn (a–b)',
      select: 'Velg ett alternativ',
      slider: 'En verdi mellom to ytterpunkter',
      date: 'Et tidspunkt',
      date_range: 'Usikkert tidsrom'
    },
    slots: {
      name: 'Navn',
      gender: 'Kjønn',
      birth: 'Fødsel',
      death: 'Død',
      highlight: 'Markering'
    },
    slotHints: {
      name: 'Tekstegenskaper · rekkefølge = ordrekkefølge',
      gender: 'Plasseres på fargeovergangen',
      birth: 'Datoer, år eller spenn',
      death: 'Datoer, år eller spenn',
      highlight: 'Enhver verdi gir noden en ring'
    },
    addTrait: 'Legg til egenskap',
    close: 'Lukk',
    changeType: 'Bytt type',
    nameTraitPh: 'Gi denne {type}-egenskapen et navn …',
    lock: 'Lås',
    lockHint: 'Låste egenskaper vises på alle personers skjema',
    create: 'Opprett',
    optionN: 'Alternativ {n}',
    row: {
      dragHint: 'Dra for å endre rekkefølge – slipp på en plass for å tilordne',
      templateHint: 'Malegenskap – på alle skjemaer',
      shownInGraph: 'Vises i grafetiketten',
      timeframeHint: 'Når denne egenskapen gjaldt',
      label: 'Etikett',
      unit: 'Enhet',
      multiline: 'Flere linjer',
      min: 'Min',
      max: 'Maks',
      step: 'Steg',
      leftLabel: 'Venstre etikett',
      rightLabel: 'Høyre etikett',
      icon: 'Ikon',
      traitIcon: 'Egenskapsikon',
      optionColor: 'Alternativfarge',
      optionPh: 'Alternativ …',
      removeOption: 'Fjern alternativ',
      addOption: 'Legg til alternativ',
      apply: 'Bruk',
      options: 'Egenskapsvalg',
      editTrait: 'Rediger egenskap',
      editTraitHint: 'Etikett · ikon · alternativer',
      unlock: 'Lås opp',
      thisPersonOnly: 'Kun denne {noun}',
      onEveryForm: 'På alle skjemaer',
      showInGraph: 'Vis i grafen',
      applyAllHint: 'Bruk på denne egenskapen for alle personer',
      applyAll: 'Bruk på alle',
      removeTimeframe: 'Fjern tidsrom',
      setTimeframe: 'Angi tidsrom',
      moveToSlot: 'Flytt til plass',
      slotRejects: '{type}-egenskaper kan ikke plasseres her',
      duplicate: 'Dupliser',
      removeFromThis: 'Fjern fra denne {noun}',
      deleteTrait: 'Slett egenskap',
      copyName: '{name} (kopi)'
    },
    unnamed: 'Uten navn',
    bornAbbr: 'f. {year}',
    picker: {
      placeholder: 'Skriv et navn …',
      noMatches: 'Ingen treff',
      creating: 'Oppretter …',
      createAs: 'Opprett «{name}» som ny {noun}'
    },
    dock: {
      leftColor: 'Venstre overgangsfarge',
      rightColor: 'Høyre overgangsfarge',
      earlier: 'Tidligere i navnet',
      later: 'Senere i navnet',
      ringColor: 'Ringfarge',
      ejectHint: 'Fjern fra plassen (tilbake til egenskapslisten)',
      eject: 'Fjern fra plassen',
      dropHere: 'Slipp her',
      dragHere: 'Dra en egenskap hit'
    },
    livePreview: 'Forhåndsvisning',
    identitySlots: 'Identitetsplasser',
    traits: 'Egenskaper',
    traitsHint: 'Dra i håndtaket for å endre rekkefølge · slipp på en plass for å tilordne',
    removeRel: 'Fjern relasjon',
    status: 'Status',
    married: 'Gift',
    since: 'Siden',
    ended: 'Sluttet',
    siblings: 'Søsken',
    siblingHint: 'Utledet fra en felles forelder – ingen egen relasjon trengs',
    viaSharedParents: 'via felles foreldre',
    new: 'Ny',
    discardLink: 'Forkast denne koblingen',
    images: 'Bilder',
    imagesLater: 'Bilder kan legges til etter opprettelse – lagre først.',
    removeImage: 'Fjern bilde',
    useAs: 'Bruk som {slot}',
    deleteImage: 'Slett bilde',
    addExtraImage: 'Legg til et ekstra bilde',
    extra: 'Ekstra',
    tags: 'Tagger',
    tagsLater: 'Tagger kan legges til etter opprettelse – lagre først.',
    saving: 'Lagrer …',
    saveChanges: 'Lagre endringer',
    intentHintDirected: 'Hvem er denne {noun}s {role}?',
    intentHintSym: '{type}: velg den andre {noun}',
    bands: {
      family: 'Familie',
      social: 'Sosialt',
      power: 'Makt',
      custom: 'Egendefinert'
    },
    roleOf: '{role} av',
    imageSlots: {
      portrait: 'Portrett',
      fullbody: 'Helfigur',
      background: 'Bakgrunn'
    },
    imageSlotHints: {
      portrait: 'Hode og skuldre – avataren',
      fullbody: 'Stående figur',
      background: 'En scene eller bakgrunn'
    },
    sections: {
      identity: 'Identitet',
      traits: 'Egenskaper',
      relations: 'Relasjoner',
      images: 'Bilder',
      tags: 'Tagger'
    },
    editTitle: 'Rediger: {name}',
    addTitle: 'Legg til {noun}',
    present: 'nå',
    onlyTextInName: 'Bare tekstegenskaper kan vises i grafnavnet',
    slotRejectsType: 'Den egenskapstypen kan ikke plasseres i {slot}-plassen',
    couldNotSave: 'Kunne ikke lagre',
    couldNotCreate: 'Kunne ikke opprette'
  },
  tagChips: {
    color: 'Taggfarge',
    typeTitle: 'Taggtype: {type}',
    remove: 'Fjern tagg',
    empty: 'Ingen tagger ennå.',
    addExisting: 'Legg til eksisterende tagg …',
    assign: 'Tildel',
    newLabelPh: 'Navn på ny tagg …',
    typePh: 'Type (valgfritt)',
    typeHint: 'Tagger med samme type kan sammenlignes i Grupper-visningen (f.eks. «familie»)',
    add: 'Legg til'
  },
  personModal: {
    inMemoriam: 'Til minne',
    present: 'Nå',
    ageYrs: '{n} år',
    noDates: 'Ingen datoer registrert',
    stats: {
      bonds: 'Bånd',
      circle: 'Krets',
      traits: 'Egenskaper',
      photos: 'Bilder'
    },
    constellation: 'Konstellasjon',
    withinTwo: '{n} innen to bånd',
    twoHops: '2 ledd',
    kinship: 'Slektskap',
    kinshipSub: 'familien, med navn',
    story: 'Historie',
    traits: 'Egenskaper',
    chronicle: 'Krønike',
    addEventHint: 'Legg til en hendelse vedkommende var med på',
    addEvent: 'Legg til hendelse',
    livedThrough: 'Levde gjennom',
    bonds: 'Bånd',
    endedYear: 'Sluttet {year}',
    gallery: 'Galleri',
    primaryPhoto: 'Hovedbilde',
    blankTitle: 'En historie som venter på å bli skrevet',
    blankText:
      'Ingen egenskaper, bånd eller bilder ennå – åpne redigeringen for å vekke {name} til live.',
    them: 'vedkommende',
    startEditing: 'Begynn å redigere',
    profileStyle: 'Profilstil',
    styles: {
      cinematic: 'Filmatisk',
      scroll: 'Rull'
    },
    styleTitles: {
      cinematic: 'Filmatisk profil',
      scroll: 'Håndrull – en tuschmaleriprofil'
    },
    editNoun: 'Rediger {noun}',
    edit: 'Rediger',
    deleteNoun: 'Slett {noun}',
    closeProfile: 'Lukk profil',
    prevPhoto: 'Forrige bilde',
    nextPhoto: 'Neste bilde',
    kin: {
      husband: 'Ektemann',
      wife: 'Kone',
      spouse: 'Ektefelle',
      son: 'Sønn',
      daughter: 'Datter',
      child: 'Barn',
      father: 'Far',
      mother: 'Mor',
      parent: 'Forelder',
      adoptedChild: 'Adoptivbarn',
      adoptiveParent: 'Adoptivforelder',
      brother: 'Bror',
      sister: 'Søster',
      sibling: 'Søsken'
    },
    bands: {
      family: 'Familie',
      social: 'Sosialt',
      power: 'Makt',
      custom: 'Annet'
    },
    ev: {
      born: 'Født',
      married: 'Giftet seg med {name}',
      childBorn: '{name} ble født',
      bond: '{role} – {name}',
      bondEnded: '{role} avsluttet – {name}',
      with: 'med {names}',
      eraBegins: '{name} begynner',
      aged: '{n} år gammel',
      died: 'Døde',
      atAge: '{n} år gammel'
    },
    listSep: ', ',
    back: 'Tilbake',
    view: 'visningen',
    backTo: 'Tilbake til {view}'
  },
  relsView: {
    searchPh: 'Søk etter navn …',
    issuesHint: 'Relasjoner som trenger oppmerksomhet',
    issues: 'Problemer',
    filters: 'Filtre',
    manageTypes: 'Administrer relasjonstyper',
    types: 'Typer',
    addRel: 'Legg til relasjon',
    dates: 'Datoer',
    any: 'Alle',
    dated: 'Datert',
    undated: 'Udatert',
    marriage: 'Ekteskap',
    together: 'Sammen',
    groupLens: 'Gruppelinse',
    endpointsHint: 'Hvilke ender som må være i gruppen',
    either: 'Én av dem',
    both: 'Begge',
    clearFilters: {
      one: 'Fjern {n} filter',
      other: 'Fjern {n} filtre'
    },
    newRel: 'Ny relasjon',
    personA: 'Person A',
    personB: 'Person B',
    relationship: 'Relasjon',
    swapAB: 'Bytt A og B',
    marriedYear: 'Gift (år)',
    sinceYear: 'Siden (år)',
    endedYear: 'Sluttet (år)',
    save: 'Lagre',
    colFrom: 'Fra',
    colRelation: 'Relasjon',
    colTo: 'Til',
    viewPerson: 'Vis {name}',
    unknown: 'Ukjent',
    toggleMarried: 'Klikk for å veksle mellom gift / skilt',
    formedHint: 'Året relasjonen startet',
    swapDirection: 'Snu retningen',
    editRel: 'Rediger relasjon',
    deleteRel: 'Slett relasjon',
    empty: {
      noIssues: 'Fant ingen problemer',
      noMatches: 'Ingen treff',
      noRels: 'Ingen relasjoner ennå',
      noIssuesText: 'Alle relasjonene ser konsistente ut. Bra jobbet!',
      noMatchesText: 'Prøv et annet søkeord eller filter.',
      noRelsText: 'Koble sammen to familiemedlemmer for å komme i gang.'
    },
    selectPerson: 'Velg person …',
    nameBorn: '{name} ({born})',
    parentOf: 'Forelder til',
    partner: 'Partner',
    all: 'Alle',
    issue: {
      self: 'Kobler en person til seg selv',
      missing: 'Viser til en person som ikke lenger finnes',
      duplicate: 'Duplikat – dette paret har allerede denne relasjonen',
      parentYounger: 'Forelder (f. {a}) er født etter eller samme år som barnet (f. {b})',
      tooManyParents: '{name} har mer enn to biologiske foreldre',
      thisChild: 'Dette barnet',
      redundantSibling: 'Overflødig – disse to er allerede søsken via en felles forelder'
    },
    preview: {
      divorced: '{a} og {b} var gift, nå skilt',
      married: '{a} og {b} er gift',
      adopted: '{a} adopterte {b}',
      parent: '{a} er forelder til {b}',
      generic: '{a} – {b}',
      directed: '{a} er {b}s {role}',
      symmetric: '{a} og {b}: {type}'
    },
    err: {
      chooseBoth: 'Velg begge personene.',
      self: 'En person kan ikke kobles til seg selv.',
      exists: 'Denne relasjonen finnes allerede.',
      couldNotSave: 'Kunne ikke lagre.'
    },
    kind: {
      marriage: 'ekteskap',
      adoption: 'adopsjon',
      parentChild: 'forelder–barn'
    }
  },
  app: {
    homepage: 'Hjemmeside',
    exportFailed: 'Eksporten mislyktes',
    langName: {
      en: 'Engelsk',
      'zh-Hans': 'Forenklet kinesisk',
      'zh-Hant': 'Tradisjonell kinesisk',
      nb: 'Norsk'
    }
  },
  scenes: {
    label: 'Scener',
    add: 'Ny scene',
    duplicate: 'Dupliser gjeldende scene',
    remove: 'Slett scene'
  },
  commands: {
    searchPh: 'Gå til en person…',
    unnamed: 'Uten navn',
    born: 'f. {year}',
    noMatches: 'Ingen treff'
  },
  exportModal: {
    title: 'Eksporter bilde',
    sub: 'Lag et bilde av prosjektet og lagre det hvor du vil',
    closeEsc: 'Lukk (Esc)',
    dragReframe: 'Dra for å flytte utsnittet',
    dragFrame: 'Dra for å ramme inn delen du vil ha',
    empty: 'Ingenting å avbilde i {view}-visningen ennå.',
    cropped: 'Beskåret',
    reset: 'Tilbakestill',
    view: 'Visning',
    size: 'Størrelse',
    preset: {
      fhd: 'Full HD',
      qhd: 'QHD',
      '4k': '4K UHD',
      square: 'Kvadrat',
      portrait: 'Stående',
      a4: 'Utskrift A4 · 300 dpi'
    },
    custom: 'Egendefinert…',
    format: 'Format',
    quality: 'Kvalitet',
    colours: 'Farger',
    noAlpha: 'JPEG støtter ikke gjennomsiktighet – velg PNG eller WebP',
    scheme: {
      app: 'Som appen',
      none: 'Ingen'
    },
    tint: 'Stemningsfarge',
    margin: 'Marg',
    text: 'Tekst',
    titlePh: 'Tittel (vises i bildet)',
    subtitlePh: 'Undertittel (valgfri)',
    stamp: 'Hjørnestempel – {stamp}',
    crop: 'Beskjær',
    done: 'Ferdig',
    saved: 'Lagret',
    rendering: 'Gjengir…',
    download: 'Last ned',
    defaultStamp: 'Slektstre'
  },
  auth: {
    termsPrivacy: 'Vilkår og personvern',
    home: 'Hjem',
    back: 'Tilbake',
    loginSubtitle: 'Velkommen tilbake – logg inn for å fortsette',
    registerSubtitle: 'Opprett en konto for å starte treet ditt',
    signIn: 'Logg inn',
    createAccount: 'Opprett konto',
    username: 'Brukernavn',
    password: 'Passord',
    hidePassword: 'Skjul passord',
    showPassword: 'Vis passord',
    confirmPassword: 'Bekreft passord',
    agreePre: 'Jeg godtar',
    terms: 'vilkårene',
    agreeAnd: 'og',
    privacyPolicy: 'personvernerklæringen',
    agreePost: '',
    or: 'eller',
    guest: 'Fortsett som gjest',
    guestNote: 'Utforsk med eksempeldata – avansert modus forblir låst.',
    footPre: 'Dataene dine blir på denne enheten – se',
    footPost: '',
    strength: {
      tooShort: 'For kort',
      okay: 'Ok',
      good: 'Bra',
      strong: 'Sterkt'
    },
    err: {
      mismatch: 'Passordene er ikke like',
      acceptTerms: 'Godta vilkårene og personvernerklæringen',
      generic: 'Noe gikk galt',
      guest: 'Kunne ikke starte en gjesteøkt',
      usernameMin: 'Brukernavnet må ha minst {n} tegn',
      usernameMax: 'Brukernavnet kan ha høyst {n} tegn',
      usernameChars:
        'Brukernavnet kan bare inneholde bokstaver, tall, punktum, bindestrek og understrek',
      passwordMin: 'Passordet må ha minst {n} tegn',
      passwordMax: 'Passordet kan ha høyst {n} tegn',
      taken: 'Det brukernavnet er allerede tatt',
      invalid: 'Ugyldig brukernavn eller passord',
      locked: 'For mange mislykkede forsøk – prøv igjen om noen minutter'
    },
    email: 'E-post',
    emailPh: 'deg@eksempel.no',
    sb: {
      createTitle: 'Opprett kontoen din',
      welcomeTitle: 'Velkommen tilbake',
      createSub: 'Registrer deg for å begynne å bygge trærne dine.',
      welcomeSub: 'Logg inn til trærne dine.',
      wait: 'Vent litt…',
      signUp: 'Registrer deg',
      haveAccount: 'Har du allerede en konto?',
      noAccount: 'Ingen konto ennå?',
      genericError: 'Noe gikk galt. Prøv igjen.',
      confirmSent:
        'Vi har sendt en bekreftelseslenke til {email}. Bekreft den, og logg deretter inn.'
    }
  },
  ui: {
    search: 'Søk…',
    clearSearch: 'Tøm søk',
    icon: 'Ikon',
    noIcon: 'Ingen ikon',
    searchIcons: 'Søk i alle ikoner…',
    noIconMatch: 'Ingen ikoner samsvarer med «{query}».'
  },
  storeMsg: {
    welcome: 'Velkommen',
    welcomeName: 'Velkommen, {name}',
    welcomeGuest: 'Velkommen, gjest',
    growingTree: 'Lar slektstreet ditt vokse…',
    notProjectFile: 'Ikke en prosjektfil',
    opening: 'Åpner {name}',
    switchingProject: 'Bytter prosjekt…',
    loadingData: 'Laster personer og relasjoner…',
    yourProfile: 'Profilen din',
    gatheringAccount: 'Henter kontoen din…',
    signingOut: 'Logger ut…',
    seeYouSoon: 'Vi ses snart'
  },
  home: {
    born: 'f. {year}',
    nav: {
      features: 'Funksjoner',
      views: 'Visninger',
      explore: 'Utforsk',
      about: 'Om',
      openEditor: 'Åpne editoren',
      signIn: 'Logg inn',
      getStarted: 'Kom i gang'
    },
    hero: {
      eyebrow: 'Hver familie er et univers',
      titleWords: ['Gjør', 'familien', 'din', 'om', 'til', 'et', '*levende', '*stjernebilde.'],
      titleLabel: 'Gjør familien din om til et levende stjernebilde.',
      sub: 'Kartlegg ekte forfedre eller oppdiktede dynastier. Se livsløp utfolde seg på en filmatisk tidslinje, samle slekt i glødende hus, og svev gjennom treet ditt i 3D — silkemykt selv med tusenvis av mennesker.',
      ctaOpen: 'Åpne treet ditt',
      ctaStart: 'Start treet ditt — gratis',
      ctaDemo: 'Prøv live-demoen',
      demoError: 'Kunne ikke starte demoen — prøv igjen',
      trust: 'Gratis for alltid · Privat som standard · Skrivebord og nett',
      scroll: 'Rull ned',
      hint: 'Psst — klikk på himmelen'
    },
    features: {
      kicker: 'Hvorfor det føles annerledes',
      titleLead: 'Slektshistorie, men ',
      titleEm: 'levende',
      titleTail: '.',
      sub: 'De fleste slektstreverktøy føles som skatteprogrammer. Dette føles som en nattehimmel du får ordne selv.',
      items: {
        breathes: {
          title: 'Et tre som puster',
          text: 'Fysikkdrevne grafer: dra i en besteforelder, og hele familien svaier. Fem oppsett, fra strenge generasjoner til fritt svevende rom.'
        },
        time: {
          title: 'Tidsreise',
          text: 'Dra i tidsglideren og se folk dukke opp, gifte seg og bli gamle. Livslinjer, ekteskapsbånd og fødselsgnister — alt animert.'
        },
        houses: {
          title: 'Hus og klaner',
          text: 'Tagg hvem som helst inn i grupper — gårder, dynastier, skipsmannskaper — og se dem samle seg i glødende klynger du kan flytte rundt på.'
        },
        faces: {
          title: 'Ansikter og historier',
          text: 'Portretter, bilder, datoer og notater på hver person. Bygg hele familiens persongalleri, ikke bare en liste med navn.'
        },
        smooth: {
          title: 'Absurd glatt',
          text: 'Alt er WebGL. Ti tusen slektninger glir i 60 fps, bakgrunnsanimasjoner bruker 0 % CPU i hvile, og visninger skifter som scener i en film.'
        },
        yours: {
          title: 'Ditt, punktum',
          text: 'Privat som standard og fungerer uten nett. Dataene dine bor hos deg og kan eksporteres til en vanlig fil. Ingen reklame, ingen datagraving, ingen kredittkort.'
        }
      }
    },
    views: {
      kicker: 'Fem linser',
      titleLead: 'Én familie. ',
      titleEm: 'Fem måter å se den på.',
      sub: 'Se de samme tolv personene ordne seg på nytt — dette er live, bare klikk i vei.'
    },
    stats: {
      people: 'personer i ett tre — fortsatt silkemykt',
      lenses: 'linser på hver familie',
      languages: 'språk, tre temaer',
      fps: 'med bakgrunnsanimasjon på 0 % CPU i hvile'
    },
    marquee: {
      title: 'Plass til alle slags familier'
    },
    explore: {
      kicker: 'Fellesskap · kommer snart',
      titleLead: 'Utforsk ',
      titleEm: 'familieuniverser',
      titleTail: '.',
      sub: 'En titt på hva slags trær folk dyrker. Utforsking, likes, kommentarer og følging kommer sammen med nettversjonen — hvert omslag under er generert kunst, ikke skjermbilder.'
    },
    about: {
      kicker: 'Om skaperen',
      title: 'Håndlaget av én person som mener slektshistorie fortjener bedre programvare.',
      body: 'Hei — jeg heter Tommy. Jeg lagde {app} fordi min egen familie nektet å passe inn i et regneark, og alle verktøyene jeg prøvde føltes som å fylle ut skjemaer. Ikke noe selskap bak, ingen sporing, ingen risikokapital — bare et langt kjærlighetsprosjekt, sendt ut fra Norge. Får det deg til å kartlegge noen du er glad i (eller et dynasti du fant på klokka to om natta), gjør det jobben sin.',
      hello: 'Si hei',
      idea: 'Foreslå en funksjon'
    },
    final: {
      titleAuthed: 'Familien din venter.',
      titleGuest: 'Begynn familiens historie.',
      subAuthed: 'Hopp tilbake i editoren og la stjernebildet vokse videre.',
      subGuest: 'Om to minutter kan de tre første generasjonene dine være på lerretet.',
      ctaAuthed: 'Tilbake til treet ditt',
      ctaGuest: 'Start treet ditt — det er gratis',
      note: 'Ingen nedlasting · Ingen kredittkort · Bare menneskene dine'
    },
    footer: {
      tag: 'Hver familie er et stjernebilde.',
      product: 'Produkt',
      maker: 'Skaper',
      legal: 'Juridisk',
      contact: 'Kontakt',
      terms: 'Bruksvilkår',
      privacy: 'Personvernerklæring',
      madeWith: 'Laget med',
      madeAfter: 'og null risikokapital',
      love: 'kjærlighet'
    },
    showcase: {
      live: 'Live',
      sep: ' — ',
      spaceName: '3D-rom',
      groups: {
        farm: 'Gården',
        seafarers: 'Sjøfolk',
        musicians: 'Musikere'
      },
      views: {
        tree: {
          title: 'Den levende grafen',
          caption: 'et fysikkdrevet nett av alle — dra i noen, og hele familien svaier.'
        },
        timeline: {
          title: 'Livslinjer',
          caption:
            'hver person blir et livsløp — se hvem som levde samtidig, og hvem som aldri møttes.'
        },
        groups: {
          title: 'Hus og klaner',
          caption: 'tagg folk inn i grupper og se dem samle seg i glødende stjernebilder.'
        },
        grid: {
          title: 'Katalogen',
          caption:
            'et søkbart kartotek over hele persongalleriet — laget for å bla gjennom tusenvis.'
        },
        space: {
          title: 'Rommodus',
          caption: 'den eksperimentelle linsen — dynastiet ditt svevende i tre dimensjoner.'
        }
      }
    },
    gallery: {
      filters: {
        all: 'Alle',
        trending: 'Populært',
        fictional: 'Fiksjon',
        historical: 'Historisk',
        personal: 'Personlig'
      },
      badges: {
        trending: 'Populært',
        staffPick: 'Redaksjonens valg',
        new: 'Ny'
      },
      coverMeta: '{people} personer · {generations} generasjoner',
      peoplePill: '{people} personer',
      liked: 'Likt! (synkronisering med fellesskapet kommer snart)',
      like: 'Lik',
      comments: 'Kommentarer',
      favorites: 'Favoritter',
      followers: 'Følgere',
      close: 'Lukk',
      peekTitle: 'Fellesskapsutforsking er nesten her',
      peekBody:
        'Snart kan du gå inn i trær som dette — utforske dem visning for visning, følge skaperne, legge igjen kommentarer og favorittmerke familiene du liker.',
      follow: 'Følg',
      comment: 'Kommenter',
      favorite: 'Favoritt',
      cta: 'Start ditt eget tre i stedet',
      ago: {
        m: '{n} min siden',
        h: '{n} t siden',
        d: '{n} d siden'
      }
    },
    projects: {
      atreides: {
        title: 'Huset Atreides',
        blurb: 'Fra hertug Leto til Leto II — hver blodslinje på Arrakis, kartlagt.'
      },
      medici: {
        title: 'Medici-dynastiet',
        blurb: 'Bankfolk, paver og mesener — renessansens Firenze i én graf.'
      },
      vestlandet: {
        title: 'Slekta mi — Vestlandet',
        blurb: 'Fire gårder, sju generasjoner og én svært sta grandtante.'
      },
      westeros: {
        title: 'Westeros: De store husene',
        blurb: 'Stark, Targaryen, Lannister — allianser, svik og alt imellom.'
      },
      bronte: {
        title: 'Brontë-kretsen',
        blurb: 'Prestegården i Haworth og alle som noen gang gikk gjennom den.'
      },
      kattegat: {
        title: 'Kattegat-blodslinjer',
        blurb: 'Ragnars sønner og sagaene mellom dem, tokt for tokt.'
      },
      village: {
        title: 'Bestemors landsby',
        blurb: 'Hver familie i én kretisk fjellside, tilbake til 1840.'
      },
      bridgerton: {
        title: 'Bridgerton-kretsen',
        blurb: 'Åtte søsken, én dronning og hele societeten — kjære leser.'
      },
      romanov: {
        title: 'Romanovene: De siste tsarene',
        blurb: 'Tre århundrer med keiserslekten, med slutt i Jekaterinburg.'
      },
      corleone: {
        title: 'La Famiglia Corleone',
        blurb: 'Forretninger, aldri personlig — fra Sicilia til Lake Tahoe.'
      },
      curie: {
        title: 'Curie-arven',
        blurb: 'Fem nobelpriser i ett slektstre. Ikke noe press, unger.'
      },
      durin: {
        title: 'Midgard: Durins ætt',
        blurb: 'Dvergenes sju fedre og hvert eneste skjegg imellom.'
      }
    }
  },
  characterX: {
    parts: {
      afro: 'Afro',
      angry: 'Sint',
      arched: 'Buet',
      armor: 'Rustning',
      backpack: 'Ryggsekk',
      bags: 'Øyeposer',
      balloon: 'Ballong',
      bandage: 'Bandasje',
      bandaid: 'Plaster',
      bandaids: 'Plastre',
      batwings: 'Flaggermusvinger',
      beanie: 'Strikkelue',
      bell: 'Sleng',
      beret: 'Alpelue',
      blazer: 'Blazer',
      blep: 'Tunge ut',
      blush: 'Rødme',
      bob: 'Bob',
      boots: 'Støvler',
      bow: 'Sløyfe',
      bowl: 'Potteklipp',
      bowtie: 'Tversoversløyfe',
      braid: 'Flette',
      buns: 'Knuter',
      button: 'Knappenese',
      cap: 'Caps',
      cape: 'Kappe',
      cat: 'Kattemunn',
      catears: 'Katteører',
      chin: 'Hakeskjegg',
      choker: 'Choker',
      chubby: 'Lubben',
      circlet: 'Diadem',
      closed: 'Lukket',
      coat: 'Frakk',
      cowboy: 'Cowboyhatt',
      crown: 'Krone',
      cuffed: 'Brettet',
      curly: 'Krøllete',
      diamond: 'Diamant',
      dot: 'Prikk',
      dots: 'Prikker',
      dress: 'Kjole',
      earrings: 'Øreringer',
      egg: 'Eggform',
      elf: 'Alv',
      eyepatch: 'Øyelapp',
      facemask: 'Munnbind',
      fang: 'Hoggtann',
      fedora: 'Fedora',
      flattop: 'Flattop',
      flower: 'Blomst',
      foxmask: 'Revemaske',
      foxtail: 'Revehale',
      freckles: 'Fregner',
      frown: 'Surmule',
      full: 'Fyldig',
      gakuran: 'Gakuran',
      geta: 'Geta',
      glasses: 'Briller',
      goatee: 'Bukkeskjegg',
      gown: 'Gallakjole',
      grin: 'Glis',
      hairclip: 'Hårspenne',
      hakama: 'Hakama',
      halo: 'Glorie',
      happy: 'Glad',
      headband: 'Hårbånd',
      headphones: 'Hodetelefoner',
      heart: 'Hjerte',
      hearts: 'Hjerter',
      heels: 'Høye hæler',
      hime: 'Hime',
      hooded: 'Tunge øyelokk',
      hoodie: 'Hettegenser',
      idol: 'Idol',
      jacket: 'Jakke',
      jeans: 'Jeans',
      jetpack: 'Jetpakke',
      kimono: 'Kimono',
      kneesocks: 'Knestrømper',
      lash: 'Vipper',
      lashes: 'Lange vipper',
      leggings: 'Leggings',
      loafers: 'Loafers',
      long: 'Lang',
      longbangs: 'Lang lugg',
      longskirt: 'Langt skjørt',
      maryjanes: 'Mary Jane-sko',
      messy: 'Rufsete',
      mohawk: 'Hanekam',
      mole: 'Føflekk',
      monocle: 'Monokkel',
      monolid: 'Enkelt øyelokk',
      mustache: 'Bart',
      necklace: 'Halskjede',
      neutral: 'Nøytral',
      none: 'Ingen',
      o: 'O-munn',
      open: 'Åpen',
      oval: 'Oval',
      overalls: 'Snekkerbukse',
      oxfords: 'Oxford-sko',
      paint: 'Maling',
      pants: 'Bukse',
      party: 'Festhatt',
      pearls: 'Perler',
      pirate: 'Pirathatt',
      plaid: 'Rutete',
      pleated: 'Plissert',
      pointy: 'Spiss',
      ponytail: 'Hestehale',
      pout: 'Trutmunn',
      puffy: 'Pösete',
      quiver: 'Pilkogger',
      rainboots: 'Gummistøvler',
      raised: 'Hevet',
      ribbon: 'Bånd',
      robe: 'Kjortel',
      roman: 'Romersk',
      round: 'Rund',
      sad: 'Trist',
      sailor: 'Matros',
      sandals: 'Sandaler',
      scar: 'Arr',
      scarf: 'Skjerf',
      shades: 'Solbriller',
      sharp: 'Skarp',
      short: 'Kort',
      shorts: 'Shorts',
      sidepart: 'Sideskill',
      skirt: 'Skjørt',
      sleepy: 'Søvnig',
      slickback: 'Bakoverstrøket',
      slim: 'Smal',
      slippers: 'Tøfler',
      small: 'Liten',
      smile: 'Smil',
      smirk: 'Lurt smil',
      sneakers: 'Joggesko',
      soft: 'Myk',
      spark: 'Gnist',
      spiky: 'Piggete',
      square: 'Firkantet',
      star: 'Stjerne',
      stars: 'Stjerner',
      straight: 'Rett',
      stripes: 'Striper',
      stubble: 'Skjeggstubb',
      suit: 'Dress',
      sweater: 'Genser',
      sword: 'Sverd',
      tail: 'Hale',
      tank: 'Singlet',
      tareme: 'Hengende',
      tee: 'T-skjorte',
      teeth: 'Tenner',
      thick: 'Tykk',
      thighhigh: 'Lårhøye',
      tights: 'Strømpebukse',
      tiny: 'Bitteliten',
      tongue: 'Tunge',
      toothy: 'Tannglis',
      top: 'Flosshatt',
      triangle: 'Trekant',
      tsurime: 'Skrå',
      tunic: 'Tunika',
      twintails: 'Doble hestehaler',
      undercut: 'Undercut',
      unibrow: 'Sammenvokst',
      uniform: 'Uniform',
      wavy: 'Bølgete',
      wide: 'Bred',
      wings: 'Vinger',
      wink: 'Blunk',
      witch: 'Heksehatt',
      wizard: 'Trollmannsskjegg'
    },
    partIds: {
      'beard-full': 'Fullskjegg'
    }
  },
  human3dX: {
    reset: 'Tilbakestill'
  },
  pagesX: {
    couldNotRename: 'Kunne ikke gi nytt navn',
    couldNotSave: 'Kunne ikke lagre',
    couldNotDuplicate: 'Kunne ikke duplisere',
    couldNotChangePassword: 'Kunne ikke endre passordet',
    sandbox: 'SANDKASSE',
    quotaDetail: {
      people: '{n} personer',
      projects: '{n} prosjekter',
      photos: '{n} bilder'
    }
  }
}
