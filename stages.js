'use strict';
const STAGES = Object.freeze([
  {
    id: 'brifo',
    order: 1,
    name: 'ぶりふぉ村',
    element: 'ice',
    icon: '❄',
    uniform: { primary: '#8edcff', secondary: '#ffffff', pattern: 'vertical-stripe' },
    description: '雪と氷に囲まれた静かな村。',
    chiefLine: '押し返せ！ 臭いのは向こうの村へ返すんだ！'
  },
  {
    id: 'salubie',
    order: 2,
    name: 'さるびえ村',
    element: 'fire',
    icon: '🔥',
    uniform: { primary: '#7b2438', secondary: '#f1c7aa', pattern: 'solid' },
    description: '鍛冶場の煙が立ちのぼる、熱気のある村。',
    chiefLine: '熱く蹴り返せ！ こっちへ寄せるな！'
  },
  {
    id: 'salubibi',
    order: 3,
    name: 'さるびび村',
    element: 'wind',
    icon: '🌪',
    uniform: { primary: '#29b8b4', secondary: '#eaffff', pattern: 'solid' },
    description: '風車と旗が絶えず揺れる、風の村。',
    chiefLine: '風に乗せて、一気に向こうへ！'
  },
  {
    id: 'takezo',
    order: 4,
    name: 'たけぞ村',
    element: 'earth',
    icon: '🪨',
    uniform: { primary: '#ec73ad', secondary: '#172c55', pattern: 'wide-horizontal-stripe' },
    description: '竹林と石垣に囲まれた、土の村。',
    chiefLine: '腰を落とせ。どっしり押し返すんだ。'
  },
  {
    id: 'chestapi-circus',
    order: 5,
    name: 'ちぇすたぴサーカス団',
    element: 'thunder',
    icon: '⚡',
    uniform: { primary: '#111d3d', secondary: '#f4d34e', pattern: 'solid' },
    description: '異次元ゲートの先に現れた、村ではない謎のサーカス団。',
    chiefLine: 'さあ皆さま！ 雷鳴のショータイムです！'
  }
]);

function getStageByOrder(order){
  return STAGES.find(stage => stage.order === order) || STAGES[0];
}
