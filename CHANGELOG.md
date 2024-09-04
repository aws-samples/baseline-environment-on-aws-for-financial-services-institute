# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.4.0] - 2024-09-04

### Changed

- FSI Lens for FISC の更新
  - FISC 安全対策基準（第 12 版）対応
  - AWS Well-Architected Frameworkアップデート対応

## [1.3.0] - 2024-07-24

### Changed

- 勘定系ワークロード: マルチリージョン・デモアプリの強化
	- CloudWatch synthetics canaryによるAPI (Transaction service) の死活監視
	- Step Functionsによる自動フェールオーバー
	- OpenTelemetryの導入 (for X-Ray)
- 勘定系ワークロード: ランサムウェア対策の追加
	- ランサムウェア対策としてAWS Backup設定を追加
- CDKテンプレートのデプロイ回数トラッキング対応
	- CDKテンプレートのデプロイ回数をトラッキングするために、メトリックツール用の定義を各サンプルアプリに追加

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
