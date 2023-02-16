# AWS Control Tower Landing Zone ver3.0 のアップデートに関する注意事項

AWS Control Tower Landing Zone の v3.0 へのバージョンアップに伴い、usecases/base-ct-guest のデプロイ前に、ご自身の環境に合わせて base-ct-guest のソースコードを修正していただく場合があります。

## アップデートによる BLEA への影響

AWS Control Tower Landing Zone ver.3.0 より、CloudTrail の設定を有効化した場合の CloudTrail のログは、管理アカウント の AWS CloudWatch Logs に集約されるようになりました。

- ご参考：https://docs.aws.amazon.com/controltower/latest/userguide/2022-all.html#version-3.0

その結果、これまでゲストアカウント上に存在していた CloudTrail のログが出力される CloudWatch Logs の ロググループが新たに作成されなくなり、base-ct-guest でデプロイされていた AWS CloudTrail のログを監視する通知がデプロイできなくなりました。

## BLEA for FSI の対応方針

BLEA for FSI では、ベースとなった BLEA と同様にゲストアカウントのログ監視はゲストアカウントの管理者が実施すべきと考えるため、これまで AWS Control Tower Landing Zone がアカウントのプロビジョニング時に作成していた AWS CloudTrail 証跡と AWS CloudWatch Logs のリソースを CDK テンプレートによるガバナンスベースのセットアップ時に生成するように修正しました。この対応によりゲストアカウントでの CloudTrail 証跡が二重に取得される（Control Tower がセットアップする組織レベルの証跡と BLEA for FSI によりセットアップされるゲストアカウント内での証跡）ことに注意して下さい。

ただし、適用する Control Tower Landing Zone のバージョンが 3.0 より前であった場合や、3.0 以降へのアップデート時に ランディングゾーン設定の AWS CloudTrail 設定で、「組織レベルのログ記録」を有効にしない場合は、デフォルトの状態では CDK スタック（usecase/base-ct-guest/lib/bleafsi-base-ct-guest-stack.ts）により不要な CloudTrail 証跡ログが作成されてしまうため、ご自身の環境に合わせてソースコードを一部修正することを推奨します。

## ソースコードの修正方法

以下のフローチャートに従い、ご自身の環境に適した`usecase/base-ct-guest/lib/bleafsi-base-ct-guest-stack.ts`のソースコードの修正方針を確認してください。

図中の略語は以下の通りです。

- CT: Control Tower
- LZ: Landing Zone
- CTrail: CloudTrail

```mermaid
flowchart TD
A[START] --> B{CT LZを<br>v3.0より前から<br>利用している}
B -->|YES| C{LZのバージョンを3.0<br>に更新してCTrailの[組織レベルのログ記録」設定を<br>有効化する}
C -->|NO| D[ケース2: 修正要]
C -->|YES| E[ケース2: 修正不要]
B -->|NO| E
```

### ケース 1: 修正要 ゲストアカウント上で新規のリソースを作成しない

バージョン 3.0 より前の AWS Control Tower landing zone が作成したリソースを利用するため、ゲストアカウント上に新規の CloudTrail 証跡と CloudWatch Logs ロググループ を作成しないように`bleafsi-base-ct-guest-stack.ts`を修正して下さい。

[修正手順]  
`bleafsi-base-ct-guest-stack.ts`の 7 行目の import 文と、46, 47 行目にあるコードをコメントアウトして、37 行目のコードのコメントを外してください。

```js
//import { CloudTrail } from './cloudtrail-trail';
```

[7 行目]

```js
// ----- block2 ----
//const cloudTrail = new CloudTrail(this, `CloudTrail`, props.env);
//const cloudTrailLogGroupName = cloudTrail.cloudTrailLogGroup.logGroupName;
// -----------------
```

[46,47 行目]

```js
// ----- block1 ----
const cloudTrailLogGroupName = 'aws-controltower/CloudTrailLogs';
// ----------------
```

[37 行目]

### ケース 2: 修正不要 ゲストアカウント上に新規でリソースを作成する

`blea-base-ct-guest-stack.ts`の修正は不要です。cloudtrail-trail.ts によりゲストアカウント上に CloudTrail 証跡と CloudWatch Logs ロググループ が作成されます。

## 備考

- AWS Control Tower Landing Zone の ver.3.0 において、一度でも AWS CloudTrail の「組織レベルのログ記録」設定を無効化すると、過去に生成されていた AWS CloudTrail と AWS CloudWatch Logs のリソースは削除されます。
