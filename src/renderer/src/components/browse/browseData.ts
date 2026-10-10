// Mock community for the Browse page: creator profiles + their shared
// projects. Real browsing (other accounts' public projects) arrives with the
// hosted backend; until then these stand-ins carry REAL people and
// relationships, so previews, fun facts and forking all work end-to-end —
// grafting one runs the ordinary projects:import path.
//
// People rows are tuples: [id, name, gender, born, died, role?, bio?].
// Relationship rows are a tiny edge DSL parsed by browseModel.parseRel:
//   "a > b"      parent → child       "a >> b"  adoptive parent → child
//   "a = b"      spouses              "a ~ b"   partners
//   "a & b"      siblings (explicit)  "a + b"   friends
//   "a ! b"      rivals               "a ^ b"   a mentors b
//   "a * b"      a likes b            "a _ b"   a is b's superior
// Either side may be a comma list ("dad,mum > kid1,kid2" = every pair).
// Optional modifiers after the pair: "@1509" formed, "|1533" ended, and
// " : label" at the very end for the per-edge label.

import type { ShareAccess } from '../../../../shared/types'

export type Genre = 'anime' | 'tv' | 'history' | 'dynasty' | 'sitcom' | 'myth'
export type Lang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja'
export type PersonRow = [
  id: string,
  name: string,
  gender: 'm' | 'f' | '',
  born: number | null,
  died: number | null,
  role?: string,
  bio?: string
]
/** [profileId, text, daysAgo] */
export type CommentRow = [string, string, number]

export interface BrowseProfile {
  id: string
  username: string
  displayName: string
  avatar: string // UiIcon name
  hue: number
  bio: string
  location: string
  joined: string // YYYY-MM
  followers: number
  following: number
  badges: Array<'staff' | 'historian' | 'otaku' | 'critic' | 'pioneer'>
}

export interface BrowseProject {
  id: string
  title: string
  authorId: string
  genre: Genre
  lang: Lang
  access: ShareAccess
  hue: number
  crest: string // UiIcon name
  era: string
  tags: string[]
  blurb: string
  likes: number
  forks: number
  views: number
  updatedAgo: number // days
  createdAgo: number // days
  badge?: 'staff' | 'trending' | 'new'
  noun?: string
  people: PersonRow[]
  rels: string[]
  groups?: Record<string, string[]>
  comments: CommentRow[]
}

/** Curated shelves. Titles are UI copy, so they carry every locale. */
export interface BrowseCollection {
  id: string
  icon: string // UiIcon name
  hue: number
  title: Record<'en' | 'zh-Hans' | 'zh-Hant', string>
  projectIds: string[]
}

export const PROFILES: BrowseProfile[] = [
  {
    id: 'hokage_archivist',
    username: 'hokage_archivist',
    displayName: 'Konoha Archives',
    avatar: 'scroll',
    hue: 18,
    bio: 'Keeper of scrolls. If a shinobi has a cousin, I have a node for them.',
    location: 'Hidden Leaf Village',
    joined: '2024-03',
    followers: 4210,
    following: 88,
    badges: ['staff', 'otaku']
  },
  {
    id: 'stand_user_77',
    username: 'stand_user_77',
    displayName: 'Yare Yare Genealogy',
    avatar: 'star',
    hue: 280,
    bio: 'Mapping the Joestar curse one part at a time. ゴゴゴゴ',
    location: 'Morioh, S City',
    joined: '2024-07',
    followers: 3380,
    following: 140,
    badges: ['otaku']
  },
  {
    id: 'capsule_corp_intern',
    username: 'capsule_corp_intern',
    displayName: 'Capsule Corp Intern',
    avatar: 'rocket',
    hue: 32,
    bio: 'I count Saiyans for a living. It’s over 9000 and still going.',
    location: 'West City',
    joined: '2025-01',
    followers: 2140,
    following: 311,
    badges: ['otaku', 'pioneer']
  },
  {
    id: 'maester_gyldayn',
    username: 'maester_gyldayn',
    displayName: 'Archmaester Gyldayn',
    avatar: 'scroll-text',
    hue: 0,
    bio: 'Chronicler of the Dance. Sources: Mushroom, Septon Eustace, and vibes.',
    location: 'The Citadel, Oldtown',
    joined: '2023-11',
    followers: 6120,
    following: 12,
    badges: ['critic', 'pioneer']
  },
  {
    id: 'springfield_genealogy',
    username: 'springfield_genealogy',
    displayName: 'Springfield Historical Society',
    avatar: 'house',
    hue: 50,
    bio: 'Est. 1796 by Jebediah Springfield (allegedly). A noble spirit embiggens the smallest tree.',
    location: 'Springfield, USA',
    joined: '2024-09',
    followers: 1890,
    following: 64,
    badges: []
  },
  {
    id: 'waystar_hr',
    username: 'waystar_hr',
    displayName: 'Waystar HR (unofficial)',
    avatar: 'briefcase',
    hue: 215,
    bio: 'Succession planning, literally. Not affiliated with any boar on the floor.',
    location: 'Manhattan',
    joined: '2025-04',
    followers: 1275,
    following: 9,
    badges: ['critic']
  },
  {
    id: 'tudor_rose',
    username: 'tudor_rose',
    displayName: 'Dr. Rosalind Hale',
    avatar: 'flower',
    hue: 345,
    bio: 'Early-modern historian. Six wives, two crowns, zero chill. Every date footnoted.',
    location: 'London',
    joined: '2023-06',
    followers: 8930,
    following: 205,
    badges: ['historian', 'staff', 'pioneer']
  },
  {
    id: 'changan_scribe',
    username: 'changan_scribe',
    displayName: '长安史官',
    avatar: 'feather',
    hue: 12,
    bio: '考据派。唐与三国，一个都不能少。欢迎指正。',
    location: '西安',
    joined: '2024-02',
    followers: 7450,
    following: 96,
    badges: ['historian']
  },
  {
    id: 'forbidden_city_notes',
    username: 'forbidden_city_notes',
    displayName: '紫禁城笔记',
    avatar: 'landmark',
    hue: 42,
    bio: '从洪武到宣统，把六百年装进一张图。宫斗剧爱好者，史料洁癖。',
    location: '北京',
    joined: '2023-12',
    followers: 9820,
    following: 57,
    badges: ['historian', 'staff']
  },
  {
    id: 'tvb_forever',
    username: 'tvb_forever',
    displayName: 'TVB 老友記',
    avatar: 'tv',
    hue: 150,
    bio: '港劇迷，《皆大歡喜》重溫第 38 次。金家大宅係我第二個屋企。',
    location: '香港',
    joined: '2025-02',
    followers: 3060,
    following: 420,
    badges: ['critic']
  },
  {
    id: 'pantheon_lab',
    username: 'pantheon_lab',
    displayName: 'Pantheon Lab',
    avatar: 'zap',
    hue: 200,
    bio: 'Gods are just families with extra lightning. Open grove — bring your favourite demigod.',
    location: 'Mount Olympus (remote)',
    joined: '2024-05',
    followers: 2710,
    following: 77,
    badges: ['pioneer']
  },
  {
    id: 'edo_archive',
    username: 'edo_archive',
    displayName: '江戸アーカイブ',
    avatar: 'library',
    hue: 130,
    bio: '三百年の天下泰平を一枚の図に。将軍家と御三家の系譜を整理中。',
    location: '東京',
    joined: '2024-10',
    followers: 1980,
    following: 33,
    badges: ['historian']
  }
]

