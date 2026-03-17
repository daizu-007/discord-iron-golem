# discord-iron-golem 改善計画

## 現状まとめ

### プロジェクト概要

Minecraft のアイアンゴーレムをコンセプトにした Discord 認証 Bot。
指定チャンネルに投稿されたメッセージが合言葉（正規表現）を含むかを判定し、認証済みロールを自動付与する。

### ファイル構成

```
discord-iron-golem/
├── index.js                  # エントリーポイント（設定読み込み・イベント登録）
├── modules/
│   └── keywordVerifier.js    # 認証ロジック本体
├── example-config.toml       # 設定ファイルテンプレート
├── package.json
└── package-lock.json
```

### 使用技術

| 技術 | バージョン | 用途 |
|---|---|---|
| Node.js | (未指定) | ランタイム |
| discord.js | ^14.18.0 | Discord API ラッパー |
| toml | ^3.0.0 | 設定ファイルのパース |
| dotenv | ^16.4.7 | **インストール済みだが未使用** |

### 現在の処理フロー

1. 起動時に `config.toml` を同期読み込みしてすべての設定値を展開
2. `ClientReady` イベントで最初のギルドのロールとログチャンネルをキャッシュ
3. `MessageCreate` イベントで Bot・DM メッセージを除外し、`keywordVerifier.validateKeyword()` に委譲
4. 指定チャンネルのメッセージを正規表現でテストし、成否に応じてロール付与・DM 送信・ログ送信

---

## 問題点・改善点

### 1. バグ・不具合リスク

#### 1-1. 設定読み込み失敗時の不明瞭なクラッシュ

```js
// index.js
let config;
try {
    config = toml.parse(fs.readFileSync('./config.toml', 'utf8'));
} catch (error) {
    console.error('Configの読み込み中にエラーが発生しました:', error);
    // ← process.exit() がないため処理が続行される
}

const token = config.general.token; // ← config が undefined なら TypeError
```

`config.toml` が存在しない場合、エラーをログして続行するため、直後の `config.general.token` で `TypeError: Cannot read properties of undefined` がスローされる。エラーメッセージが不明瞭になる。

**修正方針:** catch 内で `process.exit(1)` するか、エラーを再スローする。

---

#### 1-2. `verification.enable` フラグが無視されている

`example-config.toml` に `enable = true` があるが、コードでは一切参照されていない。設定を `false` にしても機能は止まらない。

**修正方針:** 設定値を読み込んで条件分岐に使う。

---

#### 1-3. `role` / `log_channel` の null 状態が伝播する

```js
// index.js
let role = null;
let log_channel = null;

client.once(Events.ClientReady, readyClient => {
    role = guild.roles.cache.get(role_id);       // 見つからなければ undefined
    log_channel = guild.channels.cache.get(log_channel_id); // 同上
});
```

`keywordVerifier.js` では `role == null` のチェックはあるが、`log_channel` が null/undefined の場合は `log_channel.send()` で例外が発生する。

**修正方針:** `log_channel` にも null ガードを追加する。または起動時に取得失敗したら `process.exit(1)` する。

---

#### 1-4. グローバルフラグ付き RegExp の状態問題（潜在的）

```js
const regex_keyword = new RegExp(keyword);
```

現在は問題ないが、ユーザーが `keyword` に `g` フラグを含む正規表現を設定した場合、`RegExp.prototype.test()` は `lastIndex` を更新するため、連続した呼び出しで交互に `true`/`false` を返すバグが起きる。

**修正方針:** TypeScript 移行時に設定バリデーションを追加し、`g` フラグを禁止または自動除去する。

---

#### 1-5. `guilds.cache.first()` による単一ギルド前提

```js
const guild = readyClient.guilds.cache.first();
```

Bot が複数のギルドに参加している場合、意図しないギルドの role/channel を取得する。

**修正方針:** `config.toml` に `guild_id` を追加して `guilds.cache.get(guild_id)` で明示的に取得する。

---

### 2. コード品質

#### 2-1. `validateKeyword` の引数が多すぎる（7個）

```js
validateKeyword(message, regex_keyword, role, introduction_channel_id, dm_message_wrong, dm_message_correct, log_channel)
```

引数が増えるほどミスしやすく、将来の拡張も困難。

**修正方針:** 設定値をオブジェクト（`VerifierConfig` 型）にまとめて渡す。

```ts
interface VerifierConfig {
  regex: RegExp;
  role: Role;
  introductionChannelId: string;
  dmMessageWrong: string;
  dmMessageCorrect: string;
  logChannel: TextChannel;
}
```

---

#### 2-2. 設定値の個別展開（スプレッドアンチパターン）

