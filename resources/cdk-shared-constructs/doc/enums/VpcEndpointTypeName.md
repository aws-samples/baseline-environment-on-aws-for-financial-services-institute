[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / VpcEndpointTypeName

# Enumeration: VpcEndpointTypeName

作成する VPC Endpoint の種類を指定

- S3_Gateway: Gateway タイプの S3 用 VPC Endpoints
- S3_Interface: Interface タイプの S3 用 VPC Endpoints
- DynamoDB: Interface タイプの DynamoDB 用 VPC Endpoints
- CWLogs: Interface タイプの CloudWatch Logs 用 VPC Endpoints
- ECR: Interface タイプの ECR 用 VPC Endpoints
- ECR_Docker: Interface タイプの ECR Docker 用 VPC Endpoints
- SecretsManager: Interface タイプの Secrets Manager 用 VPC Endpoints
- SSM: SSM 接続用の 4 つの Interface タイプ（SSM, SSM_MESSAGES, EC2, EC2_MESSAGES）の VPC Endpoints
- Glue: Interface タイプの Glue 用 VPC Endpoints
- KMS: Interface タイプの KMS 用 VPC Endpoints

## Table of contents

### Enumeration Members

- [CWLogs](VpcEndpointTypeName.md#cwlogs)
- [DynamoDB](VpcEndpointTypeName.md#dynamodb)
- [ECR](VpcEndpointTypeName.md#ecr)
- [ECR_Docker](VpcEndpointTypeName.md#ecr_docker)
- [Glue](VpcEndpointTypeName.md#glue)
- [KMS](VpcEndpointTypeName.md#kms)
- [S3_Gateway](VpcEndpointTypeName.md#s3_gateway)
- [S3_Interface](VpcEndpointTypeName.md#s3_interface)
- [SSM](VpcEndpointTypeName.md#ssm)
- [SecretsManager](VpcEndpointTypeName.md#secretsmanager)

## Enumeration Members

### CWLogs

• **CWLogs** = `"CWLogs"`

#### Defined in

bleafsi-vpc.ts:71

---

### DynamoDB

• **DynamoDB** = `"DynamoDB"`

#### Defined in

bleafsi-vpc.ts:70

---

### ECR

• **ECR** = `"ECR"`

#### Defined in

bleafsi-vpc.ts:72

---

### ECR_Docker

• **ECR_Docker** = `"ECR_Docker"`

#### Defined in

bleafsi-vpc.ts:73

---

### Glue

• **Glue** = `"Glue"`

#### Defined in

bleafsi-vpc.ts:76

---

### KMS

• **KMS** = `"KMS"`

#### Defined in

bleafsi-vpc.ts:77

---

### S3_Gateway

• **S3_Gateway** = `"S3_Gateway"`

#### Defined in

bleafsi-vpc.ts:68

---

### S3_Interface

• **S3_Interface** = `"S3_Interface"`

#### Defined in

bleafsi-vpc.ts:69

---

### SSM

• **SSM** = `"SSM"`

#### Defined in

bleafsi-vpc.ts:75

---

### SecretsManager

• **SecretsManager** = `"SecretsManager"`

#### Defined in

bleafsi-vpc.ts:74
