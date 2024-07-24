import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';

/**
 * Cognito UserPoolの作成
 */
export class Cognito extends Construct {
  readonly userPool: cognito.UserPool;
  readonly lambdaFunc: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'userPool', {
      userPoolName: 'apiUserPool',
      selfSignUpEnabled: false,
      standardAttributes: {
        email: { required: true, mutable: true },
        phoneNumber: { required: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        otp: false,
        sms: true,
      },
    });

    // Create User Pool Client
    this.userPool.addClient('client', {
      userPoolClientName: 'apiUserPoolClient',
      generateSecret: false,
      authFlows: { adminUserPassword: true, userSrp: true, userPassword: true }, //cognitoIdp:adminInitiateAuth APIでユーザートークンを取得可能にする
    });

    // Create Hello world lambda function
    this.lambdaFunc = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'hello.handler',
    });
  }
}