export const PROJECTS: BrowseProject[] = [
  // ── Anime ──────────────────────────────────────────────────────────────────
  {
    id: 'uchiha',
    title: 'The Uchiha Clan',
    authorId: 'hokage_archivist',
    genre: 'anime',
    lang: 'en',
    access: 'graft',
    hue: 355,
    crest: 'flame',
    era: 'Warring States → Boruto era',
    tags: ['naruto', 'ninja', 'sharingan', 'clan', 'shinobi', 'rivalry', '宇智波', 'うちは'],
    blurb:
      'From Indra’s rebellion to Sarada’s glasses — every Sharingan, every grudge, every brother.',
    likes: 5820,
    forks: 412,
    views: 98000,
    updatedAgo: 0.08,
    createdAgo: 410,
    badge: 'trending',
    noun: 'Shinobi',
    people: [
      ['hagoromo', 'Hagoromo Ōtsutsuki', 'm', null, null, 'Sage of Six Paths'],
      ['indra', 'Indra Ōtsutsuki', 'm', null, null, 'Progenitor of the Uchiha'],
      ['asura', 'Asura Ōtsutsuki', 'm', null, null, 'Progenitor of the Senju'],
      ['tajima', 'Tajima Uchiha', 'm', null, null, 'Clan head, Warring States'],
      ['madara', 'Madara Uchiha', 'm', null, null, 'Co-founder of Konoha'],
      ['izuna', 'Izuna Uchiha', 'm', null, null, 'Madara’s younger brother'],
      ['hashirama', 'Hashirama Senju', 'm', null, null, 'First Hokage'],
      ['fugaku', 'Fugaku Uchiha', 'm', null, null, 'Captain, Konoha Military Police'],
      ['mikoto', 'Mikoto Uchiha', 'f', null, null, 'Former jōnin'],
      ['itachi', 'Itachi Uchiha', 'm', null, null, 'Akatsuki · double agent'],
      ['shisui', 'Shisui Uchiha', 'm', null, null, 'Shisui of the Body Flicker'],
      ['sasuke', 'Sasuke Uchiha', 'm', null, null, 'The Shadow Hokage'],
      ['sakura', 'Sakura Haruno', 'f', null, null, 'Medical ninja'],
      ['sarada', 'Sarada Uchiha', 'f', null, null, 'Aspiring Hokage'],
      ['obito', 'Obito Uchiha', 'm', null, null, 'The masked man'],
      ['kakashi', 'Kakashi Hatake', 'm', null, null, 'Sixth Hokage'],
      ['naruto', 'Naruto Uzumaki', 'm', null, null, 'Seventh Hokage']
    ],
    rels: [
      'hagoromo > indra,asura',
      'indra ! asura : the first rivalry',
      'tajima > madara,izuna',
      'madara ! hashirama : Valley of the End',
      'fugaku = mikoto',
      'fugaku,mikoto > itachi,sasuke',
      'sasuke = sakura',
      'sasuke,sakura > sarada',
      'itachi + shisui',
      'madara ^ obito',
      'obito + kakashi : teammates',
      'kakashi ^ sasuke',
      'sasuke ! naruto : rivals & brothers-in-arms'
    ],
    groups: {
      Mangekyō: ['madara', 'izuna', 'shisui', 'itachi', 'sasuke', 'obito', 'kakashi'],
      Hokage: ['hashirama', 'kakashi', 'naruto']
    },
    comments: [
      [
        'stand_user_77',
        'The Indra/Asura → Madara/Hashirama parallel reads SO well in the tree view.',
        2
      ],
      ['capsule_corp_intern', 'Grafted this to add the Boruto timeline. Thank you!', 5]
    ]
  },
  {
    id: 'joestar',
    title: 'The Joestar Bloodline',
    authorId: 'stand_user_77',
    genre: 'anime',
    lang: 'en',
    access: 'seedbank',
    hue: 272,
    crest: 'star',
    era: '1868 → 2012',
    tags: ['jojo', 'stands', 'hamon', 'bizarre', 'vampire', 'rivalry', 'ジョジョ', 'JOJO'],
    blurb:
      'Six generations, one star-shaped birthmark — plus the vampire who stole a body and still fathered Giorno.',
    likes: 4410,
    forks: 0,
    views: 71200,
    updatedAgo: 0.6,
    createdAgo: 380,
    people: [
      ['george1', 'George Joestar I', 'm', null, 1888, 'English nobleman'],
      ['jonathan', 'Jonathan Joestar', 'm', 1868, 1889, 'Part 1 · Phantom Blood'],
      ['erina', 'Erina Pendleton', 'f', null, null, 'Jonathan’s wife'],
      ['dio', 'Dio Brando', 'm', 1867, 1989, 'Vampire · adopted son'],
      ['george2', 'George Joestar II', 'm', 1889, null, 'RAF pilot'],
      ['lisalisa', 'Elizabeth “Lisa Lisa” Joestar', 'f', null, null, 'Hamon master'],
      ['joseph', 'Joseph Joestar', 'm', 1920, null, 'Part 2 · Battle Tendency'],
      ['suzi', 'Suzi Q', 'f', null, null, 'Joseph’s wife'],
      ['caesar', 'Caesar Zeppeli', 'm', 1918, 1939, 'Joseph’s best friend'],
      ['holy', 'Holy Kujo', 'f', null, null, 'Jotaro’s mother'],
      ['sadao', 'Sadao Kujo', 'm', null, null, 'Jazz musician'],
      ['jotaro', 'Jotaro Kujo', 'm', 1970, null, 'Part 3 · Stardust Crusaders'],
      ['jolyne', 'Jolyne Cujoh', 'f', 1992, null, 'Part 6 · Stone Ocean'],
      ['tomoko', 'Tomoko Higashikata', 'f', null, null, 'Josuke’s mother'],
      ['josuke', 'Josuke Higashikata', 'm', 1983, null, 'Part 4 · Diamond is Unbreakable'],
      ['giorno', 'Giorno Giovanna', 'm', 1985, null, 'Part 5 · Golden Wind']
    ],
    rels: [
      'george1 > jonathan',
      'george1 >> dio',
      'jonathan ! dio : the original feud',
      'jonathan = erina',
      'jonathan,erina > george2',
      'george2 = lisalisa',
      'george2,lisalisa > joseph',
      'lisalisa ^ joseph : hamon training',
      'joseph + caesar',
      'joseph = suzi',
      'joseph,suzi > holy',
      'joseph,tomoko > josuke',
      'holy = sadao',
      'holy,sadao > jotaro',
      'jotaro > jolyne',
      'jotaro ! dio : ORA ORA',
      'dio > giorno'
    ],
    groups: {
      JoJo: ['jonathan', 'joseph', 'jotaro', 'josuke', 'giorno', 'jolyne'],
      'Hamon users': ['jonathan', 'lisalisa', 'joseph', 'caesar']
    },
    comments: [
      [
        'hokage_archivist',
        'Dio → Giorno as a parent edge is technically correct, the best kind of correct.',
        1
      ],
      ['pantheon_lab', 'Downloaded to study the colour scheme. Gorgeous.', 9]
    ]
  },
  {
    id: 'sonfamily',
    title: 'The Son Family & Friends',
    authorId: 'capsule_corp_intern',
    genre: 'anime',
    lang: 'en',
    access: 'grove',
    hue: 30,
    crest: 'biceps-flexed',
    era: 'Age 737 → Age 790',
    tags: [
      'dragon ball',
      'saiyan',
      'kamehameha',
      'martial arts',
      'rivalry',
      'ドラゴンボール',
      '龙珠',
      '七龍珠'
    ],
    blurb:
      'Saiyan dads, human mums and a surprising number of weddings. Open grove — help us add every fusion!',
    likes: 3960,
    forks: 288,
    views: 64000,
    updatedAgo: 0.25,
    createdAgo: 190,
    badge: 'trending',
    noun: 'Fighter',
    people: [
      ['bardock', 'Bardock', 'm', null, null, 'Low-class Saiyan warrior'],
      ['gine', 'Gine', 'f', null, null, 'Saiyan'],
      ['raditz', 'Raditz', 'm', null, null, 'Goku’s older brother'],
      ['goku', 'Son Goku (Kakarot)', 'm', 737, null, 'Earth’s defender'],
      ['chichi', 'Chi-Chi', 'f', null, null, 'Martial artist'],
      ['oxking', 'Ox-King', 'm', null, null, 'Chi-Chi’s father'],
      ['gohan', 'Son Gohan', 'm', 757, null, 'Scholar · Great Saiyaman'],
      ['goten', 'Son Goten', 'm', 767, null, 'Youngest son'],
      ['videl', 'Videl', 'f', 760, null, 'Crime fighter'],
      ['satan', 'Mr. Satan (Hercule)', 'm', null, null, 'World Champion (self-titled)'],
      ['pan', 'Pan', 'f', 779, null, 'Quarter-Saiyan'],
      ['vegeta', 'Vegeta', 'm', 732, null, 'Prince of all Saiyans'],
      ['bulma', 'Bulma', 'f', 733, null, 'Capsule Corp genius'],
      ['trunks', 'Trunks', 'm', 766, null, 'Capsule Corp heir'],
      ['bulla', 'Bulla', 'f', null, null, 'Vegeta’s daughter'],
      ['roshi', 'Master Roshi', 'm', null, null, 'Turtle Hermit'],
      ['krillin', 'Krillin', 'm', 736, null, 'Strongest human'],
      ['android18', 'Android 18', 'f', null, null, 'Former Red Ribbon android'],
      ['marron', 'Marron', 'f', null, null, 'Krillin’s daughter']
    ],
    rels: [
      'bardock = gine',
      'bardock,gine > raditz,goku',
      'goku = chichi',
      'oxking > chichi',
      'goku,chichi > gohan,goten',
      'gohan = videl',
      'satan > videl',
      'gohan,videl > pan',
      'vegeta = bulma',
      'vegeta,bulma > trunks,bulla',
      'goku ! vegeta : eternal rivals',
      'roshi ^ goku,krillin',
      'goku + krillin : best friends',
      'krillin = android18',
      'krillin,android18 > marron',
      'goten + trunks : Gotenks'
    ],
    groups: {
      Saiyans: ['bardock', 'gine', 'raditz', 'goku', 'vegeta'],
      'Turtle School': ['roshi', 'goku', 'krillin']
    },
    comments: [
      [
        'springfield_genealogy',
        'Joined the grove to add the Ginyu Force. They deserve a family too.',
        0.5
      ],
      ['stand_user_77', 'The goku ! vegeta edge has 40 comments on its own lol', 3]
    ]
  },

  // ── TV & film ──────────────────────────────────────────────────────────────
  {
    id: 'targaryen',
    title: 'House Targaryen: The Dance',
    authorId: 'maester_gyldayn',
    genre: 'tv',
    lang: 'en',
    access: 'graft',
    hue: 2,
    crest: 'egg',
    era: '34 AC → 172 AC',
    tags: [
      'house of the dragon',
      'targaryen',
      'dragons',
      'civil war',
      'fire & blood',
      'westeros',
      '龙家族',
      '坦格利安'
    ],
    blurb:
      'Blacks vs Greens, one Iron Throne. Every claim colour-coded by the side you’d back at the Dance.',
    likes: 6710,
    forks: 530,
    views: 122000,
    updatedAgo: 1.2,
    createdAgo: 640,
    badge: 'staff',
    people: [
      ['jaehaerys', 'Jaehaerys I', 'm', 34, 103, 'The Conciliator'],
      ['alysanne', 'Alysanne', 'f', 36, 100, 'Good Queen Alysanne'],
      ['aemon', 'Prince Aemon', 'm', null, 92, 'Heir who died young'],
      ['baelon', 'Prince Baelon', 'm', null, 101, 'The Spring Prince'],
      ['alyssa', 'Alyssa Targaryen', 'f', null, null, 'Baelon’s wife'],
      ['rhaenys', 'Rhaenys', 'f', 74, 129, 'The Queen Who Never Was'],
      ['corlys', 'Corlys Velaryon', 'm', null, null, 'The Sea Snake'],
      ['viserys', 'Viserys I', 'm', 77, 129, 'King of the Seven Kingdoms'],
      ['daemon', 'Daemon Targaryen', 'm', 81, 130, 'The Rogue Prince'],
      ['aemma', 'Aemma Arryn', 'f', null, 105, 'Viserys’ first queen'],
      ['alicent', 'Alicent Hightower', 'f', 88, 133, 'Queen · leader of the Greens'],
      ['rhaenyra', 'Rhaenyra Targaryen', 'f', 97, 130, 'The Realm’s Delight'],
      ['laenor', 'Laenor Velaryon', 'm', 94, 120, 'Rhaenyra’s first husband'],
      ['laena', 'Laena Velaryon', 'f', 93, 120, 'Rider of Vhagar'],
      ['aegon2', 'Aegon II', 'm', 107, 131, 'Crowned by the Greens'],
      ['helaena', 'Helaena Targaryen', 'f', 109, 130, 'The dreamer'],
      ['aemond', 'Aemond One-Eye', 'm', 110, 130, 'Kinslayer'],
      ['daeron', 'Daeron the Daring', 'm', 114, 130, 'Youngest Green prince'],
      ['jace', 'Jacaerys Velaryon', 'm', 114, 130, 'Prince of Dragonstone'],
      ['luke', 'Lucerys Velaryon', 'm', 115, 129, 'Heir to Driftmark'],
      ['joffrey', 'Joffrey Velaryon', 'm', 117, 130, 'Youngest Velaryon son'],
      ['baela', 'Baela Targaryen', 'f', 116, null, 'Daemon’s daughter'],
      ['rhaena', 'Rhaena Targaryen', 'f', 116, null, 'Daemon’s daughter'],
      ['aegon3', 'Aegon III', 'm', 120, 157, 'The Dragonbane'],
      ['viserys2', 'Viserys II', 'm', 122, 172, 'Hand of the King']
    ],
    rels: [
      'jaehaerys = alysanne',
      'jaehaerys,alysanne > aemon,baelon',
      'baelon = alyssa',
      'baelon,alyssa > viserys,daemon',
      'aemon > rhaenys',
      'rhaenys = corlys',
      'rhaenys,corlys > laenor,laena',
      'viserys = aemma',
      'viserys,aemma > rhaenyra',
      'viserys = alicent @106',
      'viserys,alicent > aegon2,helaena,aemond,daeron',
      'aegon2 = helaena',
      'rhaenyra = laenor @114 |120',
      'rhaenyra > jace,luke,joffrey',
      'daemon = laena |120',
      'daemon,laena > baela,rhaena',
      'rhaenyra = daemon @120',
      'rhaenyra,daemon > aegon3,viserys2',
      'jace = baela : betrothed',
      'rhaenyra ! alicent : friends turned rivals',
      'aegon2 ! rhaenyra : the Dance of the Dragons',
      'aemond ! luke : Storm’s End'
    ],
    groups: {
      Blacks: [
        'rhaenyra',
        'daemon',
        'jace',
        'luke',
        'joffrey',
        'aegon3',
        'viserys2',
        'baela',
        'rhaena',
        'rhaenys',
        'corlys'
      ],
      Greens: ['alicent', 'aegon2', 'helaena', 'aemond', 'daeron'],
      Kings: ['jaehaerys', 'viserys', 'aegon2', 'aegon3']
    },
    comments: [
      [
        'tudor_rose',
        'As a historian of actual succession crises: this is disturbingly accurate.',
        1
      ],
      ['forbidden_city_notes', '这比九子夺嫡还乱！已嫁接到我的项目里对比。', 4],
      ['waystar_hr', 'Honestly the Roys would fit right in.', 6]
    ]
  },
  {
    id: 'roys',
    title: 'The Roys of Waystar Royco',
    authorId: 'waystar_hr',
    genre: 'tv',
    lang: 'en',
    access: 'glasshouse',
    hue: 214,
    crest: 'briefcase-business',
    era: '1938 → 2023',
    tags: [
      'succession',
      'media empire',
      'drama',
      'business',
      'rivalry',
      'hbo',
      '继承之战',
      '繼承之戰'
    ],
    blurb:
      'Who gets the company? Every heir, spouse and Cousin Greg, with loyalties that change every episode. Look, don’t touch.',
    likes: 2890,
    forks: 0,
    views: 40300,
    updatedAgo: 3,
    createdAgo: 300,
    people: [
      ['logan', 'Logan Roy', 'm', 1938, 2023, 'Founder & CEO, Waystar Royco'],
      ['ewan', 'Ewan Roy', 'm', null, null, 'Logan’s principled brother'],
      ['marianne', 'Marianne Hirsch', 'f', null, null, 'Ewan’s daughter'],
      ['greg', 'Greg Hirsch', 'm', null, null, 'Cousin Greg'],
      ['connor', 'Connor Roy', 'm', null, null, 'Presidential candidate (1%)'],
      ['willa', 'Willa Ferreyra', 'f', null, null, 'Playwright'],
      ['caroline', 'Lady Caroline Collingwood', 'f', null, null, 'Logan’s second wife'],
      ['marcia', 'Marcia Roy', 'f', null, null, 'Logan’s third wife'],
      ['kendall', 'Kendall Roy', 'm', null, null, 'Number one boy'],
      ['rava', 'Rava Roy', 'f', null, null, 'Kendall’s ex-wife'],
      ['roman', 'Roman Roy', 'm', null, null, 'COO (briefly)'],
      ['shiv', 'Siobhan “Shiv” Roy', 'f', null, null, 'Political strategist'],
      ['tom', 'Tom Wambsgans', 'm', null, null, 'CEO, eventually'],
      ['gerri', 'Gerri Kellman', 'f', null, null, 'General counsel']
    ],
    rels: [
      'logan & ewan',
      'ewan > marianne',
      'marianne > greg',
      'logan > connor',
      'connor = willa',
      'logan = caroline : divorced',
      'logan,caroline > kendall,roman,shiv',
      'logan = marcia',
      'kendall = rava : divorced',
      'shiv = tom',
      'kendall ! logan : the boar on the floor',
      'shiv ! kendall',
      'tom ^ greg : disgusting brothers',
      'gerri ^ roman : it’s complicated'
    ],
    groups: {
      'Board votes': ['logan', 'kendall', 'roman', 'shiv', 'connor', 'gerri']
    },
    comments: [
      ['maester_gyldayn', 'Glasshouse mode is the only mode Logan would ever allow.', 2],
      ['tvb_forever', '想嫁接但係唔俾', 8]
    ]
  },

  // ── Sitcoms & dramas ──────────────────────────────────────────────────────
  {
    id: 'simpsons',
    title: 'The Simpsons of Evergreen Terrace',
    authorId: 'springfield_genealogy',
    genre: 'sitcom',
    lang: 'en',
    access: 'seedbank',
    hue: 50,
    crest: 'sofa',
    era: 'Three generations, forever the same age',
    tags: ['simpsons', 'springfield', 'animation', 'cartoon', 'comedy', '辛普森'],
    blurb:
      'Three generations on one couch — including the long-lost half-brother and both Bouvier sisters.',
    likes: 3320,
    forks: 0,
    views: 58100,
    updatedAgo: 2,
    createdAgo: 510,
    people: [
      ['abe', 'Abraham “Grampa” Simpson', 'm', null, null, 'WWII veteran'],
      ['mona', 'Mona Simpson', 'f', null, null, 'Activist on the run'],
      ['homer', 'Homer Simpson', 'm', null, null, 'Safety Inspector, Sector 7G'],
      ['herb', 'Herb Powell', 'm', null, null, 'Homer’s half-brother'],
      ['clancy', 'Clancy Bouvier', 'm', null, null, 'Flight attendant'],
      ['jackie', 'Jacqueline Bouvier', 'f', null, null, 'Marge’s mother'],
      ['marge', 'Marge Simpson', 'f', null, null, 'Homemaker, painter, cop (once)'],
      ['patty', 'Patty Bouvier', 'f', null, null, 'DMV'],
      ['selma', 'Selma Bouvier', 'f', null, null, 'DMV'],
      ['ling', 'Ling Bouvier', 'f', null, null, 'Selma’s adopted daughter'],
      ['bart', 'Bart Simpson', 'm', null, null, 'Eat my shorts'],
      ['lisa', 'Lisa Simpson', 'f', null, null, 'Future president'],
      ['maggie', 'Maggie Simpson', 'f', null, null, '*squeak*'],
      ['milhouse', 'Milhouse Van Houten', 'm', null, null, 'Best friend'],
      ['ned', 'Ned Flanders', 'm', null, null, 'Neighborino'],
      ['bob', 'Sideshow Bob', 'm', null, null, 'Nemesis']
    ],
    rels: [
      'abe = mona',
      'abe,mona > homer',
      'abe > herb',
      'clancy = jackie',
      'clancy,jackie > marge,patty,selma',
      'selma >> ling',
      'homer = marge',
      'homer,marge > bart,lisa,maggie',
      'bart + milhouse',
      'milhouse * lisa',
      'bart ! bob',
      'homer ! ned : stupid Flanders'
    ],
    comments: [
      [
        'capsule_corp_intern',
        'Downloaded and added the whole Power Plant as a subordinate chain.',
        1
      ],
      ['hokage_archivist', 'Lisa → future president needs a timeline scene!', 12]
    ]
  },
  {
    id: 'jdhx',
    title: '皆大歡喜 · 金家大宅（古裝版）',
    authorId: 'tvb_forever',
    genre: 'sitcom',
    lang: 'zh-Hant',
    access: 'grove',
    hue: 152,
    crest: 'gift',
    era: 'TVB 2001 – 2002',
    tags: [
      '皆大歡喜',
      '皆大欢喜',
      'tvb',
      '港劇',
      '处境剧',
      '處境劇',
      'virtues of harmony',
      'sitcom',
      '薛家燕',
      '林文龍'
    ],
    blurb:
      '三胞胎同年同月同日生，後母游念慈掌家，金家大宅日日有驚喜。共耕林開放中——一齊補充每一集嘅新角色！',
    likes: 2450,
    forks: 164,
    views: 36800,
    updatedAgo: 0.15,
    createdAgo: 12,
    badge: 'new',
    noun: '角色',
    people: [
      ['jinhua', '金華', 'm', null, null, '金家老爺（已故）', '演員：羅樂林'],
      ['yau', '游念慈', 'f', null, null, '金家主母・原名賽鳳凰', '演員：薛家燕'],
      ['jinnin', '金年', 'm', null, null, '縣令 → 駙馬', '三胞胎長子。演員：林文龍'],
      ['jinyuet', '金月', 'm', null, null, '洞蜜園', '三胞胎次子。演員：謝天華'],
      ['jinyat', '金日', 'f', null, null, '三胞胎幼妹', '演員：陳彥行'],
      ['fukada', '深田公主', 'f', null, null, '公主', '演員：廖碧兒'],
      ['lamyuklou', '林玉露', 'f', null, null, '金月之妻', '演員：趙學而'],
      ['shekmei', '石美', 'f', null, null, '金月之妻', '演員：梅小惠'],
      ['gou', '高爾康', 'm', null, null, '金日之夫', '演員：鄧兆尊'],
      ['yaufu', '游念富', 'm', null, null, '廚師・游念慈之弟', '演員：阮兆祥'],
      ['wan', '雲影姬', 'f', null, null, '游念富之妻', '演員：林漪娸']
    ],
    rels: [
      'jinhua = yau',
      'jinhua > jinnin,jinyuet,jinyat',
      'yau >> jinnin,jinyuet,jinyat : 後母',
      'jinnin = fukada',
      'jinyuet = lamyuklou',
      'jinyuet = shekmei',
      'jinyat = gou',
      'yau & yaufu',
      'yaufu = wan',
      'lamyuklou ! shekmei : 爭寵'
    ],
    groups: {
      三胞胎: ['jinnin', 'jinyuet', 'jinyat'],
      游家: ['yau', 'yaufu', 'wan']
    },
    comments: [
      ['changan_scribe', '童年回忆！时装版的刘家星也可以加进来吗？', 0.4],
      ['forbidden_city_notes', '已申请加入共耕林，准备补齐配角。', 1]
    ]
  },

  // ── Historical dynasties ──────────────────────────────────────────────────
  {
    id: 'tudors',
    title: 'The Tudors: Six Wives & Two Queens',
    authorId: 'tudor_rose',
    genre: 'history',
    lang: 'en',
    access: 'graft',
    hue: 345,
    crest: 'flower',
    era: '1400 → 1625',
    tags: [
      'tudor',
      'england',
      'monarchy',
      'henry viii',
      'renaissance',
      'royalty',
      'scotland',
      '都铎',
      '都鐸'
    ],
    blurb:
      'Henry VII’s gamble, Henry VIII’s marriages and Elizabeth’s golden age — every annulment dated and footnoted.',
    likes: 7240,
    forks: 610,
    views: 133000,
    updatedAgo: 0.9,
    createdAgo: 820,
    badge: 'staff',
    people: [
      ['owen', 'Owen Tudor', 'm', 1400, 1461, 'Welsh courtier'],
      ['catherineV', 'Catherine of Valois', 'f', 1401, 1437, 'Queen of England'],
      ['edmund', 'Edmund Tudor', 'm', 1430, 1456, 'Earl of Richmond'],
      ['margaretB', 'Margaret Beaufort', 'f', 1443, 1509, 'The King’s Mother'],
      ['henry7', 'Henry VII', 'm', 1457, 1509, 'King of England'],
      ['elizabethY', 'Elizabeth of York', 'f', 1466, 1503, 'Queen of England'],
      ['arthur', 'Arthur, Prince of Wales', 'm', 1486, 1502, 'Heir who died young'],
      ['margaretT', 'Margaret Tudor', 'f', 1489, 1541, 'Queen of Scots'],
      ['henry8', 'Henry VIII', 'm', 1491, 1547, 'King of England'],
      ['maryT', 'Mary Tudor', 'f', 1496, 1533, 'Queen of France'],
      ['catherineA', 'Catherine of Aragon', 'f', 1485, 1536, 'Wife No. 1 — divorced'],
      ['anneB', 'Anne Boleyn', 'f', 1501, 1536, 'Wife No. 2 — beheaded'],
      ['janeS', 'Jane Seymour', 'f', 1508, 1537, 'Wife No. 3 — died'],
      ['anneC', 'Anne of Cleves', 'f', 1515, 1557, 'Wife No. 4 — divorced'],
      ['catherineH', 'Catherine Howard', 'f', 1523, 1542, 'Wife No. 5 — beheaded'],
      ['catherineP', 'Catherine Parr', 'f', 1512, 1548, 'Wife No. 6 — survived'],
      ['mary1', 'Mary I', 'f', 1516, 1558, 'Queen of England'],
      ['elizabeth1', 'Elizabeth I', 'f', 1533, 1603, 'The Virgin Queen'],
      ['edward6', 'Edward VI', 'm', 1537, 1553, 'Boy king'],
      ['james4', 'James IV of Scotland', 'm', 1473, 1513, 'King of Scots'],
      ['james5', 'James V of Scotland', 'm', 1512, 1542, 'King of Scots'],
      ['maryQS', 'Mary, Queen of Scots', 'f', 1542, 1587, 'Queen of Scots'],
      ['darnley', 'Henry Stuart, Lord Darnley', 'm', 1546, 1567, 'King consort'],
      ['james6', 'James VI & I', 'm', 1566, 1625, 'Unites the crowns'],
      ['brandon', 'Charles Brandon', 'm', 1484, 1545, 'Duke of Suffolk'],
      ['frances', 'Frances Brandon', 'f', 1517, 1559, 'Duchess of Suffolk'],
      ['janeG', 'Lady Jane Grey', 'f', 1537, 1554, 'The Nine Days’ Queen']
    ],
    rels: [
      'owen = catherineV',
      'owen,catherineV > edmund',
      'edmund = margaretB',
      'edmund,margaretB > henry7',
      'henry7 = elizabethY @1486',
      'henry7,elizabethY > arthur,margaretT,henry8,maryT',
      'arthur = catherineA @1501 |1502',
      'henry8 = catherineA @1509 |1533 : annulled',
      'henry8 = anneB @1533 |1536 : executed',
      'henry8 = janeS @1536 |1537',
      'henry8 = anneC @1540 |1540 : annulled',
      'henry8 = catherineH @1540 |1542 : executed',
      'henry8 = catherineP @1543',
      'henry8,catherineA > mary1',
      'henry8,anneB > elizabeth1',
      'henry8,janeS > edward6',
      'margaretT = james4 @1503',
      'margaretT,james4 > james5',
      'james5 > maryQS',
      'maryQS = darnley @1565',
      'maryQS,darnley > james6',
      'maryT = brandon @1515',
      'maryT,brandon > frances',
      'frances > janeG',
      'catherineP ^ elizabeth1 : stepmother & tutor',
      'mary1 ! elizabeth1 : half-sisters',
      'elizabeth1 ! maryQS : cousins, rival queens'
    ],
    groups: {
      Monarchs: ['henry7', 'henry8', 'edward6', 'janeG', 'mary1', 'elizabeth1', 'james6'],
      'Six Wives': ['catherineA', 'anneB', 'janeS', 'anneC', 'catherineH', 'catherineP']
    },
    comments: [
      [
        'maester_gyldayn',
        'Divorced, beheaded, died, divorced, beheaded, survived — and all of it in the edge labels. Chef’s kiss.',
        0.7
      ],
      [
        'changan_scribe',
        'Grafted as a template for my 唐朝 project, the dated marriages are so useful.',
        3
      ],
      ['edo_archive', 'Beautiful sources section.', 20]
    ]
  },
  {
    id: 'romanovs',
    title: 'Romanovs: The Last Generation',
    authorId: 'tudor_rose',
    genre: 'history',
    lang: 'en',
    access: 'seedbank',
    hue: 205,
    crest: 'crown',
    era: '1818 → 1960',
    tags: ['romanov', 'russia', 'tsar', 'imperial', '1917', 'royalty', '罗曼诺夫', '羅曼諾夫'],
    blurb:
      'From the Tsar Liberator to Ekaterinburg — the final imperial generations, the Grand Duchesses and the mystic.',
    likes: 3180,
    forks: 0,
    views: 49600,
    updatedAgo: 6,
    createdAgo: 700,
    people: [
      ['alex2', 'Alexander II', 'm', 1818, 1881, 'The Tsar Liberator'],
      ['mariaA', 'Maria Alexandrovna', 'f', 1824, 1880, 'Empress consort'],
      ['alex3', 'Alexander III', 'm', 1845, 1894, 'Emperor of Russia'],
      ['mariaF', 'Maria Feodorovna', 'f', 1847, 1928, 'Empress consort'],
      ['nicholas2', 'Nicholas II', 'm', 1868, 1918, 'Last Emperor of Russia'],
      ['alexandra', 'Alexandra Feodorovna', 'f', 1872, 1918, 'Last Empress'],
      ['george', 'Grand Duke George', 'm', 1871, 1899, ''],
      ['xenia', 'Grand Duchess Xenia', 'f', 1875, 1960, ''],
      ['sandro', 'Grand Duke Alexander Mikhailovich', 'm', 1866, 1933, '“Sandro”'],
      ['michael', 'Grand Duke Michael', 'm', 1878, 1918, 'Emperor for a day'],
      ['olgaA', 'Grand Duchess Olga Alexandrovna', 'f', 1882, 1960, 'Painter'],
      ['olga', 'Grand Duchess Olga', 'f', 1895, 1918, 'OTMA'],
      ['tatiana', 'Grand Duchess Tatiana', 'f', 1897, 1918, 'OTMA'],
      ['maria', 'Grand Duchess Maria', 'f', 1899, 1918, 'OTMA'],
      ['anastasia', 'Grand Duchess Anastasia', 'f', 1901, 1918, 'OTMA'],
      ['alexei', 'Tsarevich Alexei', 'm', 1904, 1918, 'Heir apparent'],
      ['rasputin', 'Grigori Rasputin', 'm', 1869, 1916, 'Mystic']
    ],
    rels: [
      'alex2 = mariaA @1841',
      'alex2,mariaA > alex3',
      'alex3 = mariaF @1866',
      'alex3,mariaF > nicholas2,george,xenia,michael,olgaA',
      'nicholas2 = alexandra @1894',
      'nicholas2,alexandra > olga,tatiana,maria,anastasia,alexei',
      'xenia = sandro @1894',
      'rasputin ^ alexandra : spiritual adviser'
    ],
    groups: { OTMA: ['olga', 'tatiana', 'maria', 'anastasia'] },
    comments: [
      ['pantheon_lab', 'The OTMA group is such a thoughtful touch.', 4],
      ['forbidden_city_notes', '和清末几乎同时落幕，放在一起看很震撼。', 15]
    ]
  },
  {
    id: 'tokugawa',
    title: '徳川将軍家 十五代',
    authorId: 'edo_archive',
    genre: 'history',
    lang: 'ja',
    access: 'seedbank',
    hue: 128,
    crest: 'castle',
    era: '1543 → 1913',
    tags: ['徳川', 'tokugawa', 'shogun', 'edo', 'japan', '将軍', '江戸', '德川'],
    blurb: '家康から慶喜まで、十五代の将軍と御三家・御三卿の系譜。大奥の人間関係も少しだけ。',
    likes: 1640,
    forks: 0,
    views: 22400,
    updatedAgo: 4,
    createdAgo: 150,
    people: [
      ['ieyasu', '徳川家康', 'm', 1543, 1616, '初代将軍'],
      ['hidetada', '徳川秀忠', 'm', 1579, 1632, '二代将軍'],
      ['yorinobu', '徳川頼宣', 'm', 1602, 1671, '紀州藩祖'],
      ['yorifusa', '徳川頼房', 'm', 1603, 1661, '水戸藩祖'],
      ['iemitsu', '徳川家光', 'm', 1604, 1651, '三代将軍'],
      ['ietsuna', '徳川家綱', 'm', 1641, 1680, '四代将軍'],
      ['tsunashige', '徳川綱重', 'm', 1644, 1678, '甲府藩主'],
      ['tsunayoshi', '徳川綱吉', 'm', 1646, 1709, '五代将軍・生類憐みの令'],
      ['ienobu', '徳川家宣', 'm', 1662, 1712, '六代将軍'],
      ['ietsugu', '徳川家継', 'm', 1709, 1716, '七代将軍'],
      ['mitsusada', '徳川光貞', 'm', 1627, 1705, '紀州藩主'],
      ['yoshimune', '徳川吉宗', 'm', 1684, 1751, '八代将軍・享保の改革'],
      ['ieshige', '徳川家重', 'm', 1712, 1761, '九代将軍'],
      ['munetada', '徳川宗尹', 'm', 1721, 1765, '一橋家祖'],
      ['ieharu', '徳川家治', 'm', 1737, 1786, '十代将軍'],
      ['harusada', '一橋治済', 'm', 1751, 1827, '一橋家当主'],
      ['ienari', '徳川家斉', 'm', 1773, 1841, '十一代将軍'],
      ['ieyoshi', '徳川家慶', 'm', 1793, 1853, '十二代将軍'],
      ['nariyuki', '徳川斉順', 'm', 1801, 1846, '紀州藩主'],
      ['iesada', '徳川家定', 'm', 1824, 1858, '十三代将軍'],
      ['atsuhime', '天璋院篤姫', 'f', 1836, 1883, '家定の御台所'],
      ['iemochi', '徳川家茂', 'm', 1846, 1866, '十四代将軍'],
      ['kazunomiya', '和宮', 'f', 1846, 1877, '家茂の御台所'],
      ['nariaki', '徳川斉昭', 'm', 1800, 1860, '水戸藩主'],
      ['yoshinobu', '徳川慶喜', 'm', 1837, 1913, '十五代・最後の将軍']
    ],
    rels: [
      'ieyasu > hidetada,yorinobu,yorifusa',
      'hidetada > iemitsu',
      'iemitsu > ietsuna,tsunashige,tsunayoshi',
      'tsunashige > ienobu',
      'ienobu > ietsugu',
      'yorinobu > mitsusada',
      'mitsusada > yoshimune',
      'yoshimune > ieshige,munetada',
      'ieshige > ieharu',
      'munetada > harusada',
      'harusada > ienari',
      'ienari > ieyoshi,nariyuki',
      'ieyoshi > iesada',
      'iesada = atsuhime @1856',
      'nariyuki > iemochi',
      'iemochi = kazunomiya @1862',
      'atsuhime ! kazunomiya : 嫁姑の確執',
      'nariaki > yoshinobu'
    ],
    groups: {
      将軍: [
        'ieyasu',
        'hidetada',
        'iemitsu',
        'ietsuna',
        'tsunayoshi',
        'ienobu',
        'ietsugu',
        'yoshimune',
        'ieshige',
        'ieharu',
        'ienari',
        'ieyoshi',
        'iesada',
        'iemochi',
        'yoshinobu'
      ]
    },
    comments: [
      [
        'tudor_rose',
        'The branch successions (Kii → main line) are so clear in the generations layout.',
        6
      ],
      ['forbidden_city_notes', '和大清同步对照，很有意思。', 11]
    ]
  },

  // ── Chinese dynasties ─────────────────────────────────────────────────────
  {
    id: 'tang',
    title: '大唐李氏 · 从晋阳到开元',
    authorId: 'changan_scribe',
    genre: 'dynasty',
    lang: 'zh-Hans',
    access: 'graft',
    hue: 26,
    crest: 'lamp',
    era: '566 → 775',
    tags: ['唐朝', '唐代', 'tang', '李世民', '武则天', '玄武门', '长安', 'china', '大唐'],
    blurb: '从晋阳起兵到开元盛世：玄武门之变、女皇登基、先天政变，一张图看懂李唐两百年。',
    likes: 8120,
    forks: 702,
    views: 156000,
    updatedAgo: 0.3,
    createdAgo: 560,
    badge: 'trending',
    people: [
      ['liyuan', '李渊', 'm', 566, 635, '唐高祖'],
      ['dou', '太穆皇后窦氏', 'f', null, null, '李渊之妻'],
      ['jiancheng', '李建成', 'm', 589, 626, '隐太子'],
      ['shimin', '李世民', 'm', 598, 649, '唐太宗'],
      ['yuanji', '李元吉', 'm', 603, 626, '齐王'],
      ['pingyang', '平阳昭公主', 'f', null, 623, '娘子军统帅'],
      ['zhangsun', '文德皇后长孙氏', 'f', 601, 636, '贤后'],
      ['chengqian', '李承乾', 'm', 619, 645, '废太子'],
      ['litai', '李泰', 'm', 620, 653, '魏王'],
      ['lizhi', '李治', 'm', 628, 683, '唐高宗'],
      ['wuzetian', '武则天', 'f', 624, 705, '武周皇帝'],
      ['lihong', '李弘', 'm', 652, 675, '孝敬皇帝'],
      ['lixian', '李贤', 'm', 655, 684, '章怀太子'],
      ['lixian2', '李显', 'm', 656, 710, '唐中宗'],
      ['lidan', '李旦', 'm', 662, 716, '唐睿宗'],
      ['taiping', '太平公主', 'f', 665, 713, '权倾朝野'],
      ['weihou', '韦皇后', 'f', null, 710, '中宗皇后'],
      ['anle', '安乐公主', 'f', 684, 710, '中宗之女'],
      ['longji', '李隆基', 'm', 685, 762, '唐玄宗'],
      ['limao', '李瑁', 'm', null, 775, '寿王'],
      ['yang', '杨玉环', 'f', 719, 756, '杨贵妃'],
      ['shangguan', '上官婉儿', 'f', 664, 710, '巾帼宰相']
    ],
    rels: [
      'liyuan = dou',
      'liyuan,dou > jiancheng,shimin,yuanji,pingyang',
      'shimin ! jiancheng : 玄武门之变',
      'shimin = zhangsun',
      'shimin,zhangsun > chengqian,litai,lizhi',
      'chengqian ! litai : 夺嫡',
      'lizhi = wuzetian',
      'lizhi,wuzetian > lihong,lixian,lixian2,lidan,taiping',
      'lixian2 = weihou',
      'lixian2,weihou > anle',
      'lidan > longji',
      'longji ! taiping : 先天政变',
      'longji > limao',
      'limao = yang : 寿王妃',
      'longji = yang @745 : 贵妃',
      'wuzetian _ shangguan : 重用'
    ],
    groups: {
      皇帝: ['liyuan', 'shimin', 'lizhi', 'wuzetian', 'lixian2', 'lidan', 'longji'],
      公主: ['pingyang', 'taiping', 'anle']
    },
    comments: [
      ['forbidden_city_notes', '玄武门那条“对手”连线点开有详细注释，太用心了。', 0.2],
      [
        'tudor_rose',
        'Wu Zetian deserves her own collection. Grafted for my comparative monarchs study.',
        2
      ],
      ['tvb_forever', '睇完《大明宮詞》再睇呢個圖，一目了然！', 7]
    ]
  },
  {
    id: 'ming',
    title: '大明朱氏 · 洪武至崇祯',
    authorId: 'forbidden_city_notes',
    genre: 'dynasty',
    lang: 'zh-Hans',
    access: 'seedbank',
    hue: 6,
    crest: 'landmark',
    era: '1328 → 1644',
    tags: ['明朝', 'ming', '朱元璋', '靖难', '紫禁城', 'china', '大明', '万历'],
    blurb: '十六帝、二百七十六年。靖难之役、夺门之变、大礼议——皇位如何在叔侄兄弟间辗转。',
    likes: 5230,
    forks: 0,
    views: 88700,
    updatedAgo: 1.5,
    createdAgo: 620,
    people: [
      ['yuanzhang', '朱元璋', 'm', 1328, 1398, '明太祖・洪武'],
      ['ma', '孝慈高皇后马氏', 'f', 1332, 1382, '大脚马皇后'],
      ['biao', '朱标', 'm', 1355, 1392, '懿文太子'],
      ['di', '朱棣', 'm', 1360, 1424, '明成祖・永乐'],
      ['xu', '仁孝文皇后徐氏', 'f', 1362, 1407, '徐达之女'],
      ['yunwen', '朱允炆', 'm', 1377, null, '建文帝'],
      ['gaochi', '朱高炽', 'm', 1378, 1425, '明仁宗・洪熙'],
      ['zhanji', '朱瞻基', 'm', 1399, 1435, '明宣宗・宣德'],
      ['qizhen', '朱祁镇', 'm', 1427, 1464, '明英宗・正统／天顺'],
      ['qiyu', '朱祁钰', 'm', 1428, 1457, '明代宗・景泰'],
      ['jianshen', '朱见深', 'm', 1447, 1487, '明宪宗・成化'],
      ['wan', '万贵妃', 'f', 1428, 1487, '宪宗宠妃'],
      ['youcheng', '朱祐樘', 'm', 1470, 1505, '明孝宗・弘治'],
      ['youyuan', '朱祐杬', 'm', 1476, 1519, '兴献王'],
      ['houzhao', '朱厚照', 'm', 1491, 1521, '明武宗・正德'],
      ['houcong', '朱厚熜', 'm', 1507, 1567, '明世宗・嘉靖'],
      ['zaiji', '朱载坖', 'm', 1537, 1572, '明穆宗・隆庆'],
      ['yijun', '朱翊钧', 'm', 1563, 1620, '明神宗・万历'],
      ['zhangjuzheng', '张居正', 'm', 1525, 1582, '内阁首辅'],
      ['changluo', '朱常洛', 'm', 1582, 1620, '明光宗・泰昌'],
      ['youjiao', '朱由校', 'm', 1605, 1627, '明熹宗・天启'],
      ['youjian', '朱由检', 'm', 1611, 1644, '明思宗・崇祯'],
      ['weizhongxian', '魏忠贤', 'm', 1568, 1627, '九千岁']
    ],
    rels: [
      'yuanzhang = ma',
      'yuanzhang,ma > biao,di',
      'biao > yunwen',
      'di ! yunwen : 靖难之役',
      'di = xu',
      'di,xu > gaochi',
      'gaochi > zhanji',
      'zhanji > qizhen,qiyu',
      'qizhen ! qiyu : 夺门之变',
      'qizhen > jianshen',
      'jianshen = wan : 宠妃',
      'jianshen > youcheng,youyuan',
      'youcheng > houzhao',
      'youyuan > houcong',
      'houcong > zaiji',
      'zaiji > yijun',
      'zhangjuzheng ^ yijun : 帝师',
      'yijun > changluo',
      'changluo > youjiao,youjian',
      'youjiao _ weizhongxian : 宠信',
      'youjian ! weizhongxian : 清算阉党'
    ],
    groups: {
      皇帝: [
        'yuanzhang',
        'yunwen',
        'di',
        'gaochi',
        'zhanji',
        'qizhen',
        'qiyu',
        'jianshen',
        'youcheng',
        'houzhao',
        'houcong',
        'zaiji',
        'yijun',
        'changluo',
        'youjiao',
        'youjian'
      ]
    },
    comments: [
      ['changan_scribe', '大礼议那一支（兴献王）画得很清楚，赞。', 1],
      ['edo_archive', '家系図の参考にしました。', 9]
    ]
  },
  {
    id: 'qing',
    title: '爱新觉罗 · 大清十二帝',
    authorId: 'forbidden_city_notes',
    genre: 'dynasty',
    lang: 'zh-Hans',
    access: 'grove',
    hue: 44,
    crest: 'target',
    era: '1559 → 1967',
    tags: [
      '清朝',
      'qing',
      '康熙',
      '乾隆',
      '慈禧',
      '九子夺嫡',
      '宫斗',
      'china',
      '爱新觉罗',
      '愛新覺羅'
    ],
    blurb:
      '从努尔哈赤到溥仪，十二帝一脉相承。九子夺嫡、垂帘听政都在这里——共耕林开放，欢迎一起补全后宫！',
    likes: 9340,
    forks: 845,
    views: 171000,
    updatedAgo: 0.05,
    createdAgo: 690,
    badge: 'trending',
    people: [
      ['nurhaci', '努尔哈赤', 'm', 1559, 1626, '清太祖'],
      ['hongtaiji', '皇太极', 'm', 1592, 1643, '清太宗'],
      ['dorgon', '多尔衮', 'm', 1612, 1650, '摄政王'],
      ['xiaozhuang', '孝庄文皇后', 'f', 1613, 1688, '三朝国母'],
      ['shunzhi', '福临', 'm', 1638, 1661, '顺治帝'],
      ['kangxi', '玄烨', 'm', 1654, 1722, '康熙帝'],
      ['yinreng', '胤礽', 'm', 1674, 1725, '废太子'],
      ['yongzheng', '胤禛', 'm', 1678, 1735, '雍正帝'],
      ['yinsi', '胤禩', 'm', 1681, 1726, '八阿哥'],
      ['qianlong', '弘历', 'm', 1711, 1799, '乾隆帝'],
      ['heshen', '和珅', 'm', 1750, 1799, '权臣'],
      ['jiaqing', '颙琰', 'm', 1760, 1820, '嘉庆帝'],
      ['daoguang', '旻宁', 'm', 1782, 1850, '道光帝'],
      ['xianfeng', '奕詝', 'm', 1831, 1861, '咸丰帝'],
      ['yixin', '奕訢', 'm', 1833, 1898, '恭亲王'],
      ['yixuan', '奕譞', 'm', 1840, 1891, '醇亲王'],
      ['cixi', '慈禧太后', 'f', 1835, 1908, '垂帘听政'],
      ['cian', '慈安太后', 'f', 1837, 1881, '东太后'],
      ['tongzhi', '载淳', 'm', 1856, 1875, '同治帝'],
      ['guangxu', '载湉', 'm', 1871, 1908, '光绪帝'],
      ['zaifeng', '载沣', 'm', 1883, 1951, '监国摄政王'],
      ['puyi', '溥仪', 'm', 1906, 1967, '宣统帝']
    ],
    rels: [
      'nurhaci > hongtaiji,dorgon',
      'hongtaiji = xiaozhuang',
      'hongtaiji,xiaozhuang > shunzhi',
      'shunzhi > kangxi',
      'xiaozhuang ^ kangxi : 祖孙辅政',
      'kangxi > yinreng,yongzheng,yinsi',
      'yongzheng ! yinsi : 九子夺嫡',
      'yongzheng > qianlong',
      'qianlong _ heshen : 宠臣',
      'qianlong > jiaqing',
      'jiaqing ! heshen : 和珅跌倒，嘉庆吃饱',
      'jiaqing > daoguang',
      'daoguang > xianfeng,yixin,yixuan',
      'xianfeng = cixi',
      'xianfeng = cian',
      'xianfeng,cixi > tongzhi',
      'yixuan > guangxu,zaifeng',
      'cixi ! guangxu : 戊戌变法',
      'zaifeng > puyi'
    ],
    groups: {
      皇帝: [
        'nurhaci',
        'hongtaiji',
        'shunzhi',
        'kangxi',
        'yongzheng',
        'qianlong',
        'jiaqing',
        'daoguang',
        'xianfeng',
        'tongzhi',
        'guangxu',
        'puyi'
      ],
      垂帘听政: ['cixi', 'cian']
    },
    comments: [
      ['changan_scribe', '九子夺嫡建议再加上十三阿哥和十四阿哥！', 0.1],
      ['tvb_forever', '加入咗共耕林，幫手補後宮', 0.6],
      ['maester_gyldayn', 'Cixi vs Guangxu is peak Dance-of-the-Dragons energy.', 5]
    ]
  },
  {
    id: 'caowei',
    title: '三国 · 谯郡曹氏',
    authorId: 'changan_scribe',
    genre: 'dynasty',
    lang: 'zh-Hans',
    access: 'glasshouse',
    hue: 222,
    crest: 'swords',
    era: '155 → 274',
    tags: ['三国', '曹操', 'three kingdoms', '魏', '七步诗', 'china', '三國', '赤壁'],
    blurb: '“宁我负人”的曹孟德与他的儿子们：七步成诗、称象神童，还有三国枭雄的对手盘。',
    likes: 4760,
    forks: 0,
    views: 69000,
    updatedAgo: 8,
    createdAgo: 430,
    people: [
      ['caosong', '曹嵩', 'm', null, 193, '太尉'],
      ['caocao', '曹操', 'm', 155, 220, '魏武帝'],
      ['bian', '卞夫人', 'f', 160, 230, '武宣皇后'],
      ['liu', '刘夫人', 'f', null, null, '曹昂生母'],
      ['caoang', '曹昂', 'm', null, 197, '战死宛城'],
      ['caopi', '曹丕', 'm', 187, 226, '魏文帝'],
      ['caozhang', '曹彰', 'm', null, 223, '黄须儿'],
      ['caozhi', '曹植', 'm', 192, 232, '陈思王'],
      ['caochong', '曹冲', 'm', 196, 208, '称象神童'],
      ['zhenfu', '甄宓', 'f', 183, 221, '文昭皇后'],
      ['guo', '郭女王', 'f', 184, 235, '文德皇后'],
      ['caorui', '曹叡', 'm', 204, 239, '魏明帝'],
      ['caofang', '曹芳', 'm', 232, 274, '齐王'],
      ['simayi', '司马懿', 'm', 179, 251, '太傅'],
      ['liubei', '刘备', 'm', 161, 223, '蜀汉昭烈帝'],
      ['sunquan', '孙权', 'm', 182, 252, '吴大帝']
    ],
    rels: [
      'caosong > caocao',
      'caocao = bian',
      'caocao = liu',
      'caocao,liu > caoang',
      'caocao,bian > caopi,caozhang,caozhi',
      'caocao > caochong',
      'caopi ! caozhi : 七步诗',
      'caopi = zhenfu',
      'caopi = guo',
      'caopi,zhenfu > caorui',
      'caorui >> caofang',
      'caopi _ simayi : 托孤',
      'caocao ! liubei : 煮酒论英雄',
      'caocao ! sunquan : 赤壁之战'
    ],
    groups: { 三国君主: ['caocao', 'caopi', 'liubei', 'sunquan'] },
    comments: [
      ['forbidden_city_notes', '温室模式好评，考据派作品值得保护。', 3],
      ['hokage_archivist', 'Cao Pi ! Cao Zhi is basically Itachi & Sasuke with poetry.', 10]
    ]
  },

  // ── Mythology ─────────────────────────────────────────────────────────────
  {
    id: 'olympus',
    title: 'The Olympians',
    authorId: 'pantheon_lab',
    genre: 'myth',
    lang: 'en',
    access: 'grove',
    hue: 198,
    crest: 'zap',
    era: 'Before time → Age of Heroes',
    tags: ['greek mythology', 'olympus', 'gods', 'titans', 'zeus', 'myth', '希腊神话', '希臘神話'],
    blurb:
      'Primordials, Titans and a family reunion that never ends well. Open grove — bring your favourite demigod.',
    likes: 4980,
    forks: 377,
    views: 80500,
    updatedAgo: 0.7,
    createdAgo: 470,
    noun: 'Deity',
    people: [
      ['gaia', 'Gaia', 'f', null, null, 'Primordial Earth'],
      ['uranus', 'Uranus', 'm', null, null, 'Primordial Sky'],
      ['cronus', 'Cronus', 'm', null, null, 'King of the Titans'],
      ['rhea', 'Rhea', 'f', null, null, 'Mother of the gods'],
      ['zeus', 'Zeus', 'm', null, null, 'King of the Gods'],
      ['hera', 'Hera', 'f', null, null, 'Queen of the Gods'],
      ['poseidon', 'Poseidon', 'm', null, null, 'God of the Sea'],
      ['hades', 'Hades', 'm', null, null, 'Lord of the Underworld'],
      ['demeter', 'Demeter', 'f', null, null, 'Goddess of the Harvest'],
      ['hestia', 'Hestia', 'f', null, null, 'Goddess of the Hearth'],
      ['persephone', 'Persephone', 'f', null, null, 'Queen of the Underworld'],
      ['ares', 'Ares', 'm', null, null, 'God of War'],
      ['hephaestus', 'Hephaestus', 'm', null, null, 'God of the Forge'],
      ['hebe', 'Hebe', 'f', null, null, 'Goddess of Youth'],
      ['aphrodite', 'Aphrodite', 'f', null, null, 'Goddess of Love'],
      ['leto', 'Leto', 'f', null, null, 'Titaness'],
      ['apollo', 'Apollo', 'm', null, null, 'God of the Sun & Music'],
      ['artemis', 'Artemis', 'f', null, null, 'Goddess of the Hunt'],
      ['metis', 'Metis', 'f', null, null, 'Titaness of wisdom'],
      ['athena', 'Athena', 'f', null, null, 'Goddess of Wisdom'],
      ['maia', 'Maia', 'f', null, null, 'Pleiad'],
      ['hermes', 'Hermes', 'm', null, null, 'Messenger of the Gods'],
      ['semele', 'Semele', 'f', null, null, 'Mortal princess of Thebes'],
      ['dionysus', 'Dionysus', 'm', null, null, 'God of Wine'],
      ['alcmene', 'Alcmene', 'f', null, null, 'Mortal queen'],
      ['heracles', 'Heracles', 'm', null, null, 'Greatest of heroes']
    ],
    rels: [
      'gaia = uranus',
      'gaia,uranus > cronus,rhea',
      'uranus ! cronus : the first coup',
      'cronus = rhea',
      'cronus,rhea > zeus,hera,poseidon,hades,demeter,hestia',
      'zeus ! cronus : Titanomachy',
      'zeus = hera',
      'zeus,hera > ares,hebe',
      'hera > hephaestus',
      'zeus,demeter > persephone',
      'hades = persephone',
      'hephaestus = aphrodite',
      'ares * aphrodite',
      'aphrodite * ares',
      'zeus,leto > apollo,artemis',
      'zeus,metis > athena',
      'zeus,maia > hermes',
      'zeus,semele > dionysus',
      'zeus,alcmene > heracles',
      'hera ! heracles : twelve labours'
    ],
    groups: {
      'The Twelve': [
        'zeus',
        'hera',
        'poseidon',
        'demeter',
        'athena',
        'apollo',
        'artemis',
        'ares',
        'aphrodite',
        'hephaestus',
        'hermes',
        'dionysus'
      ],
      Titans: ['cronus', 'rhea', 'leto', 'metis']
    },
    comments: [
      ['tudor_rose', 'Zeus has more spouse-adjacent edges than Henry VIII. Impressive.', 1],
      ['capsule_corp_intern', 'Added Perseus to the grove — pending review', 2]
    ]
  }
]

