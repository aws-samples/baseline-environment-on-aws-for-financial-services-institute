# Git 規約

## ブランチ名

ブランチ名は以下の形式に従います：

```
[カテゴリ名]/[グループ名]/[issue番号 または 変更の説明]
```

### カテゴリ名

- `feature`: CDK コードの追加開発
- `fix`: CDK コードのバグ修正、コードのリファクタリング
- `docs`: ドキュメント修正
- `build`: npm モジュールの更新、package.json/package-lock.json の更新、構成ファイルの変更、CI エラーの対応
- `chore`: ビルドプロセスやツールの変更、依存関係の更新、その他の雑務

### グループ名

- `all`: 全体に影響する変更
- `governance-base`
- `core-banking`
- `customer-channel`
- `open-api`
- `market-data`
- `analytics`
- `fsi-lens`
- `mf-integration`
- `cyber-resilience`
- `modern-app`
- `genai`
- `fsi-case-study`
- `shared-constructs`

### 命名規則

- アルファベットと記号のみ使用
- セパレータとしてスラッシュ（/）を使用
- 変更の説明はハイフン（-）で区切る
- 説明は英語で記述

### 例

```
feature/governance-base/landing-zone-v3
feature/all/update-npm-modules
fix/core-banking/#53
docs/governance-base/update-readme
```

## コミットメッセージ

コミットメッセージは Semantic Commit Messages の形式に従います：

```
[type]([scope]): [説明]
```

### Type

- `feat`: 機能追加
- `fix`: バグ修正、コードのリファクタリング
- `docs`: ドキュメントのみ変更
- `build`: npm モジュールの更新、package.json/package-lock.json の更新、CI 構成ファイルの変更
- `chore`: ビルドプロセスやツールの変更、依存関係の更新、その他の雑務

### Scope

ブランチ名の「グループ名」と同じ値を使用します。

### 説明

- 日本語または英語で記述
- 変更内容を簡潔に記述

### 例

```
docs(governance-base): READMEを更新
fix(open-api): cdk-nag suppressionを更新
feat(core-banking): マルチリージョン対応を追加
build(all): CDK v2.150.0にアップデート
```

## Git コマンド実行時の設定

### ページャーの無効化

Git コマンドを実行する際は、ページャーを無効化してください。これにより、出力が直接表示され、インタラクティブなページャーによる待機状態を回避できます。

**方法:**

```bash
# 個別のコマンドで無効化（推奨）
git --no-pager <command>
```

**例:**

```bash
# ページャーなしでログを表示
git --no-pager log

# ページャーなしで差分を表示
git --no-pager diff

# ページャーなしでブランチ一覧を表示
git --no-pager branch

# ページャーなしでステータスを表示
git --no-pager status
```

**理由:**

- 自動化スクリプトや CI 環境での実行時に、ページャーが起動すると処理が停止する
- 出力を直接確認できるため、デバッグやログ確認が容易になる
