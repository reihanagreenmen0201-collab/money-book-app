# お金の手帳

個人のお金管理用Webアプリ。財布ごとの残高・カテゴリ別の振り分け・積み立て・支払いチェックリストを管理します。

## 構成

```
money-book-app/
├── index.html              エントリーHTML
├── package.json
├── vite.config.js
├── .github/workflows/deploy.yml   pushすると自動でGitHub Pagesに公開されるワークフロー
└── src/
    ├── main.jsx             Reactのマウント処理
    ├── index.css            全体の簡易スタイル
    └── MoneyBook.jsx        アプリ本体
```

## データの保存について

Claudeの中で使うときは `window.storage`、それ以外（GitHub Pagesなど）ではブラウザの
`localStorage` を自動で使い分けます。データは同じ端末・同じブラウザ内にのみ保存されます。

## 公開方法

GitHubリポジトリにこのフォルダの中身をアップロードし、Settings → Pages で
「GitHub Actions」を選択すると、以後 main ブランチへの反映のたびに自動でビルド・公開されます。
（詳しい手順は別途ご案内します）
