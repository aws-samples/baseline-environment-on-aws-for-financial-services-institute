import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  CfnUserPoolUser,
  FeaturePlan,
  OAuthScope,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  IUserPool,
} from 'aws-cdk-lib/aws-cognito';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { UserConfig } from 'lib/config';

export interface AuthProps {
  readonly users?: UserConfig[];
}

export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: AuthProps) {
    super(scope, id);

    // cdk.json から cognitoAdminEmail を取得
    const cognitoAdminEmail = this.node.tryGetContext('cognitoAdminEmail') ?? '';

    /**
     * Cognito ユーザープールを作成
     */
    const userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: false, // ユーザー自身によるサインアップを無効化

      // パスワードが満たすべき最低要件を定義
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },

      // サインイン時にメールアドレスを利用するためのエイリアスを設定
      signInAliases: {
        email: true,
      },

      // ユーザーに必要な標準属性を定義
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      removalPolicy: RemovalPolicy.DESTROY, // スタックの削除時にユーザープールも自動削除されるように設定 (実運用ではお勧めしません)

      featurePlan: FeaturePlan.PLUS,
    });
    NagSuppressions.addResourceSuppressions(userPool, [
      { id: 'AwsSolutions-COG3', reason: 'AdvancedSecurityMode is obsolete; enabling FeaturePlan.PLUS instead' },
    ]);

    // 管理者ユーザーを作成 (オプショナル)
    if (cognitoAdminEmail) {
      new CfnUserPoolUser(this, 'AdminUser', {
        userPoolId: userPool.userPoolId,
        username: cognitoAdminEmail,
        userAttributes: [
          {
            name: 'email',
            value: cognitoAdminEmail,
          },
        ],
      });
    }

    /**
     * Cognito ユーザープールクライアントを作成
     */
    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.COGNITO_ADMIN, OAuthScope.PROFILE],
      },
      // 認証時に渡されるアクセストークンやIDトークンの有効期限を設定します
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(1),
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
    });

    this.userPoolClient = userPoolClient;
    this.userPool = userPool;

    if (props?.users) {
      this.addUsers(userPool, props.users);
    }

    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }

  private addUsers(userPool: IUserPool, users: UserConfig[]) {
    users.forEach((user) => {
      new CfnUserPoolUser(this, `User-${user.alias}`, {
        userPoolId: userPool.userPoolId,
        username: user.email,
        userAttributes: [
          {
            name: 'email',
            value: user.email,
          },
        ],
      });
    });
  }
}
