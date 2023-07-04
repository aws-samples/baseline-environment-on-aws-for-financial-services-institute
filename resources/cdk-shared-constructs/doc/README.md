BLEA for FSI 共通 L3 コンストラクト サンプル集 / [Exports](modules.md)

CDK による開発生産性の向上と、セキュリティや組織のルールをカプセル化するために使用される`カスタムコンストラクタ`のサンプルです。

下記のコンストラクタを提供します。

| コンストラクトの種類 | コンストラクト名                      | 説明                                           |     |
| -------------------- | ------------------------------------- | ---------------------------------------------- | --- |
| S3                   | [Bucket](./classes/Bucket.md)         | S3 バケットを作成                              |     |
| KMS                  | [KmsKey](./classes/KmsKey.md)         | KMS キーを作成                                 |     |
| VPC                  | [PrivateVpc](./classes/PrivateVpc.md) | Private Subnet のみを持つ VPC を作成           |     |
|                      | [PublicVpc](./classes/PublicVpc.md)   | Public および Private Subnet を持つ VPC を作成 |     |
| IAM Role             | [IamRole](./classes/IamRole.md)       | ポリシーを指定して IAM Role を作成             |     |
| ECR                  | [Ecr](./classes/Ecr.md)               | ECR リポジトリ を作成する                      |     |
| WAF                  | [Waf](./classes/Waf.md)               | WAF Web ACL を作成する                         |     |
