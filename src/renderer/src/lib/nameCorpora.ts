// Bundled name corpora for the name generator (nameGen.ts). Small on purpose:
// a few dozen names per list is plenty for an order-3 character chain. Only
// generic, historical or invented names — no franchise character lists.
// Labels are i18n keys, translated where the culture list is shown.
import type { NameCorpus } from './nameGen'

const words = (s: string): string[] => s.trim().split(/\s+/)

export const NAME_CORPORA: readonly NameCorpus[] = [
  {
    id: 'english',
    labelKey: 'nameGen.corpus.english',
    mode: 'char',
    male: words(`
      Aldric Alfred Alwin Ambrose Arthur Athelstan Baldwin Benedict Bertram Cedric
      Cuthbert Edgar Edmund Edric Edward Edwin Egbert Geoffrey Gilbert Giles Godric
      Godwin Harold Henry Hugh Humphrey Jasper Leofric Miles Nigel Osric Oswald Ralph
      Richard Robert Roger Rupert Silas Simon Stephen Thomas Walter William Wulfric Wystan
    `),
    female: words(`
      Ada Adela Agnes Aldith Alice Amice Audrey Avice Beatrice Bridget Cecily Clemence
      Dorothy Edith Eleanor Elfreda Elswith Emma Ethel Felicity Florence Harriet Hilda
      Isabel Joan Juliana Lettice Mabel Margery Matilda Maud Mildred Millicent Prudence
      Rosamund Rowena Sybil Tamsin Ursula Winifred Wynflaed
    `),
    surnames: words(`
      Ashdown Ashford Atwood Baker Barrow Blackwood Bramley Carter Chapman Cooper Cotton
      Draper Fairfax Fletcher Fowler Gardner Hartley Hawthorne Holloway Kingsley Langley
      Lockwood Marsh Mercer Miller Norwood Oakley Pemberton Radcliffe Rowley Sawyer
      Shepherd Smith Stanton Thatcher Thornton Turner Underwood Wainwright Whitaker
      Wickham Woodward Wren Yardley
    `)
  },
  {
    id: 'norse',
    labelKey: 'nameGen.corpus.norse',
    mode: 'char',
    male: words(`
      Arne Asbjorn Bjarni Bjorn Bodvar Brand Dag Egil Einar Eirik Erlend Eyvind Finnbogi
      Floki Frode Geir Gisli Grim Gudmund Gunnar Hakon Halfdan Hallbjorn Harald Hauk
      Helgi Hjalmar Hrafn Ingvar Ivar Kari Ketil Knut Leif Magnus Njal Odd Olaf Orm
      Ragnar Rolf Rune Sigurd Snorri Steinar Sven Thorbjorn Thorkel Thorstein Torvald
      Ulf Vidar Yngvar
    `),
    female: words(`
      Alfhild Asa Astrid Aud Bergljot Bodil Brynja Dagny Eir Freydis Frida Grima Gudrun
      Gunnhild Gyda Halla Helga Hervor Hildr Ingrid Ingunn Jorunn Katla Liv Ragna
      Ragnhild Ranveig Runa Sigrid Signy Sigrun Solveig Svanhild Thora Thorgerd Thorunn
      Thyra Tove Turid Ulfhild Unn Vigdis Yrsa
    `),
    surnames: [],
    patronymic: { m: 'son', f: 'dottir' }
  },
  {
    id: 'roman',
    labelKey: 'nameGen.corpus.roman',
    mode: 'char',
    male: words(`
      Agrippa Albinus Appius Aquila Aulus Bassus Brutus Caius Cassius Crispus Decimus
      Drusus Faustus Felix Flavius Florus Gaius Gallus Gnaeus Hostus Julius Kaeso
      Lentulus Lucius Magnus Mamercus Manius Marcus Maximus Nero Numerius Otho Paulus
      Publius Quintus Rufus Servius Severus Sextus Silvanus Spurius Tiberius Titus Varro Vitus
    `),
    female: words(`
      Aelia Aemilia Antonia Aurelia Caecilia Calpurnia Camilla Claudia Cornelia Domitia
      Fabia Faustina Flavia Fulvia Galla Hortensia Julia Junia Licinia Livia Lucilla
      Lucretia Marcella Marcia Octavia Paulina Plautia Pompeia Porcia Priscilla Quintilla
      Sabina Septimia Servilia Severa Sulpicia Terentia Tullia Valeria Vibia Vipsania
    `),
    surnames: words(`
      Aemilius Agricola Antonius Aurelius Caecilius Calpurnius Cicero Claudius Cornelius
      Corvus Crassus Dentatus Domitius Fabius Fulvius Galba Horatius Junius Lepidus
      Licinius Livius Lucretius Manlius Marius Naso Octavius Pompeius Porcius Quinctius
      Scaevola Sempronius Sergius Servilius Sulpicius Terentius Tullius Valerius Varus
      Verginius Vipsanius
    `),
    femSurname: [['ius', 'ia']]
  },
  {
    id: 'slavic',
    labelKey: 'nameGen.corpus.slavic',
    mode: 'char',
    male: words(`
      Bogdan Bohumil Boleslav Borislav Bozidar Branimir Casimir Dobromir Dragan Dusan
      Goran Igor Ivan Jaromir Kazimir Ladislav Lubomir Miroslav Mstislav Nikola Oleg
      Pavel Predrag Radomir Radoslav Ratimir Rostislav Ruslan Stanislav Svetoslav
      Tomislav Vadim Vaclav Velimir Vladimir Vlastimil Vojtech Vsevolod Yaroslav Zbigniew
      Zdenek Zoran Zvonimir
    `),
    female: words(`
      Agnieszka Bogdana Bojana Bozena Branka Danica Dobrava Dobroslava Dragana Dubravka
      Jadwiga Jaroslava Jelena Katarina Kazimiera Lada Ljubica Ludmila Lyubov Milena
      Milica Mira Miroslava Nadezhda Olga Radmila Radoslava Rusalka Snezhana Stanislava
      Svetlana Vera Vesna Vlasta Wanda Zdenka Zlata Zora Zorica Zvezdana
    `),
    surnames: words(`
      Babic Belov Bogdanov Dubrovsky Dvorak Horvat Ivanov Jankovic Jovanovic Kaminski
      Kolar Kovac Kowalski Kozlov Kral Krol Kuznetsov Lebedev Lewandowski Markovic
      Medvedev Morozov Nemec Nikolic Novak Novikov Orlov Pavlov Petrov Petrovic Popov
      Romanov Sadowski Smirnov Sokolov Svoboda Vasiliev Volkov Wisniewski Wozniak Zajac
      Zielinski
    `),
    femSurname: [
      ['sky', 'skaya'],
      ['ski', 'ska'],
      ['ov', 'ova'],
      ['ev', 'eva'],
      ['in', 'ina']
    ]
  },
  {
    id: 'celtic',
    labelKey: 'nameGen.corpus.celtic',
    mode: 'char',
    male: words(`
      Aedan Ailill Alasdair Aonghus Bran Brendan Brian Cadoc Cathal Cian Cillian Colm
      Conall Conan Cormac Daithi Declan Diarmuid Donal Dougal Dyfan Eamon Emrys Eoghan
      Evander Fergus Fiachra Finbar Finnian Gareth Gethin Iolo Kieran Lachlan Llewelyn
      Lorcan Malcolm Niall Oisin Padraig Ronan Ruairi Seamus Tadhg Tomas
    `),
    female: words(`
      Aileen Ailsa Aine Aisling Alys Blodwen Brigid Bronwen Caitlin Catriona Ceridwen
      Ciara Clodagh Deirdre Eilidh Eira Eithne Enid Fiona Fionnuala Grainne Gwen
      Gwendolyn Isla Maeve Mairead Morag Morwenna Muirne Nesta Nia Niamh Orla Rhiannon
      Roisin Saoirse Seren Siobhan Sorcha Tegan Una
    `),
    surnames: words(`
      Brennan Byrne Campbell Connolly Davies Doherty Donnelly Doyle Duffy Evans Fraser
      Gallagher Gillies Griffiths Kavanagh Kelly Kennedy Kerr Lloyd MacDonald MacGregor
      MacKenzie MacLeod McCarthy Morgan Munro Murphy Nolan O'Brien O'Connor O'Neill
      O'Sullivan Owens Price Pryce Quinn Reilly Rhys Ross Ryan Sullivan Walsh
    `)
  },
  {
    id: 'elvish',
    labelKey: 'nameGen.corpus.elvish',
    mode: 'char',
    male: words(`
      Aelion Althaer Caelas Calareth Corathis Daelon Elarion Elmiryn Eolan Faelyr Feyran
      Galinor Ilidor Ilvaris Iolas Kaelith Laerion Liraneth Lysander Mirathel Myrrhan
      Naelis Naeron Oravin Orinel Pelleas Rhovanis Saelorn Saevren Sylvaren Taelith
      Thaelin Vaeril Valandor Vindaris Ythrel Zaltheon
    `),
    female: words(`
      Aelira Aeloria Alyndra Amarielle Calithe Celandine Cyrielle Elisande Elowen Eluned
      Faelwen Fiorel Ilaria Ilyse Liandra Lyrisse Maelis Meliora Miravel Naeris Nerys
      Ondine Oriane Perenna Quilla Rhaelyn Rosalind Saeriel Sariel Seraphine Sylviane
      Sylwen Taliesa Tirelle Vaelith Vaenna Velanne Yllana Ysolde Zelphira
    `),
    surnames: words(`
      Aelthorne Amastrel Ashenleaf Brightwater Caladris Dawnwhisper Dewglen Elarneth
      Faeloren Ilthanar Lorethil Mirelan Mistvale Moonbrook Naevaris Oronthal Quessaril
      Rhovanel Saelthis Silverbough Starfall Sunmantle Sylvarin Thalassir Thornvale
      Vaelorn Valerith Willowmere Yllaris Zephyrin
    `)
  },
  {
    id: 'dwarven',
    labelKey: 'nameGen.corpus.dwarven',
    mode: 'char',
    male: words(`
      Bardrik Barnok Borgrim Brakka Brummel Dolgrin Dorn Drogan Durgan Durrik Folkor
      Gharak Glorn Gorm Grimbald Grokk Gruldar Hadrik Hargan Hrothgar Jorgrim Karbuk
      Kazrak Kordak Korgan Krag Mograth Mordek Narbok Nargul Rokkar Rurik Skagg Skarn
      Thorgar Thrak Throk Torgar Ulfrik Ulgar Urgoth Vorgan Vrask Yorik Zarg Zhorn
    `),
    female: words(`
      Agna Bardra Borka Bruna Brunhild Dagna Dagrun Dorla Durna Edda Gerda Grizka Gudra
      Gunnra Helka Hilga Hulda Ingra Jorna Kara Kelda Lorga Magra Morka Murga Narga
      Ozra Rikka Sigra Skara Torga Ulga Urda Varga Vorka Yarga Zura
    `),
    surnames: words(`
      Anvilbrand Bargrund Blackforge Copperhelm Deepdelver Drakkar Durmok Flintfist
      Goldvein Gorvash Granitebrow Grukk Harnak Ironhide Ironmantle Kragmar Morgrund
      Rockjaw Skullgar Stonebeard Thrommek Thunderaxe Urzog Vargash Zhurak
    `)
  },
  {
    id: 'japanese',
    labelKey: 'nameGen.corpus.japanese',
    mode: 'syllable',
    scheme: 'romaji',
    surnameFirst: true,
    maxSyllables: 4,
    male: words(`
      Akihiro Akira Daichi Daisuke Haruki Haruto Hayato Hideo Hikaru Hiroshi Ichiro
      Isamu Jiro Kaito Katsuro Kazuki Kenji Kenta Kichiro Makoto Masaru Minoru Naoki
      Noboru Osamu Renji Riku Ryota Satoshi Shin Shota Sora Susumu Takashi Takumi Taro
      Tatsuya Tomoya Yamato Yasuo Yoshiro Yuki Yusuke Yuto
    `),
    female: words(`
      Aiko Akane Aoi Asuka Ayaka Chiharu Chiyo Emi Fumiko Hana Haruka Hikari Hinata
      Hiroko Kaede Kaori Kazumi Keiko Kiyoko Kiyomi Mai Mana Mayumi Megumi Michiko Midori
      Misaki Miyu Momoko Nanami Naomi Natsuki Noriko Rin Sakura Sayuri Shiori Sumire
      Tomoko Yoko Yui Yukari Yumi Yuna
    `),
    surnames: words(`
      Abe Aoki Endo Fujii Fujita Fukuda Goto Hasegawa Hayashi Hoshino Ikeda Inoue Ishii
      Ito Kato Kawaguchi Kimura Kobayashi Kondo Kuroda Matsumoto Mori Morita Murakami
      Nakajima Nakamura Nishimura Ogawa Okada Ono Saito Sakamoto Sasaki Sato Shimizu
      Suzuki Takahashi Takeda Tanaka Watanabe Yamada Yamaguchi Yamamoto Yoshida
    `)
  },
  {
    id: 'chinese',
    labelKey: 'nameGen.corpus.chinese',
    mode: 'syllable',
    scheme: 'pinyin',
    surnameFirst: true,
    pickSurnames: true,
    maxSyllables: 2,
    male: words(`
      An Bo Bowen Cheng Chenglong Da Dawei Gang Guang Guoqiang Hao Haoran Haoyu Hong Jiahao
      Jian Jianguo Jie Jinhai Jun Junjie Kai Lei Liang Long Ming Mingyu Peng Qiang Rui
      Shan Tao Tianyi Wei Weiming Wen Xiaoming Xin Yang Yi Yifan Yong Yu Yuxuan Zeyu
      Zhen Zhi Zhiwei Zihao
    `),
    female: words(`
      Ai Chunhua Fang Hui Huifang Jiayi Jing Juan Lan Li Lihua Lin Liying Mei Meiling
      Mingzhu Na Ning Ping Qing Qiuyue Ruoxi Shiyun Wanting Xia Xiaohong Xiaoli Xinyi
      Xiuying Xue Yan Yawen Ying Yuehan Yun Yuqing Yutong Ziyi
    `),
    surnames: words(`
      Cai Cao Chen Cheng Deng Ding Dong Du Feng Gao Guo Han He Hu Huang Jiang Li Liang
      Lin Liu Lu Luo Ma Ouyang Pan Peng Ren Shangguan Shen Sima Song Su Sun Tang Tian
      Wang Wei Wu Xiao Xie Xu Yang Yao Ye Yu Yuan Zeng Zhang Zhao Zheng Zhou Zhu Zhuge
    `)
  }
]

export const DEFAULT_CORPUS_ID = 'english'

export function corpusById(id: string | null | undefined): NameCorpus | null {
  return NAME_CORPORA.find((c) => c.id === id) || null
}
