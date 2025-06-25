[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / VpcProps

# Interface: VpcProps

VPC 作成時のパラメータ

## Table of contents

### Properties

- [flowLogsRetentionDays](VpcProps.md#flowlogsretentiondays)
- [privateSubnetCidr](VpcProps.md#privatesubnetcidr)
- [publicSubnetCidr](VpcProps.md#publicsubnetcidr)
- [vpcEndpoints](VpcProps.md#vpcendpoints)
- [vpcIpAddresses](VpcProps.md#vpcipaddresses)

## Properties

### flowLogsRetentionDays

• `Optional` **flowLogsRetentionDays**: `RetentionDays`

VPC Flow Logs の保持期間 <br>
See: [aws-cdk-lib.aws_logs.RetentionDays](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_logs.RetentionDays.html)

**`Default Value`**

6 ヶ月 RetentionDays.SIX_MONTHS

#### Defined in

bleafsi-vpc.ts:35

---

### privateSubnetCidr

• `Optional` **privateSubnetCidr**: `number`

private subnet の CIDR

**`Default Value`**

24

#### Defined in

bleafsi-vpc.ts:43

---

### publicSubnetCidr

• `Optional` **publicSubnetCidr**: `number`

public subnet の CIDR

**`Default Value`**

24

#### Defined in

bleafsi-vpc.ts:51

---

### vpcEndpoints

• `Optional` **vpcEndpoints**: [`VpcEndpointTypeName`](../enums/VpcEndpointTypeName.md)[]

VPC 内に作成する VPC Endpoints を指定

#### Defined in

bleafsi-vpc.ts:27

---

### vpcIpAddresses

• `Optional` **vpcIpAddresses**: `string`

VPC に指定する IP アドレス範囲（CIDR 形式）<br>
最大 /16、最小 /28

**`Default Value`**

`10.0.0.0/16`

#### Defined in

bleafsi-vpc.ts:22
