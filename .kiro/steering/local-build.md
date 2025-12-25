# ローカルビルド手順

## 概要

このドキュメントは、リポジトリをローカル環境でビルドおよびテストする手順を説明します。基本的に CI で実行されている手順と同じ方法でビルドします。

## 前提条件

- Node.js がインストールされていること（バージョン 20 以上）
- npm がインストールされていること（バージョン 11 以上）

## ビルド手順

### 1. パッケージのインストール

```bash
npm ci
```

`npm ci` は `package-lock.json` に基づいてクリーンインストールを実行します。

### 2. リント（オプション）

コードスタイルをチェックします：

```bash
npm run lint:ci
```

自動修正を行う場合：

```bash
npm run lint
```

### 3. フォーマット（オプション）

コードフォーマットをチェックします：

```bash
npm run format:ci
```

自動フォーマットを行う場合：

```bash
npm run format
```

### 4. ビルド

全ワークスペースをビルドします：

```bash
npm run build --workspaces
```

### 5. テスト

全ワークスペースのテストを実行します：

```bash
npm run test --workspaces
```

#### スナップショットテストの更新

スナップショットテストが失敗することが最初から分かっている場合（意図的な変更の場合）は、スナップショットを更新します：

```bash
npm run test --workspaces -- -u
```

## ワークスペース単位でのビルド・テスト

特定のワークスペースのみをビルド・テストすることも可能です：

```bash
# 特定のワークスペースに移動
cd usecases/base-ct-guest

# ビルド
npm run build

# テスト
npm run test

# スナップショット更新
npm run test -- -u
```

## コミット前の注意事項

**重要:** CI では全ワークスペースのビルドとテストが実行されるため、コミット前に必ず以下を実行してください：

```bash
npm run build --workspaces
npm run test --workspaces
```

これにより、CI で発生する可能性のあるエラーを事前に検出できます。

## メモリ不足エラーが発生する場合

大規模なプロジェクトでメモリ不足エラーが発生する場合は、Node.js のメモリ制限を増やします：

```bash
export NODE_OPTIONS=--max_old_space_size=12288
```

また、Jest の並列実行数を制限することもできます：

```bash
npm run test --workspaces -- --maxWorkers=2
```

## トラブルシューティング

### ビルドエラーが発生する場合

1. `node_modules` を削除して再インストール：

```bash
rm -rf node_modules
npm ci
```

2. ワークスペースの `node_modules` も削除：

```bash
rm -rf usecases/*/node_modules
npm ci
```

### テストエラーが発生する場合

1. 特定のワークスペースのみをテストして問題を特定
2. スナップショットの更新が必要かどうかを確認
3. AWS 認証情報が設定されていないことを確認（CI では無効化されている）
