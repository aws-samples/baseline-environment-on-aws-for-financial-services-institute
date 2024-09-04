# 参照すべき AWS Well-Architected Framework 及び、AWS Well-Architected Framework FSI Lens for FISC

財団法人金融情報システムセンター（FISC）の求める各管理策に対する AWS の取り組みとお客様の責任範囲で実施する事項について、FISC 安全対策基準・解説書（第 11 版）に対する[リファレンス](https://aws.amazon.com/jp/compliance/fisc/)をまとめております。本一覧とあわせて、こちらもご参照ください。

注意: 本文書は情報提供のみを目的としています。本文書は、発行時点における AWS の製品と対応を説明するものであり、予告なく変更される場合があります。お客様は、本文書の情報および AWS 製品またはサービスの利用について、ご自身の評価に基づき判断する責任を負います。いずれの AWS 製品またはサービスも、明示また は黙示を問わずいかなる保証も伴うことなく、「現状のまま」提供されます。本文書のいかなる内容も、AWS とその関係会社、サプライヤー、またはライセンサーからの保証、表明、および契約上の責任、条件や確約を意味するものではありません。お客様に対する AWS の責任は AWS 契約によって規定されています。また、本文書は、 AWS とお客様との間のいかなる契約の一部も構成するものではなく、また、当該契約が本文書によって変更されることもありません。

| 基準番号 | 関連 WA / WA FSI Lens for FISC                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実 1     | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 2     | ー                                                                                                                                                                   |
| 実 3     | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
| 実 4     | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 5     | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [FISCSEC 1](./security.md#fiscsec1-アクセス許可をどのように設定管理していますか)                                                                                     |
| 実 6     | [FISCSEC 3](./security.md#fiscsec3-システムへ入力されるデータに対し不良データの混入や不正からの保護のためどのような対策を取っていますか)                             |
| 実 7     | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 8     | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 9     | [SEC 1](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/aws-account-management-and-separation.html)                                         |
|          | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 10    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [FISCSEC 2](./security.md#fiscsec2-システムの操作記録検証のためにどのような情報を収集していますか)                                                                   |
| 実 11    | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 12    | ー                                                                                                                                                                   |
| 実 13    | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [FISCSEC 8](./security.md#fiscsec8-暗号化キーをどのように管理していますか)                                                                                           |
| 実 14    | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 15    | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 16    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [OPS 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/utilizing-workload-observability.html)                                |
|          | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 17    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
| 実 18    | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 19    | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
|          | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 20    | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-compute.html)                                                            |
|          | [FISCSEC 1](./security.md#fiscsec1-アクセス許可をどのように設定管理していますか)                                                                                     |
|          | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
|          | [FISCSEC 9](./security.md#fiscsec9-マルウェアからどのようにシステムを守りますか)                                                                                     |
| 実 21    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [SEC 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-compute.html)                                                            |
| 実 22    | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
|          | [FISCSEC 9](./security.md#fiscsec9-マルウェアからどのようにシステムを守りますか)                                                                                     |
| 実 23    | ー                                                                                                                                                                   |
| 実 24    | ー                                                                                                                                                                   |
| 実 25    | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
| 実 26    | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 27    | [FISCSEC 1](./security.md#fiscsec1-アクセス許可をどのように設定管理していますか)                                                                                     |
| 実 28    | ー                                                                                                                                                                   |
| 実 29    | ー                                                                                                                                                                   |
| 実 30    | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [FISCSEC 8](./security.md#fiscsec8-暗号化キーをどのように管理していますか)                                                                                           |
| 実 31    | [OPS 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/learn-share-and-improve.html)                                        |
| 実 32    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [SEC 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-compute.html)                                                            |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
|          | [FISCSEC 9](./security.md#fiscsec9-マルウェアからどのようにシステムを守りますか)                                                                                     |
| 実 33    | ー                                                                                                                                                                   |
| 実 34    | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-compute.html)                                                            |
| 実 35    | [FISCSEC 5](./security.md#fiscsec5-どのようにアイデンティティを保護しシステムの不正使用を防ぎますか)                                                                 |
| 実 36    | ー                                                                                                                                                                   |
| 実 37    | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
| 実 38    | [FISCOPS 1](./operational_excellence.md#fiscops1-どのようにワークロードの変更を管理しますか)                                                                         |
| 実 39    | [REL 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/back-up-data.html)                                                               |
|          | [FISCOPS 3](./operational_excellence.md#fiscops3-ワークロードのバックアップをどのように取得しますか)                                                                 |
| 実 40    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
|          | [FISCOPS 1](./operational_excellence.md#fiscops1-どのようにワークロードの変更を管理しますか)                                                                         |
| 実 41    | [FISCOPS 3](./operational_excellence.md#fiscops3-ワークロードのバックアップをどのように取得しますか)                                                                 |
| 実 42    | [FISCOPS 1](./operational_excellence.md#fiscops1-どのようにワークロードの変更を管理しますか)                                                                         |
|          | [REL 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/implement-change.html)                                                           |
|          | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
| 実 43    | [FISCOPS 3](./operational_excellence.md#fiscops3-ワークロードのバックアップをどのように取得しますか)                                                                 |
|          | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [REL 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/back-up-data.html)                                                               |
| 実 44    | [FISCOPS 4](./operational_excellence.md#fiscops4-重要なドキュメントをどのように管理しますか)                                                                         |
| 実 45    | [FISCOPS 4](./operational_excellence.md#fiscops4-重要なドキュメントをどのように管理しますか)                                                                         |
| 実 46    | [FISCOPS 2](./operational_excellence.md#fiscops2-どのようにワークロードの障害を迅速に検知しますか)                                                                   |
|          | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [OPS 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/utilizing-workload-observability.html)                                |
|          | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
| 実 47    | [REL 1](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/manage-service-quotas-and-constraints.html)                                      |
|          | [PERF 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/performance-efficiency-pillar/process-and-culture.html)                                            |
| 実 48    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
| 実 49    | ー                                                                                                                                                                   |
| 実 50    | ー                                                                                                                                                                   |
| 実 51    | ー                                                                                                                                                                   |
| 実 52    | ー                                                                                                                                                                   |
| 実 53    | ー                                                                                                                                                                   |
| 実 54    | ー                                                                                                                                                                   |
| 実 55    | ー                                                                                                                                                                   |
| 実 56    | ー                                                                                                                                                                   |
| 実 57    | ー                                                                                                                                                                   |
| 実 58    | ー                                                                                                                                                                   |
| 実 59    | ー                                                                                                                                                                   |
| 実 60    | ー                                                                                                                                                                   |
| 実 61    | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [FISCSEC 1](./security.md#fiscsec1-アクセス許可をどのように設定管理していますか)                                                                                     |
| 実 62    | ー                                                                                                                                                                   |
| 実 63    | [FISCSEC 2](./security.md#fiscsec2-システムの操作記録検証のためにどのような情報を収集していますか)                                                                   |
| 実 64    | ー                                                                                                                                                                   |
| 実 65    | [FISCSEC 3](./security.md#fiscsec3-システムへ入力されるデータに対し不良データの混入や不正からの保護のためどのような対策を取っていますか)                             |
| 実 66    | ー                                                                                                                                                                   |
| 実 67    | ー                                                                                                                                                                   |
| 実 68    | ー                                                                                                                                                                   |
| 実 69    | [FISCSEC 4](./security.md#fiscsec4-顧客データを保護し適正に利用するためどのようにデータを分類管理していますか)                                                       |
| 実 70    | [OPS 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/responding-to-events.html)                                           |
| 実 71    | [OPS 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/responding-to-events.html)                                           |
|          | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [REL 12](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/test-reliability.html)                                                          |
| 実 72    | [OPS 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/utilizing-workload-observability.html)                                |
|          | [OPS 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/understanding-operational-health.html)                                |
|          | [OPS 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/learn-share-and-improve.html)                                        |
|          | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
| 実 73    | [FISCREL 1](./reliability.md#fiscrel1-災害時におけるワークロードの復旧要件をどのように決定しますか)                                                                  |
|          | [REL 13](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)                                             |
| 実 74    | [FISCREL 1](./reliability.md#fiscrel1-災害時におけるワークロードの復旧要件をどのように決定しますか)                                                                  |
|          | [REL 13](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)                                             |
| 実 75    | [REL 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/implement-change.html)                                                           |
| 実 76    | [FISCREL 2](./reliability.md#fiscrel2-本番システムの安全性を確保するためにソフトウェア開発ライフサイクルsdlc-環境-開発テスト本稼働-間の分離をどのように保証しますか) |
|          | [SEC 1](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/operating-your-workload-securely.html)                                              |
| 実 77    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
|          | [OPS 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/mitigate-deployment-risks.html)                                       |
| 実 78    | [REL 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/implement-change.html)                                                           |
| 実 79    | [OPS 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/responding-to-events.html)                                           |
| 実 80    | ー                                                                                                                                                                   |
| 実 81    | ー                                                                                                                                                                   |
| 実 82    | [FISCSEC 8](./security.md#fiscsec8-暗号化キーをどのように管理していますか)                                                                                           |
| 実 83    | ー                                                                                                                                                                   |
| 実 84    | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 85    | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 86    | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 87    | [REL 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/plan-your-network-topology.html)                                                 |
|          | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
| 実 88    | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
| 実 89    | [SEC 全般](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/security.html)                                                                   |
| 実 90    | [SEC 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/framework/sec-11.html)                                                                             |
| 実 91    | [SEC 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/framework/sec-11.html)                                                                             |
| 実 92    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
|          | [OPS 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/mitigate-deployment-risks.html)                                       |
| 実 93    | [OPS 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/mitigate-deployment-risks.html)                                       |
| 実 94    | [SEC 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/framework/sec-11.html)                                                                             |
| 実 95    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
|          | [OPS 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/mitigate-deployment-risks.html)                                       |
| 実 96    | [OPS 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/design-for-operations.html)                                           |
|          | [OPS 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/mitigate-deployment-risks.html)                                       |
|          | [FISCOPS 1](./operational_excellence.md#fiscops1-どのようにワークロードの変更を管理しますか)                                                                         |
| 実 97    | ー                                                                                                                                                                   |
| 実 98    | ー                                                                                                                                                                   |
| 実 99    | [OPS 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/operational-readiness.html)                                           |
|          | [OPS 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/responding-to-events.html)                                           |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 100   | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-compute.html)                                                            |
| 実 101   | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [REL 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-adapt-to-changes-in-demand.html)                         |
| 実 102   | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [REL 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-adapt-to-changes-in-demand.html)                         |
|          | [OPS 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/implement-observability.html)                                         |
|          | [OPS 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/operational-excellence-pillar/utilizing-workload-observability.html)                                |
| 実 103   | [REL 6](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/monitor-workload-resources.html)                                                 |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 103-1 | [REL 12](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/test-reliability.html)                                                          |
| 実 104   | [FISCREL 3](./reliability.md#fiscrel3-コンポーネントの障害が発生した際にワークロードを保護またはリカバリするにはどうすればよいですか)                                |
|          | [REL 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html)                              |
|          | [REL 11](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html)                      |
| 実 105   | ー                                                                                                                                                                   |
| 実 106   | [FISCREL 3](./reliability.md#fiscrel3-コンポーネントの障害が発生した際にワークロードを保護またはリカバリするにはどうすればよいですか)                                |
|          | [REL 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reliability-pillar/back-up-data.html)                                                               |
| 実 107   | ー                                                                                                                                                                   |
| 実 108   | ー                                                                                                                                                                   |
| 実 109   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 110   | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 111   | ー                                                                                                                                                                   |
| 実 112   | [FISCSEC 6](./security.md#fiscsec6-どのようにサービスの不正利用の対策を行いますか)                                                                                   |
|          | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
| 実 113   | [FISCSEC 7](./security.md#fiscsec7-どのようにセキュリティインシデントの対策を行いますか)                                                                             |
| 実 114   | ー                                                                                                                                                                   |
| 実 115   | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 116   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 4](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/detection.html)                                                                     |
|          | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 117   | ー                                                                                                                                                                   |
| 実 118   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 119   | ー                                                                                                                                                                   |
| 実 120   | ー                                                                                                                                                                   |
| 実 121   | ー                                                                                                                                                                   |
| 実 122   | ー                                                                                                                                                                   |
| 実 123   | ー                                                                                                                                                                   |
| 実 124   | ー                                                                                                                                                                   |
| 実 125   | ー                                                                                                                                                                   |
| 実 126   | ー                                                                                                                                                                   |
| 実 127   | ー                                                                                                                                                                   |
| 実 128   | ー                                                                                                                                                                   |
| 実 129   | ー                                                                                                                                                                   |
| 実 130   | ー                                                                                                                                                                   |
| 実 131   | ー                                                                                                                                                                   |
| 実 132   | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 133   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 134   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
| 実 135   | ー                                                                                                                                                                   |
| 実 136   | ー                                                                                                                                                                   |
| 実 137   | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 138   | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
|          | [FISCSEC 10](./security.md#fiscsec10-どのように電子メールを安全に運用しますか)                                                                                       |
| 実 139   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 10](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/preparation.html)                                                                  |
| 実 140   | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 141   | [SEC 5](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-networks.html)                                                           |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 142   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
|          | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
| 実 143   | ー                                                                                                                                                                   |
| 実 144   | ー                                                                                                                                                                   |
| 実 145   | ー                                                                                                                                                                   |
| 実 146   | [SEC 2](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/identity-management.html)                                                           |
|          | [SEC 3](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/permissions-management.html)                                                        |
| 実 147   | [SEC 7](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/data-classification.html)                                                           |
|          | [SEC 8](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)                                                       |
|          | [SEC 9](https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/security-pillar/protecting-data-in-transit.html)                                                    |
| 実 148   | ー                                                                                                                                                                   |
