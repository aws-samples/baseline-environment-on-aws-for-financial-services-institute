# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.5.1] - 2025-06-25

### Changed
- 顧客チャネルワークロードの更新
  - Amazon Q in Connect によるエージェント支援に対応
  - 通話内容をリアルタイムに文字起こしして表示し、コンプライアンスチェックや要約を表示できるコールモニタリングのサンプルを追加
  - インバウンドの業務を想定したサンプルとして、エージェントに直接接続できるコンタクトフローを追加
  - 金融機関を模したサンプルのウェブサイトの画面を追加
  - Amazon Connect Customer Profiles と Amazon Connect Cases の自動有効化対応
  - コンタクトフローログの有効化を含めた、その他の軽微な修正を実施
- OpenAPI FAPIワークロードの更新
  - バージョンアップ対応のためデプロイ手順が工事中の旨を記載
- メインフレーム連携ワークロードの更新
  - ドキュメントの軽微な修正を実施

## [1.5.0] - 2024-11-10

### Added

- 新ワークロード メインフレーム連携を提供
- 新ワークロード ハイブリッドを提供

## [1.4.0] - 2024-09-04

### Changed

- FSI Lens for FISC の更新
  - FISC 安全対策基準（第 12 版）対応
  - AWS Well-Architected Framework アップデート対応

## [1.3.0] - 2024-07-24

### Changed

- 勘定系ワークロード: マルチリージョン・デモアプリの強化
  - CloudWatch synthetics canary による API (Transaction service) の死活監視
  - Step Functions による自動フェールオーバー
  - OpenTelemetry の導入 (for X-Ray)
- 勘定系ワークロード: ランサムウェア対策の追加
  - ランサムウェア対策として AWS Backup 設定を追加
- CDK テンプレートのデプロイ回数トラッキング対応
  - CDK テンプレートのデプロイ回数をトラッキングするために、メトリックツール用の定義を各サンプルアプリに追加

## [1.2.0] - 2023-12-15

### Changed

- FISC 安全対策基準（第 11 版）対応
  - 各ワークロードの「 FISC 安全対策基準 実務基準の対策 」の更新
  - FSI Lens for FISC の更新

## [1.1.0] - 2023-7-6

### Added

- 新ワークロード データ分析プラットフォーム Simple data lake を提供
- 勘定系ワークロード レジリエンス対応サンプルアプリケーションを提供
- 金融リファレンスアーキテクチャ日本版 体験型ワークショップの提供

### Changed

- Control Tower 新機能への対応
- ガバナンスベースおよび金融ワークロードでの CDK コードのリファクタリング

## [1.0.2] - 2022-10-19

### Changed

- ガバナンスベース base-ct-logging プロジェクトの cdk.json から `securityNotifyEmail`パラメータを削除

## [1.0.1] - 2022-10-05

### Changed

- オープン API サンプルアプリケーションの名称修正
- オープン API サンプルアプリケーションの CDK デプロイメント手順の修正

## [1.0.0] - 2022-10-03

### Added

- リリース初期バージョン