```js
const token = config.general.token;
const log_channel_id = config.general.log_channel_id;
// ... 6行続く
```

型安全性がなく、typo があっても `undefined` のまま進んでしまう。

**修正方針:** TypeScript の型定義 + Zod などでランタイムバリデーションを追加する。

---

#### 2-3. `dotenv` が依存関係に残っている

`package.json` に `dotenv` が記載されているが、コードでは一切使用されていない。

**修正方針:** `npm uninstall dotenv` でアンインストールする。

---

#### 2-4. `start` スクリプトがない

```json
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
}
```

`npm start` で起動できない。

**修正方針:** `"start": "node index.js"` を追加する。TypeScript 移行後は `"start": "node dist/index.js"`, `"dev": "tsx watch src/index.ts"` を追加する。

---

#### 2-5. ネストした try-catch が読みにくい

`keywordVerifier.js` でロール付与・DM 送信・ログ送信がそれぞれ独立した try-catch に包まれており、深いネストが生じている。

**修正方針:** ヘルパー関数に切り出すか、Promise のエラーハンドリングを統一する。

---

### 3. TypeScript 移行チェックリスト

TypeScript で書き直す際に対応すべき項目は以下のとおり。

#### 3-1. ツールチェーンの追加

| パッケージ | 用途 |
|---|---|
| `typescript` | TypeScript コンパイラ |
| `tsx` | 開発時の直接実行（`ts-node` より高速） |
| `@types/node` | Node.js 型定義 |
| `eslint` + `typescript-eslint` | Lint |
| `prettier` | フォーマット |
| `zod` | ランタイム設定バリデーション（推奨） |

> `discord.js` v14 は型定義を内包しているため `@types/discord.js` は不要。

#### 3-2. ディレクトリ構成の変更

```
discord-iron-golem/
├── src/
│   ├── index.ts
│   ├── config.ts          # 設定の読み込み・バリデーション
│   ├── types.ts           # 共通型定義 (Config, VerifierConfig など)
│   └── modules/
│       └── keywordVerifier.ts
├── dist/                  # コンパイル出力（.gitignore 対象）
├── tsconfig.json
├── eslint.config.ts
├── .prettierrc
├── example-config.toml
└── package.json
```

#### 3-3. `tsconfig.json` 推奨設定

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`strict: true` + `noUncheckedIndexedAccess: true` で null/undefined 由来のバグを型レベルで検出できる。

#### 3-4. 設定バリデーション（Zod による例）

```ts
// src/config.ts
import { z } from 'zod';
import { parse } from 'toml';
import { readFileSync } from 'fs';

const ConfigSchema = z.object({
  general: z.object({
    token: z.string().min(1),
    log_channel_id: z.string().regex(/^\d+$/),
  }),
  verification: z.object({
    enable: z.boolean(),
    introduction_channel_id: z.string().regex(/^\d+$/),
    role_id: z.string().regex(/^\d+$/),
    keyword: z.string().min(1),
    dm_message_wrong: z.string(),
    dm_message_correct: z.string(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const raw = parse(readFileSync('./config.toml', 'utf8'));
  return ConfigSchema.parse(raw); // 失敗時は ZodError をスロー
}
```

#### 3-5. CommonJS から ESM への移行（任意）

Node.js 22 以降では ESM がデフォルト推奨。`package.json` に `"type": "module"` を追加し、`import`/`export` 構文に統一することを検討する。

---

### 4. 機能面の改善候補（将来対応）

| 優先度 | 内容 |
|---|---|
| 高 | `guild_id` を設定ファイルに追加し、単一ギルド前提を排除 |
| 高 | メッセージ編集 (`MessageUpdate`) イベントへの対応 |
| 中 | すでに認証済み（ロール保持済み）のユーザーへの重複処理を防ぐ |
| 中 | DM が無効なユーザーへのフォールバック（チャンネル返信など） |
| 低 | 複数の認証ルール（チャンネル・ロール・合言葉のセット）への対応 |
| 低 | スラッシュコマンドによる管理機能（設定確認・ロール手動付与など） |

---

### 5. 対応優先順位まとめ

```
[即対応]
 1. config 読み込み失敗時の process.exit(1) 追加
 2. log_channel の null ガード追加
 3. dotenv をアンインストール
 4. start スクリプトの追加

[TypeScript 移行時に同時対応]
 5. tsconfig.json / eslint / prettier の設定
 6. Zod による設定バリデーション
 7. VerifierConfig 型定義・引数オブジェクト化
 8. verification.enable フラグを実際に参照
 9. guild_id を設定ファイルに追加

[移行後に対応]
10. MessageUpdate イベントへの対応
11. 既認証ユーザーの重複処理防止
12. テストの追加
```
