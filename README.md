# スライム・キックオフ！ v0.30 PROJECT REFACTOR

ブラウザだけで動く、3対3のスライム押し付けアクションゲームです。

## 今回の整理

- `css/`、`js/`、`data/`、`assets/images/`へファイルを分類
- Android WebView互換処理を `js/polyfills.js` に分離
- 基本設定を `js/config.js` に分離
- 村・チーム・ユニフォーム情報を `js/stages.js` に分離
- 将来の編集用ステージ一覧を `data/stages.json` に追加
- メインゲームは `js/game.js` に維持し、挙動を壊しにくい形で整理
- 消えていた試合終了ボタンとスライム選択UIを復元
- ステージカードのインライン装飾をCSSへ移動

## フォルダ構成

```text
slime-kickoff/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── polyfills.js
│   ├── config.js
│   ├── stages.js
│   └── game.js
├── data/
│   └── stages.json
└── assets/
    └── images/
        └── slime.png
```

## ステージ設定

1. ❄ ぶりふぉ村 — 水色×白ストライプ
2. 🔥 さるびえ村 — エンジ
3. 🌪 さるびび村 — ターコイズ
4. 🪨 たけぞ村 — ピンク×ネイビー太ボーダー
5. ⚡ ちぇすたぴサーカス団 — 濃いネイビー

服はチームカラー、魔法と演出は属性カラーとして分けます。

## 起動方法

`index.html` をブラウザで開いてください。スマホは横画面推奨です。

GitHub Pagesでは、リポジトリ直下へこの構成をそのままアップロードできます。

## 次の更新候補

- `js/game.js`から描画、AI、スキル、入力を段階的に分離
- `STAGES`を使った村名・ユニフォーム・背景の実表示
- ぶりふぉ村の雪原、氷柵、青白いゲート
- 勝利後の「新たな異次元空間が発生！」演出