export const COLLECTIONS: BrowseCollection[] = [
  {
    id: 'dragon-thrones',
    icon: 'flame',
    hue: 12,
    title: { en: 'Dragon thrones', 'zh-Hans': '龙椅之争', 'zh-Hant': '龍椅之爭' },
    projectIds: ['qing', 'tang', 'ming', 'caowei', 'targaryen']
  },
  {
    id: 'anime-clans',
    icon: 'sparkles',
    hue: 330,
    title: { en: 'Anime clans', 'zh-Hans': '动漫家族', 'zh-Hant': '動漫家族' },
    projectIds: ['uchiha', 'joestar', 'sonfamily']
  },
  {
    id: 'crowns',
    icon: 'crown',
    hue: 280,
    title: { en: 'Crowns & courts', 'zh-Hans': '王冠与宫廷', 'zh-Hant': '王冠與宮廷' },
    projectIds: ['tudors', 'romanovs', 'tokugawa', 'targaryen']
  },
  {
    id: 'sofa',
    icon: 'sofa',
    hue: 150,
    title: { en: 'Sofa families', 'zh-Hans': '沙发上的家人', 'zh-Hant': '梳化上的家人' },
    projectIds: ['simpsons', 'jdhx', 'roys']
  },
  {
    id: 'feuds',
    icon: 'swords',
    hue: 0,
    title: { en: 'Legendary feuds', 'zh-Hans': '传奇恩怨', 'zh-Hant': '傳奇恩怨' },
    projectIds: ['uchiha', 'targaryen', 'roys', 'tang', 'olympus']
  },
  {
    id: 'open-groves',
    icon: 'handshake',
    hue: 140,
    title: { en: 'Open for gardeners', 'zh-Hans': '招募园丁中', 'zh-Hant': '招募園丁中' },
    projectIds: ['qing', 'jdhx', 'sonfamily', 'olympus']
  }
]

/** Fake live-activity lines for the hero ticker: [profileId, verb, projectId]. */
export const ACTIVITY: Array<
  [string, 'grafted' | 'liked' | 'joined' | 'downloaded' | 'commented', string]
> = [
  ['tudor_rose', 'grafted', 'tang'],
  ['tvb_forever', 'joined', 'qing'],
  ['hokage_archivist', 'liked', 'joestar'],
  ['changan_scribe', 'commented', 'tudors'],
  ['edo_archive', 'downloaded', 'ming'],
  ['capsule_corp_intern', 'joined', 'olympus'],
  ['maester_gyldayn', 'liked', 'qing'],
  ['pantheon_lab', 'downloaded', 'joestar'],
  ['forbidden_city_notes', 'grafted', 'targaryen'],
  ['springfield_genealogy', 'joined', 'sonfamily']
]
